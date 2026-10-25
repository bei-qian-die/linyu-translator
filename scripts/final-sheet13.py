#!/usr/bin/env python3
"""把第 13 轮最终成图拼成一张总览表，供逐张核验（人物名 + 文件名标注）。"""
import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, "src", "renderer", "img")

# 与 fetch-hero-images13.js 的 PLAN 顺序一致，从 hero-230 起
NAMES = [
    "安妮", "瑟庄妮", "卡特琳娜", "丽桑卓", "婕拉", "克烈", "阿木木", "芮尔",
    "奈德丽", "厄运小姐", "乐芙娜", "凝光", "坎蒂丝", "梦见月瑞希", "翡翠", "灵砂",
    "黑塔", "女娲", "安琪拉", "芈月", "镜", "海诺", "重岳", "玛恩纳", "龙舌兰",
    "能天使", "红蝶", "杰克", "孔雀明王", "三角头", "德古拉",
]

CELL = 230
COLS = 6
PAD = 10
LABEL = 26


def main():
    rows = (len(NAMES) + COLS - 1) // COLS
    W = COLS * (CELL + PAD) + PAD
    H = rows * (CELL + LABEL + PAD) + PAD
    sheet = Image.new("RGB", (W, H), (18, 18, 22))
    draw = ImageDraw.Draw(sheet)
    for i, name in enumerate(NAMES):
        fn = "hero-%d.png" % (230 + i)
        p = os.path.join(IMG, fn)
        cx = PAD + (i % COLS) * (CELL + PAD)
        cy = PAD + (i // COLS) * (CELL + LABEL + PAD)
        if os.path.exists(p):
            im = Image.open(p).convert("RGB")
            im.thumbnail((CELL, CELL))
            sheet.paste(im, (cx + (CELL - im.width) // 2, cy + (CELL - im.height) // 2))
        draw.text((cx + 2, cy + CELL + 4), "%s %s" % (fn, name), fill=(230, 230, 230))
    out = os.path.join(ROOT, "evidence", "hero-images13-final-sheet.png")
    sheet.save(out, "PNG", optimize=True)
    print("[sheet]", out)


if __name__ == "__main__":
    main()
