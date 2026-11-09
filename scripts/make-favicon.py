#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
把 build/icon.png（512×512 应用图标）切成一整套网页 favicon。

产物落在 build/favicon/，由 scripts/build-web.mjs 复制到 www-web 根目录：
    favicon.ico            16/32/48 多尺寸（老浏览器 + 任务栏固定）
    favicon-32.png         现代浏览器标签页
    favicon-16.png         极低 DPI 下的兜底
    apple-touch-icon.png   180×180（iOS 添加到主屏）
    icon-192.png           Android 主屏 / PWA

用法：python scripts/make-favicon.py
"""
import os
import sys

from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "build", "icon.png")
OUT = os.path.join(ROOT, "build", "favicon")


def resize(im, size, sharpen=True):
    """LANCZOS 缩放；小尺寸补一点锐化，否则眼睛/嘴唇会糊成一团。"""
    out = im.resize((size, size), Image.LANCZOS)
    if sharpen and size <= 48:
        out = out.filter(ImageFilter.UnsharpMask(radius=1, percent=60, threshold=0))
    return out


def main():
    if not os.path.exists(SRC):
        sys.exit(f"找不到源图标：{SRC}")
    os.makedirs(OUT, exist_ok=True)

    im = Image.open(SRC).convert("RGB")
    # 非正方形先居中裁成正方形，避免拉伸变形
    w, h = im.size
    if w != h:
        side = min(w, h)
        left = (w - side) // 2
        top = (h - side) // 2
        im = im.crop((left, top, left + side, top + side))

    targets = {
        "favicon-16.png": 16,
        "favicon-32.png": 32,
        "apple-touch-icon.png": 180,
        "icon-192.png": 192,
        "icon-512.png": 512,
    }
    for name, size in targets.items():
        path = os.path.join(OUT, name)
        resize(im, size).save(path, "PNG", optimize=True)
        print(f"  {name:22s} {size}x{size}  {os.path.getsize(path) / 1024:.1f}KB")

    ico = os.path.join(OUT, "favicon.ico")
    resize(im, 256, sharpen=False).save(ico, "ICO", sizes=[(16, 16), (32, 32), (48, 48)])
    print(f"  {'favicon.ico':22s} 16/32/48  {os.path.getsize(ico) / 1024:.1f}KB")


if __name__ == "__main__":
    main()
