'use strict';

// 第二十一轮词卡生成：从本轮策展词库反推，例句一律从语料里原样摘录。
//
// 纪律（同 19/20 号）：
//   - term 必须是真实存在的叫法（来自 curated-linyu21.js 的 linyu）
//   - example 必须是 corpus/*.txt 里逐字存在的一行，不改写、不拼接
//   - meaning 直接取词条的 sense（不另编一套解释）
//   - score 由语料出现次数决定，决定卡片在列表里的排序
//
// 用法: node scripts/build-cards21.js [目标条数]
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'scripts/curated-cards21.json');
const TARGET = Number(process.argv[2] || 80);

const { WORDS } = require(path.join(ROOT, 'scripts/curated-linyu21.js'));
const { OW_STRONG } = require(path.join(ROOT, 'scripts/_owctx21.js'));

// 已有词卡不再重复收录（「惹」「阿三」这类早年就进库了）
const EXISTING = new Set();
try {
  const lore = require(path.join(ROOT, 'src/core/lore.js'));
  for (const c of lore.flashcards || []) EXISTING.add(normKey(c.term));
} catch { /* 读不到就只按本轮去重 */ }
function normKey(s) {
  return String(s || '').replace(/[\s，。、！？；："'（）()【】[\]…~～·—\-_/\\|,.:;!?]/g, '').toLowerCase();
}

const norm = (s) =>
  String(s || '')
    .replace(/[\s，。、！？；：""''（）()【】[\]…~～·—\-_/\\|,.:;!?"']/g, '')
    .toLowerCase();

// 例句池只取**守望语境**，不能拿别的分区的句子来凑：
//   1) 本轮（21 号）新采的语料文件
//   2) scripts/_owctx21.js 判定的守望语境行（前几轮里讲到守望的段落）
// 否则会出现「阿三」的例句来自原神、「皮肤」的例句来自医美这种串味。
const CORPUS = path.join(ROOT, 'corpus');
const POOL = new Set();
for (const f of fs.readdirSync(CORPUS).filter((x) => /^corpus.*21.*\.txt$/.test(x)).sort()) {
  for (const line of fs.readFileSync(path.join(CORPUS, f), 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    POOL.add(t.replace(/^【(评论|弹幕|视频|UP|简介|标签|正文|网页)】\s*/, '').trim());
  }
}
for (const line of require(path.join(ROOT, 'scripts/_owctx21.js')).load().lines) POOL.add(String(line).trim());
const rawLines = [...POOL].filter(Boolean);

const cards = [];
for (const w of WORDS) {
  const key = norm(w.linyu);
  if (!key) continue;

  // 例句：长度合适的、含该词的整行，且**这一行本身带守望信息**
  // （只含「皮肤」「对面」这类通用词、却不提任何守望元素的句子，不算守望例句）
  const hits = rawLines.filter((l) => {
    const n = norm(l);
    if (!n.includes(key)) return false;
    // 去掉「整行就是这个词本身」的情况，那不是例句
    if (n === key) return false;
    if (n.length < key.length + 4) return false;
    if (n.length > 90) return false;
    if (/^@/.test(l)) return false;                       // 纯 @ 名单
    if (!OW_STRONG.test(l)) return false;                 // 必须带守望特征
    return true;
  });
  if (!hits.length) continue;

  // 选「像一句话」的那条：长度越接近 28 字越好，太短是碎词、太长是整段简介
  const fit = (l) => Math.abs(norm(l).length - 28);
  hits.sort((a, b) => fit(a) - fit(b));
  const example = hits[0];

  cards.push({
    term: w.linyu,
    zh: w.zh,
    type: 'slang',
    meaning: w.sense,
    example,
    source: w.source,
    slot: w.slot,
    score: Math.min(20, 4 + Math.round(Math.log2(hits.length + 1) * 3)),
    _n: hits.length,
  });
}

// 去重（term 相同的只留第一个）后按热度排序
const seen = new Set();
const uniq = [];
for (const c of cards.sort((a, b) => b._n - a._n)) {
  const k = norm(c.term);
  if (seen.has(k) || EXISTING.has(k)) continue;
  seen.add(k);
  uniq.push(c);
}

const picked = uniq.slice(0, TARGET).map(({ _n, ...rest }) => rest);
fs.writeFileSync(OUT, JSON.stringify(picked, null, 2) + '\n', 'utf8');
console.error(`[cards21] 候选 ${uniq.length}，写出 ${picked.length} 条 → ${path.relative(ROOT, OUT)}`);
