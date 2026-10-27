#!/usr/bin/env python3
"""第五淋格配图审查 contact sheet：把 64 位人物的当前配图拼图，附名字编号。"""
import json, os, sys
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG_ROOT = os.path.join(ROOT, "src", "renderer")
data = json.load(open(os.path.join(ROOT, "evidence", "qc22-heroes-第五淋格.json"), encoding="utf-8"))
OUT = os.path.join(ROOT, "evidence", "qc22")
os.makedirs(OUT, exist_ok=True)

CELL, LABEL = 250, 34
COLS = 5
PER_PAGE = 20
try:
    font = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 20)
except Exception:
    font = ImageFont.load_default()

items = []
for i, h in enumerate(data):
    p = os.path.join(IMG_ROOT, h["img"].replace("/", os.sep))
    items.append((h["name"], p, h["img"]))

missing = []
for page in range((len(items) + PER_PAGE - 1) // PER_PAGE):
    chunk = items[page*PER_PAGE:(page+1)*PER_PAGE]
    rows = (len(chunk) + COLS - 1) // COLS
    sheet = Image.new("RGB", (COLS*CELL, rows*(CELL+LABEL)), (240, 240, 240))
    d = ImageDraw.Draw(sheet)
    for j, (name, p, rel) in enumerate(chunk):
        x, y = (j % COLS)*CELL, (j//COLS)*(CELL+LABEL)
        n = page*PER_PAGE + j + 1
        if os.path.exists(p):
            im = Image.open(p).convert("RGB")
            w, hh = im.size
            side = min(w, hh)
            im = im.crop(((w-side)//2, (hh-side)//2, (w+side)//2, (hh+side)//2)).resize((CELL, CELL))
            sheet.paste(im, (x, y+LABEL))
        else:
            missing.append((name, rel))
            d.rectangle([x, y+LABEL, x+CELL, y+LABEL+CELL], fill=(200, 60, 60))
        d.text((x+6, y+5), f"#{n} {name}", fill=(0, 0, 0), font=font)
    sheet.save(os.path.join(OUT, f"sheet-p{page+1}.png"))
print("missing:", missing)
print("pages:", (len(items)+PER_PAGE-1)//PER_PAGE, "->", OUT)
