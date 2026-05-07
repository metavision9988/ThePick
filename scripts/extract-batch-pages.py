#!/usr/bin/env python3
# extract-batch-pages.py — BATCH 적재 추출 v2 (handoff-039 §5.4 + handoff-040 §8.3 7가지 묶음)
#
# 7가지 의무:
#   (1) 페이지 + 챕터/절 자동 인식  (raw 텍스트 첫 30 lines 정규식)
#   (2) 표 row + column 셀 합침      (pdfplumber extract_tables() + cell merge 감지)
#   (3) Nested table 인식           (page.find_tables() 모두 추출)
#   (4) 페이지 경계 forward-fill     (last_chapter/last_section state-machine)
#   (5) 분수 처리                   (regex \d+/\d+)
#   (6) 페이지 표기 정합화           (book_page = pdf_page + offset, 둘 다 영속)
#   (7) Claude multimodal fallback   (page.images PNG 영속)
#
# Usage:
#   python3 scripts/extract-batch-pages.py \
#     --pdf "docs/manual/<교재.pdf>" \
#     --pdf-pages 403-434 \
#     --book-offset -7 \
#     --output-dir docs/batch-load/batch-1-v2 \
#     --batch-id batch-1

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pdfplumber

PDFPLUMBER_VERSION = pdfplumber.__version__

CHAPTER_PATTERN = re.compile(r"^제\s*(\d+)\s*장\s+(.+?)\s*$")
SECTION_PATTERN = re.compile(r"^제\s*(\d+)\s*절\s+(.+?)\s*$")
FRACTION_PATTERN = re.compile(r"(?<![\d.])(\d{1,3})/(\d{1,3})(?![\d.])")


@dataclass
class ImageMeta:
    idx: int
    bbox: tuple[float, float, float, float]
    width: int
    height: int
    png_path: str


@dataclass
class TableMeta:
    table_idx: int
    rows: list[list[str | None]]
    cell_merge_detected: bool
    bbox: tuple[float, float, float, float] | None


@dataclass
class PageRecord:
    book_page: int
    pdf_page: int
    chapter: str | None
    section: str | None
    chapter_source: str  # "detected" | "forward_fill" | "missing"
    section_source: str
    text: str
    text_lines: int
    tables: list[TableMeta] = field(default_factory=list)
    images: list[ImageMeta] = field(default_factory=list)
    fractions: list[str] = field(default_factory=list)


def parse_pdf_pages(spec: str) -> tuple[int, int]:
    if "-" not in spec:
        raise ValueError(f"--pdf-pages must be 'start-end' (got: {spec})")
    start_str, end_str = spec.split("-", 1)
    start, end = int(start_str), int(end_str)
    if start <= 0 or end < start:
        raise ValueError(f"--pdf-pages range invalid: {spec}")
    return start, end


def detect_chapter_section(text_lines: list[str]) -> tuple[str | None, str | None]:
    chapter: str | None = None
    section: str | None = None
    for raw_line in text_lines[:30]:
        line = raw_line.strip()
        if not line:
            continue
        ch_match = CHAPTER_PATTERN.match(line)
        if ch_match and chapter is None:
            chapter = f"제{ch_match.group(1)}장 {ch_match.group(2).strip()}"
            continue
        sec_match = SECTION_PATTERN.match(line)
        if sec_match and section is None:
            section = f"제{sec_match.group(1)}절 {sec_match.group(2).strip()}"
    return chapter, section


def detect_cell_merge(rows: list[list[str | None]]) -> bool:
    if not rows:
        return False
    for row in rows:
        # pdfplumber convention: empty cell = None or "" → likely merged with neighbor
        empty_count = sum(1 for c in row if c is None or (isinstance(c, str) and not c.strip()))
        if empty_count >= 1 and len(row) >= 2:
            return True
    return False


def extract_fractions(text: str) -> list[str]:
    seen: list[str] = []
    for match in FRACTION_PATTERN.finditer(text):
        frac = f"{match.group(1)}/{match.group(2)}"
        if frac not in seen:
            seen.append(frac)
    return seen


