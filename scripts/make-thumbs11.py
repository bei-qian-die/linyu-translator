#!/usr/bin/env python3
"""只为本轮新增的人物图生成缩略图（img/thumb/<name>.webp，240 宽）。

不重编码、不改动已有的 PNG —— 既有图片是历史轮次留下的，压缩收益与风险都另算。
这里只补新图缺的缩略图，避免人物列表出现裂图。

    py scripts/make-thumbs11.py
"""

import os

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG_DIR = os.path.join(ROOT, "src", "renderer", "img")
THUMB_DIR = os.path.join(IMG_DIR, "thumb")
THUMB_WIDTH = 240
WEBP_QUALITY = 75

# 本轮新增的人物图
NEW = [
    "hero-200.png", "hero-201.png", "hero-202.png", "hero-203.png", "hero-204.png",
    "hero-205.png", "hero-206.png", "hero-207.png", "hero-208.png", "hero-209.png",
    "hero-210.png", "hero-211.png", "hero-212.png", "hero-213.png",
    "hero-228.png", "hero-229.png",
]


def make_thumb(im, name):
    w, h = im.size
    if w <= THUMB_WIDTH:
        small = im.copy()
    else:
        nh = max(1, round(h * THUMB_WIDTH / w))
        small = im.resize((THUMB_WIDTH, nh), Image.LANCZOS)
    dst = os.path.join(THUMB_DIR, os.path.splitext(name)[0] + ".webp")
    if small.mode in ("RGBA", "LA") or (small.mode == "P" and "transparency" in small.info):
        small.convert("RGBA").save(dst, "WEBP", quality=WEBP_QUALITY, method=6)
    else:
        small.convert("RGB").save(dst, "WEBP", quality=WEBP_QUALITY, method=6)


def main():
    os.makedirs(THUMB_DIR, exist_ok=True)
    made = 0
    for NAME in NEW:
        p = os.path.join(IMG_DIR, NAME)
        if not os.path.exists(p):
            print("  跳过（缺图）%s" % NAME)
            continue
        im = Image.open(p)
        im.load()
        make_thumb(im, NAME)
        made += 1
        print("  [thumb] %s -> %s" % (NAME, os.path.splitext(NAME)[0] + ".webp"))
    print("共生成 %d 张缩略图" % made)


if __name__ == "__main__":
    main()
