#!/usr/bin/env python3
"""
ThePick PDF Text Extractor (M01)

Extracts text and tables from PDF files using pdfplumber.
Outputs JSON to stdout for consumption by TypeScript wrapper.

Usage:
    python extract_pdf.py <pdf_path> [--pages 1-10]
"""

import json
import sys
import argparse
from pathlib import Path

import pdfplumber


def extract_table_cells(table):
    """Convert pdfplumber table to list of lists, replacing None with empty string."""
    return [
        [cell if cell is not None else "" for cell in row]
        for row in table
    ]


def extract_page(page, page_number):
    """Extract text and tables from a single page."""
    text = page.extract_text() or ""
    raw_tables = page.extract_tables() or []
    tables = [extract_table_cells(t) for t in raw_tables]

    return {
        "page": page_number,
        "text": text,
        "tables": tables,
    }


def main():
    parser = argparse.ArgumentParser(description="Extract text and tables from PDF")
    parser.add_argument("pdf_path", help="Path to PDF file")
    parser.add_argument("--pages", help="Page range (e.g., '1-10' or '5')", default=None)
    args = parser.parse_args()

    pdf_path = Path(args.pdf_path)
    if not pdf_path.exists():
        print(json.dumps({"error": f"File not found: {pdf_path}"}), file=sys.stdout)
        sys.exit(1)

    # Parse page range
    start_page = None
    end_page = None
    if args.pages:
        if "-" in args.pages:
            parts = args.pages.split("-")
            start_page = int(parts[0])
            end_page = int(parts[1])
        else:
            start_page = int(args.pages)
            end_page = start_page

    try:
        with pdfplumber.open(pdf_path) as pdf:
            total_pages = len(pdf.pages)
            results = []

            for i, page in enumerate(pdf.pages, start=1):
                if start_page is not None and i < start_page:
                    continue
                if end_page is not None and i > end_page:
                    break

                page_data = extract_page(page, i)
                results.append(page_data)

            output = {
                "file": str(pdf_path),
                "totalPages": total_pages,
                "extractedPages": len(results),
                "pages": results,
            }

            print(json.dumps(output, ensure_ascii=False))

    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stdout)
        sys.exit(1)


if __name__ == "__main__":
    main()
