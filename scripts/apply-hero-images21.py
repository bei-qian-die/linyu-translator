#!/usr/bin/env python3
"""第二十一轮配图落地：把核验通过的图裁进产品，并生成缩略图。

    python scripts/apply-hero-images21.py [--dry-run]

行为：
  1. 竖构图（h/w ≥ 1.15）→ 裁顶部正方（脸+肩），再缩到 256x256；
     横构图（视频封面 / 横版 CG）→ 居中裁正方
  2. 写入 src/renderer/img/hero-XXX.png（编号接着上一轮的最大号往后排）
  3. 生成 src/renderer/img/thumb/hero-XXX.webp（240 宽，q75）
  4. 落 evidence/hero-images21.json 的 map/items：谁用了哪张、原图 URL、裁切模式、缺失清单

只做裁剪 / 缩放 / 转码，不生成任何图片内容，无 AI 参与。
来源为百度图库 / 必应图库 / B 站视频封面，逐条记在 sourceUrl 里。
"""
import datetime
import json
import os
import re
import sys

from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG_DIR = os.path.join(ROOT, "src", "renderer", "img")
THUMB_DIR = os.path.join(IMG_DIR, "thumb")
CAND_DIR = os.path.join(ROOT, "evidence", "hero-cand21")

DRY = "--dry-run" in sys.argv
SIZE = 256
THUMB_W = 240

# 编号接着已有最大号往后排（上一轮用到 456）
_nums = [int(m.group(1)) for f in os.listdir(IMG_DIR) for m in [re.match(r"hero-(\d+)\.png$", f)] if m]
START = max(_nums) + 1 if _nums else 1

PICK = json.load(open(os.path.join(ROOT, "evidence", "hero-images21.json"), encoding="utf-8"))
MAP = PICK["map"]

# 明确不配图的（宁缺毋滥）
NO_IMAGE = {}


def top_square(im):
    """竖图取顶部正方（脸+肩）。"""
    w, h = im.size
    side = min(w, h)
    return im.crop((0, 0, side, side))


def crop(src, dst, mode):
    im = Image.open(src)
    if im.mode in ("RGBA", "LA", "P"):
        bg = Image.new("RGB", im.size, (18, 18, 22))
        im2 = im.convert("RGBA")
        bg.paste(im2, (0, 0), im2)
        im = bg
    else:
        im = im.convert("RGB")
    if mode == "top":
        out = top_square(im).resize((SIZE, SIZE), Image.LANCZOS)
    else:
        out = ImageOps.fit(im, (SIZE, SIZE), method=Image.LANCZOS, centering=(0.5, 0.42))
    out.save(dst, "PNG", optimize=True)


def thumb(png, dst):
    im = Image.open(png).convert("RGB")
    w = THUMB_W
    h = max(1, round(im.height * w / im.width))
    im.resize((w, h), Image.LANCZOS).save(dst, "WEBP", quality=75, method=6)


ledger = []
missing = []
num = START

for name, m in MAP.items():
    if name in NO_IMAGE:
        continue
    src = os.path.join(CAND_DIR, m["file"])
    if not os.path.exists(src):
        missing.append((name, src))
        continue
    png = os.path.join(IMG_DIR, f"hero-{num}.png")
    webp = os.path.join(THUMB_DIR, f"hero-{num}.webp")
    im = Image.open(src)
    source = {"baidu": "百度图库", "bing": "必应图库", "bili-cover": "B站视频封面"}.get(m.get("kind", ""), "图库")
    rec = {
        "name": name,
        "img": f"img/hero-{num}.png",
        "thumb": f"img/thumb/hero-{num}.webp",
        "source": source,
        "sourceUrl": m.get("url", ""),
        "candTitle": m.get("title", ""),
        "origSize": list(im.size),
        "crop": m.get("crop", "center"),
    }
    if not DRY:
        crop(src, png, rec["crop"])
        thumb(png, webp)
        rec["bytes"] = os.path.getsize(png)
    ledger.append(rec)
    num += 1

out = {
    "generatedAt": datetime.datetime.now().isoformat(),
    "count": len(ledger),
    "note": "只做裁剪/缩放/转码，无 AI 生成；来源为百度图库、必应图库与 B 站视频封面，逐条记在 sourceUrl。",
    "map": {r["name"]: {"img": r["img"], "source": r["sourceUrl"], "crop": r["crop"]} for r in ledger},
    "items": ledger,
    "pending": [{"name": k, "why": v} for k, v in NO_IMAGE.items()],
    "missing": missing,
}
if not DRY:
    with open(os.path.join(ROOT, "evidence", "hero-images21.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
        f.write("\n")

print(f"[apply21] 起点编号 {START}，落地 {len(ledger)} 张，缺失 {len(missing)}")
for r in ledger[:6]:
    print(f"  {r['name']:12s} -> {r['img']}  {r['crop']:6s}  {r['origSize'][0]}x{r['origSize'][1]}")
if len(ledger) > 6:
    print(f"  ... 共 {len(ledger)} 张")
for m in missing:
    print(f"  [缺失] {m[0]} {m[1]}")
