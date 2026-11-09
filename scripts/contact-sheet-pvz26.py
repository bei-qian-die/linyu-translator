#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""淋物大战阴尸配图联系表：把 evidence/pvz-hero-images26.json 里已落盘的人图拼成一张网格，
每格标「名字 + 编号」，用于人工抽检有没有张冠李戴。
用法: python scripts/contact-sheet-pvz26.py <输出PNG> [每行格数] [格宽]
"""
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EVI = os.path.join(ROOT, "evidence", "pvz-hero-images26.json")
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "evidence", "pvz26-contact-sheet.png")
COLS = int(sys.argv[2]) if len(sys.argv) > 2 else 6
CELL = int(sys.argv[3]) if len(sys.argv) > 3 else 170

rep = [r for r in json.load(open(EVI, encoding="utf-8"))["report"] if r.get("file")]
rows = (len(rep) + COLS - 1) // COLS
PAD = 24
W = COLS * CELL + (COLS + 1) * PAD
H = rows * (CELL + 34) + (rows + 1) * PAD
sheet = Image.new("RGB", (W, H), (250, 250, 250))
d = ImageDraw.Draw(sheet)
try:
    font = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 15)
except Exception:
    font = ImageFont.load_default()

for i, r in enumerate(rep):
    cx, cy = i % COLS, i // COLS
    x = PAD + cx * (CELL + PAD)
    y = PAD + cy * (CELL + 34 + PAD)
    p = os.path.join(ROOT, "src", "renderer", "img", r["file"])
    if os.path.exists(p):
        sheet.paste(Image.open(p).convert("RGB").resize((CELL, CELL), Image.LANCZOS), (x, y))
    d.rectangle([x, y, x + CELL, y + CELL], outline=(200, 200, 200))
    d.text((x, y + CELL + 4), f'{r["name"]} {r["file"].replace("hero-", "").replace(".png", "")}', fill=(20, 20, 20), font=font)

os.makedirs(os.path.dirname(OUT), exist_ok=True)
sheet.save(OUT)
print("wrote", os.path.relpath(OUT, ROOT), f"{W}x{H}", "| 人物", len(rep))
