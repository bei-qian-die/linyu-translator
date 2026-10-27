'use strict';

// 第二十一轮的统一验真层。
//
// 为什么需要它：curated 数据里难免混进「我知道这个词、但语料里没有」的写法
// （比如把毒液写成台译「猛毒」、把惩罚者写成旧译「制裁者」）。这类内容不是幻觉，
// 但本项目纪律是**每一条落库文本都要能逐字回源**，不能靠「我记得」。
//
// 于是把「什么算可回源」收敛到这一个文件：apply 与 verify 都调它，
// 口径不会漂，也不会出现「脚本删了但报告还在」的两套标准。
//
// 命中源（任一即可）：
//   1) corpus/*.txt —— 本轮采集的 B 站标题/评论/弹幕、官网、百科
//   2) 既有 seed.json / lore.js —— 前二十轮已经验真过的词与句
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const norm = (s) =>
  String(s || '')
    .replace(/[\s，。、！？；：""''（）()【】［］[\]…~～·—\-_/\\|,.:;!?"']/g, '')
    .toLowerCase();

let blob = '';
for (const f of fs.readdirSync(path.join(ROOT, 'corpus')).filter((x) => x.endsWith('.txt') && true)) {
  blob += fs.readFileSync(path.join(ROOT, 'corpus', f), 'utf8') + '\n';
}
// B 站评论里的 [委屈] 这类表情占位符是渲染产物、不是正文，
// 转录时常被清掉；比对时两边都去一次，避免「原句明明在、却查不到」。
const stripEmoji = (s) => String(s || '').replace(/\[[^\]]{1,24}\]/g, '');

let known = '';
try {
  const seed = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/core/seed.json'), 'utf8'));
  const L = require(path.join(ROOT, 'src/core/lore.js'));
  const parts = [];
  for (const w of seed.words || []) parts.push(w.zh, w.linyu, w.alias);
  for (const c of L.flashcards || []) parts.push(c.term, c.example);
  for (const h of L.heroes || []) parts.push(h.name, h.alias, h.intro);
  for (const q of L.quotes || []) parts.push(q.text);
  known = parts.filter(Boolean).join('\n');
} catch {
  /* 既有数据读不到就只用语料判定 */
}

const HAY = norm(blob) + '\u0000' + norm(stripEmoji(blob)) + '\u0000' + norm(known);

/** 这段文本能否逐字回源 */
const attested = (s) => {
  const n = norm(s);
  return n ? HAY.includes(n) : false;
};

const splitAl = (s) =>
  String(s || '')
    .split(/[、,，/|]/)
    .map((x) => x.trim())
    .filter(Boolean);

/**
 * 过滤一批词条：
 *   - linyu 回不了源 → 整条丢弃（不再是「淋语译法」，只剩我编的别名）
 *   - alias 里回不了源的单项 → 摘掉，其余保留
 *
 * 注意 zh 不做校验：本项目的 zh 是「词条名」，常常是描述性的
 * （「猩红女巫的自称」「美国队长的称呼」），本来就不会逐字出现在语料里；
 * 真正需要回源的是译法本身和别名。
 * 返回 { words, dropped, trimmed }
 */
const pruneWords = (WORDS) => {
  const words = [];
  const dropped = [];
  const trimmed = [];
  for (const w of WORDS) {
    const linyu = w.linyu || w.tr || '';
    if (!linyu) {
      dropped.push({ zh: w.zh, why: '缺译法字段' });
      continue;
    }
    if (!attested(linyu)) {
      dropped.push({ zh: w.zh, linyu, why: '译法未在语料出现' });
      continue;
    }
    const al = splitAl(w.alias).filter((a) => a !== linyu);
    const keep = al.filter((a) => attested(a));
    const lost = al.filter((a) => !attested(a));
    if (lost.length) trimmed.push({ zh: w.zh, lost });
    words.push({ ...w, linyu, alias: keep.join('、') });
  }
  return { words, dropped, trimmed };
};

module.exports = { attested, pruneWords, splitAl, norm, corpusChars: blob.length };
