#!/usr/bin/env python3
"""qc23 候选 contact sheet v2：每英雄一块(3x2格)，每页 6 英雄(2列x3行)，格 190px。
用法: python scripts/contact-sheet23.py <组名|+名字,逗号|@名单文件|__all__> <输出PNG>
"""
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
grp = sys.argv[1]
out = sys.argv[2]
cell = int(sys.argv[3]) if len(sys.argv) > 3 else 190
per_row = int(sys.argv[4]) if len(sys.argv) > 4 else 6
maxc = int(sys.argv[5]) if len(sys.argv) > 5 else 6

m = json.load(open(os.path.join(root, "evidence", "qc23-cand.json"), encoding="utf-8"))
plan = json.load(open(os.path.join(root, "work", "plan-raw.json"), encoding="utf-8"))
gmap = {p["name"]: p for p in plan}
items = m["items"]
for i in items:
    p = gmap.get(i["name"], {})
    i["group"] = (p.get("rank") or "").split("·")[0].strip() or p.get("group") or "未分组"

if grp == "__all__":
    pass
elif grp.startswith("@"):
    names = [l.strip() for l in open(os.path.join(root, grp[1:]), encoding="utf-8") if l.strip()]
    items = [i for i in items if i["name"] in names]
elif grp.startswith("+"):
    names = [s.strip() for s in grp[1:].split(",") if s.strip()]
    items = [i for i in items if i["name"] in names]
else:
    items = [i for i in items if (i["group"] or "").startswith(grp)]

try:
    font = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 15)
    font_s = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 12)
except Exception:
    font = ImageFont.load_default()
    font_s = font

block_w = 3 * cell
rows_c = (maxc + 2) // 3
block_h = rows_c * cell + (rows_c - 1) * 16 + 34
cols_b = 3
per_page = cols_b * 2
pages = (len(items) + per_page - 1) // per_page
code = {"baidu": "B", "baike": "K", "bili-cover": "C", "bili-user-avatar": "U", "pool": "P", "pool22": "P2"}
ccol = {"B": (0, 0, 255), "K": (0, 128, 0), "C": (255, 128, 0), "U": (128, 0, 128), "P": (0, 160, 160), "P2": (200, 100, 0)}

for page in range(pages):
    page_items = items[page * per_page:(page + 1) * per_page]
    W = cols_b * block_w + 60
    H = 2 * block_h + 32
    sheet = Image.new("RGB", (W, H), (255, 255, 255))
    draw = ImageDraw.Draw(sheet)
    for n, it in enumerate(page_items):
        br = n // cols_b
        bc = n % cols_b
        bx = bc * block_w + 20
        by = br * (block_h + 12) + 4
        draw.rectangle([bx - 8, by - 4, bx + block_w + 8, by + block_h + 4], outline=(180, 180, 180))
        draw.text((bx, by - 2), f"{page * per_page + n + 1}. {it['name']}  候选{len(it.get('cands', []))}", fill=(0, 0, 0), font=font)
        cands = it.get("cands", [])[:maxc]
        for k, c in enumerate(cands):
            rr, cc = divmod(k, 3)
            x = bx + cc * cell
            y = by + 18 + rr * (cell + 16)
            f = os.path.join(root, "evidence", "qc23-cand", it["name"], c.get("file", ""))
            if not os.path.exists(f):
                continue
            try:
                im = Image.open(f).convert("RGB")
            except Exception:
                continue
            im.thumbnail((cell - 6, cell - 6), Image.LANCZOS)
            sheet.paste(im, (x + (cell - im.width) // 2, y + (cell - 6 - im.height) // 2))
            tag = code.get(c.get("from", ""), "?")
            draw.rectangle([x, y, x + cell - 1, y + cell + 15], outline=ccol.get(tag, (200, 200, 200)), width=3 if c.get("good") else 1)
            draw.text((x + 3, y + cell - 12), f"{tag}{k}" + ("*" if c.get("good") else ""), fill=ccol.get(tag, (0, 0, 0)), font=font_s)

    base, ext = os.path.splitext(out)
    outp = f"{base}-p{page + 1}{ext}" if pages > 1 else out
    sheet.save(outp)
    print(f"page{page + 1}: {len(page_items)} heroes -> {outp} ({W}x{H})")
