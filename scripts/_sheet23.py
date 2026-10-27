#!/usr/bin/env python3
"""第二十三轮 · 英雄配图逐张复核拼图。按分区输出 5x4 联系人表，带名字与图片号。"""
import json, os, sys, re
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG_ROOT = os.path.join(ROOT, "src", "renderer")
OUT = os.path.join(ROOT, "evidence", "qc23", "sheets")
os.makedirs(OUT, exist_ok=True)

CELL, LABEL, COLS, PER_PAGE = 250, 30, 5, 20
try:
    font = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 17)
except Exception:
    font = ImageFont.load_default()

data = json.load(open(os.path.join(ROOT, "evidence", "qc23-heroes.json"), encoding="utf-8"))

def zone_of(h):
    return h.get("zone") or "未分区"

groups = {}
for h in data:
    groups.setdefault(zone_of(h), []).append(h)

# 分区顺序：风险高的先看
ORDER = ["瓦罗淋特", "UP主", "守望淋锋", "淋威争锋", "阴雄淋盟", "淋者荣耀", "淋神", "英雄淋盟",
         "淋日方舟", "星淋铁道", "原神", "街头霸淋", "淋明杀鸡", "阴淋师", "洛克淋国", "第五淋格",
         "王者淋耀", "其它"]
keys = [k for k in ORDER if k in groups] + [k for k in groups if k not in ORDER]

sheet_map = {}
total = 0
for zone in keys:
    items = groups[zone]
    safe = re.sub(r'[\\/:*?"<>|]', "_", zone)
    for page in range((len(items) + PER_PAGE - 1) // PER_PAGE):
        chunk = items[page * PER_PAGE:(page + 1) * PER_PAGE]
        rows = (len(chunk) + COLS - 1) // COLS
        sheet = Image.new("RGB", (COLS * CELL, rows * (CELL + LABEL)), (238, 238, 238))
        d = ImageDraw.Draw(sheet)
        cells = []
        for j, h in enumerate(chunk):
            x, y = (j % COLS) * CELL, (j // COLS) * (CELL + LABEL)
            p = os.path.join(IMG_ROOT, h["img"].replace("/", os.sep)) if h.get("img") else None
            num = (h.get("img") or "").replace("img/hero-", "").replace(".png", "").replace(".jpg", "")
            d.text((x + 5, y + 4), f'{page*PER_PAGE+j+1}. {h["name"]}  [#{num}]', fill=(0, 0, 0), font=font)
            if p and os.path.exists(p):
                im = Image.open(p).convert("RGB")
                w, hh = im.size
                side = min(w, hh)
                im = im.crop(((w - side) // 2, (hh - side) // 2, (w + side) // 2, (hh + side) // 2)).resize((CELL, CELL))
                sheet.paste(im, (x, y + LABEL))
            else:
                d.rectangle([x, y + LABEL, x + CELL, y + LABEL + CELL], fill=(205, 70, 70))
                d.text((x + 8, y + LABEL + 100), "NO IMAGE", fill=(255, 255, 255), font=font)
            cells.append({"n": page * PER_PAGE + j + 1, "name": h["name"], "img": h.get("img"), "baike": (h.get("baike") or "")[:60]})
        fn = f"{safe}-p{page + 1}.png"
        sheet.save(os.path.join(OUT, fn))
        sheet_map[fn] = {"zone": zone, "cells": cells}
        total += 1

json.dump(sheet_map, open(os.path.join(ROOT, "evidence", "qc23", "sheet-map.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("zones", len(keys), "sheets", total, "->", OUT)
for zone in keys:
    print(f"  {zone}: {len(groups[zone])} 人, {((len(groups[zone])+PER_PAGE-1)//PER_PAGE)} 页")
