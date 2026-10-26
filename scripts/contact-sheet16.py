#!/usr/bin/env python3
"""把候选图拼成核验用的 contact sheet（每格标 名字#idx）。

    python scripts/contact-sheet16.py <候选JSON> <输出PNG> [每格尺寸] [每行格数]

只拼接既有候选图，不生成、不修改图片内容。
"""
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
cand_json = sys.argv[1]
out = sys.argv[2]
cell = int(sys.argv[3]) if len(sys.argv) > 3 else 168
cols = int(sys.argv[4]) if len(sys.argv) > 4 else 6

items = json.load(open(cand_json, encoding="utf-8"))["items"]
items = [i for i in items if os.path.exists(os.path.join(root, "evidence", "hero-cand16", i["file"]))]

rows = (len(items) + cols - 1) // cols
pad_top = 0
W = cols * cell
H = rows * (cell + 16) + pad_top
sheet = Image.new("RGB", (W, H), (255, 255, 255))
draw = ImageDraw.Draw(sheet)
try:
    font = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 13)
except Exception:
    font = ImageFont.load_default()

for n, it in enumerate(items):
    r, c = divmod(n, cols)
    x = c * cell
    y = r * (cell + 16) + pad_top
    try:
        im = Image.open(os.path.join(root, "evidence", "hero-cand16", it["file"])).convert("RGB")
    except Exception:
        continue
    im.thumbnail((cell - 6, cell - 6), Image.LANCZOS)
    sheet.paste(im, (x + (cell - im.width) // 2, y + (cell - 6 - im.height) // 2 + 3))
    draw.rectangle([x, y, x + cell - 1, y + cell + 15], outline=(200, 200, 200))
    draw.text((x + 3, y + cell + 1), f"{it['name']}#{it['idx']}", fill=(0, 0, 0), font=font)

sheet.save(out)
print(f"{len(items)} 格 -> {out} ({W}x{H})")
