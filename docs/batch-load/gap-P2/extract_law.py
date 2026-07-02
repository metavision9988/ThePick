#!/usr/bin/env python3
"""P1 갭 보강 — 법령 PDF 페이지별 텍스트 추출 (검수 GT). pdfplumber (프로젝트 표준)."""
import sys
import pdfplumber

path = sys.argv[1]
lo = int(sys.argv[2]) if len(sys.argv) > 2 else 1
hi = int(sys.argv[3]) if len(sys.argv) > 3 else 9999

with pdfplumber.open(path) as pdf:
    for i, pg in enumerate(pdf.pages, 1):
        if i < lo or i > hi:
            continue
        txt = pg.extract_text() or ""
        print(f"\n===PDF_PAGE {i}===")
        print(txt)
