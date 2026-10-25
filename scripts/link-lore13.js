'use strict';

// 第十三轮：把 708 条词卡 / 1944 条名言里无 hero 归属的条目，按「最长别名优先」
// 自动挂到 164 个人物身上，产出 evidence/hero-links13.json 供人工复核。
//
// 匹配策略（宁可留空，绝不误挂）：
//   1. 每个人物的候选别名 = name + alias 按 、,，/;； 切分，去空白、转小写、长度 >=2。
//   2. 词卡文本分两层：term（标题级，最强信号）与 meaning+example（正文级）；
//      名言只有 text（正文级）。
//   3. 一条文本里所有命中的别名都收集；排序优先级：
//      term 命中 > 正文命中 → 别名等于人物本名 > 别名越长 > group（real<game<up<其它）> 原始顺序。
//   4. 可靠性闸门：
//      - 别名只出现在 term 且与 term 完全相等 → 视为「这张卡就是说这个人物」，无条件挂（high）；
//      - 出现在正文的别名：长度 >=3 才允许挂，但 GENERIC_BODY 里的人名/普通名词除外；
//        长度 ==2 的只允许挂 SPECIFIC2，GENERIC2（河马/医生/楼主…这类通用词）一律不挂；
//      - 被闸门拦掉而最终留空的，计入 unreliable 统计。
//   5. 一条文本命中 >=2 个不同人物 → 记进 conflicts，供人工复核（仍按规则挂第一）。
//
// 本脚本只读 lore 与产出 evidence JSON，不改动 src/core 下任何文件。
// 用法: node scripts/link-lore13.js
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const lore = require(path.join(ROOT, 'src/core/lore'));

const norm = (s) => String(s == null ? '' : s).replace(/\s+/g, '').toLowerCase();

// ---- 1. 人物别名索引 ----
const GROUP_ORDER = { real: 0, game: 1, up: 2 };
const heroes = lore.heroes.map((h, idx) => {
  const aliases = new Set();
  const add = (raw) => {
    const n = norm(raw);
    if (n.length >= 2) aliases.add(n);
  };
  add(h.name);
  String(h.alias || '')
    .split(/[、,，/;；]/)
    .forEach(add);
  return {
    name: h.name,
    group: GROUP_ORDER[h.group] == null ? 3 : GROUP_ORDER[h.group],
    idx,
    aliases: [...aliases].map((a) => ({ alias: a, isName: a === norm(h.name) })),
  };
});

// 别名 -> 人物列表（同名别名即冲突源）
const aliasOwners = new Map();
for (const h of heroes) {
  for (const a of h.aliases) {
    if (!aliasOwners.has(a.alias)) aliasOwners.set(a.alias, []);
    aliasOwners.get(a.alias).push(h);
  }
}

// ---- 2. 通用词闸门 ----
// GENERIC_BODY：长度 >=3 但作为普通名词/游戏分区名太常见，出现在正文里不足以说明在讲这个人物。
const GENERIC_BODY = new Set([
  norm('小剧场'), norm('仙人掌'), norm('火龙果'), norm('大魔导师'), norm('擦边主播'),
  norm('什么都能变'), norm('对策卡'), norm('守望淋锋'), norm('王者淋耀'), norm('克里斯'),
  norm('大沙田'), norm('变身茄子'), norm('如何识别1'), norm('河马姐'),
]);
// GENERIC2：长度 ==2 的通用词，正文命中一律不挂。
const GENERIC2 = new Set([
  norm('医生'), norm('泡泡'), norm('祭司'), norm('北斗'), norm('七七'), norm('阿三'),
  norm('卡子'), norm('软辅'), norm('铁T'), norm('艾文'), norm('香香'), norm('河马'),
  norm('楼主'), norm('青子'), norm('娜美'), norm('成长'), norm('A女'), norm('52'),
  norm('李华'), norm('灯姐'), norm('阿鬼'),
]);
// SPECIFIC2：长度 ==2 但基本只在淋语/本英雄谱里出现的词，正文命中可挂（medium）。
const SPECIFIC2 = new Set([
  norm('淋淋'), norm('腋淋'), norm('火淋'), norm('淋光'), norm('可淋'), norm('阴中'),
  norm('血律'), norm('凤蝶'), norm('淋潮'), norm('你肘'), norm('肘门'), norm('霉霉'),
  norm('蒜姐'), norm('杯糕'), norm('心海'), norm('元歌'), norm('妮蔻'), norm('孙策'),
  norm('我华'), norm('我泔'), norm('我妲'), norm('我虞'), norm('我琴'), norm('我光'),
  norm('我鸟'), norm('我水'), norm('我米'), norm('我月'), norm('我曌'), norm('我狸'),
  norm('你泔'), norm('华粪'), norm('玉华'), norm('你华'), norm('你鱼'), norm('你莎'),
  norm('你茶'), norm('你珍'), norm('你符'), norm('阿狸'), norm('卡莎'), norm('薇恩'),
  norm('佐伊'), norm('貂蝉'), norm('西施'), norm('小乔'), norm('夜兰'), norm('优菈'),
  norm('婉儿'), norm('守约'), norm('元英'), norm('凤姐'), norm('允珍'), norm('凤敏'),
  norm('暮蝶'), norm('黑梦'), norm('奇乐'), norm('曼侬'), norm('迪莫'), norm('琴女'),
  norm('嘶哈'), norm('湿柔'), norm('玛莎'), norm('秦豪'), norm('灯神'),
]);

