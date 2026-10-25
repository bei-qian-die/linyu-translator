'use strict';

// 第十四轮 lore 素材开采（只读语料 → evidence/lore14-*.txt / .json，供人工挑选）。
// 三条产线：
//   QUOTES 候选：新语料里 >=12 字、带淋语特征字的整行原文（弹幕/评论），重复刷屏的排前面
//   CARDS  候选：完整词段级「黑话/称号/专名」（我X、X婆、淋X、X Daddy、通讯录X…）+ 命中行样例
//   HEROES 候选：新语料里出现 >=2 次的 UP 名，以及名字本身就被淋写过的角色/人物
// 每条都带 BV + 标题，方便直接写进 curated 的 src/verify。

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CORPUS_DIR = path.join(ROOT, 'corpus');
const EV = path.join(ROOT, 'evidence');
const NEW_RE = /^corpus-bili-20261025/;

// title -> {bvid,url,up} （本轮 manifest 反查）
const idx = new Map();
for (const g of fs.readdirSync(EV)) {
  if (!/^manifest-.*\.json$/.test(g)) continue;
  try {
    for (const v of JSON.parse(fs.readFileSync(path.join(EV, g), 'utf8'))) {
      if (v && v.title && v.bvid && !idx.has(v.title)) idx.set(v.title, v);
    }
  } catch {
    /* 忽略个别格式不同的 manifest */
  }
}

const files = fs.readdirSync(CORPUS_DIR).filter((f) => NEW_RE.test(f));
if (!files.length) {
  console.error('没有本轮新语料');
  process.exit(1);
}
const blocks = [];
for (const f of files) {
  let cur = null;
  for (const raw of fs.readFileSync(path.join(CORPUS_DIR, f), 'utf8').split(/\r?\n/)) {
    const l = raw.trim();
    if (!l || l.startsWith('#')) continue;
    const mv = l.match(/^【(视频|UP|简介|标签|弹幕|评论)】(.*)$/);
    if (!mv) continue;
    const [, k, v] = mv;
    if (k === '视频') {
      cur = { file: f, title: v.trim(), up: '', desc: '', tags: '', dm: [], cmt: [] };
      blocks.push(cur);
      continue;
    }
    if (!cur) continue;
    if (k === 'UP') cur.up = v.trim();
    else if (k === '简介') cur.desc = v.trim();
    else if (k === '标签') cur.tags = v.trim();
    else if (k === '弹幕') cur.dm.push(v.trim());
    else if (k === '评论') cur.cmt.push(v.trim());
  }
}
for (const b of blocks) {
  const m = idx.get(b.title);
  b.bv = m ? m.bvid : '';
  b.url = m ? m.url : '';
}

const MARK = /(淋|阴|泔|惹|噜|厚|靴|素|珍|尊|本可|本仙女|本猪|本祝|姐|婆|酱|滴|哒|熏|翻|菇|滴|Daddy|daddy|通讯录|地才|吸入|灰机|婊|贝|茎|汉|兰|鸡|蕾|兽|饺|糕|杯糕)/;
const STRONG = /(淋语|高等淋语|本可|本仙女|本猪妞|靴靴|珍素|尊素|就素|地才|吸入|通讯录|姐圈|淋耀|淋盟|淋格|淋神|淋日|淋明|淋国|阴雄|绝区淋|守望淋锋|星淋铁道|完颜|周阴|那艺娜|三梦|万人迷|郭老师|鹅妈妈|楼兰|肘姐|新酱|惹|噜|厚)/;
const norm = (s) => String(s || '').replace(/\s+/g, '').toLowerCase();

// ---------------- QUOTES 候选
const qmap = new Map();
for (const b of blocks) {
  for (const kind of ['cmt', 'dm']) {
    for (const t of b[kind]) {
      if (t.length < 12 || t.length > 120) continue;
      if (!MARK.test(t)) continue;
      const k = norm(t);
      if (!qmap.has(k)) qmap.set(k, { text: t, count: 0, videos: new Map() });
      const e = qmap.get(k);
      e.count++;
      const label = (b.bv || '') + ' ' + b.title;
      e.videos.set(label, (e.videos.get(label) || 0) + 1);
      if (!e.bv) {
        e.bv = b.bv;
        e.title = b.title;
        e.up = b.up;
        e.url = b.url;
        e.kind = kind;
        e.file = b.file;
      }
    }
  }
}
const quotesAll = [...qmap.values()].sort((a, b) => b.count - a.count || b.text.length - a.text.length);
const qlines = [];
qlines.push(`### QUOTES 候选（新语料 >=12 字带淋味整行）共 ${quotesAll.length}，重复>=2 的 ${quotesAll.filter((q) => q.count >= 2).length} 条`);
quotesAll.slice(0, 500).forEach((q) => {
  qlines.push(`[${q.count}] ${q.bv || '-'} | ${q.kind} | ${q.up || ''} | ${String(q.title).slice(0, 34)}\n     ${q.text.slice(0, 90)}`);
});
fs.writeFileSync(path.join(EV, 'lore14-quotes.txt'), qlines.join('\n'), 'utf8');

