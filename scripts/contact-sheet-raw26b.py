#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""第二轮候选联系表：按 evidence/pvz-img-so26b.json 的 picked 列表拼网格。"""
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "evidence", "pvz-raw26b")
META = os.path.join(ROOT, "evidence", "pvz-img-so26b.json")
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "evidence", "pvz26b-sheet.png")
COLS = int(sys.argv[2]) if len(sys.argv) > 2 else 7
CELL = int(sys.argv[3]) if len(sys.argv) > 3 else 150

items = []
for r in json.load(open(META, encoding="utf-8"))["report"]:
    for rank, c in enumerate(r["picked"]):
        items.append({"name": r["name"], "file": c["file"], "rank": rank})

rows = (len(items) + COLS - 1) // COLS
PAD, CAP = 18, 30
W = COLS * CELL + (COLS + 1) * PAD
H = rows * (CELL + CAP) + (rows + 1) * PAD
sheet = Image.new("RGB", (W, H), (248, 248, 248))
d = ImageDraw.Draw(sheet)
try:
    font = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 13)
except Exception:
    font = ImageFont.load_default()

for i, it in enumerate(items):
    cx, cy = i % COLS, i // COLS
    x = PAD + cx * (CELL + PAD)
    y = PAD + cy * (CELL + CAP + PAD)
    p = os.path.join(RAW, it["file"])
    cell = Image.new("RGB", (CELL, CELL), (255, 255, 255))
    try:
        im = Image.open(p).convert("RGBA")
        im.thumbnail((CELL, CELL), Image.LANCZOS)
        bg = Image.new("RGBA", (CELL, CELL), (255, 255, 255, 255))
        bg.paste(im, ((CELL - im.width) // 2, (CELL - im.height) // 2), im)
        cell = bg.convert("RGB")
    except Exception:
        pass
    sheet.paste(cell, (x, y))
    d.rectangle([x, y, x + CELL, y + CELL], outline=(190, 190, 190))
    d.text((x + 2, y + CELL + 2), f'{it["name"]}-{it["rank"]}', fill=(10, 10, 10), font=font)
    d.text((x + 2, y + CELL + 16), f'[{i}]', fill=(120, 120, 120), font=font)

sheet.save(OUT)
print("wrote", os.path.relpath(OUT, ROOT), f"{W}x{H}", "| 共", len(items))
