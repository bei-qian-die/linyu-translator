#!/usr/bin/env python3
"""把 qc22-cand 候选图拼成 contact sheet，供人工复核挑选。"""
import json, os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAND = os.path.join(ROOT, "evidence", "qc22-cand")
OUT = os.path.join(ROOT, "evidence", "qc22-review")
os.makedirs(OUT, exist_ok=True)
data = json.load(open(os.path.join(ROOT, "evidence", "qc22-cand.json"), encoding="utf-8"))

CELL, LABEL = 220, 40
COLS = 6
try:
    font = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 18)
except Exception:
    font = ImageFont.load_default()

# 按人物分组，每人一张 sheet，候选横向排
for it in data["items"]:
    name = it["name"]
    cands = it.get("cands", [])
    files = []
    for i, c in enumerate(cands):
        p = os.path.join(CAND, name, f"{i}.jpg")
        if os.path.exists(p):
            files.append((i, p, c.get("title", "")[:40]))
    if not files:
        continue
    rows = (len(files) + COLS - 1) // COLS
    sheet = Image.new("RGB", (COLS * CELL, rows * (CELL + LABEL) + 30), (245, 245, 245))
    d = ImageDraw.Draw(sheet)
    d.text((8, 6), f"{name}   ({it.get('query','')})", fill=(0, 0, 0), font=font)
    for j, (idx, p, t) in enumerate(files):
        x, y = (j % COLS) * CELL, 30 + (j // COLS) * (CELL + LABEL)
        im = Image.open(p).convert("RGB")
        w, h = im.size
        side = min(w, h)
        im = im.crop(((w - side) // 2, (h - side) // 2, (w + side) // 2, (h + side) // 2)).resize((CELL, CELL))
        sheet.paste(im, (x, y + LABEL))
        d.text((x + 4, y + 2), f"{idx}", fill=(200, 0, 0), font=font)
        d.text((x + 4, y + CELL + LABEL - 18), t[:16], fill=(60, 60, 60), font=font)
    sheet.save(os.path.join(OUT, f"{name}.png"))
print("done", len(data["items"]), "->", OUT)
