#!/usr/bin/env python3
# 第二十五轮英雄配图落地：四分区 245 位人物，一人一文件，新编号从 hero-705 起。
#
#   python scripts/apply-hero-images25.py [--dry-run]
#
# 行为：
#   1. 读 evidence/hero-images25.json（fetch-hero-images25.js 的候选记录）
#   2. 每位人物挑一张：user（B站头像）> baike（百科词条图）> baidu（图库），
#      再按「宽高都不小于 200」过滤，避免拿到缩略图
#   3. 裁成 256x256 → src/renderer/img/hero-NNN.png（不覆盖任何既有文件）
#   4. 生成 thumb/hero-NNN.webp（240 宽）
#   5. 回写 evidence/hero-images25.json 的 map 字段（name → img），供 gen-lore25.js 引用
#
# 只做裁剪/缩放/转码，不生成任何图片内容，无 AI 参与。
import json
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG_DIR = os.path.join(ROOT, "src", "renderer", "img")
THUMB_DIR = os.path.join(IMG_DIR, "thumb")
CAND_DIR = os.path.join(ROOT, "evidence", "hero-cand25")
DOC_PATH = os.path.join(ROOT, "evidence", "hero-images25.json")
DRY = "--dry-run" in sys.argv
SIZE = 256
THUMB_W = 240
FIRST = 705

PREF = {"user": 0, "baike": 1, "baidu": 2}

doc = json.load(open(DOC_PATH, encoding="utf-8"))
rows = doc.get("rows", [])


def crop_square(im):
    w, h = im.size
    side = min(w, h)
    if h / w >= 1.15:
        box = (0, 0, side, side)  # 竖图裁顶部：人物头像通常在画面上方
    else:
        left = (w - side) // 2
        top = (h - side) // 2
        box = (left, top, left + side, top + side)
    return im.crop(box)


existing = [f for f in os.listdir(IMG_DIR) if f.startswith("hero-") and f.endswith(".png")]
next_no = max([int(f[5:-4]) for f in existing] + [FIRST - 1]) + 1
if next_no < FIRST:
    next_no = FIRST

mapping = {}
report = []
used_files = set()
skipped = []

# 幂等：已经落地过的人物直接沿用原编号，不重新分配（否则每跑一次就多出一整套重复图）
prev_map = doc.get("map", {})
for name, m in prev_map.items():
    p = os.path.join(IMG_DIR, os.path.basename(m.get("img", "")))
    if m.get("img") and os.path.exists(p):
        mapping[name] = m

for r in rows:
    name = r["name"]
    if name in mapping:
        continue
    files = r.get("files") or []
    cands = sorted(files, key=lambda f: PREF.get(f.get("from"), 9))
    chosen = None
    im = None
    for c in cands:
        p = os.path.join(CAND_DIR, name.replace("/", "_").replace("\\", "_"), c["file"])
        if not os.path.exists(p):
            continue
        try:
            im = Image.open(p)
            im.load()
        except Exception:
            continue
        if im.width < 200 or im.height < 200:
            continue
        if os.path.getsize(p) in used_files:
            continue
        chosen = c
        used_files.add(os.path.getsize(p))
        break
    if chosen is None or im is None:
        skipped.append(name)
        continue

    im = crop_square(im.convert("RGB")).resize((SIZE, SIZE), Image.LANCZOS)
    fname = "hero-%d.png" % next_no
    next_no += 1
    if not DRY:
        im.save(os.path.join(IMG_DIR, fname), "PNG", optimize=True)
        os.makedirs(THUMB_DIR, exist_ok=True)
        th = im.copy()
        th.thumbnail((THUMB_W, THUMB_W), Image.LANCZOS)
        th.save(os.path.join(THUMB_DIR, fname.replace(".png", ".webp")), "WEBP", quality=75, method=4)
    mapping[name] = {
        "img": "img/" + fname,
        "url": chosen.get("url", ""),
        "title": chosen.get("title", ""),
        "from": chosen.get("from", ""),
        "src": "evidence/hero-cand25/%s/%s" % (name, chosen["file"]),
    }
    report.append((name, fname, chosen.get("from"), chosen.get("title", "")[:40]))

doc["map"] = mapping
doc["appliedAt"] = __import__("datetime").datetime.now().isoformat(timespec="seconds")
if not DRY:
    json.dump(doc, open(DOC_PATH, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

print("落地 %d 张 / 共 %d 位；跳过 %d 位" % (len(mapping), len(rows), len(skipped)))
if skipped:
    print("无可用候选：" + "、".join(skipped[:40]))
for name, fname, frm, title in report[:12]:
    print("  %s → %s (%s) %s" % (name, fname, frm, title))
