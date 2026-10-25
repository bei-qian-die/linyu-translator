'use strict';

// 第十三轮：语义位补齐前的「真实词频」统计。
//
// 目的（硬约束的落地方式）：pop 档位不能凭感觉写，必须由 corpus/*.txt 的逐字出现次数推导。
// 本脚本只读不写 seed.json，产两份证据：
//   evidence/slot-freq13.json  —— 每条 (zh, linyu) 的出现次数 + 由阈值推导的 popSuggested
//   evidence/slot-hits13.txt   —— 人工核对用的上下文抽样（每词最多 3 条真实语料片段）
//
// 计数口径（全部逐字可查；本项目的「可查」定义 = 忽略空白 / 标点 / 大小写，见 README 与 attest.js）：
//   1. 每个 corpus 文件先 norm（删所有空白、转小写）得到 NTXT；再 strip（额外删掉标点）得到 STXT。
//      - nLinStrict / nZhStrict：在 NTXT 里逐字计数（标点也要一致，最严）。
//      - nLin / nZh：在 STXT 里计数（忽略空白标点大小写），即项目生命线口径，也是 pop 的判定依据。
//   2. 纯 ASCII needle（baby / T0 / 666 / nsfw…）：要求左右邻字符不是 [a-z0-9]，
//      否则 "no" 会命中 "nobody"、"op" 会命中 "pop"，虚高到没有意义。
//   3. 单字谐音（滴 / 珍 / 吼 / 康 / 缩 / 丸 / 银 / 鞋…）在通用中文里本就高频，计数是上界；
//      已如实记录在 caveats，pop 判定对它们用同一阈值，不做特殊加成。
//
// pop 阈值（对 nLin，即忽略标点后的淋语侧逐字出现次数）：
//   高  nLin >= 100
//   中  nLin >= 20
//   低  nLin <  20（含 0：语料无逐字命中，只能靠 source 出处活着）
// 阈值依据：见证据 JSON 的 distribution 分位数（p50/p75/p90），取整到 20 / 100。
//
// sense 写入判据：只有 nLin > 0（能在语料里逐字查到该淋语形）才写释义；
// nLin = 0 的一律留空字符串，不编。
//
// 用法: node scripts/freq-slots13.js

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CORPUS_DIR = path.join(ROOT, 'corpus');
const seed = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/core/seed.json'), 'utf8'));

const HIGH = 100;
const MID = 20;

const files = fs
  .readdirSync(CORPUS_DIR)
  .filter((f) => /^corpus.*\.txt$/.test(f))
  .sort();

