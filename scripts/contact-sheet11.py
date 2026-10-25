#!/usr/bin/env python3
"""把候选图拼成联络表（contact sheet），用于人工/视觉核对哪一张才是本人/角色本体的真实图。

    py scripts/contact-sheet11.py

输出 evidence/hero-sheet11/<人物>.png，每张图下方标注候选序号。
只做排版与缩放，不生成任何新画面内容。
"""

import json
import os

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAND = os.path.join(ROOT, "evidence", "hero-cand11")
OUT = os.path.join(ROOT, "evidence", "hero-sheet11")
MANIFEST = os.path.join(ROOT, "evidence", "hero-cand11.json")

CELL = 200
COLS = 4
PAD = 8
LABEL = 22


def main():
    os.makedirs(OUT, exist_ok=True)
    with open(MANIFEST, "r", encoding="utf-8") as f:
        items = json.load(f)["items"]

    by_name = {}
    for it in items:
        by_name.setdefault(it["name"], []).append(it)

    for si, (name, lst) in enumerate(sorted(by_name.items())):
        rows = (len(lst) + COLS - 1) // COLS
        W = COLS * (CELL + PAD) + PAD
        H = rows * (CELL + LABEL + PAD) + PAD
        sheet = Image.new("RGB", (W, H), (24, 24, 28))
        draw = ImageDraw.Draw(sheet)

        for i, it in enumerate(lst):
            p = os.path.join(CAND, it["file"])
            if not os.path.exists(p):
                continue
            cx = PAD + (i % COLS) * (CELL + PAD)
            cy = PAD + (i // COLS) * (CELL + LABEL + PAD)
            try:
                im = Image.open(p).convert("RGB")
            except Exception:
                continue
            im.thumbnail((CELL, CELL))
            sheet.paste(im, (cx, cy + (CELL - im.height) // 2))
            draw.text((cx + 2, cy + CELL + 4), "#%d  %dx%d" % (
                it["idx"], it.get("w", 0) or 0, it.get("h", 0) or 0), fill=(210, 210, 210))

        out = os.path.join(OUT, "%02d_%s.png" % (si, name))
        sheet.save(out, "PNG", optimize=True)
        print("[sheet] %02d  %s  %d 张 -> %s" % (si, name, len(lst), out))


if __name__ == "__main__":
    main()
