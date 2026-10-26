#!/usr/bin/env python3
"""把一轮候选图拼成核验 contact sheet（每格标 名字#序号 + 原始尺寸）。

    python scripts/contact-sheet17.py <候选JSON> <候选目录> <输出前缀> [每格尺寸] [每行格数] [每张最多格数]

与第十六轮 contact-sheet16.py 的区别：目录与分页可传参，并在标签里带上原图宽高，
方便一眼看出哪些是低清放大图。只拼接既有候选图，不生成、不修改图片内容。
"""
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
cand_json = sys.argv[1]
cand_dir = sys.argv[2]
prefix = sys.argv[3]
cell = int(sys.argv[4]) if len(sys.argv) > 4 else 168
cols = int(sys.argv[5]) if len(sys.argv) > 5 else 6
per_sheet = int(sys.argv[6]) if len(sys.argv) > 6 else 30

base = os.path.join(root, cand_dir)
items = json.load(open(cand_json, encoding="utf-8"))["items"]
items = [i for i in items if os.path.exists(os.path.join(base, i["file"]))]

try:
    font = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 12)
except Exception:
    font = ImageFont.load_default()

for page, start in enumerate(range(0, len(items), per_sheet), 1):
    chunk = items[start : start + per_sheet]
    rows = (len(chunk) + cols - 1) // cols
    W = cols * cell
    H = rows * (cell + 16)
    sheet = Image.new("RGB", (W, H), (255, 255, 255))
    draw = ImageDraw.Draw(sheet)
    for n, it in enumerate(chunk):
        r, c = divmod(n, cols)
        x = c * cell
        y = r * (cell + 16)
        try:
            im = Image.open(os.path.join(base, it["file"])).convert("RGB")
        except Exception:
            continue
        im.thumbnail((cell - 6, cell - 6), Image.LANCZOS)
        sheet.paste(im, (x + (cell - im.width) // 2, y + (cell - 6 - im.height) // 2 + 3))
        draw.rectangle([x, y, x + cell - 1, y + cell + 15], outline=(200, 200, 200))
        label = f"{it['name']}#{it['idx']} {it.get('w') or '?'}x{it.get('h') or '?'}"
        draw.text((x + 3, y + cell + 1), label, fill=(0, 0, 0), font=font)
    out = f"{prefix}-p{page}.png"
    sheet.save(out)
    print(f"{len(chunk)} 格 -> {out} ({W}x{H})")
