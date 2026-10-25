'use strict';

// 语义位 × 译法变体矩阵：evidence/slot-matrix13.json 的生成器。
//
// 这是「同一语义位、多种淋语译法」的核心证据文件。每个 slot key 下：
//   concepts   该语义位覆盖的全部中文概念（zh）
//   entries    每条中文概念的 linyu 主译法 + 它的全部 alias 变体
//   variants   每个变体的语料逐字出现次数，以及至少一条语料原文样例（截断 60 字）+ 出自哪个 corpus 文件
//
// 硬约束落地：
//   - 计数与样例都直接来自 corpus/*.txt，脚本生成、不手写，因此不存在杜撰的可能；
//   - 口径与 attest.js / scripts/freq-slots13.js 一致：删空白 + 删标点 + 转小写后逐字匹配（纯 ASCII 变体加词边界）；
//   - 取不到命中的变体如实标 hits:0、sample:null，不编造上下文；
//   - 样例是语料原行（只去掉行首的 [dm]/[cmt]/【评论】 这类标签前缀），截到 60 字。
//
// 用法: node scripts/build-slot-matrix13.js
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CORPUS_DIR = path.join(ROOT, 'corpus');
const OUT = path.join(ROOT, 'evidence', 'slot-matrix13.json');
const seed = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/core/seed.json'), 'utf8'));
const { TAXONOMY, splitSlot } = require('./slot-taxonomy13.js');
const { KEYS } = require('./slot-taxonomy13.js');