const gate = (alias, inTerm, termExact) => {
  if (termExact) return alias.length >= 2 ? 'high' : null;
  if (inTerm && alias.length >= 3 && !GENERIC_BODY.has(alias)) return 'high';
  if (alias.length >= 3) return GENERIC_BODY.has(alias) ? null : 'high';
  // 长度 == 2
  if (GENERIC2.has(alias)) return null;
  if (SPECIFIC2.has(alias)) return 'medium';
  return null; // 未知二字别名，正文里不敢挂
};

// ---- 3. 对单条文本找归属 ----
function resolve(texts, fullKeyText) {
  const matches = [];
  const seen = new Set();
  for (const [fieldPri, text] of texts) {
    const n = norm(text);
    if (!n) continue;
    for (const [alias, owners] of aliasOwners) {
      if (!n.includes(alias)) continue;
      for (const h of owners) {
        const dedupe = fieldPri + '|' + alias + '|' + h.name;
        if (seen.has(dedupe)) continue;
        seen.add(dedupe);
        matches.push({
          fieldPri,
          alias,
          hero: h,
          nameMatch: alias === norm(h.name),
          termExact: fieldPri === 0 && norm(fullKeyText) === alias,
        });
      }
    }
  }
  if (!matches.length) return { winner: null, conflicts: [], blocked: [] };
  const withConf = matches.map((m) => ({ m, conf: gate(m.alias, m.fieldPri === 0, m.termExact) }));
  const allowed = withConf.filter((x) => x.conf);
  const blocked = withConf.filter((x) => !x.conf);
  allowed.sort((a, b) =>
    a.m.fieldPri - b.m.fieldPri ||
    Number(b.m.nameMatch) - Number(a.m.nameMatch) ||
    b.m.alias.length - a.m.alias.length ||
    a.m.hero.group - b.m.hero.group ||
    a.m.hero.idx - b.m.hero.idx
  );
  const winnerHeroes = new Set(allowed.map((x) => x.m.hero.name));
  return {
    winner: allowed.length ? { hero: allowed[0].m.hero.name, alias: allowed[0].m.alias, confidence: allowed[0].conf } : null,
    conflicts: winnerHeroes.size > 1 ? [...winnerHeroes] : [],
    blocked: blocked.map((x) => x.m.alias),
  };
}

// ---- 4. 跑全量无 hero 的词卡 / 名言 ----
const entries = [];
const conflicts = [];
const unreliable = [];
const perHero = new Map();

let cardTotal = 0;
let cardLinked = 0;
let cardBlocked = 0;
let quoteTotal = 0;
let quoteLinked = 0;
let quoteBlocked = 0;