const norm = (s) => String(s).replace(/\s+/g, '').toLowerCase();
const strip = (s) =>
  norm(s).replace(/[，。！？、；：""''‘“（）()…~—\-《》,.!?;:"'[\]【】「」『』·…＠@#＊*＋+／/\\|_=^%&<>{}]/g, '');
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const perFile = [];
const NTXT = [];
const STXT = [];
const RAWLINES = []; // 用于抽上下文：{file, raw, n(去空白), s(去标点)}
for (const f of files) {
  const txt = fs.readFileSync(path.join(CORPUS_DIR, f), 'utf8');
  NTXT.push(norm(txt));
  STXT.push(strip(txt));
  for (const l of txt.split(/\r?\n/)) {
    const raw = l.trim();
    if (raw.length < 2 || raw.length > 600) continue;
    if (/^====/.test(raw)) continue;
    RAWLINES.push({ f, raw, n: norm(raw), s: strip(raw) });
  }
  perFile.push({ file: f, chars: txt.length });
}
const ALL = NTXT.join('\u0001');
const SALL = STXT.join('\u0001');

function countIn(hay, needle, asciiBoundary) {
  if (!needle) return 0;
  if (asciiBoundary) {
    const re = new RegExp('(?<![a-z0-9])' + esc(needle) + '(?![a-z0-9])', 'g');
    const m = hay.match(re);
    return m ? m.length : 0;
  }
  let c = 0;
  let i = 0;
  while ((i = hay.indexOf(needle, i)) !== -1) {
    c++;
    i += needle.length;
  }
  return c;
}

/** needle 是否按纯 ASCII 处理（决定要不要加词边界） */
const isAscii = (n) => /^[\x20-\x7e]+$/.test(n);
const cN = (needle) => countIn(ALL, norm(needle), isAscii(norm(needle))); // 严格：标点也要一致
const cS = (needle) => countIn(SALL, strip(needle), isAscii(strip(needle))); // 生命线口径：忽略空白/标点/大小写

/** 取最多 limit 条真实上下文（原行，截 60 字）；先试严格命中，再退回忽略标点的命中 */
function samples(needle, limit) {
  const n = norm(needle);
  const s = strip(needle);
  if (!n) return [];
  const ascii = isAscii(n);
  const re = ascii ? new RegExp('(?<![a-z0-9])' + esc(n) + '(?![a-z0-9])') : null;
  const res = [];
  for (const r of RAWLINES) {
    if (res.length >= limit) break;
    const ok = ascii ? re.test(r.n) : r.n.includes(n);
    if (ok) res.push({ file: r.f, text: r.raw.replace(/^\[(desc|cmt|sub|dm)\]\s*/, '').slice(0, 60), match: 'strict' });
  }
  if (res.length < limit && s.length >= 4) {
    for (const r of RAWLINES) {
      if (res.length >= limit) break;
      if (!r.s.includes(s)) continue;
      res.push({
        file: r.f,
        text: r.raw.replace(/^\[(desc|cmt|sub|dm)\]\s*/, '').slice(0, 60),
        match: 'punct-insensitive',
      });
    }
  }
  return res;
}

const popOf = (nLin) => (nLin >= HIGH ? '高' : nLin >= MID ? '中' : '低');

// ---- 「用法佐证」信号：同形字命中 ≠ 淋语用法 ----
// 单字谐音（滴/珍/吼/银/康…）和常用字（造/香/柱）在通用中文里大量出现，逐字命中并不能证明
// 「这句话在用淋语」（例如 真→珍 的命中里有一条其实是「珍珠音色」）。所以再加一个语体信号：
// 某行里除了该 needle 还出现 >= 2 个互不相同的淋语标记，才算这条命中落在淋语语境里。
// 结论：pop 用 nLin（真实出现次数，如实反映同形字上界）；sense 只在 nFlavor > 0 或该条目挂得上句式规则时写。
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
function flavorCount(needle) {
  const s = strip(needle);
  if (!s) return 0;
  const ascii = isAscii(s);
  let c = 0;
  for (const r of RAWLINES) {
    const hit = ascii ? new RegExp('(?<![a-z0-9])' + esc(s) + '(?![a-z0-9])').test(r.s) : r.s.includes(s);
    if (!hit) continue;
    const distinct = new Set(FLAVOR.filter((m) => strip(m) !== s && r.s.includes(strip(m))));
    if (distinct.size >= 2) c++;
  }
  return c;
}

// ---- 句式回链：seed.rules 里 template 用到该淋语形，或 pattern 能匹配该中文 ----
function ruleRef(zh, linyu) {
  const nl = strip(linyu);
  const found = [];
  for (const r of seed.rules) {
    const tpl = strip(String(r.template || ''));
    if (nl.length >= 2 && tpl && tpl.includes(nl)) {
      found.push({
        pattern: r.pattern,
        template: r.template,
        note: r.note || '',
        scene: r.scene || '',
        src: r.src || '',
      });
    }
  }
  if (found.length) return found[0];
  for (const r of seed.rules) {
    let re;
    try {
      re = new RegExp(String(r.pattern || ''));
    } catch {
      re = null;
    }
    if (re && re.test(zh) && String(r.pattern || '').length >= 4) {
      return {
        pattern: r.pattern,
        template: r.template || '',
        note: r.note || '',
        scene: r.scene || '',
        src: r.src || '',
        patternOnly: true,
      };
    }
  }
  return null;
}

const noslot = seed.words.filter((w) => !w.slot);
const entries = [];
const lines = [];
for (const w of noslot) {
  const nZh = cS(w.zh);
  const nLin = cS(w.linyu);
  const variants = [w.linyu]
    .concat(
      String(w.alias || '')
        .split(/[、,，]/)
        .map((x) => x.trim())
    )
    .filter((v, i, a) => v && v.length >= 1 && a.indexOf(v) === i);
  const vc = {};
  for (const v of variants) vc[v] = cS(v);
  const rule = ruleRef(w.zh, w.linyu);
  const nFlavor = flavorCount(w.linyu);
  const e = {
    zh: w.zh,
    linyu: w.linyu,
    nZh,
    nLin,
    nZhStrict: cN(w.zh),
    nLinStrict: cN(w.linyu),
    nFlavor, // 落在淋语语境里的命中行数
    identity: strip(w.zh) === strip(w.linyu), // zh 与 linyu 同形（计数即通用词频，不代表淋语特有用法）
    popSuggested: popOf(nLin),
    hasSource: !!(w.source || w.verify),
    rule,
    variantCounts: vc,
    samples: samples(w.linyu, 3),
  };
  // sense 可写判据 = 证据分层（tier），见 evidence JSON 的 evidenceTiers 说明
  let tier;
  if (nLin === 0) tier = rule ? 'rule-only' : 'none';
  else if (nFlavor > 0) tier = 'corpus';
  else if (String(w.linyu).length >= 2 && !e.identity) tier = 'literal';
  else tier = rule ? 'weak+rule' : 'weak';
  e.tier = tier;
  e.senseAllowed = tier === 'corpus' || tier === 'literal' || tier === 'weak+rule';
  entries.push(e);
  lines.push(
    `${e.nLin}\t${e.nFlavor}\t${e.nZh}\t${e.popSuggested}\t${w.zh}→${w.linyu}\tsrc=${e.hasSource ? 'Y' : 'N'}\trule=${rule ? 'Y' : 'N'}\tid=${e.identity ? 'Y' : 'N'}\ttier=${tier}\tvar=${JSON.stringify(vc)}`
  );
  lines.push(`   ${JSON.stringify(e.samples, null, 0)}`);
}

const nums = entries.map((e) => e.nLin).sort((a, b) => a - b);
const pct = (p) => (nums.length ? nums[Math.min(nums.length - 1, Math.floor(nums.length * p))] : 0);
const dist = {
  total: entries.length,
  nLin_zero: entries.filter((e) => e.nLin === 0).length,
  nLin_zero_noSource: entries.filter((e) => e.nLin === 0 && !e.hasSource).length,
  popSuggested_high: entries.filter((e) => e.popSuggested === '高').length,
  popSuggested_mid: entries.filter((e) => e.popSuggested === '中').length,
  popSuggested_low: entries.filter((e) => e.popSuggested === '低').length,
  sense_writable: entries.filter((e) => e.senseAllowed).length,
  tiers: entries.reduce((m, e) => {
    m[e.tier] = (m[e.tier] || 0) + 1;
    return m;
  }, {}),
  identity_count: entries.filter((e) => e.identity).length,
  p50: pct(0.5),
  p75: pct(0.75),
  p90: pct(0.9),
  max: nums[nums.length - 1],
};

const evDir = path.join(ROOT, 'evidence');
fs.writeFileSync(
  path.join(evDir, 'slot-freq13.json'),
  JSON.stringify(
    {
      generatedBy: 'scripts/freq-slots13.js',
      corpusFiles: perFile,
      countingRules: [
        'nLin / nZh 在「删空白 + 删标点 + 转小写」的全文里逐字计数 = 本项目生命线口径（忽略空白/标点/大小写）；pop 用它',
        'nLinStrict / nZhStrict 只删空白、标点必须一致，与 attest.js 的 WORD 判定同口径，一并留档',
        '纯 ASCII needle 加词边界 (?<![a-z0-9])…(?![a-z0-9])，避免 no⊂nobody、op⊂pop 虚高',
        '单字谐音（滴/珍/吼/康/缩/丸/银/鞋…）在通用中文里本就高频，此计数是上界；如实记录，不额外加成',
      ],
      caveats: [
        'nLin=0 的条目 sense 一律留空（tier=none / rule-only），不把「查不到的用法」写成释义',
        '淋语侧命中含同形字歧义（如 滴 也作“滴”的本义），pop 偏高方向已知，不做修饰',
        'identity=true 表示 zh 与 linyu 同形（如 弹幕→弹幕、 queen→queen），其计数即该通用词本身频次，不代表淋语特有用法',
      ],
      evidenceTiers: {
        corpus: 'nFlavor>0：该淋语形出现在「同一行还有 >=2 个别的淋语标记」的语料行里，用法可证实 —— sense 可写',
        literal:
          'nLin>0 且 linyu 长度>=2 且非 identity：形本身在语料里逐字存在（盆友/鸡冻 这类非通用词），用法方向明确 —— sense 可写，但只描述替换本身，不外推语境',
        'weak+rule':
          '逐字命中只有同形字歧义（单字或 identity），但 scripts/apply 时该条目在 seed.rules 句式表里有对应 template —— 以句式为据，sense 可写',
        weak: '只有同形字命中、又无句式回链 —— sense 留空',
        'rule-only': '语料里查不到该淋语形，仅句式表提到 —— sense 留空',
        none: '语料 0 命中且无句式回链（大多靠 verify 外链活着）—— sense 留空',
      },
      thresholds: { 高: `nLin >= ${HIGH}`, 中: `nLin >= ${MID}`, 低: `nLin < ${MID}` },
      distribution: dist,
      entries,
    },
    null,
    2
  ) + '\n',
  'utf8'
);
fs.writeFileSync(path.join(evDir, 'slot-hits13.txt'), lines.join('\n') + '\n', 'utf8');

console.error('corpus files', files.length, '| lines sampled', RAWLINES.length);
console.error('dist', JSON.stringify(dist));
