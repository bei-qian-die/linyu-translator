#!/usr/bin/env python3
"""第二十轮配图落地：把核验通过的图裁进产品，并生成缩略图。

    python scripts/apply-hero-images20.py [--dry-run]

行为：
  1. 游戏英雄用网易国服官网英雄卡（181x330，含官方名条）——裁顶部正方（脸+肩），
     再缩放到 256x256；这样既避开底部名条，又保留人物特征
  2. UP 主用 B 站头像（490x490），直接 fit 到 256
  3. 写入 src/renderer/img/hero-XXX.png（编号从 393 起，接上一轮的 392）
  4. 生成 src/renderer/img/thumb/hero-XXX.webp（240 宽，q75）
  5. 落 evidence/hero-images20.json：谁用了哪张、原图 URL、裁切模式、待补清单

只做裁剪 / 缩放 / 转码，不生成任何图片内容，无 AI 参与。
"""
import datetime
import json
import os
import sys

from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG_DIR = os.path.join(ROOT, "src", "renderer", "img")
THUMB_DIR = os.path.join(IMG_DIR, "thumb")
CAND_DIR = os.path.join(ROOT, "evidence", "hero-cand20")

DRY = "--dry-run" in sys.argv
SIZE = 256
THUMB_W = 240
START = 393  # 上一轮（第十九轮）用到 392

ITEMS = json.load(open(os.path.join(ROOT, "evidence", "hero-cand20.json"), encoding="utf-8"))["items"]

# 明确不配图的（宁缺毋滥）
NO_IMAGE = {
    # 本轮 64 位人物全部配到图，无待补。
    # 初稿曾有一条「冰月花雪应援会语录」的群体条目，语料里查不到出处，已按验真纪律整条删除。
}


def top_square(im):
    """官方英雄卡：取顶部正方区域（脸+肩），避开底部名条。"""
    w, h = im.size
    side = min(w, h)
    box = (0, 0, w, side) if h > w else (0, 0, side, side)
    return im.crop(box)


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
    elif mode == "contain":
        fitted = ImageOps.contain(im, (SIZE, SIZE), method=Image.LANCZOS)
        canvas = Image.new("RGB", (SIZE, SIZE), (18, 18, 22))
        canvas.paste(fitted, ((SIZE - fitted.width) // 2, (SIZE - fitted.height) // 2))
        out = canvas
    else:
        out = ImageOps.fit(im, (SIZE, SIZE), method=Image.LANCZOS, centering=(0.5, 0.5))
    out.save(dst, "PNG", optimize=True)


def thumb(png, dst):
    im = Image.open(png).convert("RGB")
    w = THUMB_W
    h = max(1, round(im.height * w / im.width))
    im = im.resize((w, h), Image.LANCZOS)
    im.save(dst, "WEBP", quality=75, method=6)


# 每位人物选一张：游戏英雄取官网卡，UP 取头像
PICK = {}
for it in ITEMS:
    n = it["name"]
    if it["kind"] == "official":
        PICK[n] = (os.path.join(CAND_DIR, it["file"]), it["url"], "网易国服官网英雄卡（官方美术资源）", "top", it.get("title", ""))
    elif it["kind"] == "up-avatar":
        PICK.setdefault(n, (os.path.join(CAND_DIR, it["file"]), it["url"], "B站 UP 主头像（owner.face）", "fit", "B站 UP 主头像"))
    elif it["kind"] == "baidu":
        # 只在前两类都拿不到时才用百度图库兜底
        PICK.setdefault(n, (os.path.join(CAND_DIR, it["file"]), it["url"], "百度图库", "fit", it.get("title", "")))

# 人物顺序沿用 curated 顺序，保证编号稳定可复现
ORDER_FILE = os.path.join(ROOT, "evidence", "hero-order20.json")
if os.path.exists(ORDER_FILE):
    _raw = json.load(open(ORDER_FILE, encoding="utf-8"))
    HERO_ORDER = [h["name"] if isinstance(h, dict) else h for h in _raw]
else:
    HERO_ORDER = list(PICK.keys())

ledger = []
missing = []
num = START

for name in HERO_ORDER:
    if name in NO_IMAGE:
        continue
    got = PICK.get(name)
    if not got:
        missing.append((name, "无任何候选图"))
        continue
    src, url, source, mode, title = got
    if not os.path.exists(src):
        missing.append((name, src))
        continue
    png = os.path.join(IMG_DIR, f"hero-{num}.png")
    webp = os.path.join(THUMB_DIR, f"hero-{num}.webp")
    im = Image.open(src)
    rec = {
        "name": name,
        "img": f"img/hero-{num}.png",
        "thumb": f"img/thumb/hero-{num}.webp",
        "source": source,
        "sourceUrl": url,
        "candTitle": title,
        "origSize": list(im.size),
        "crop": mode,
    }
    if not DRY:
        crop(src, png, mode)
        thumb(png, webp)
        rec["bytes"] = os.path.getsize(png)
    ledger.append(rec)
    num += 1

out = {
    "generatedAt": datetime.datetime.now().isoformat(),
    "count": len(ledger),
    "note": "只做裁剪/缩放/转码，无 AI 生成；游戏英雄取自网易国服官网英雄卡，UP 主取自 B 站头像。",
    "map": {r["name"]: {"img": r["img"], "source": r["sourceUrl"], "crop": r["crop"]} for r in ledger},
    "items": ledger,
    "pending": [{"name": k, "why": v} for k, v in NO_IMAGE.items()],
    "missing": missing,
}
if not DRY:
    with open(os.path.join(ROOT, "evidence", "hero-images20.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
        f.write("\n")

print(f"[apply20] 落地 {len(ledger)} 张，待补 {len(NO_IMAGE)} 位，缺失 {len(missing)}")
for r in ledger[:5]:
    print(f"  {r['name']:10s} -> {r['img']}  {r['crop']:7s}  {r['origSize'][0]}x{r['origSize'][1]}")
if len(ledger) > 5:
    print(f"  ... 共 {len(ledger)} 张")
for m in missing:
    print(f"  [缺失] {m[0]} {m[1]}")
