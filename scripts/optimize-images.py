#!/usr/bin/env python3
"""
一次性图片优化工具 —— 只在需要整理人物配图时手动跑，不属于应用运行时依赖。

  python scripts/optimize-images.py --dry-run   # 只报体积，不落盘
  python scripts/optimize-images.py             # 实际写入

做什么：
  1. 压缩 src/renderer/img 下的 PNG / JPG，**文件名与扩展名保持不变**
     —— 库里 heroes.img 存的就是相对路径，改扩展名会让存量用户的图裂掉
     （db.js 的 backfillHeroImg 只回填 img 为空的行，覆盖不到已经写死 .png 的老库）。
  2. 生成缩略图 img/thumb/<原名>.webp（宽 240，WebP q75），给人物列表用。

不做什么：
  - 不缩放原图分辨率（原图多为 256x256，缩放只会让详情页变糊）。
  - 不碰 media: 开头的图（那些在 %APPDATA% 下，不在仓库里）。
  - 不改动任何代码或数据。

需要 Pillow：pip install Pillow
"""

import argparse
import io
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
IMG_DIR = os.path.join(ROOT, "src", "renderer", "img")
THUMB_DIR = os.path.join(IMG_DIR, "thumb")

THUMB_WIDTH = 240
PNG_COLORS = 256          # 无 alpha 的图量化到 256 色
JPEG_QUALITY = 82
WEBP_QUALITY = 75


def human(n):
    return "%.1f KB" % (n / 1024) if n < 1024 * 1024 else "%.2f MB" % (n / 1048576)


def optimized_bytes(im, path):
    """把一张图按目标策略编码成字节，返回 (bytes, 说明)。压完更大就返回 None。"""
    ext = os.path.splitext(path)[1].lower()
    has_alpha = im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info)

    if ext == ".jpg" or ext == ".jpeg":
        out = io.BytesIO()
        base = im.convert("RGB")
        base.save(out, "JPEG", quality=JPEG_QUALITY, optimize=True, progressive=True)
        return out.getvalue(), "jpeg q%d" % JPEG_QUALITY

    if ext == ".png":
        out = io.BytesIO()
        if has_alpha:
            # 带透明的图不量化：Pillow 对 RGBA 量化会丢透明边缘，收益也不大
            rgba = im.convert("RGBA")
            rgba.save(out, "PNG", optimize=True, compress_level=9)
            return out.getvalue(), "png rgba opt"
        rgb = im.convert("RGB")
        q = rgb.quantize(colors=PNG_COLORS, method=Image.FASTOCTREE)
        q.save(out, "PNG", optimize=True, compress_level=9)
        return out.getvalue(), "png q%d" % PNG_COLORS

    return None, "skip"


def make_thumb(im):
    w, h = im.size
    if w <= THUMB_WIDTH:
        small = im.copy()
    else:
        nh = max(1, round(h * THUMB_WIDTH / w))
        small = im.resize((THUMB_WIDTH, nh), Image.LANCZOS)
    out = io.BytesIO()
    if small.mode in ("RGBA", "LA") or (small.mode == "P" and "transparency" in small.info):
        small.convert("RGBA").save(out, "WEBP", quality=WEBP_QUALITY, method=6)
    else:
        small.convert("RGB").save(out, "WEBP", quality=WEBP_QUALITY, method=6)
    return out.getvalue()


def list_images():
    names = []
    for n in sorted(os.listdir(IMG_DIR)):
        if n.startswith("."):
            continue
        if os.path.splitext(n)[1].lower() in (".png", ".jpg", ".jpeg"):
            names.append(n)
    return names


def write_thumb(name, blob):
    os.makedirs(THUMB_DIR, exist_ok=True)
    stem = os.path.splitext(name)[0]
    with open(os.path.join(THUMB_DIR, stem + ".webp"), "wb") as f:
        f.write(blob)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="只报体积，不写文件")
    args = ap.parse_args()

    if not os.path.isdir(IMG_DIR):
        print("找不到图片目录：%s" % IMG_DIR)
        return 1

    names = list_images()
    if not names:
        print("图片目录为空")
        return 1

    before = after = thumbs = 0
    kept = 0
    rows = []

    for name in names:
        path = os.path.join(IMG_DIR, name)
        src_size = os.path.getsize(path)
        before += src_size
        try:
            im = Image.open(path)
            im.load()
        except Exception as e:  # 读不通就跳过，别让一张坏图中断整个流程
            print("  跳过 %s（读不通：%s）" % (name, e))
            after += src_size
            continue

        blob, how = optimized_bytes(im, path)
        if blob is None or len(blob) >= src_size:
            # 主图压不小就保持原样，但缩略图照常生成——
            # 列表 img 一律指向 thumb，缺一张就是裂图，不能因为"原图够小"而漏掉
            thumb = make_thumb(im)
            thumbs += len(thumb)
            after += src_size
            kept += 1
            rows.append((name, src_size, src_size, len(thumb), "skip-main"))
            if not args.dry_run:
                write_thumb(name, thumb)
            continue

        thumb = make_thumb(im)
        thumbs += len(thumb)

        if not args.dry_run:
            with open(path, "wb") as f:
                f.write(blob)
            write_thumb(name, thumb)

        after += len(blob)
        rows.append((name, src_size, len(blob), len(thumb), how))

    rows.sort(key=lambda r: r[1] - r[2], reverse=True)
    print("\n压缩收益前 10：")
    for name, b, a, t, how in rows[:10]:
        print("  %-14s %8s -> %8s  (-%5.1f%%)  缩略图 %6s  [%s]" % (
            name, human(b), human(a), (b - a) * 100.0 / b if b else 0, human(t), how))

    print("\n原图合计   %s" % human(before))
    print("压缩后合计 %s  （省下 %s，降幅 %.1f%%）" % (
        human(after), human(before - after),
        (before - after) * 100.0 / before if before else 0))
    print("缩略图合计 %s（img/thumb/，另算）" % human(thumbs))
    if kept:
        print("压完没变小、保持原样的：%d 张" % kept)
    print("\n%s" % ("（dry-run，未写盘）" if args.dry_run else "已写入"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
