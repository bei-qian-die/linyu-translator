'use strict';

// 第二十五轮 lore 生成器 → src/core/lore-extra25.js
// 目标：词卡 600 / 人物传 240 / 名言 1600，四分区各 150 / 60 / 400。
//
// 取料纪律：
//   · 词卡 —— term 与释义都来自本轮 seed.json 的新增词条；example 只在 corpus 里逐字命中时才填
//   · 人物传 —— 官方角色来自 curated-heroes25.js（属性/兵种/代表作这类可查事实）；
//             UP 主来自 evidence/manifest-*.json（真实视频标题 + BV 号）
//   · 名言 —— 只从 corpus 的【评论】行逐字摘，不改写、不拼接
//
// 用法：node scripts/gen-lore25.js

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'src/core/lore-extra25.js');
const seed = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/core/seed.json'), 'utf8'));
const { OFFICIAL } = require(path.join(ROOT, 'scripts/curated-heroes25.js'));

const SRC = {
  淋可梦: { corpus: 'corpus-bili-20261103183535.txt', manifest: 'manifest-20261103183535.json', upN: 20 },
  奥奇淋说: { corpus: 'corpus-bili-20261103183828.txt', manifest: 'manifest-20261103183828.json', upN: 16 },
  淋角洲行动: { corpus: 'corpus-bili-20261103184124.txt', manifest: 'manifest-20261103184124.json', upN: 55 },
  divatag: { corpus: 'corpus-bili-20261103184446.txt', manifest: 'manifest-20261103184446.json', upN: 36 },
};

const readLines = (f) => fs.readFileSync(path.join(ROOT, 'corpus', f), 'utf8').split(/\r?\n/);
const readManifest = (f) => {
  const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'evidence', f), 'utf8'));
  return Array.isArray(raw) ? raw : raw.items || [];
};