for (const c of lore.flashcards) {
  if (c.hero) continue;
  cardTotal++;
  const r = resolve([[0, c.term], [1, (c.example || '') + '\n' + (c.meaning || '')]], c.term);
  if (r.winner) {
    entries.push({
      kind: 'card',
      key: c.term,
      hero: r.winner.hero,
      matchedAlias: r.winner.alias,
      confidence: r.winner.confidence,
      text: String(c.term + '：' + (c.meaning || '')).slice(0, 200),
    });
    cardLinked++;
    if (!perHero.has(r.winner.hero)) perHero.set(r.winner.hero, { cards: 0, quotes: 0 });
    perHero.get(r.winner.hero).cards++;
    if (r.conflicts.length) conflicts.push({ kind: 'card', key: c.term, chosen: r.winner.hero, others: r.conflicts });
  } else {
    cardBlocked++;
    unreliable.push({ kind: 'card', key: c.term, reason: r.blocked.length ? 'blocked-generic' : 'no-match', blocked: r.blocked });
  }
}

for (const q of lore.quotes) {
  if (q.hero) continue;
  quoteTotal++;
  const r = resolve([[1, q.text]], q.text);
  if (r.winner) {
    entries.push({
      kind: 'quote',
      key: q.text,
      hero: r.winner.hero,
      matchedAlias: r.winner.alias,
      confidence: r.winner.confidence,
      text: String(q.text).slice(0, 200),
    });
    quoteLinked++;
    if (!perHero.has(r.winner.hero)) perHero.set(r.winner.hero, { cards: 0, quotes: 0 });
    perHero.get(r.winner.hero).quotes++;
    if (r.conflicts.length) conflicts.push({ kind: 'quote', key: q.text.slice(0, 60), chosen: r.winner.hero, others: r.conflicts });
  } else {
    quoteBlocked++;
    unreliable.push({ kind: 'quote', key: q.text.slice(0, 80), reason: r.blocked.length ? 'blocked-generic' : 'no-match', blocked: r.blocked });
  }
}

const table = [...perHero.entries()]
  .map(([hero, v]) => {
    const h = heroes.find((x) => x.name === hero);
    return { hero, group: ['real', 'game', 'up', 'other'][h ? h.group : 3], cardsAdded: v.cards, quotesAdded: v.quotes };
  })
  .sort((a, b) => b.cardsAdded + b.quotesAdded - (a.cardsAdded + a.quotesAdded) || a.hero.localeCompare(b.hero, 'zh'));

const blockedCardGeneric = unreliable.filter((u) => u.kind === 'card' && u.reason === 'blocked-generic').length;
const blockedQuoteGeneric = unreliable.filter((u) => u.kind === 'quote' && u.reason === 'blocked-generic').length;
const out = {
  note: '最长别名优先自动归属；blocked-generic=命中了别名但被通用词闸门拦下（宁缺勿滥）；no-match=文本里没有任何人物别名，与人物无关。',
  gate: { GENERIC_BODY: [...GENERIC_BODY], GENERIC2: [...GENERIC2], SPECIFIC2: [...SPECIFIC2] },
  stats: {
    cards: { noHero: cardTotal, linked: cardLinked, leftBlank: cardTotal - cardLinked, blankRate: ((cardTotal - cardLinked) / cardTotal).toFixed(3), blockedGeneric: blockedCardGeneric },
    quotes: { noHero: quoteTotal, linked: quoteLinked, leftBlank: quoteTotal - quoteLinked, blankRate: ((quoteTotal - quoteLinked) / quoteTotal).toFixed(3), blockedGeneric: blockedQuoteGeneric },
    unreliableLeftBlankTotal: cardTotal - cardLinked + quoteTotal - quoteLinked,
    unreliableRatio: ((cardTotal - cardLinked + quoteTotal - quoteLinked) / (cardTotal + quoteTotal)).toFixed(3),
    blockedByGenericOnly: blockedCardGeneric + blockedQuoteGeneric,
    conflicts: conflicts.length,
  },
  entries,
  conflicts,
  unreliable,
  perHero: table,
};

const OUT = path.join(ROOT, 'evidence/hero-links13.json');
fs.writeFileSync(OUT, JSON.stringify(out, null, 2), 'utf8');
console.error(
  `cards: ${cardLinked}/${cardTotal} linked | quotes: ${quoteLinked}/${quoteTotal} linked | conflicts ${conflicts.length} | blocked-generic ${blockedCardGeneric + blockedQuoteGeneric} -> ${OUT}`
);