const norm = (s) => String(s).replace(/\s+/g, '').toLowerCase();
const strip = (s) =>
  norm(s).replace(/[，。！？、；：""''‘“（）()…~—\-《》,.!?;:"'[\]【】「」『』·＠@#＊*＋+／/\\|_=^%&<>{}]/g, '');
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isAscii = (n) => /^[\x20-\x7e]+$/.test(n);

const files = fs
  .readdirSync(CORPUS_DIR)
  .filter((f) => /^corpus.*\.txt$/.test(f))
  .sort();
const LINES = [];
let SALL = '';
const perFile = [];
for (const f of files) {
  const txt = fs.readFileSync(path.join(CORPUS_DIR, f), 'utf8');
  SALL += strip(txt);
  perFile.push({ file: f, chars: txt.length });
  for (const l of txt.split(/\r?\n/)) {
    const raw = l.trim();
    if (raw.length < 2 || raw.length > 600) continue;
    if (/^====/.test(raw)) continue;
    LINES.push({
      f,
      text: raw.replace(/^(\[(desc|cmt|sub|dm|弹幕|评论|简介)\]|【[^】]{1,6}】)\s*/, '').slice(0, 60),
      s: strip(raw),
    });
  }
}

// 淋语语体标记：某行除了该变体本身还出现 >=2 个别的标记，才算“这句话在用淋语”。
// 样例优先取这种行，避免把「祝健康」「珍珠音色」这类同形字巧合当成用法证据。
const FLAVOR = [
  '本可',
  '本仙女',
  '本仙子',
  '惹',
  '噜',
  '厚',
  '靴',
  '玛雅',
  '麻鸭',
  '淋语',
  '集美',
  '地才',
  '通讯录',
  'nbcs',
  '淋神',
  '阴婷',
  '仙女',
  '本质骑士',
  '素',
  '尊',
  '淋王',
  '吸吸',
  '漂酿',
];

const cache = new Map();
function lookup(form) {
  const key = strip(form);
  if (!key) return { hits: 0, sample: null, file: null, match: 'none' };
  if (cache.has(key)) return cache.get(key);
  const ascii = isAscii(key);
  const re = ascii ? new RegExp('(?<![a-z0-9])' + esc(key) + '(?![a-z0-9])', 'g') : null;
  const hay = SALL;
  let hits = 0;
  if (ascii) {
    const m = hay.match(re);
    hits = m ? m.length : 0;
  } else {
    let i = 0;
    while ((i = hay.indexOf(key, i)) !== -1) {
      hits++;
      i += key.length;
    }
  }
  let plain = null;
  let flavored = null;
  if (hits) {
    const one = ascii ? new RegExp('(?<![a-z0-9])' + esc(key) + '(?![a-z0-9])') : null;
    for (const r of LINES) {
      if (flavored) break;
      const ok = one ? one.test(r.s) : r.s.includes(key);
      if (!ok) continue;
      const cand = { sample: r.text, file: r.f };
      if (!plain) plain = cand;
      if (!flavored) {
        const distinct = new Set(FLAVOR.filter((m) => strip(m) !== key && r.s.includes(strip(m))));
        if (distinct.size >= 2) flavored = cand;
      }
    }
  }
  const use = flavored || plain;
  const res = use
    ? { hits, sample: use.sample, file: use.file, match: flavored ? 'corpus-verbatim+淋语语境' : 'corpus-verbatim' }
    : { hits, sample: null, file: null, match: hits ? 'count-only' : 'none' };
  cache.set(key, res);
  return res;
}

const variantsOf = (w) => {
  const list = [w.linyu].concat(
    String(w.alias || '')
      .split(/[、,，]/)
      .map((x) => x.trim())
  );
  const out = [];
  const seen = new Set();
  for (const v of list) {
    const k = strip(v);
    if (!v || seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  return out;
};

const descOf = Object.fromEntries(TAXONOMY.map((t) => [t.key, t.desc]));
const isNewOf = Object.fromEntries(TAXONOMY.map((t) => [t.key, !!t.isNew]));

const bucket = new Map();
for (const w of seed.words) {
  const keys = splitSlot(w.slot);
  if (!keys.length) continue;
  const variants = variantsOf(w).map((v) => ({
    form: v,
    ambiguous: strip(v).length <= 1 || strip(v) === strip(w.zh), // 单字同形 / 与中文原词同形：计数是上界
    ...lookup(v),
  }));
  for (const k of keys) {
    if (!bucket.has(k)) bucket.set(k, []);
    bucket.get(k).push({
      zh: w.zh,
      linyu: w.linyu,
      pop: w.pop || '',
      sense: w.sense || '',
      variants,
    });
  }
}

const slots = [...bucket.entries()]
  .map(([key, rows]) => {
    const allVariants = rows.reduce((n, r) => n + r.variants.length, 0);
    const attested = rows.reduce((n, r) => n + r.variants.filter((v) => v.hits > 0).length, 0);
    return {
      key,
      desc: descOf[key] || '',
      isNewInThisRound: !!isNewOf[key],
      conceptCount: new Set(rows.map((r) => r.zh)).size,
      wordCount: rows.length,
      variantCount: allVariants,
      variantsAttested: attested,
      variantsUnattested: allVariants - attested,
      concepts: [...new Set(rows.map((r) => r.zh))],
      entries: rows,
    };
  })
  .sort((a, b) => b.variantCount - a.variantCount || b.wordCount - a.wordCount || a.key.localeCompare(b.key, 'zh'));

const outOfTaxonomy = slots.filter((s) => !KEYS.includes(s.key)).map((s) => s.key);
const unusedKeys = KEYS.filter((k) => !bucket.has(k));

const doc = {
  generatedBy: 'scripts/build-slot-matrix13.js',
  purpose: '语义位 × 译法变体矩阵：证明「同一个中文概念，淋语有 N 种译法」，每条变体都给出语料逐字次数与原文样例',
  corpusFiles: perFile,
  corpusTotalChars: perFile.reduce((n, f) => n + f.chars, 0),
  method: [
    '计数口径：删空白 + 删标点 + 转小写后在 corpus/*.txt 全文里逐字匹配（= 本项目“可查”的定义，与 attest.js 一致）',
    '纯 ASCII 变体（baby / T0 / 666 / nsfw…）加词边界 (?<![a-z0-9])…(?![a-z0-9])，避免 no⊂nobody 之类虚高',
    'sample 取该变体第一次命中的语料原行，去掉行首 [dm]/[cmt]/【评论】 这类标签，截断 60 字；sample 所在文件记在 file',
    '样例优先选「同一行还有 >=2 个别的淋语标记」的行（match=corpus-verbatim+淋语语境），退而求其次才是普通命中行（match=corpus-verbatim）；这样 康/珍 这类单字谐音不会拿到“祝健康”“珍珠音色”这种同形巧合当例句',
    'ambiguous=true 表示该变体是单字、或与中文原词同形（弹幕→弹幕），其 hits 含通用用法，是上界',
    'hits=0 的变体 sample 一律 null：宁可空着，也不给没查到的写法配“例句”',
    '一条词有多个 slot（用 / 分隔）时，会在每个语义位下各出现一次，所以 wordCount 合计会大于词库总数',
  ],
  summary: {
    wordsTotal: seed.words.length,
    wordsWithSlot: seed.words.filter((w) => w.slot).length,
    wordsWithoutSlot: seed.words.filter((w) => !w.slot).length,
    slotKeysInMatrix: slots.length,
    slotKeysDefined: KEYS.length,
    slotKeysUnused: unusedKeys,
    slotKeysOutsideTaxonomy: outOfTaxonomy,
    variantRows: slots.reduce((n, s) => n + s.variantCount, 0),
    variantsAttested: slots.reduce((n, s) => n + s.variantsAttested, 0),
    variantsWithSample: slots.reduce(
      (n, s) => n + s.entries.reduce((k, r) => k + r.variants.filter((v) => v.sample).length, 0),
      0
    ),
    variantsInLinyuContext: slots.reduce(
      (n, s) =>
        n + s.entries.reduce((k, r) => k + r.variants.filter((v) => v.match === 'corpus-verbatim+淋语语境').length, 0),
      0
    ),
    variantsAmbiguous: slots.reduce(
      (n, s) => n + s.entries.reduce((k, r) => k + r.variants.filter((v) => v.ambiguous).length, 0),
      0
    ),
    top5SlotsByVariants: slots
      .slice(0, 5)
      .map((s) => ({ key: s.key, variantCount: s.variantCount, wordCount: s.wordCount, conceptCount: s.conceptCount })),
  },
  slots,
};

fs.writeFileSync(OUT, JSON.stringify(doc, null, 1) + '\n', 'utf8');
console.error(
  'slots',
  slots.length,
  '| wordRows',
  slots.reduce((n, s) => n + s.wordCount, 0),
  '| variantRows',
  doc.summary.variantRows,
  '| attested',
  doc.summary.variantsAttested,
  '| unusedKeys',
  unusedKeys.length,
  '| outOfTaxonomy',
  outOfTaxonomy.length,
  '| bytes',
  fs.statSync(OUT).size
);
console.error('top5', doc.summary.top5SlotsByVariants.map((x) => x.key + ':' + x.variantCount).join(', '));
