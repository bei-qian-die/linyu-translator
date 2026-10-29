#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""为微信小程序端生成人物配图（v1.30 起只产一套）。

    python scripts/build-weapp-hero-img.py [--force]

产物：
    miniprogram/pkg-hero/img/hero-NNN.webp   112x112  列表与详情共用（pkg-hero 分包）
    evidence/weapp-hero-images.json          逐张清单（谁、编号、字节数、源文件）

规则（与《小程序端人物配图计划书 v1.0》6.6 一致）：
    · 只处理 src/core/lore 里 hero.img 非空的人物，一张人物一张图，编号沿用桌面端；
    · 源图 256x256 PNG，只做裁切 + 缩放 + 转码，不生成任何新画面，无 AI 参与；
    · 竖图（h/w >= 1.15）从顶部裁正方，横图居中裁正方，正方形直接缩放；
    · WebP 质量 70，strip 元数据，无 alpha。

为什么只有一套：微信主包 2MB 硬上限。v1.28 时同一张脸存了两份 —— 主包 96px 列表图
（1.0MB）+ 分包 136px 详情图（1.7MB），光重复存图就白占 1MB 主包预算。v1.30 把词卡 /
名言 / 人物整块搬进 pkg-hero 分包后，列表和详情都在同一个分包里，一套 112px 同时够
120rpx 头像（约 1.9 倍像素密度）和列表缩略图，分包仍有近 500KB gzip 余量。

不覆盖已存在且比源文件新的产物（--force 可强制重建）。
"""
import json
import os
import subprocess
import sys
import time

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.join(ROOT, "src", "renderer", "img")
IMG_DIR = os.path.join(ROOT, "miniprogram", "pkg-hero", "img")
EVIDENCE = os.path.join(ROOT, "evidence", "weapp-hero-images.json")

SIZE = 112
QUALITY = 70

FORCE = "--force" in sys.argv


def heroes():
    """从 Node 侧取权威人物列表，避免 Python 解析 JS 模块。"""
    code = (
        "const l=require('./src/core/lore');"
        "process.stdout.write(JSON.stringify("
        "l.heroes.map(h=>({name:h.name,img:h.img||'',group:h.group||''}))))"
    )
    out = subprocess.run(
        ["node", "-e", code], cwd=ROOT, capture_output=True, text=True, check=True
    )
    return json.loads(out.stdout)


def square(img):
    w, h = img.size
    if w == h:
        return img
    side = min(w, h)
    if h / w >= 1.15:
        return img.crop((0, 0, side, side))          # 竖图裁顶部，保头部
    if w / h >= 1.15:
        return img.crop(((w - side) // 2, 0, (w + side) // 2, side))  # 横图居中
    left = (w - side) // 2
    top = (h - side) // 2
    return img.crop((left, top, left + side, top + side))


def save_webp(img, size, path, quality):
    tiny = square(img).resize((size, size), Image.LANCZOS)
    if tiny.mode not in ("RGB", "RGBA"):
        tiny = tiny.convert("RGB")
    if tiny.mode == "RGBA":
        # 统一压到白底，避免透明区域在小程序里变黑
        bg = Image.new("RGB", tiny.size, (255, 255, 255))
        bg.paste(tiny, mask=tiny.split()[-1])
        tiny = bg
    tiny.save(path, "WEBP", quality=quality, method=6)


def resolve_src(num):
    """桌面端有 4 张是 .jpg，不能只认 .png。"""
    for ext in (".png", ".jpg", ".jpeg", ".webp"):
        p = os.path.join(SRC_DIR, num + ext)
        if os.path.exists(p):
            return p
    return None


def need_build(src, dst):
    if FORCE or not os.path.exists(dst):
        return True
    return os.path.getmtime(dst) < os.path.getmtime(src)


def main():
    rows = heroes()
    with_img = [r for r in rows if r["img"]]
    missing_src = []
    built = 0
    skipped = 0
    manifest = {}
    total_bytes = 0

    os.makedirs(IMG_DIR, exist_ok=True)

    started = time.time()
    for i, row in enumerate(with_img, 1):
        num = row["img"].replace("img/", "").rsplit(".", 1)[0]
        src = resolve_src(num)
        if not src:
            missing_src.append((row["name"], num))
            continue

        dst = os.path.join(IMG_DIR, num + ".webp")
        entry = {
            "name": row["name"],
            "group": row["group"],
            "num": num,
            "src": "src/renderer/img/%s" % os.path.basename(src),
            "out": "miniprogram/pkg-hero/img/%s.webp" % num,
        }

        try:
            if need_build(src, dst):
                with Image.open(src) as im:
                    save_webp(im, SIZE, dst, QUALITY)
                built += 1
            else:
                skipped += 1
            entry["bytes"] = os.path.getsize(dst)
            total_bytes += entry["bytes"]
        except Exception as exc:  # 单张失败不拖垮整批
            entry["error"] = str(exc)

        manifest[row["name"]] = entry
        if i % 100 == 0:
            print("  ... %d / %d" % (i, len(with_img)))

    os.makedirs(os.path.dirname(EVIDENCE), exist_ok=True)
    with open(EVIDENCE, "w", encoding="utf-8") as fh:
        json.dump(
            {
                "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S"),
                "size": SIZE,
                "quality": QUALITY,
                "count": len(manifest),
                "map": manifest,
            },
            fh,
            ensure_ascii=False,
            indent=1,
        )

    print("人物总数 %d，有图 %d" % (len(rows), len(with_img)))
    print(
        "人物图 %d 张 / %.0fKB（本次新建 %d，跳过 %d）"
        % (len(manifest), total_bytes / 1024, built, skipped)
    )
    if missing_src:
        print("源图缺失 %d 张：%s" % (len(missing_src), missing_src[:5]))
    print("耗时 %.1fs" % (time.time() - started))
    return 0


if __name__ == "__main__":
    sys.exit(main())
