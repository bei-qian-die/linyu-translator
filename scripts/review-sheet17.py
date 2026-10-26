#!/usr/bin/env python3
"""把「已上线的人物图」拼成质检用 contact sheet（每格标 人物名 + 文件名）。

    python scripts/review-sheet17.py <清单TSV> <输出前缀> [每格尺寸] [每行格数] [每张最多格数]

清单 TSV 每行：人物名 \t img/hero-XXX.png \t 字节数 \t 备注

与 contact-sheet16.py 的区别：那个是拼「候选图」供挑选，这个是拼「已经装进产品的图」供验收，
所以直接从 src/renderer/ 下读正式图，并按张数自动分页，避免单张过大看不清。
只拼接既有图片，不生成、不修改任何图片内容。
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFont

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
tsv = sys.argv[1]
prefix = sys.argv[2]
cell = int(sys.argv[3]) if len(sys.argv) > 3 else 168
cols = int(sys.argv[4]) if len(sys.argv) > 4 else 8
per_sheet = int(sys.argv[5]) if len(sys.argv) > 5 else 32

rows_in = [ln.rstrip("\n").split("\t") for ln in open(tsv, encoding="utf-8") if ln.strip()]
rows_in = [r for r in rows_in if len(r) >= 2 and r[1].startswith("img/")]

try:
    font = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 12)
except Exception:
    font = ImageFont.load_default()

sheets = []
for page, start in enumerate(range(0, len(rows_in), per_sheet), 1):
    chunk = rows_in[start : start + per_sheet]
    rows = (len(chunk) + cols - 1) // cols
    W = cols * cell
    H = rows * (cell + 16)
    sheet = Image.new("RGB", (W, H), (255, 255, 255))
    draw = ImageDraw.Draw(sheet)
    for n, it in enumerate(chunk):
        r, c = divmod(n, cols)
        x = c * cell
        y = r * (cell + 16)
        path = os.path.join(root, "src", "renderer", it[1])
        try:
            im = Image.open(path).convert("RGB")
        except Exception:
            draw.rectangle([x, y, x + cell - 1, y + cell + 15], outline=(220, 0, 0))
            draw.text((x + 3, y + 4), "缺失", fill=(220, 0, 0), font=font)
            draw.text((x + 3, y + cell + 1), it[0], fill=(0, 0, 0), font=font)
            continue
        im.thumbnail((cell - 6, cell - 6), Image.LANCZOS)
        sheet.paste(im, (x + (cell - im.width) // 2, y + (cell - 6 - im.height) // 2 + 3))
        draw.rectangle([x, y, x + cell - 1, y + cell + 15], outline=(200, 200, 200))
        label = f"{it[0]} {it[1].split('/')[-1].replace('hero-', '#').replace('.png', '')}"
        draw.text((x + 3, y + cell + 1), label, fill=(0, 0, 0), font=font)
    out = f"{prefix}-p{page}.png"
    sheet.save(out)
    sheets.append((out, len(chunk), W, H))

for out, n, W, H in sheets:
    print(f"{n} 格 -> {out} ({W}x{H})")
