#!/usr/bin/env python3
"""第十七轮质检：把重新取到的人物图覆盖装进产品，并同步重生成缩略图。

    python scripts/apply-hero-images17.py [--dry-run]

行为：
  1. 按 PLAN 把新图裁成 256x256（竖长立绘用 contain 补黑边，避免裁掉头）
  2. 覆盖 src/renderer/img/hero-XXX.png（文件名不变，所以 lore 的 img 字段无需改动）
  3. 重生成 src/renderer/img/thumb/hero-XXX.webp（240 宽，q75）
  4. 落 evidence/hero-images17.json 记录「谁换成了哪张、原图 URL、裁切模式」

只做裁剪/缩放/转码，不生成任何图片内容。
"""
import json
import os
import sys

from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG_DIR = os.path.join(ROOT, "src", "renderer", "img")
THUMB_DIR = os.path.join(IMG_DIR, "thumb")
BAIKE = json.load(open(os.path.join(ROOT, "evidence", "hero-baike17.json"), encoding="utf-8"))["items"]
BAIKE_URL = {i["name"]: i["image"] for i in BAIKE}

DRY = "--dry-run" in sys.argv
SIZE = 256
THUMB_W = 240

# (人物名, 目标图号, 原图相对路径, 图源说明)
PLAN = [
    ("魔力猫", 189, "evidence/hero-baike17/魔力猫.jpg", "百度百科词条主图"),
    ("瞌睡王", 297, "evidence/hero-baike17/瞌睡王.jpg", "百度百科词条主图"),
    ("鬼雾", 302, "evidence/qc17/guiwu/g17.jpg", "百度图库（宠物素材 053-鬼雾）"),
    ("喷火鸟", 308, "evidence/hero-baike17/喷火鸟.jpg", "百度百科词条主图"),
    ("龙希帕尔", 310, "evidence/hero-baike17/龙希帕尔.jpg", "百度百科词条主图（词条名：龙息帕尔）"),
    ("圣羽翼王", 311, "evidence/hero-baike17/圣羽翼王.jpg", "百度百科词条主图"),
    ("幽颖树", 312, "evidence/hero-baike17/幽颖树.jpg", "百度百科词条主图（词条名：幽影树）"),
    ("幽铃", 313, "evidence/hero-cand17/幽铃_4.jpg", "百度图库"),
    ("多灵主", 314, "evidence/hero-baike17/多灵主.jpg", "百度百科词条主图"),
    ("巴哈姆特", 315, "evidence/hero-cand17/巴哈姆特_1.jpg", "百度图库"),
    ("卡瓦重", 318, "evidence/hero-baike17/卡瓦重.jpg", "百度百科词条主图"),
    ("阿布", 319, "evidence/hero-cand17/阿布_0.jpg", "百度图库"),
    ("卷毛鸭", 320, "evidence/hero-baike17/卷毛鸭.jpg", "百度百科词条主图"),
    ("云梦豚", 321, "evidence/hero-cand17/云梦豚_7.jpg", "百度图库"),
    ("咔咔鸟", 323, "evidence/hero-baike17/咔咔鸟.jpg", "百度百科词条主图"),
    ("障眼魔", 327, "evidence/hero-cand17/障眼魔_8.jpg", "百度图库"),
    ("上岸蛙", 329, "evidence/hero-baike17/上岸蛙.jpg", "百度百科词条主图"),
    ("吸泥鸥", 330, "evidence/hero-cand17/吸泥鸥_1.jpg", "百度图库"),
]


def crop(src, dst, mode):
    im = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
    if mode == "contain":
        fitted = ImageOps.contain(im, (SIZE, SIZE), method=Image.LANCZOS)
        canvas = Image.new("RGB", (SIZE, SIZE), (0, 0, 0))
        canvas.paste(fitted, ((SIZE - fitted.width) // 2, (SIZE - fitted.height) // 2))
        out = canvas
    else:
        out = ImageOps.fit(im, (SIZE, SIZE), method=Image.LANCZOS, centering=(0.5, 0.5))
    out.save(dst, "PNG", optimize=True)
    return im.size


def thumb(png, dst):
    im = Image.open(png).convert("RGB")
    w = THUMB_W
    h = max(1, round(im.height * w / im.width))
    im = im.resize((w, h), Image.LANCZOS)
    im.save(dst, "WEBP", quality=75, method=6)


# 少数图宽高比接近 1:1、但主体（翅膀/耳朵）顶到左右边缘，fit 会切掉，单独指定 contain。
FORCE_MODE = {"圣羽翼王": "contain"}

ledger = []
missing = []
for name, num, rel, source in PLAN:
    src = os.path.join(ROOT, rel)
    if not os.path.exists(src):
        missing.append((name, rel))
        continue
    png = os.path.join(IMG_DIR, f"hero-{num}.png")
    webp = os.path.join(THUMB_DIR, f"hero-{num}.webp")
    im = Image.open(src)
    mode = FORCE_MODE.get(name) or ("contain" if im.height > im.width * 1.25 else "fit")
    rel_path = rel.replace("evidence/hero-baike17/", "").replace("evidence/hero-cand17/", "").replace(
        "evidence/qc17/guiwu/", ""
    )
    rec = {
        "name": name,
        "img": f"img/hero-{num}.png",
        "thumb": f"img/thumb/hero-{num}.webp",
        "source": source,
        "from": rel,
        "origSize": list(im.size),
        "crop": mode,
        "baikeUrl": BAIKE_URL.get(name, ""),
    }
    if not DRY:
        orig = list(im.size)
        rec["origSize"] = orig
        crop(src, png, mode)
        thumb(png, webp)
        rec["bytes"] = os.path.getsize(png)
    ledger.append(rec)

out = {
    "generatedAt": __import__("datetime").datetime.now().isoformat(),
    "count": len(ledger),
    "note": "本轮只覆盖同名 hero-XXX.png，因此 lore 里的 img 字段无需改动；素材仅裁剪/缩放，无生成。",
    "items": ledger,
    "missing": missing,
}
if not DRY:
    with open(os.path.join(ROOT, "evidence", "hero-images17.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
        f.write("\n")

print(f"[apply17] 替换 {len(ledger)} 张，缺失 {len(missing)} 张" + ("（dry-run）" if DRY else ""))
for r in ledger:
    print(f"  {r['name']:6s} -> {r['img']}  {r['crop']:7s}  {r['origSize'][0]}x{r['origSize'][1]}  ← {r['source']}")
for m in missing:
    print(f"  [缺失] {m[0]} {m[1]}")
