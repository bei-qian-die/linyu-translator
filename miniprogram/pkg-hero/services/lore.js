'use strict';

// 词卡/名言/人物浏览数据：依赖约 1.23MB 的 data/lore（v1.18），
// 只在词库页/人物页 onLoad 时按需加载，避免 App 启动即解析全部数据（A4）。
const lore = require('../data/lore');
const { wordMap, rules } = require('../../services/content');

const CARD_TYPE_ALIASES = {
  语气词: 'particle',
  俚语梗: 'slang',
  歌词典故: 'lyric',
  网络梗: 'meme',
};

const CARD_TYPE_LABELS = {
  particle: '语气词',
  slang: '俚语梗',
  lyric: '歌词典故',
  meme: '网络梗',
};

const CARD_FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'particle', label: '语气词' },
  { key: 'slang', label: '俚语梗' },
  { key: 'lyric', label: '歌词典故' },
  { key: 'meme', label: '网络梗' },
];

const HERO_GROUPS = [
  { key: 'real', label: '通讯录真人' },
  { key: 'game', label: '游戏角色' },
  { key: 'up', label: '淋语UP主' },
];

function text(value) {
  return value === null || value === undefined ? '' : String(value);
}

function list(value) {
  return Array.isArray(value)
    ? value.filter((item) => item !== null && item !== undefined && item !== '')
    : [];
}

function joinSearch(parts) {
  return parts.map(text).join(' ').toLowerCase();
}

function normalizeCardType(type) {
  const raw = text(type);
  return CARD_TYPE_ALIASES[raw] || raw || 'slang';
}

function heroZone(hero) {
  if (!hero || hero.group !== 'game') return '';
  const rank = text(hero.rank);
  const cut = rank.indexOf('·');
  return cut > 0 ? rank.slice(0, cut).trim() : '';
}

// 与桌面端播种逻辑一致：没写 hero 的词卡/名言按来源推断归属
const cards = lore.flashcards.map((c, index) => {
  const hero = text(c.hero) || (typeof lore.inferCardHero === 'function' ? text(lore.inferCardHero(c)) : '');
  const type = normalizeCardType(c.type);
  return {
    id: index + 1,
    term: text(c.term),
    type,
    typeLabel: CARD_TYPE_LABELS[type] || text(c.type),
    meaning: text(c.meaning),
    detail: text(c.detail),
    example: text(c.example),
    source: text(c.source),
    hero,
    aliases: list(c.aliases),
    aliasesText: list(c.aliases).join('、'),
    searchText: joinSearch([c.term, c.meaning, c.detail, c.example, c.source, hero, list(c.aliases).join(' ')]),
  };
});

const quotes = lore.quotes.map((q, index) => {
  const hero = text(q.hero) || (typeof lore.inferQuoteHero === 'function' ? text(lore.inferQuoteHero(q)) : '');
  return {
    id: index + 1,
    text: text(q.text),
    author: text(q.author),
    hero,
    src: text(q.src),
    scene: text(q.scene),
    searchText: joinSearch([q.text, q.author, hero, q.src, q.scene]),
  };
});

const heroes = lore.heroes.map((h, index) => {
  const group = text(h.group) || 'real';
  // 配图编号：桌面端存的是 "img/hero-704.png"，小程序只保留 "hero-704"，
  // 由页面按包位置拼路径（列表与详情同在本分包 pkg-hero/img/）。
  const imgNum = text(h.img).replace(/^img\//, '').replace(/\.[a-z0-9]+$/i, '');
  const hero = {
    id: index,
    name: text(h.name),
    alias: text(h.alias),
    rank: text(h.rank),
    intro: text(h.intro),
    baike: text(h.baike),
    group,
    tags: list(h.tags),
    works: list(h.works),
    words: list(h.words),
    links: Array.isArray(h.links) ? h.links.filter((l) => l && l.url) : [],
    zone: '',
    initial: text(h.name).slice(0, 1) || '淋',
    img: imgNum,
    thumb: imgNum ? '/pkg-hero/img/' + imgNum + '.webp' : '',
  };
  hero.zone = heroZone(hero);
  hero.searchText = joinSearch([
    hero.name,
    hero.alias,
    hero.rank,
    hero.intro,
    hero.baike,
    hero.tags.join(' '),
    hero.works.join(' '),
  ]);
  return hero;
});

const heroByName = {};
for (const h of heroes) heroByName[h.name] = h;

const cardFilters = CARD_FILTERS.map((f) => ({
  key: f.key,
  label: f.label,
  count: f.key === 'all' ? cards.length : cards.filter((c) => c.type === f.key).length,
}));

const heroGroups = HERO_GROUPS.map((g) => ({
  key: g.key,
  label: g.label,
  count: heroes.filter((h) => h.group === g.key).length,
}));

const heroZones = Array.from(new Set(heroes.filter((h) => h.group === 'game' && h.zone).map((h) => h.zone)))
  .sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))
  .map((zone) => ({
    key: zone,
    label: zone,
    count: heroes.filter((h) => h.group === 'game' && h.zone === zone).length,
  }));

function getHero(id) {
  const index = Number(id);
  return Number.isInteger(index) && heroes[index] ? heroes[index] : null;
}

// 与桌面端人物详情页的聚合口径保持一致
function relatedForHero(hero) {
  if (!hero) return { words: [], rules: [], cards: [], quotes: [] };
  const name = hero.name;
  const keys = [name].concat(
    hero.alias
      .split(/[/,、，\s]+/)
      .filter((s) => s.length >= 2)
  );
  return {
    words: hero.words.map((zh) => wordMap[zh]).filter(Boolean),
    rules: rules.filter((r) => {
      const hay = r.pattern + '\n' + r.template + '\n' + r.note;
      return keys.some((k) => hay.indexOf(k) >= 0);
    }),
    cards: cards.filter((c) => c.hero === name),
    quotes: quotes.filter((q) => (q.hero || q.author) === name),
  };
}

module.exports = {
  cards,
  quotes,
  heroes,
  heroByName,
  cardFilters,
  heroGroups,
  heroZones,
  getHero,
  relatedForHero,
};
