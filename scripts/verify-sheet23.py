#!/usr/bin/env python3
"""qc23 选图核验表：每位英雄一格(选中的候选)，附名字/来源/标题。"""
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
pre = json.load(open(os.path.join(root, "work", "prepicks23.json"), encoding="utf-8"))
if len(sys.argv) > 1:
    names = set(s.strip() for s in sys.argv[1].split(",") if s.strip())
    pre = [r for r in pre if r["name"] in names]

cell = 340
cols = 3
per = 6
pages = (len(pre) + per - 1) // per
try:
    font = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 15)
    font_s = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 12)
except Exception:
    font = ImageFont.load_default()
    font_s = font

for page in range(pages):
    items = pre[page * per:(page + 1) * per]
    W = cols * (cell + 24) + 20
    H = 2 * (cell + 64) + 20
    sheet = Image.new("RGB", (W, H), (255, 255, 255))
    draw = ImageDraw.Draw(sheet)
    for n, r in enumerate(items):
        br, bc = divmod(n, cols)
        x = bc * (cell + 24) + 10
        y = br * (cell + 64) + 10
        pk = r.get("pick") or {}
        draw.rectangle([x, y, x + cell + 8, y + cell + 52], outline=(160, 160, 160))
        draw.text((x + 2, y + 2), f"{page * per + n + 1}. {r['name']}", fill=(0, 0, 0), font=font)
        f = os.path.join(root, "evidence", "qc23-cand", r["name"], (pk.get("file") or ""))
        if os.path.exists(f):
            try:
                im = Image.open(f).convert("RGB")
                im.thumbnail((cell, cell - 18), Image.LANCZOS)
                sheet.paste(im, (x + 4, y + 26))
            except Exception:
                pass
        else:
            draw.text((x + 4, y + 60), "NO PICK", fill=(255, 0, 0), font=font)
        draw.text((x + 2, y + cell + 30), f"{pk.get('from','')} | {(pk.get('title') or '')[:24]}", fill=(0, 0, 140), font=font_s)
        draw.text((x + 2, y + cell + 46), f"alt: {(r.get('alt') or {}).get('title') or ''}[:18]", fill=(140, 140, 140), font=font_s)
    outp = os.path.join(root, "evidence", "qc23", "sheets", f"verify-p{page + 1}.png")
    sheet.save(outp)
    print(f"page{page + 1}: {len(items)} -> {outp} ({W}x{H})")
