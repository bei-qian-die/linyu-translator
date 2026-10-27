#!/usr/bin/env python3
# 第二十三轮英雄配图落地：图文不符修复（一人一文件，新文件号 hero-513+）
#
#    python scripts/apply-hero-images23.py [--dry-run]
#
# 行为：
#   1. 132 张核验通过的候选图 → 新文件 src/renderer/img/hero-513..644.png（256x256）
#      竖图(h/w>=1.15)裁顶部正方，横图居中裁正方；不覆盖任何既有文件
#   2. 生成 src/renderer/img/thumb/hero-NNN.webp（240 宽 q75）
#   3. 生成 src/core/lore-extra23.js 与 src/renderer/core/lore-extra23.js
#      （heroMerge 仅含 {name, img}，img:'' 表示清空错误图）
#   4. 落 evidence/hero-images23.json（谁换了哪张、来源 URL、裁切模式、备注）
#
# 只做裁剪/缩放/转码，不生成任何图片内容，无 AI 参与。
# 来源：百度图库 / 百度百科词条图 / B站淋语视频封面 / B站UP主头像 / 既有轮次候选池。
import json
import os
import sys
from datetime import datetime

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG_DIR = os.path.join(ROOT, "src", "renderer", "img")
THUMB_DIR = os.path.join(IMG_DIR, "thumb")
CAND_DIR = os.path.join(ROOT, "evidence", "qc23-cand")
DRY = "--dry-run" in sys.argv
SIZE = 256
THUMB_W = 240
FIRST_NEW = 513

DOC = json.load(open(os.path.join(ROOT, "evidence", "qc23-picks.json"), encoding="utf-8"))
PLAN = json.load(open(os.path.join(ROOT, "work", "plan-raw.json"), encoding="utf-8"))
ORDER = {r["name"]: i for i, r in enumerate(PLAN)}

rows = sorted(DOC["rows"], key=lambda r: ORDER.get(r["name"], 9999))
keeps = DOC["keeps"]
empties = DOC["empties"]


