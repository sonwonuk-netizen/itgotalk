"""
Cross-check: numbers in the converted stems vs numbers in the PDF's own text layer, per page.

    py content/assessment/tools/verify_numbers.py "<pdf path>"

The PDF draws most Korean as outlines, but digits are mostly real text, so a multiset
comparison of numbers catches transcription typos (e.g. 59+9 typed as 58+9).
Numbers that exist only as vector drawings (some equation glyphs) show up as
"only in conversion" and are checked visually in preview.html instead.
"""
import json
import re
import sys
from collections import Counter
from pathlib import Path

import fitz

sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
pdf = fitz.open(sys.argv[1])
data = json.loads((ROOT / "assessment_4-7.json").read_text(encoding="utf-8"))

NUM = re.compile(r"\d+(?:\.\d+)?")


def numbers(text: str) -> Counter:
    text = re.sub(r"\\(?:frac|dfrac)\{(\d+)\}\{(\d+)\}", r" \1 \2 ", text)  # \dfrac{5}{6} → 5 6
    text = re.sub(r"\\[a-zA-Z]+", " ", text)  # drop latex commands
    text = text.replace(",", "")  # 30,000 → 30000
    return Counter(NUM.findall(text))


def converted_numbers(section) -> Counter:
    c = Counter()
    for p in section["parts"]:
        c += numbers(p["title"])
        for it in p["items"]:
            c += numbers(it["label"])  # "1.", "3.②" — printed in the PDF too
            if it.get("figure"):  # labels drawn inside figures (5, 3, 4cm, 84°)
                svg = (ROOT / it["figure"]).read_text(encoding="utf-8")
                c += numbers(" ".join(re.findall(r">([^<]+)</text>", svg)))
            for g in it["stem"]:
                if g["t"] == "rich":
                    c += numbers(g["v"])
            for ch in it.get("choices", []):
                c += numbers(ch)
    return c


ok = True
by_page: dict[int, Counter] = {}
for s in data["sections"]:
    by_page[s["pdf_page"]] = by_page.get(s["pdf_page"], Counter()) + converted_numbers(s)

for page_no, conv in sorted(by_page.items()):
    page = pdf[page_no - 1]
    # Only the problem area: above the "메모" box, excluding the section heading line.
    memo = page.search_for("메모") or page.search_for("메 모")
    bottom = memo[0].y0 if memo else page.rect.height * 0.9
    clip = fitz.Rect(0, page.rect.height * 0.12, page.rect.width, bottom)
    raw = page.get_text(clip=clip)
    src = numbers(raw)
    missing = src - conv  # in PDF but not converted
    extra = conv - src  # converted but not found in PDF text layer
    # Vertical arithmetic is printed digit by digit ("6 3"); compare digits when numbers differ.
    digits = lambda c: Counter("".join(k.replace(".", "") * v for k, v in c.items()))
    digit_missing = digits(src) - digits(conv)
    status = "OK" if not missing else ("OK*" if not digit_missing else "CHECK")
    if status == "CHECK":
        ok = False
    print(f"p.{page_no:2d} {status:5s} pdf={sum(src.values()):3d} conv={sum(conv.values()):3d}"
          f"  missing={dict(missing) or '-'}  only_in_conversion={dict(extra) or '-'}")

print("OK* = numbers split differently (e.g. vertical arithmetic) but every digit matches")
print("RESULT:", "no numbers missing from the conversion" if ok else "some PDF numbers are missing - see CHECK rows")
