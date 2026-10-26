#!/usr/bin/env python3
"""第二十轮配图复核册：把候选图拼成一张张网格，供人工逐张确认「是不是这位英雄」。

    python scripts/contact-sheet20.py [--cols 6] [--cell 220]

每位人物一行：第 1 格是官网立绘（基准），后面是百度图库候选。
只做缩放拼版，不修改原图、不生成任何图片内容。
"""
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAND = json.load(open(os.path.join(ROOT, "evidence", "hero-cand20.json"), encoding="utf-8"))["items"]
OUT_DIR = os.path.join(ROOT, "evidence", "sheet20")
os.makedirs(OUT_DIR, exist_ok=True)

CELL = 220
COLS = 6
for a in sys.argv[1:]:
    pass
if "--cols" in sys.argv:
    COLS = int(sys.argv[sys.argv.index("--cols") + 1])
if "--cell" in sys.argv:
    CELL = int(sys.argv[sys.argv.index("--cell") + 1])

BY = {}
for it in CAND:
    BY.setdefault(it["name"], []).append(it)


def font(sz):
    for p in (
        "C:/Windows/Fonts/msyh.ttc",
        "C:/Windows/Fonts/simhei.ttf",
        "C:/Windows/Fonts/arial.ttf",
    ):
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, sz)
            except Exception:
                pass
    return ImageFont.load_default()


F = font(20)


def paste(canvas, path, x, y, label, mark=""):
    try:
        im = Image.open(path)
        if im.mode in ("RGBA", "LA", "P"):
            bg = Image.new("RGB", im.size, (24, 24, 28))
            im = im.convert("RGBA")
            bg.paste(im, (0, 0), im)
            im = bg
        else:
            im = im.convert("RGB")
    except Exception:
        return
    im = im.copy()
    im.thumbnail((CELL - 12, CELL - 30), Image.LANCZOS)
    cw = Image.new("RGB", (CELL, CELL), (32, 32, 38))
    cw.paste(im, ((CELL - im.width) // 2, 4 + (CELL - 34 - im.height) // 2))
    d = ImageDraw.Draw(cw)
    d.text((5, CELL - 26), label[:14], fill=(235, 235, 235), font=F)
    if mark:
        d.rectangle([0, 0, CELL - 1, 3], fill=(60, 200, 120) if mark == "official" else (200, 90, 90))
    canvas.paste(cw, (x, y))


names = sorted(BY.keys())
CHUNK = 8
sheets = []
for si in range(0, len(names), CHUNK):
    part = names[si : si + CHUNK]
    rows = []
    for n in part:
        items = BY[n]
        official = [x for x in items if x["kind"] == "official"]
        others = [x for x in items if x["kind"] != "official"]
        others.sort(key=lambda x: x.get("idx", 0))
        # 第 1 格放官网立绘当基准，后面按序号排百度候选
        row = official[:1] + others
        rows.append((n, row))
    width = COLS * CELL
    height = len(rows) * CELL
    canvas = Image.new("RGB", (width, height), (18, 18, 22))
    for ri, (n, items) in enumerate(rows):
        y = ri * CELL
        # 左侧栏：人物名
        bar = Image.new("RGB", (CELL, CELL), (10, 10, 14))
        d = ImageDraw.Draw(bar)
        d.text((6, CELL // 2 - 12), n[:6], fill=(120, 200, 255), font=F)
        canvas.paste(bar, (0, y))
        for ci, it in enumerate(items[: COLS - 1]):
            p = os.path.join(ROOT, "evidence", "hero-cand20", it["file"])
            mark = "official" if it["kind"] == "official" else "b"
            lbl = f'{it["kind"][:3]}{it.get("idx", "")}'
            paste(canvas, p, (ci + 1) * CELL, y, lbl, mark)
    out = os.path.join(OUT_DIR, f"sheet20-{si // CHUNK + 1:02d}.png")
    canvas.save(out)
    sheets.append(out)
    print(f"[sheet] {out}  {len(rows)} 行  {canvas.size[0]}x{canvas.size[1]}")

print(f"[done] {len(sheets)} 张 → evidence/sheet20/")