def top_square_or_center(im):
    w, h = im.size
    side = min(w, h)
    if h / w >= 1.15:
        return im.crop((0, 0, side, side))
    return im.crop(((w - side) // 2, (h - side) // 2, (w + side) // 2, (h + side) // 2))


def main():
    os.makedirs(THUMB_DIR, exist_ok=True)
    if not os.path.exists(os.path.join(IMG_DIR, "hero-512.png")):
        raise SystemExit("hero-512.png 不存在，新文件号起点异常，中止")

    # 幂等：evidence/hero-images23.json 已存在则沿用其编号，只重建产物
    prior = os.path.join(ROOT, "evidence", "hero-images23.json")
    prior_map = {}
    if os.path.exists(prior):
        prior_map = {k: v for k, v in json.load(open(prior, encoding="utf-8"))["map"].items()}

    used = set()
    for f in os.listdir(IMG_DIR):
        if f.startswith("hero-") and f.endswith(".png"):
            used.add(f)
    n = FIRST_NEW
    while "hero-%d.png" % n in used:
        n += 1

    out, missing = [], []
    hero_merge = []
    reused = 0
    for r in rows:
        name, new_file = r["name"], r["newFile"]
        if name in prior_map:
            dst_rel = prior_map[name]["img"]
            num = prior_map[name]["newFile"]
            reused += 1
        else:
            dst_rel = "img/hero-%d.png" % n
            num = n
            n += 1
        src = os.path.join(CAND_DIR, name, new_file)
        if not os.path.exists(src):
            missing.append({"name": name, "why": "候选图缺失 " + src})
            continue
        dst = os.path.join(IMG_DIR, "hero-%d.png" % num)
        thumb = os.path.join(THUMB_DIR, "hero-%d.webp" % num)
        if not os.path.exists(dst):
            im = Image.open(src)
            im = im.convert("RGB") if im.mode != "RGB" else im
            sq = top_square_or_center(im).resize((SIZE, SIZE), Image.LANCZOS)
            if not DRY:
                sq.save(dst, "PNG")
                sq.save(thumb, "WEBP", quality=75)
        hero_merge.append({"name": name, "img": dst_rel})
        out.append({
            "name": name, "img": dst_rel, "newFile": num,
            "candFile": new_file, "from": r["from"],
            "sourceUrl": r.get("url", ""), "title": r.get("title", ""),
            "note": r.get("note", ""), "bytes": os.path.getsize(src),
            "oldImg": r.get("img") or "",
        })

    for e in empties:
        if e.get("img"):
            hero_merge.append({"name": e["name"], "img": ""})
            out.append({
                "name": e["name"], "img": "", "newFile": 0,
                "candFile": "", "from": "clear",
                "sourceUrl": "", "title": "清空错误图",
                "note": e.get("note", ""), "bytes": 0, "oldImg": e["img"],
            })

    header = (
        "// @ts-check\n'use strict';\n"
        "// 第二十三轮：英雄配图图文不符修复（146 人复核）\n"
        "// %d 张新图 hero-%d..%d（一人一文件）+ %d 位清空错误图 + %d 位保留原图。\n"
        "// 生成器：scripts/apply-hero-images23.py（幂等，可安全重跑）。\n"
        "// 来源：百度图库/百度百科词条图/B站淋语视频封面/B站UP主头像/既有轮次候选池；无 AI 图、无自绘图。\n"
        "// 换图明细见 evidence/hero-images23.json；复核记录见 evidence/qc23-review.json。\n"
    ) % (len(out) - sum(1 for o in out if o["from"] == "clear"), FIRST_NEW, n - 1,
         sum(1 for o in out if o["from"] == "clear"), len(keeps))

    def js_quote(s):
        return json.dumps(s, ensure_ascii=False)

    lines = [header, "const cards = [];", "const quotes = [];", "const heroes = [];", "", "const heroMerge = ["]
    for m in hero_merge:
        lines.append("  { name: %s, img: %s }," % (js_quote(m["name"]), js_quote(m["img"])))
    lines.append("];")
    lines.append("const quoteMerge = [];")
    lines.append("")
    lines.append("const __export = { cards, quotes, heroes, heroMerge, quoteMerge };")
    lines.append("if (typeof module === 'object' && module.exports) module.exports = __export;")
    lines.append("else if (typeof window !== 'undefined') window.LORE_EXTRA23 = __export;")
    content = "\n".join(lines) + "\n"
    if not DRY:
        for p in [os.path.join(ROOT, "src", "core", "lore-extra23.js"),
                  os.path.join(ROOT, "src", "renderer", "core", "lore-extra23.js")]:
            open(p, "w", encoding="utf-8").write(content)
        json.dump({
            "generatedAt": datetime.now().isoformat(),
            "count": len(out),
            "newFiles": "hero-%d..%d" % (FIRST_NEW, n - 1),
            "note": "146 人复核后换图/清空；来源=百度图库/百科词条图/B站封面/UP头像/既有候选池；无 AI 生成。",
            "map": {o["name"]: {k: v for k, v in o.items() if k != "name"} for o in out},
            "keeps": keeps,
            "missing": missing,
        }, open(os.path.join(ROOT, "evidence", "hero-images23.json"), "w", encoding="utf-8"),
            ensure_ascii=False, indent=1)
    print(("DRY " if DRY else "") + "完成 %d 项（换图 %d / 清空 %d），新文件号 hero-%d..%d，缺失 %d" % (
        len(out), len(out) - sum(1 for o in out if o["from"] == "clear"),
        sum(1 for o in out if o["from"] == "clear"), FIRST_NEW, n - 1, len(missing)))
    for m in missing:
        print("  [缺失]", m["name"], ":", m["why"])


if __name__ == "__main__":
    main()
