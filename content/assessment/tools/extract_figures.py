"""Cut the figures out of the PDF as small vector SVGs (+ PNG fallback).

    py content/assessment/tools/extract_figures.py "<pdf path>"
"""
import sys
from pathlib import Path

import fitz

d = fitz.open(sys.argv[1])
OUT = str(Path(__file__).resolve().parent.parent / "figures") + "/"
S = 150 / 72  # 150-dpi pixel → pt

def col(c):
    return "none" if c is None else "#%02x%02x%02x" % tuple(round(v * 255) for v in c[:3])

def svg_crop(pno, px_box, name, drop_text=(), labels=None, keep_png=False, keep_svg=True):
    p = d[pno - 1]
    box = fitz.Rect(*[v / S for v in px_box])
    out = []
    for dr in p.get_drawings():
        if not box.intersects(dr["rect"]) or dr["rect"].width > box.width * 1.5:
            continue
        parts = []
        for it in dr["items"]:
            op = it[0]
            if op == "l":
                parts.append(f"M{it[1].x:.2f} {it[1].y:.2f}L{it[2].x:.2f} {it[2].y:.2f}")
            elif op == "c":
                a, b, c, e = it[1:5]
                parts.append(f"M{a.x:.2f} {a.y:.2f}C{b.x:.2f} {b.y:.2f} {c.x:.2f} {c.y:.2f} {e.x:.2f} {e.y:.2f}")
            elif op == "re":
                r = it[1]
                parts.append(f"M{r.x0:.2f} {r.y0:.2f}H{r.x1:.2f}V{r.y1:.2f}H{r.x0:.2f}Z")
            elif op == "qu":
                q = it[1]
                parts.append(f"M{q.ul.x:.2f} {q.ul.y:.2f}L{q.ur.x:.2f} {q.ur.y:.2f}L{q.lr.x:.2f} {q.lr.y:.2f}L{q.ll.x:.2f} {q.ll.y:.2f}Z")
        if not parts:
            continue
        if dr.get("closePath"):
            parts[-1] += "Z"
        fill = col(dr.get("fill")) if dr.get("fill") is not None else "none"
        stroke = col(dr.get("color")) if dr.get("color") is not None else "none"
        w = dr.get("width") or 1
        op_f = dr.get("fill_opacity") or 1
        out.append(f'<path d="{"".join(parts)}" fill="{fill}" fill-opacity="{op_f:.2f}" stroke="{stroke}" stroke-width="{w:.2f}" stroke-linecap="round" stroke-linejoin="round"/>')
    texts = []
    for b in p.get_text("dict", clip=box)["blocks"]:
        for line in b.get("lines", []):
            for sp in line["spans"]:
                t = sp["text"].strip()
                if not t or t in drop_text:
                    continue
                if labels is not None:  # fonts with private glyph maps: use the known labels in order
                    t = labels[len(texts)]
                x, y = sp["origin"]
                italic = "italic" if (sp["flags"] & 2) else "normal"
                texts.append(f'<text x="{x:.2f}" y="{y:.2f}" font-size="{sp["size"]:.1f}" font-style="{italic}" fill="{col(fitz.sRGB_to_pdf(sp["color"]))}">{t}</text>')
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{box.x0:.2f} {box.y0:.2f} {box.width:.2f} {box.height:.2f}" '
           f'width="{box.width*2:.0f}" height="{box.height*2:.0f}" font-family="\'Times New Roman\', serif">'
           + "".join(out) + "".join(texts) + "</svg>")
    if keep_svg:
        open(OUT + name + ".svg", "w", encoding="utf-8").write(svg)
    if keep_png:
        p.get_pixmap(dpi=300, clip=box).save(OUT + name + ".png")
    print(name, len(out), "paths", len(texts), "texts", len(svg) // 1024, "KB", [t.split(">")[1].split("<")[0] for t in texts])

svg_crop(12, (735, 280, 915, 430), "s11-q1-triangle")
svg_crop(12, (130, 695, 310, 812), "s11-q3-semicircles", keep_png=True, keep_svg=False)  # hatch fill is a PDF pattern: PNG only
svg_crop(12, (570, 920, 920, 1075), "s11-q4-angle", labels=["84°", "∠x"])