def extract_image(
    page: pdfplumber.page.Page,
    img: dict[str, Any],
    img_idx: int,
    output_dir: Path,
    book_page: int,
) -> ImageMeta | None:
    bbox = (
        float(img.get("x0", 0)),
        float(img.get("top", 0)),
        float(img.get("x1", 0)),
        float(img.get("bottom", 0)),
    )
    width = int(round(bbox[2] - bbox[0]))
    height = int(round(bbox[3] - bbox[1]))
    if width <= 0 or height <= 0:
        return None

    # Clamp bbox to page mediabox — pdfplumber raises if image bbox slightly
    # exceeds page bounds (rounding / pdf MediaBox vs CropBox mismatch).
    page_x0, page_top, page_x1, page_bottom = (
        float(page.bbox[0]),
        float(page.bbox[1]),
        float(page.bbox[2]),
        float(page.bbox[3]),
    )
    clamped_bbox = (
        max(bbox[0], page_x0),
        max(bbox[1], page_top),
        min(bbox[2], page_x1),
        min(bbox[3], page_bottom),
    )
    if clamped_bbox[2] <= clamped_bbox[0] or clamped_bbox[3] <= clamped_bbox[1]:
        return None

    images_dir = output_dir / "images"
    images_dir.mkdir(parents=True, exist_ok=True)
    png_filename = f"p{book_page:03d}-im{img_idx:02d}.png"
    png_path = images_dir / png_filename

    try:
        cropped = page.within_bbox(clamped_bbox)
        page_image = cropped.to_image(resolution=200)
        page_image.save(str(png_path))
    except (ValueError, OSError) as exc:
        print(
            f"[warn] image extraction failed (book_page={book_page}, idx={img_idx}): {exc}",
            file=sys.stderr,
        )
        return None

    return ImageMeta(
        idx=img_idx,
        bbox=bbox,
        width=width,
        height=height,
        png_path=str(png_path.relative_to(output_dir)),
    )


def extract_pdf_page(
    page: pdfplumber.page.Page,
    pdf_page_num: int,
    book_page: int,
    output_dir: Path,
    last_chapter: str | None,
    last_section: str | None,
) -> PageRecord:
    text = page.extract_text() or ""
    text_lines = text.splitlines()
    chapter_detected, section_detected = detect_chapter_section(text_lines)

    chapter_source = "missing"
    section_source = "missing"
    chapter = chapter_detected
    section = section_detected
    if chapter is not None:
        chapter_source = "detected"
    elif last_chapter is not None:
        chapter = last_chapter
        chapter_source = "forward_fill"
    if section is not None:
        section_source = "detected"
    elif last_section is not None:
        section = last_section
        section_source = "forward_fill"

    raw_tables = page.find_tables()
    tables: list[TableMeta] = []
    for tbl_idx, tbl in enumerate(raw_tables):
        rows: list[list[str | None]] = tbl.extract() or []
        tables.append(
            TableMeta(
                table_idx=tbl_idx,
                rows=rows,
                cell_merge_detected=detect_cell_merge(rows),
                bbox=tuple(tbl.bbox) if tbl.bbox else None,  # type: ignore[arg-type]
            )
        )

    images: list[ImageMeta] = []
    for img_idx, img in enumerate(page.images):
        meta = extract_image(page, img, img_idx, output_dir, book_page)
        if meta is not None:
            images.append(meta)

    return PageRecord(
        book_page=book_page,
        pdf_page=pdf_page_num,
        chapter=chapter,
        section=section,
        chapter_source=chapter_source,
        section_source=section_source,
        text=text,
        text_lines=len(text_lines),
        tables=tables,
        images=images,
        fractions=extract_fractions(text),
    )


def page_record_to_dict(record: PageRecord) -> dict[str, Any]:
    payload = asdict(record)
    payload["tables"] = [
        {
            "table_idx": t.table_idx,
            "rows": t.rows,
            "cell_merge_detected": t.cell_merge_detected,
            "bbox": list(t.bbox) if t.bbox else None,
        }
        for t in record.tables
    ]
    payload["images"] = [
        {
            "idx": i.idx,
            "bbox": list(i.bbox),
            "width": i.width,
            "height": i.height,
            "png_path": i.png_path,
        }
        for i in record.images
    ]
    return payload