// ---------------- CARDS 候选（整词级黑话/称号）
const termC = new Map();
const PATTERNS = [
  /^我[\u4e00-\u9fa5A-Za-z]{1,2}$/, // 我妲 / 我泔 / 我狸
  /^[\u4e00-\u9fa5]{1,3}(婆|女|姐|妹|王|酱|宝|神|仙)$/, // 滚地婆 / 摩西女
  /^(阴|淋|母|猪|鸡|佛|婊|姐|喜)[\u4e00-\u9fa5]{1,3}$/, // 阴者自阴 / 淋角洲
  /^[\u4e00-\u9fa5]{1,4}(Daddy|daddy|dady)$/,
  /^[\u4e00-\u9fa5]{2,6}(淋|阴)[\u4e00-\u9fa5]{0,4}$/, // 王者淋耀 / 星淋铁道
  /^(通讯录|姐圈)[\u4e00-\u9fa5]{1,5}$/,
];
function bump(t, b, kind) {
  const k = norm(t);
  if (!k || k.length < 2 || k.length > 8) return;
  if (!termC.has(k)) termC.set(k, { term: t, count: 0, lines: new Map(), videos: new Set() });
  const e = termC.get(k);
  e.count++;
  e.videos.add(b.bv || b.title);
  if (e.lines.size < 3) e.lines.set(String(kind) + '|' + (b.bv || '') + '|' + t.slice(0, 70), 1);
}
for (const b of blocks) {
  const textAll = [b.title, b.desc, b.tags, ...b.dm, ...b.cmt];
  for (const t of textAll) {
    for (const seg of String(t || '').replace(/[\s，。！？、；：,.!?;:"'“”‘’()（）【】\[\]~～^*#@$%&+=|\\/_\-《》]+/g, '#').split('#')) {
      if (seg.length < 2 || seg.length > 8) continue;
      if (!PATTERNS.some((p) => p.test(seg))) continue;
      if (!MARK.test(seg)) continue;
      bump(seg, b, b.title.includes(seg) ? 'title' : 'body');
    }
  }
}
const terms = [...termC.values()].sort((a, b) => b.count - a.count || b.videos.size - a.videos.size);
const tlines = [];
tlines.push(`### CARDS/术语 候选（整词级）共 ${terms.length}`);
terms.slice(0, 420).forEach((t) => {
  tlines.push(`[${t.count}次/${t.videos.size}视频] ${t.term}\n     ${[...t.lines.keys()].slice(0, 2).join('\n     ')}`);
});
fs.writeFileSync(path.join(EV, 'lore14-terms.txt'), tlines.join('\n'), 'utf8');

// ---------------- HEROES 候选
const ups = new Map();
for (const b of blocks) {
  if (!b.up) continue;
  if (!ups.has(b.up)) ups.set(b.up, { up: b.up, n: 0, videos: [] });
  const e = ups.get(b.up);
  e.n++;
  if (e.videos.length < 4) e.videos.push(`${b.bv} ${String(b.title).slice(0, 40)}`);
}
const upList = [...ups.values()].filter((u) => u.n >= 2).sort((a, b) => b.n - a.n);
// 名字本身被淋写的角色/人物：出现在标题或弹幕里的 3~6 字淋写昵称
const charish = terms.filter((t) => t.videos.size >= 1 && /^(我[\u4e00-\u9fa5]{1,2}|[\u4e00-\u9fa5]{1,3}(婆|女|姐|酱))$/.test(t.term));
const hlines = [];
hlines.push(`### UP 候选（本轮新语料出现 >=2 个视频）共 ${upList.length}`);
upList.slice(0, 200).forEach((u) => hlines.push(`[${u.n}] ${u.up}\n     ${u.videos.join('\n     ')}`));
hlines.push('');
hlines.push(`### 淋写角色/称号候选（可作 hero-alias / game 人物）共 ${charish.length}`);
charish.slice(0, 200).forEach((c) => hlines.push(`[${c.count}/${c.videos.size}] ${c.term}  ← ${[...c.lines.keys()][0] || ''}`));
fs.writeFileSync(path.join(EV, 'lore14-heroes.txt'), hlines.join('\n'), 'utf8');

fs.writeFileSync(
  path.join(EV, 'lore14-cand.json'),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      files,
      blocks: blocks.length,
      withBv: blocks.filter((b) => b.bv).length,
      chars: blocks.reduce((a, b) => a + b.title.length + b.desc.length + b.dm.reduce((x, y) => x + y.length, 0) + b.cmt.reduce((x, y) => x + y.length, 0), 0),
      quotes: quotesAll.slice(0, 1200),
      terms: terms.slice(0, 900),
      ups: upList.slice(0, 300),
    },
    null,
    2
  ) + '\n',
  'utf8'
);
console.log(
  `blocks=${blocks.length} withBv=${blocks.filter((b) => b.bv).length} quoteCand=${quotesAll.length} termCand=${terms.length} upCand=${upList.length}`
);
