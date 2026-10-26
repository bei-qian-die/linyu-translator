#!/usr/bin/env python3
"""第十九轮配图落地：把核验通过的候选图裁进产品，并生成缩略图。

    python scripts/apply-hero-images19.py [--dry-run]

行为：
  1. 按 PLAN 把图裁成 256x256（竖长立绘用 contain 补黑边，避免裁掉头脚）
  2. 写入 src/renderer/img/hero-XXX.png（编号从 334 起，接上一轮的 333）
  3. 生成 src/renderer/img/thumb/hero-XXX.webp（240 宽，q75）
  4. 落 evidence/hero-images19.json：谁用了哪张、原图 URL、裁切模式、待补清单

只做裁剪 / 缩放 / 转码，不生成任何图片内容。
"""
import datetime
import json
import os
import sys

from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG_DIR = os.path.join(ROOT, "src", "renderer", "img")
THUMB_DIR = os.path.join(IMG_DIR, "thumb")

DRY = "--dry-run" in sys.argv
SIZE = 256
THUMB_W = 240
START = 334  # 上一轮（第十七轮）用到 333

CAND_A = json.load(open(os.path.join(ROOT, "evidence", "hero-cand19.json"), encoding="utf-8"))["items"]
CAND_B = json.load(open(os.path.join(ROOT, "evidence", "hero-cand19b.json"), encoding="utf-8"))["items"]

# (name, idx) -> 候选记录
A = {}
for it in CAND_A:
    A.setdefault((it["name"], it.get("idx", 0)), it)
B = {}
for it in CAND_B:
    B.setdefault((it["name"], it["idx"]), it)


def cand(name, idx, bank="a"):
    """取候选记录；找不到就返回 None（进入待补清单）"""
    if bank == "b":
        it = B.get((name, idx))
        return (os.path.join(ROOT, "evidence", "hero-cand19b", it["file"]), it["url"], it.get("title", "")) if it else None
    it = A.get((name, idx))
    if it and it["kind"] == "up-avatar":
        return os.path.join(ROOT, "evidence", "hero-cand19", it["file"]), it["url"], it.get("title", "")
    if it:
        return os.path.join(ROOT, "evidence", "hero-cand19", it["file"]), it["url"], it.get("title", "")
    return None


def av(name):
    """UP 主头像"""
    it = A.get((name, 0))
    if not it or it["kind"] != "up-avatar":
        return None
    return os.path.join(ROOT, "evidence", "hero-cand19", it["file"]), it["url"], "B站 UP 主头像"


# 挑选结果：逐张人工看过 contact sheet 后定的号
PLAN = []
FIGHTERS = [
    ("不死鸟", 0), ("捷风", 0), ("雷兹", 0), ("芮娜", 1), ("霓虹", 0), ("夜露", 1),
    ("壹决", 0), ("幻棱", 0), ("猎枭", 0), ("铁臂", 0), ("斯凯", 0), ("盖可", 0),
    ("钛狐", 0), ("炼狱", 1), ("星礈", 0), ("幽影", 0), ("海神", 0), ("瑟符", 0),
    ("贤者", 2), ("尚勃勒", 0), ("钢锁", 0), ("维斯", 0), ("遐思", 0),
]
for n, i in FIGHTERS:
    PLAN.append((n, i, "a", "百度图库（无畏契约 角色检索）"))

# 第一轮没找到、第二轮换关键词才拿到的
PLAN += [
    ("K/O", 3, "b", "百度图库（VALORANT KAY/O agent）"),
    ("皮蛋", 5, "b", "百度图库（盖可宠物，取盖可举皮蛋的官方立绘）"),
    ("奇乐的机器人", 4, "b", "百度图库（奇乐与炮台同框立绘）"),
    ("丢丢", 1, "a", "百度图库（盖可立绘，丢丢在肩）"),
    ("鲨鲨", 0, "a", "百度图库（盖可立绘，鲨鲨在手）"),
    ("猎天使魔女", 1, "a", "百度图库（猎天使魔女 立绘）"),
]

