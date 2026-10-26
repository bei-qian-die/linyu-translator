'use strict';

// 翻译链路最小数据集：只依赖 seed（v1.18 约 390KB，词条+句式）。
// 词卡/名言/人物等只读浏览数据在 services/lore.js，由词库页/人物页 onLoad 时按需 require，
// 翻译页首屏不再承担 lore（约 1.23MB）的解析成本（A4）。
const seed = decodeSeed(require('../data/seed'));
const counts = require('../data/counts');
const perf = require('./perf');
const { translateText } = require('../core/translator');

// seed 在小程序端是列式编码（{__col:1, __sst:1, words:{keys,rows}}）以压主包体积，
// 这里还原成常规对象数组；如果拿到的是老格式（直接是 {words:[...]}）就原样返回。
// __sst=1 表示表格单元存的是全局字符串表（data/_sst.js）的下标，见 scripts/build-weapp-data.mjs。
function decodeSeed(mod) {
  if (!mod || !mod.__col) return mod;
  let sst = null;
  if (mod.__sst) {
    try {
      sst = require('../data/_sst');
    } catch (e) {
      sst = null;
    }
  }
  const dec = (v) => {
    if (v === null || v === undefined) return v;
    if (typeof v === 'number') return sst ? sst[v] : v;
    if (typeof v === 'object') return 'n' in v ? v.n : v.a;
    return v;
  };
  const unpack = (part) => {
    if (!part || !Array.isArray(part.rows)) return [];
    const { keys, rows } = part;
    return rows.map((row) => {
      const o = {};
      for (let i = 0; i < keys.length; i++) {
        const v = sst ? dec(row[i]) : row[i];
        if (v !== null && v !== undefined) o[keys[i]] = v;
      }
      return o;
    });
  };
  return { words: unpack(mod.words), rules: unpack(mod.rules) };
}

function text(value) {
  return value === null || value === undefined ? '' : String(value);
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

// 翻译耗时采样在 services/perf.js，关于页只依赖 perf，不需要加载整个 seed（B13 / A4）
function translate(input) {
  const start = Date.now();
  const out = translateText(input, { words: seed.words, rules: seed.rules });
  perf.record(Date.now() - start, input);
  return out;
}

function translateStats() {
  return perf.stats();
}

module.exports = { words, rules, wordMap, counts, filterList, translate, translateStats };
