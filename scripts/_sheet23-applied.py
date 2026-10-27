#!/usr/bin/env python3
"""把 evidence/hero-images23.json 的最终落地图拼成 contact sheet，供落地复检。"""
import json, os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "evidence", "qc23", "sheets")
os.makedirs(OUT, exist_ok=True)
data = json.load(open(os.path.join(ROOT, "evidence", "hero-images23.json"), encoding="utf-8"))

CELL, LABEL = 190, 24
COLS, ROWS = 8, 8
PER = COLS * ROWS
try:
    font = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 13)
except Exception:
    font = ImageFont.load_default()

rows = sorted(data["map"].items(), key=lambda kv: kv[1]["newFile"])
pages = (len(rows) + PER - 1) // PER
for pg in range(pages):
    part = rows[pg * PER:(pg + 1) * PER]
    W = COLS * CELL
    H = ROWS * (CELL + LABEL) + 26
    sheet = Image.new("RGB", (W, H), (255, 255, 255))
    d = ImageDraw.Draw(sheet)
    d.text((8, 4), f"qc23 applied {pg + 1}/{pages}  ({len(part)} imgs)", fill=(0, 0, 0), font=font)
    for i, (name, r) in enumerate(part):
        x, y = (i % COLS) * CELL, 26 + (i // COLS) * (CELL + LABEL)
        if not r.get("img"):
            d.rectangle([x, y, x + CELL - 1, y + CELL - 1], fill=(240, 240, 240))
            d.text((x + 4, y + 4), f"{name} (img 清空)", fill=(120, 120, 120), font=font)
            continue
        p = os.path.join(ROOT, "src", "renderer", r["img"])
        if not os.path.exists(p):
            d.rectangle([x, y, x + CELL - 1, y + CELL - 1], fill=(255, 200, 200))
            d.text((x + 4, y + 4), "MISSING " + r["img"], fill=(200, 0, 0), font=font)
            continue
        im = Image.open(p).convert("RGB")
        im = im.resize((CELL, CELL))
        sheet.paste(im, (x, y))
        d.text((x + 3, y + CELL - 14), f"{r['newFile']} {name}", fill=(255, 0, 0), font=font)
    outp = os.path.join(OUT, f"applied-p{pg + 1}.png")
    sheet.save(outp)
    print(f"page{pg + 1}: {len(part)} -> {outp} ({W}x{H})")
print("done", len(rows), "rows ->", OUT)
