#!/usr/bin/env python3
"""把本轮最终裁好的 256x256 人物图拼成核对表，逐张确认「是不是这个人/这个角色」。

    py scripts/verify-sheet11.py

只做排版，不改任何图。
"""

import os

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, "src", "renderer", "img")
OUT = os.path.join(ROOT, "evidence", "hero-sheet11")

CELL = 200
COLS = 4
PAD = 10
LABEL = 24

ORDER = [
    ("hero-200.png", "罗玉凤"),
    ("hero-201.png", "英中啊英中"),
    ("hero-202.png", "FLY组合"),
    ("hero-203.png", "张元英"),
    ("hero-204.png", "杨玉环"),
    ("hero-205.png", "孙尚香"),
    ("hero-206.png", "百里守约"),
    ("hero-207.png", "青行灯"),
    ("hero-208.png", "黑天鹅"),
    ("hero-209.png", "陈"),
    ("hero-210.png", "青子"),
    ("hero-211.png", "琴女"),
    ("hero-212.png", "本吧英雄绰号大科普"),
    ("hero-213.png", "聊赠一枝竹"),
]


def main():
    os.makedirs(OUT, exist_ok=True)
    rows = (len(ORDER) + COLS - 1) // COLS
    W = COLS * (CELL + PAD) + PAD
    H = rows * (CELL + LABEL + PAD) + PAD
    sheet = Image.new("RGB", (W, H), (20, 20, 24))
    draw = ImageDraw.Draw(sheet)

    for i, (fn, name) in enumerate(ORDER):
        p = os.path.join(IMG, fn)
        cx = PAD + (i % COLS) * (CELL + PAD)
        cy = PAD + (i // COLS) * (CELL + LABEL + PAD)
        if not os.path.exists(p):
            draw.text((cx + 2, cy + 4), "MISSING " + fn, fill=(255, 90, 90))
            continue
        im = Image.open(p).convert("RGB")
        sheet.paste(im, (cx, cy))
        draw.text((cx + 2, cy + CELL + 6), "%s  %s" % (fn.replace(".png", ""), name), fill=(225, 225, 225))

    out = os.path.join(OUT, "99_final_check.png")
    sheet.save(out, "PNG", optimize=True)
    print("[verify] ->", out)


if __name__ == "__main__":
    main()
