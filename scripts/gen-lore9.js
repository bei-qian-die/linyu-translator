'use strict';

// 生成 src/core/lore-extra10.js：第九轮 42 位游戏人物 + 每位一张外号卡。
// 外号/出处全部来自 seed.json 与 scripts/curated-heroes9.js；图片来自 evidence/hero-images9.json。
// 不做无出处的设定补写，名言另行从语料原行生成。

const fs = require('fs');
const path = require('path');
const seed = require('../src/core/seed.json');
const { heroes: plan } = require('./curated-heroes9');

const imgReport = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'evidence', 'hero-images9.json'), 'utf8'));
const imgOf = imgReport.assign || {};
const imgMeta = new Map((imgReport.report || []).map((r) => [r.name, r]));
const wordsByName = new Map(seed.words.map((w) => [w.zh, w]));

// lore.js 现在已经把 extra10 合并进来了；生成时要拿“除 extra10 之外的基线”，
// 否则重跑会把上一轮自己生成的人物/词卡当成已存在而全部跳过。
const extra10Path = path.join(__dirname, '..', 'src', 'core', 'lore-extra10.js');
const prev = fs.existsSync(extra10Path)
  ? require(extra10Path)
  : { heroes: [], cards: [], quotes: [] };
const prevHeroNames = new Set((prev.heroes || []).map((h) => h.name));
const prevCardTerms = new Set((prev.cards || []).map((c) => c.term));
const prevQuoteTexts = new Set((prev.quotes || []).map((q) => String(q.text || '').replace(/\s+/g, '')));
const lore = require('../src/core/lore.js');
const baselineHeroes = lore.heroes.filter((h) => !prevHeroNames.has(h.name));
const baselineCards = lore.flashcards.filter((c) => !prevCardTerms.has(c.term));
const baselineQuotes = lore.quotes.filter((q) => !prevQuoteTexts.has(String(q.text || '').replace(/\s+/g, '')));

const existingNames = new Set(baselineHeroes.map((h) => h.name));
const existingTerms = new Set(baselineCards.map((c) => c.term));

const uniq = (arr) => [...new Set(arr.map((s) => String(s || '').trim()).filter(Boolean))];
const splitAlias = (s) => String(s || '').split(/[、,，/]/).map((x) => x.trim()).filter(Boolean);

const heroes = [];
const cards = [];
const skipped = [];

for (const [name, game, title, official, blurb, source] of plan) {
  if (existingNames.has(name)) {
    skipped.push(name);
    continue;
  }
  const w = wordsByName.get(name);
  if (!w) {
    skipped.push(name + '（词库缺词条）');
    continue;
  }
  if (!imgOf[name]) {
    skipped.push(name + '（缺图）');
    continue;
  }
  const aliasList = uniq(splitAlias(w.alias).concat(splitAlias(w.linyu)));
  const primary = w.linyu || title;
  const rel = uniq([name].concat(Array.isArray(w.rel) ? w.rel : [])).filter((z) => wordsByName.has(z));
  const links = [{ label: '淋语外号出处', url: source }];
  const meta = imgMeta.get(name);
  if (meta && meta.url) links.push({ label: '配图来源（' + (meta.how || '百度图库') + '）', url: meta.url });

  heroes.push({
    name,
    alias: aliasList.join(' / '),
    img: imgOf[name],
    group: 'game',
    grp: 'game',
    rank: game + ' · · ' + title,
    intro: official + ' 淋语区把它写作「' + primary + '」，' + blurb,
    baike: official + ' ' + blurb + ' 本条按词库既有外号与可回源出处整理，未添加无出处的设定。',
    tags: uniq([game, title].concat(aliasList.slice(0, 8))),
    works: uniq([title].concat(aliasList.slice(0, 5))),
    words: rel,
    links,
  });

  const cardTerm = primary;
  if (!existingTerms.has(cardTerm)) {
    existingTerms.add(cardTerm);
    cards.push({
      term: cardTerm,
      type: 'meme',
      hero: name,
      aliases: aliasList.slice(0, 12),
      meaning: blurb,
      example: '「' + primary + '」是' + name + '在' + game + '里的淋语外号。',
      source,
      verify: source,
    });
  }
}

// —— 词卡补充：scripts/cards9.json（由 gen-cards9.js 从词库生成，全部带 verify） ——
const cardsFile = path.join(__dirname, 'cards9.json');
if (fs.existsSync(cardsFile)) {
  for (const c of JSON.parse(fs.readFileSync(cardsFile, 'utf8'))) {
    if (!c.term || existingTerms.has(c.term)) continue;
    existingTerms.add(c.term);
    cards.push(c);
  }
}

// —— 名言补充：scripts/quotes9.json（由 mine-quotes9.js 从语料原行抽取） ——
const quotesFile = path.join(__dirname, 'quotes9.json');
const quotes = [];
if (fs.existsSync(quotesFile)) {
  const seen = new Set(baselineQuotes.map((q) => String(q.text || '').replace(/\s+/g, '')));
  for (const q of JSON.parse(fs.readFileSync(quotesFile, 'utf8'))) {
    const k = String(q.text || '').replace(/\s+/g, '');
    if (!k || seen.has(k)) continue;
    seen.add(k);
    quotes.push(q);
  }
}

const body = `'use strict';

// 第九轮内容（2026-10-25）：42 位游戏人物 + 42 张外号卡。
// 生成器：scripts/gen-lore9.js；外号/出处来自 seed.json 与 scripts/curated-heroes9.js，
// 图片来自 evidence/hero-images9.json（百度图库真实图，无 AI 图）。

const cards = ${JSON.stringify(cards, null, 2)};

const quotes = ${JSON.stringify(quotes, null, 2)};

const heroes = ${JSON.stringify(heroes, null, 2)};

const __export = { cards, quotes, heroes };
if (typeof module === 'object' && module.exports) module.exports = __export;
else if (typeof window !== 'undefined') window.LORE_EXTRA10 = __export;
`;

fs.writeFileSync(path.join(__dirname, '..', 'src', 'core', 'lore-extra10.js'), body, 'utf8');
console.log(`已生成 lore-extra10.js：人物 ${heroes.length}，词卡 ${cards.length}，名言 ${quotes.length}`);
if (skipped.length) console.log('跳过：' + skipped.join('、'));