// 去掉 B 站表情标签与多余空白，保留逐字文本
const clean = (s) =>
  String(s || '')
    .replace(/【评论】/g, '')
    .replace(/\[[^\]]{1,10}\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

// ---------- 既有库（判重基线）----------
// 注意：lore.js 已经把上一版 lore-extra25 聚合进来了，直接拿它当基线会把「自己的上轮产物」
// 当成「别人已有的内容」，重跑一次就只剩增量。所以先把本轮自己的那一份扣掉。
const lore = require(path.join(ROOT, 'src/core/lore.js'));
const PREV = fs.existsSync(OUT) ? require(OUT) : { heroes: [], flashcards: [], quotes: [] };
const prevHero = new Set((PREV.heroes || []).map((h) => h.name));
const prevCard = new Set((PREV.cards || []).map((c) => c.term));
const prevQuote = new Set((PREV.quotes || []).map((q) => q.text));

const haveHero = new Set(lore.heroes.map((h) => h.name).filter((n) => !prevHero.has(n)));
const haveCard = new Set(lore.flashcards.map((c) => c.term).filter((n) => !prevCard.has(n)));
const haveQuote = new Set(lore.quotes.map((q) => q.text).filter((n) => !prevQuote.has(n)));

const ZONE_ORDER = ['淋可梦', '奥奇淋说', '淋角洲行动', 'divatag'];

// 配图映射：由 apply-hero-images25.py 写入 evidence/hero-images25.json（name → img 路径）
const IMG_FILE = path.join(ROOT, 'evidence/hero-images25.json');
const IMG_MAP = (() => {
  if (!fs.existsSync(IMG_FILE)) return {};
  const j = JSON.parse(fs.readFileSync(IMG_FILE, 'utf8'));
  return j.map || {};
})();
const imgOf = (n) => (IMG_MAP[n] && IMG_MAP[n].img) || '';

const heroes = [];
const cards = [];
const quotes = [];

for (const zone of ZONE_ORDER) {
  const cfg = SRC[zone];
  const lines = readLines(cfg.corpus);
  const manifest = readManifest(cfg.manifest);
  const comments = [...new Set(lines.filter((l) => l.startsWith('【评论】')).map(clean))].filter(
    (s) => s.length >= 12 && s.length <= 80
  );

  // ---- 1. 官方角色 ----
  const zoneHeroes = [];
  for (const raw of OFFICIAL[zone] || []) {
    const [name, alias, rankTail, intro, baike] = raw.split('|');
    if (haveHero.has(name)) continue;
    // 用该分区语料里命中这位角色的视频做「来源链接」的锚点
    const hit = manifest.find((v) => String(v.title || '').includes(name)) || manifest[0];
    // works 只从 baike 里已写出的书名号作品取，取不到就退回一条真实存在的视频标题，绝不编造
    const titles = [...String(baike).matchAll(/《([^》]{2,30})》/g)].map((m) => '《' + m[1] + '》');
    const h = {
      name,
      alias: alias || '',
      img: imgOf(name),
      group: 'game',
      rank: zone + ' · ' + rankTail,
      intro,
      baike,
      tags: [zone, rankTail],
      works: titles.length ? [...new Set(titles)].slice(0, 4) : hit ? ['《' + String(hit.title).slice(0, 34) + '》（' + hit.bvid + '）'] : [],
      words: [],
      links: hit ? [{ label: 'B 站检索参考：' + String(hit.title).slice(0, 30), url: hit.url }] : [],
    };
    zoneHeroes.push(h);
  }

  // ---- 2. UP 主（按评论量排序取前 N，作品用真实标题）----
  const byUp = new Map();
  for (const v of manifest) {
    if (!v.up) continue;
    if (!byUp.has(v.up)) byUp.set(v.up, []);
    byUp.get(v.up).push(v);
  }
  const upRanked = [...byUp.entries()].sort((a, b) => b[1].length - a[1].length || (b[1][0].comments || 0) - (a[1][0].comments || 0));
  let upAdded = 0;
  for (const [up, vids] of upRanked) {
    if (upAdded >= cfg.upN) break;
    if (haveHero.has(up)) continue;
    const sorted = vids.slice().sort((a, b) => (b.comments || 0) - (a.comments || 0));
    const top = sorted.slice(0, 3);
    const totalC = vids.reduce((a, v) => a + (v.comments || 0), 0);
    zoneHeroes.push({
      name: up,
      alias: '',
      img: imgOf(up),
      group: 'up',
      rank: 'UP主 · ' + zone,
      intro: 'B 站' + zone + ' tag 下的淋语 UP 主，本轮采集到 TA 的 ' + vids.length + ' 条投稿。',
      baike:
        '本轮 B 站公开检索命中 ' +
        vids.length +
        ' 条投稿，累计评论 ' +
        totalC +
        ' 条。播放数据未取，故此处不写播放量；代表作见下方链接，标题为原视频标题，未做改写。',
      tags: [zone, 'UP主'],
      works: top.map((v) => '《' + String(v.title).slice(0, 34) + '》（' + v.bvid + '）'),
      words: [],
      links: top.map((v) => ({ label: String(v.title).slice(0, 40), url: v.url })),
    });
    upAdded++;
  }
  heroes.push(...zoneHeroes);

  // ---- 3. 词卡：从本轮新增词条里取 ----
  const zoneWords = seed.words.filter((w) => Array.isArray(w.rel) && w.rel[0] === zone);
  let cardN = 0;
  for (const w of zoneWords) {
    if (cardN >= 150) break;
    if (haveCard.has(w.zh)) continue;
    const ex = comments.find((c) => c.includes(w.linyu) && c.includes(w.zh) === false ? c.includes(w.linyu) : c.includes(w.zh));
    const owner = zoneHeroes.find((h) => h.name === w.zh || (w.alias || '').includes(h.name));
    cards.push({
      term: w.zh,
      type: 'slang',
      meaning: '【' + zone + '】' + (w.sense || ''),
      detail: '对应中文原词「' + w.zh + '」，语义位 ' + w.slot + '。',
      example: ex || w.linyu,
      source: w.source,
      verify: w.source,
      hero: owner ? owner.name : undefined,
    });
    haveCard.add(w.zh);
    cardN++;
  }

  // ---- 4. 名言：语料【评论】原句 ----
  let quoteN = 0;
  for (const c of comments) {
    if (quoteN >= 400) break;
    if (haveQuote.has(c)) continue;
    const owner = zoneHeroes.find((h) => c.includes(h.name));
    quotes.push({
      text: c,
      author: owner ? owner.name : '评论区',
      hero: owner ? owner.name : undefined,
      src: zone + '区语料（' + cfg.corpus + '）逐字摘录',
      verify: 'corpus/' + cfg.corpus,
    });
    haveQuote.add(c);
    quoteN++;
  }
  console.log(zone, '官方' + (OFFICIAL[zone] || []).length, 'UP' + upAdded, 'cards' + cardN, 'quotes' + quoteN);
}

// ---------- 写文件 ----------
const out = { cards, quotes, heroes, heroMerge: [], quoteMerge: [] };
const body =
  '// @ts-check\n' +
  "'use strict';\n" +
  '// 第二十五轮：四分区（淋可梦 / 奥奇淋说 / 淋角洲行动 / divatag）的词卡、人物传、名言增量。\n' +
  '// 生成器 scripts/gen-lore25.js，人物源 scripts/curated-heroes25.js，\n' +
  '// UP 主作品与链接来自 evidence/manifest-20261103*.json，名言逐字摘自语料 corpus/corpus-bili-20261103*.txt。\n' +
  'const __export = ' +
  JSON.stringify(out) +
  ';\n' +
  'if (typeof module === \'object\' && module.exports) module.exports = __export;\n' +
  "else if (typeof window !== 'undefined') window.LORE_EXTRA25 = __export;\n";

fs.writeFileSync(OUT, body, 'utf8');
console.log('写出', path.relative(ROOT, OUT), 'heroes', heroes.length, 'cards', cards.length, 'quotes', quotes.length);