def run(args: argparse.Namespace) -> int:
    pdf_path = Path(args.pdf).resolve()
    if not pdf_path.is_file():
        print(f"[error] pdf not found: {pdf_path}", file=sys.stderr)
        return 1

    pdf_start, pdf_end = parse_pdf_pages(args.pdf_pages)
    book_offset = int(args.book_offset)
    output_dir = Path(args.output_dir).resolve()
    pages_dir = output_dir / "pages"
    output_dir.mkdir(parents=True, exist_ok=True)
    pages_dir.mkdir(parents=True, exist_ok=True)

    last_chapter: str | None = args.chapter_init
    last_section: str | None = args.section_init
    records: list[PageRecord] = []

    with pdfplumber.open(str(pdf_path)) as pdf:
        total_pages = len(pdf.pages)
        if pdf_end > total_pages:
            print(
                f"[error] --pdf-pages end={pdf_end} exceeds total pages={total_pages}",
                file=sys.stderr,
            )
            return 1

        for pdf_page_num in range(pdf_start, pdf_end + 1):
            page = pdf.pages[pdf_page_num - 1]
            book_page = pdf_page_num + book_offset
            record = extract_pdf_page(
                page=page,
                pdf_page_num=pdf_page_num,
                book_page=book_page,
                output_dir=output_dir,
                last_chapter=last_chapter,
                last_section=last_section,
            )
            last_chapter = record.chapter if record.chapter is not None else last_chapter
            last_section = record.section if record.section is not None else last_section
            records.append(record)

            page_json_path = pages_dir / f"p{book_page:03d}.json"
            page_json_path.write_text(
                json.dumps(page_record_to_dict(record), ensure_ascii=False, indent=2),
                encoding="utf-8",
            )

    summary = {
        "batch_id": args.batch_id,
        "pdf_source": str(pdf_path.relative_to(Path.cwd())) if pdf_path.is_relative_to(Path.cwd()) else str(pdf_path),
        "pdf_pages": [pdf_start, pdf_end],
        "book_pages": [pdf_start + book_offset, pdf_end + book_offset],
        "book_offset": book_offset,
        "page_count": len(records),
        "extraction_meta": {
            "tool": "pdfplumber",
            "version": PDFPLUMBER_VERSION,
            "extracted_at": datetime.now(timezone.utc).isoformat(),
            "script_version": "v2",
        },
        "stats": {
            "chapters_detected": sorted(
                {r.chapter for r in records if r.chapter_source == "detected"}
            ),
            "sections_detected": sorted(
                {r.section for r in records if r.section_source == "detected"}
            ),
            "pages_with_tables": sum(1 for r in records if r.tables),
            "pages_with_images": sum(1 for r in records if r.images),
            "pages_with_fractions": sum(1 for r in records if r.fractions),
            "total_tables": sum(len(r.tables) for r in records),
            "total_images": sum(len(r.images) for r in records),
            "total_fractions": sum(len(r.fractions) for r in records),
            "forward_filled_chapter": sum(
                1 for r in records if r.chapter_source == "forward_fill"
            ),
            "forward_filled_section": sum(
                1 for r in records if r.section_source == "forward_fill"
            ),
            "missing_chapter": sum(1 for r in records if r.chapter is None),
            "missing_section": sum(1 for r in records if r.section is None),
        },
        "pages": [page_record_to_dict(r) for r in records],
    }

    aggregate_path = output_dir / f"{args.batch_id}-extract.json"
    aggregate_path.write_text(
        json.dumps(summary, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(f"[ok] extracted {len(records)} pages → {aggregate_path}")
    print(
        f"     chapters={summary['stats']['chapters_detected']}\n"
        f"     sections detected={len(summary['stats']['sections_detected'])} "
        f"forward_fill_chapter={summary['stats']['forward_filled_chapter']} "
        f"forward_fill_section={summary['stats']['forward_filled_section']} "
        f"missing_chapter={summary['stats']['missing_chapter']} "
        f"missing_section={summary['stats']['missing_section']}\n"
        f"     tables={summary['stats']['total_tables']} "
        f"images={summary['stats']['total_images']} "
        f"fractions={summary['stats']['total_fractions']}"
    )
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="BATCH 추출 v2 — 7가지 묶음")
    parser.add_argument("--pdf", required=True, help="PDF 파일 경로")
    parser.add_argument(
        "--pdf-pages",
        required=True,
        help="PDF 페이지 범위 (1-indexed). 예: 403-434",
    )
    parser.add_argument(
        "--book-offset",
        required=True,
        help="book_page = pdf_page + offset. 손해평가사 교재 기준 -7",
    )
    parser.add_argument(
        "--output-dir",
        required=True,
        help="출력 디렉토리. 예: docs/batch-load/batch-1-v2",
    )
    parser.add_argument(
        "--batch-id",
        required=True,
        help="BATCH ID. 예: batch-1",
    )
    parser.add_argument(
        "--chapter-init",
        default=None,
        help="첫 페이지 chapter forward-fill 시드값 (BATCH 영역 외부 cross-check 결과 주입).",
    )
    parser.add_argument(
        "--section-init",
        default=None,
        help="첫 페이지 section forward-fill 시드값. detect 우선, 미발견 시 본 값 사용.",
    )
    args = parser.parse_args()
    return run(args)


if __name__ == "__main__":
    sys.exit(main())
