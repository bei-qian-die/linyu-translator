'use strict';

// 翻译链路最小数据集：只依赖 seed（42KB，词条+句式）。
// 词卡/名言/人物等只读浏览数据在 services/lore.js，由词库页/人物页 onLoad 时按需 require，
// 翻译页首屏不再承担 331KB lore 的解析成本（A4）。
const seed = require('../data/seed');
const counts = require('../data/counts');
const { translateText } = require('../core/translator');

function text(value) {
  return value == null ? '' : String(value);
}

function joinSearch(parts) {
  return parts.map(text).join(' ').toLowerCase();
}

const words = seed.words.map((w) => ({
  zh: text(w.zh),
  linyu: text(w.linyu),
  alias: text(w.alias),
  sense: text(w.sense),
  source: text(w.source),
  pop: text(w.pop),
  slot: text(w.slot),
  searchText: joinSearch([w.zh, w.linyu, w.alias, w.sense, w.source, w.pop, w.slot]),
}));

const wordMap = {};
for (const w of words) wordMap[w.zh] = w;

const rules = seed.rules.map((r, index) => ({
  id: index + 1,
  pattern: text(r.pattern),
  template: text(r.template),
  note: text(r.note),
  scene: text(r.scene),
  examples: text(r.examples),
  src: text(r.src),
  searchText: joinSearch([r.pattern, r.template, r.note, r.scene, r.examples, r.src]),
}));

function filterList(source, keyword) {
  const q = text(keyword).trim().toLowerCase();
  if (!q) return source;
  return source.filter((item) => item.searchText.indexOf(q) >= 0);
}

// 翻译耗时采样（B13）：环型缓冲记录最近 200 次耗时，供统计与慢翻译上报
const STAT_WINDOW = 200;
const SLOW_MS = 50;
const statDurations = [];
let statIndex = 0;
let slowLogged = 0;

function translate(input) {
  const start = Date.now();
  const out = translateText(input, { words: seed.words, rules: seed.rules });
  const ms = Date.now() - start;
  if (statDurations.length < STAT_WINDOW) {
    statDurations.push(ms);
  } else {
    statDurations[statIndex % STAT_WINDOW] = ms;
  }
  statIndex += 1;
  if (ms > SLOW_MS) {
    slowLogged += 1;
    try {
      const logger = wx.getRealtimeLogManager && wx.getRealtimeLogManager();
      if (logger && logger.warn) {
        logger.warn('translate_slow', { ms, len: input.length });
      }
    } catch (err) {
      // 日志通道异常不影响翻译主链路
    }
  }
  return out;
}

function translateStats() {
  if (!statDurations.length) return null;
  const sorted = statDurations.slice().sort((a, b) => a - b);
  const pick = (p) => sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
  return {
    count: statIndex,
    window: statDurations.length,
    avg: Math.round(statDurations.reduce((a, b) => a + b, 0) / statDurations.length),
    p50: pick(50),
    p95: pick(95),
    slowCount: slowLogged,
  };
}

module.exports = { words, rules, wordMap, counts, filterList, translate, translateStats };