# 21 位 UP 主走头像
UP_NAMES = [
    "地才女特务", "仔仔无畏契约", "无畏契约情报员啊", "谋生者白言", "乃酱", "绿泡泡Reyna",
    "无畏辐能联盟", "无畏战术大师兄", "汉堡_无畏契约", "布锅锅", "无畏契约皮肤",
    "喜欢看星星的派大星", "老老老老老鱼干", "冰可乐Raze", "404就是小刘", "木彡1",
    "胡里奥小朋友", "夜光山雀", "欧阳风5019", "大东彦",
]
for n in UP_NAMES:
    PLAN.append((n, 0, "up", "B站 UP 主头像（owner.face）"))

# 明确不配图的（宁缺毋滥）
NO_IMAGE = {
    "黑梦的狗": "两轮检索只拿到黑梦本人立绘，没有能确认的「追猎者」官方形象",
    "康康": "manifest 里无其独立投稿，视频封面全带大字标题，不合规",
    "Aspas": "视频封面带大字标题（“斗三圣pov解析”），不合规",
    "kaajak": "视频封面带大字标题（“夜露pov”），不合规",
    "Eggsterr": "视频封面带大字标题，不合规",
    "lukxo": "视频封面带大字标题（“冠军钱包的控图和瞄准”），不合规",
    "grim": "视频封面是游戏内截图 + 大字，不合规",
    "ziptie": "视频封面是拼贴梗图，不合规",
    "SpiritZ1": "视频封面是真人自拍 + 文字，且非其露脸头像，不合规",
    "Evnii": "视频封面带大字标题，不合规",
    "SoMarcus": "视频封面带大字标题，不合规",
    "张钊": "无独立投稿，仅有合集视频封面，带大字标题，不合规",
}


def crop(src, dst, mode):
    im = Image.open(src).convert("RGB")
    if mode == "contain":
        fitted = ImageOps.contain(im, (SIZE, SIZE), method=Image.LANCZOS)
        canvas = Image.new("RGB", (SIZE, SIZE), (0, 0, 0))
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


# 这几张横图主体偏一侧，fit 会切到人，单独补边
# 横图原图很宽，fit 会把人物两侧切掉，改为 contain 补边
FORCE_MODE = {"钛狐": "contain", "幻棱": "contain", "瑟符": "contain", "尚勃勒": "contain"}

ledger = []
missing = []
num = START

for name, idx, bank, source in PLAN:
    got = av(name) if bank == "up" else cand(name, idx, bank)
    if not got:
        missing.append((name, f"候选缺失（bank={bank} idx={idx}）"))
        continue
    src, url, title = got
    if not os.path.exists(src):
        missing.append((name, src))
        continue
    png = os.path.join(IMG_DIR, f"hero-{num}.png")
    webp = os.path.join(THUMB_DIR, f"hero-{num}.webp")
    im = Image.open(src)
    mode = FORCE_MODE.get(name) or ("contain" if im.height > im.width * 1.25 else "fit")
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
    "note": "只做裁剪/缩放/转码，无 AI 生成；图片来源见 sourceUrl。",
    "map": {r["name"]: {"img": r["img"], "source": r["sourceUrl"], "crop": r["crop"], "from": r["from"] if "from" in r else r["sourceUrl"]} for r in ledger},
    "items": ledger,
    "pending": [{"name": k, "why": v} for k, v in NO_IMAGE.items()],
    "missing": missing,
}
if not DRY:
    with open(os.path.join(ROOT, "evidence", "hero-images19.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
        f.write("\n")

print(f"[apply19] 落地 {len(ledger)} 张，待补 {len(NO_IMAGE)} 位，缺失 {len(missing)}")
for r in ledger:
    print(f"  {r['name']:10s} -> {r['img']}  {r['crop']:7s}  {r['origSize'][0]}x{r['origSize'][1]}")
for m in missing:
    print(f"  [缺失] {m[0]} {m[1]}")
