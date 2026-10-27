#!/usr/bin/env python3
"""第二十二轮配图落地：把核验通过的图裁进产品（原地覆盖 hero-XXX.png），并生成缩略图。

    python scripts/apply-hero-images22.py [--dry-run]

行为：
  1. 竖构图（h/w ≥ 1.15）→ 裁顶部正方（脸+肩）；横图 → 居中裁正方
  2. 原地覆盖 src/renderer/img/hero-XXX.png（256x256）——img 引用不变，无需改数据
  3. 重生成 src/renderer/img/thumb/hero-XXX.webp（240 宽 q75）
  4. 落 evidence/hero-images22.json（谁用了哪张、原图 URL、裁切模式）

只做裁剪/缩放/转码，不生成任何图片内容，无 AI 参与。
来源：百度图库（第五人格+人名+官方全名+图鉴 / 定点补抓）与 B 站视频封面、UP 主头像。
"""
import json
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG_DIR = os.path.join(ROOT, "src", "renderer", "img")
THUMB_DIR = os.path.join(IMG_DIR, "thumb")
DRY = "--dry-run" in sys.argv
SIZE = 256
THUMB_W = 240

SRC = {
    "cand1": os.path.join(ROOT, "evidence", "qc22-cand"),
    "cand2": os.path.join(ROOT, "evidence", "qc22-cand2"),
    "cand3": os.path.join(ROOT, "evidence", "qc22-cand3"),
}

PICKS = json.load(open(os.path.join(ROOT, "evidence", "qc22-picks.json"), encoding="utf-8"))["picks"]
# 淋人金Daddy 是愚人金的淋化形象，与愚人金共用同一张官方图
PICKS["淋人金Daddy"]["src"] = "cand3"
PICKS["淋人金Daddy"]["srcName"] = "愚人金"

# 词库名 → 现役 img 文件（读 qc22 dump，保持引用不变、原地覆盖）
heroes = json.load(open(os.path.join(ROOT, "evidence", "qc22-heroes-第五淋格.json"), encoding="utf-8"))
IMG_OF = {h["name"]: h["img"] for h in heroes}

CAND_JSON = {
    "cand1": json.load(open(os.path.join(ROOT, "evidence", "qc22-cand.json"), encoding="utf-8")),
    "cand2": json.load(open(os.path.join(ROOT, "evidence", "qc22-cand2.json"), encoding="utf-8")),
    "cand3": json.load(open(os.path.join(ROOT, "evidence", "qc22-cand3.json"), encoding="utf-8")),
}


def url_of(src, name, i):
    items = {it["name"]: it for it in CAND_JSON[src]["items"]}
    key = PICKS[name].get("srcName", name)
    it = items.get(key)
    if it and it.get("cands") and i < len(it["cands"]):
        return it["cands"][i].get("url", "")
    return ""


def top_square_or_center(im):
    w, h = im.size
    side = min(w, h)
    if h / w >= 1.15:
        return im.crop((0, 0, side, side))  # 竖图取顶部（脸+肩）
    return im.crop(((w - side) // 2, (h - side) // 2, (w + side) // 2, (h + side) // 2))


def main():
    os.makedirs(THUMB_DIR, exist_ok=True)
    out, missing = [], []
    for name, p in PICKS.items():
        rel = IMG_OF.get(name)
        if not rel:
            missing.append({"name": name, "why": "词库中无该人物或无 img 字段"})
            continue
        src_name = p.get("srcName", name)
        cand_path = os.path.join(SRC[p["src"]], src_name, f"{p['i']}.jpg")
        if not os.path.exists(cand_path):
            missing.append({"name": name, "why": f"候选图缺失 {cand_path}"})
            continue
        im = Image.open(cand_path)
        im = im.convert("RGB") if im.mode == "RGB" else im.convert("RGB")
        sq = top_square_or_center(im).resize((SIZE, SIZE), Image.LANCZOS)
        dst = os.path.join(ROOT, "src", "renderer", rel)
        thumb = os.path.join(THUMB_DIR, os.path.basename(rel).replace(".png", ".webp"))
        if not DRY:
            sq.save(dst, "PNG")
            tw = SIZE
            sq.save(thumb, "WEBP", quality=75)
        out.append({
            "name": name, "img": rel, "pick": p["i"], "src": p["src"],
            "sourceUrl": url_of(p["src"], name, p["i"]),
            "note": p.get("note", ""), "bytes": os.path.getsize(cand_path),
        })
        print(("DRY " if DRY else "") + f"[OK] {name} -> {rel}")
    if not DRY:
        json.dump({
            "generatedAt": __import__("datetime").datetime.now().isoformat(),
            "count": len(out),
            "note": "第五淋格板块配图修复；来源=百度图库(第五人格+人名+图鉴)/B站封面/UP头像；无 AI 生成。",
            "map": {o["name"]: {k: v for k, v in o.items() if k != "name"} for o in out},
            "missing": missing,
        }, open(os.path.join(ROOT, "evidence", "hero-images22.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"完成 {len(out)} 张，缺失 {len(missing)}")
    for m in missing:
        print("  [缺失]", m["name"], ":", m["why"])


if __name__ == "__main__":
    main()
