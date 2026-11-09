#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""第二十六轮补图候选联系表：把 evidence/pvz-raw26/ 下的候选图拼成网格，
每格标「角色名 + 序号」，用于人工挑出确实是对应角色的官方立绘。
用法: python scripts/contact-sheet-raw26.py <输出PNG> [起始] [条数] [每行格数] [格宽]
"""
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "evidence", "pvz-raw26")
META = os.path.join(ROOT, "evidence", "pvz-img-so26.json")

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "evidence", "pvz26-raw-sheet.png")
START = int(sys.argv[2]) if len(sys.argv) > 2 else 0
LIMIT = int(sys.argv[3]) if len(sys.argv) > 3 else 999
COLS = int(sys.argv[4]) if len(sys.argv) > 4 else 6
CELL = int(sys.argv[5]) if len(sys.argv) > 5 else 150

meta = json.load(open(META, encoding="utf-8"))
items = []
for r in meta["report"]:
    for c in r["cands"]:
        items.append({"name": r["name"], "file": c["file"], "title": c.get("title", "")})
items = items[START:START + LIMIT]

rows = (len(items) + COLS - 1) // COLS
PAD = 20
CAP = 34
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
        d.text((x + 6, y + 6), "无法打开", fill=(200, 0, 0), font=font)
    sheet.paste(cell, (x, y))
    d.rectangle([x, y, x + CELL, y + CELL], outline=(190, 190, 190))
    tag = it["file"].rsplit("-", 1)[-1].rsplit(".", 1)[0]
    d.text((x + 2, y + CELL + 2), f'{it["name"]}#{tag}', fill=(15, 15, 15), font=font)
    d.text((x + 2, y + CELL + 17), f'{START + i}', fill=(120, 120, 120), font=font)

os.makedirs(os.path.dirname(OUT), exist_ok=True)
sheet.save(OUT)
print("wrote", os.path.relpath(OUT, ROOT), f"{W}x{H}", "| 候选", len(items), "| 序号", START, "~", START + len(items) - 1)
