#!/usr/bin/env python3
# 选图复核页：按 work/view-spec23.json 渲染候选短名单 + 当前图，人工复核用
import json, os, sys
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SPEC = os.path.join(ROOT, 'work', 'view-spec23.json')
OUT = os.path.join(ROOT, 'evidence', 'qc23', 'sheets')
FONT = 'C:/Windows/Fonts/msyh.ttc'
CELL = 320
GAP = 14
LABEL_H = 52
COLS = 3
PER_PAGE = 2

def font(sz):
    return ImageFont.truetype(FONT, sz)

CODE = {'baidu': 'B', 'baike': 'K', 'bili-cover': 'C', 'bili-user-avatar': 'U', 'pool:hero-cand11': 'P11',
        'pool:hero-cand15': 'P15', 'pool:hero-cand16': 'P16', 'pool:hero-cand18': 'P18', 'pool:hero-cand18b': 'P18b',
        'pool:hero-cand19': 'P19', 'pool:hero-cand19b': 'P19b', 'pool:hero-cand21': 'P21', 'pool:qc22': 'P22',
        'pool:hero-cand19_英雄': 'P19'}
COLOR = {'B': (66, 133, 244), 'K': (52, 168, 83), 'C': (234, 67, 53), 'U': (171, 71, 188),
         'P11': (255, 152, 0), 'P15': (255, 152, 0), 'P16': (255, 152, 0), 'P18': (255, 152, 0),
         'P18b': (255, 152, 0), 'P19': (255, 152, 0), 'P19b': (255, 152, 0), 'P21': (255, 152, 0), 'P22': (255, 152, 0)}

def wrap(text, f, maxw, draw):
    lines, cur = [], ''
    for ch in text:
        if draw.textlength(cur + ch, font=f) > maxw:
            lines.append(cur); cur = ch
        else:
            cur += ch
    if cur: lines.append(cur)
    return lines[:2]

def hero_block(draw, hero, x, y):
    f1, f2 = font(20), font(15)
    name = hero['name'] + ('  [当前图: %s]' % hero['img'] if hero.get('img') else '')
    draw.text((x, y), name, fill=(0, 0, 0), font=f1)
    y += 30
    cells = list(hero['cands'])
    if hero.get('img'):
        cells.append({'file': '@cur', 'from': 'cur', 'title': os.path.basename(hero['img']), 'cur': hero['img']})
    rows = (len(cells) + COLS - 1) // COLS
    for i, cd in enumerate(cells):
        cx = x + (i % COLS) * (CELL + GAP)
        cy = y + (i // COLS) * (CELL + LABEL_H + GAP)
        if cd.get('cur'):
            fp = os.path.join(ROOT, 'src', 'renderer', 'img', os.path.basename(cd['cur']))
        else:
            fp = os.path.join(ROOT, 'evidence', 'qc23-cand', cd.get('dir') or hero['name'], cd['file'])
        try:
            im = Image.open(fp).convert('RGB')
        except Exception as e:
            print('MISS', fp, e); continue
        im.thumbnail((CELL, CELL))
        px, py = cx + (CELL - im.width) // 2, cy + (CELL - im.height) // 2
        draw.rectangle([cx, cy, cx + CELL, cy + CELL], fill=(240, 240, 240), outline=(200, 200, 200))
        draw.rectangle([px, py, px + im.width, py + im.height], fill=(255, 255, 255))
        # 直接贴图
        page.paste(im, (px, py))
        code = 'CUR' if cd.get('cur') else CODE.get(cd['from'], '?')
        col = (120, 120, 120) if cd.get('cur') else COLOR.get(code, (0, 0, 0))
        lab = ('%s %s' % (code, os.path.basename(cd['file']))) if not cd.get('cur') else 'CUR 现图'
        draw.rectangle([cx, cy + CELL + 2, cx + CELL, cy + CELL + LABEL_H], fill=(255, 255, 255))
        draw.text((cx + 4, cy + CELL + 6), lab, fill=col, font=f2)
        for ln in wrap(cd.get('title', '')[:60], f2, CELL - 8, draw):
            draw.text((cx + 4, cy + CELL + 6 + 18 * (wrap(cd.get('title', '')[:60], f2, CELL - 8, draw).index(ln) + 1)), ln, fill=(0, 0, 0), font=f2)
    return y + rows * (CELL + LABEL_H + GAP) + 6

spec = json.load(open(SPEC, encoding='utf-8'))
os.makedirs(OUT, exist_ok=True)
page_w = COLS * CELL + (COLS - 1) * GAP + 40
pages = [spec[i:i + PER_PAGE] for i in range(0, len(spec), PER_PAGE)]
for pi, batch in enumerate(pages, 1):
    f1 = font(20)
    block_hs = []
    page = Image.new('RGB', (page_w, 100), (255, 255, 255))
    # 先量高：用临时 draw 量每个块高
    tmp = Image.new('RGB', (page_w, 10), (255, 255, 255))
    d2 = ImageDraw.Draw(tmp)
    for hero in batch:
        n = len(hero['cands']) + (1 if hero.get('img') else 0)
        rows = (n + COLS - 1) // COLS
        block_hs.append(30 + rows * (CELL + LABEL_H + GAP) + 6)
    page_h = 30 + sum(block_hs)
    page = Image.new('RGB', (page_w, page_h), (255, 255, 255))
    draw = ImageDraw.Draw(page)
    ty = 10
    draw.text((20, ty), 'qc23 选图复核 p%d' % pi, fill=(0, 0, 0), font=f1)
    y = 40
    for hero, bh in zip(batch, block_hs):
        y = hero_block(draw, hero, 20, y)
    page.save(os.path.join(OUT, 'pick-p%d.png' % pi))
    print('pick-p%d.png %dx%d' % (pi, page_w, page_h))
