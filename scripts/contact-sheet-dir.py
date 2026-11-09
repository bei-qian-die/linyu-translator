#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""通用候选联系表：扫描指定目录下的图片，按文件名排序拼网格并标注文件名。
用法: python scripts/contact-sheet-dir.py <目录> <输出PNG> [每行格数] [格宽]
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIR = sys.argv[1]
OUT = sys.argv[2]
COLS = int(sys.argv[3]) if len(sys.argv) > 3 else 6
CELL = int(sys.argv[4]) if len(sys.argv) > 4 else 150

files = sorted(
    f for f in os.listdir(os.path.join(ROOT, DIR)) if f.lower().endswith((".png", ".jpg", ".jpeg", ".webp", ".gif"))
)
rows = (len(files) + COLS - 1) // COLS
PAD, CAP = 18, 28
W = COLS * CELL + (COLS + 1) * PAD
H = rows * (CELL + CAP) + (rows + 1) * PAD
sheet = Image.new("RGB", (W, H), (248, 248, 248))
d = ImageDraw.Draw(sheet)
try:
    font = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 13)
except Exception:
    font = ImageFont.load_default()

for i, f in enumerate(files):
    cx, cy = i % COLS, i // COLS
    x = PAD + cx * (CELL + PAD)
    y = PAD + cy * (CELL + CAP + PAD)
    cell = Image.new("RGB", (CELL, CELL), (255, 255, 255))
    try:
        im = Image.open(os.path.join(ROOT, DIR, f)).convert("RGBA")
        im.thumbnail((CELL, CELL), Image.LANCZOS)
        bg = Image.new("RGBA", (CELL, CELL), (255, 255, 255, 255))
        bg.paste(im, ((CELL - im.width) // 2, (CELL - im.height) // 2), im)
        cell = bg.convert("RGB")
    except Exception:
        pass
    sheet.paste(cell, (x, y))
    d.rectangle([x, y, x + CELL, y + CELL], outline=(190, 190, 190))
    d.text((x + 2, y + CELL + 3), f"[{i}] {f}", fill=(10, 10, 10), font=font)

os.makedirs(os.path.dirname(os.path.join(ROOT, OUT)), exist_ok=True)
sheet.save(os.path.join(ROOT, OUT))
print("wrote", OUT, f"{W}x{H}", "| 共", len(files))
