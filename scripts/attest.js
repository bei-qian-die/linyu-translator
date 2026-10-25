'use strict';

// 语料溯源闸门。每个板块都必须是「严格逐字命中本地语料」或「带可访问来源」，二者都拿不到才算 unattested。
//
// 旧版本判得太松，导致 unattested=0 是假绿：
//   - word：中文侧命中就算过 → 任何中文原句都能蒙混
//   - card：中文释义 meaning 命中就算过 → 自己写的释义反而成了证据
//   - quote：去标点后取中段 6 个字就算过 → 6 字组合在百万字语料里几乎必然撞上
//   - rules / heroes：完全不校验
// 现在五板块各自独立判定，且判定依据要么是逐字命中，要么是带 URL 的 verify。
const fs = require('fs');
const vm = require('vm');

const WEB = fs.existsSync('scripts/lexicon-web.json') ? new Set(JSON.parse(fs.readFileSync('scripts/lexicon-web.json', 'utf8'))) : new Set();
const seed = JSON.parse(fs.readFileSync('src/core/seed.json', 'utf8'));
const m = { exports: {} };
vm.runInNewContext(fs.readFileSync('src/core/lore.js', 'utf8'), {
  module: m,
  exports: m.exports,
  require: (p) => require('../src/core/' + String(p).replace(/^.*[\\/]/, '')),
});
const lore = m.exports;

const files = (process.argv[2] || '').split(',').filter(Boolean);
let blob = '';
for (const f of files) if (fs.existsSync(f)) blob += fs.readFileSync(f, 'utf8') + '\n';
if (!blob) {
  console.error('no corpus given');
  process.exit(1);
}

const norm = (s) => String(s || '').replace(/\s+/g, '');
const strip = (s) =>
  norm(s).replace(/[，。！？、；：""''‘“（）()…~—\-《》,.!?;:"'[\]【】]/g, '').toLowerCase();
const BLOB = norm(blob).toLowerCase();
const SBLOB = strip(blob);

const MIN_RUN = 10; // 名言门槛：连续 10 字，不允许「去标点取中段」
const GRAMS = new Set();
for (let i = 0; i + MIN_RUN <= SBLOB.length; i++) GRAMS.add(SBLOB.slice(i, i + MIN_RUN));

/** 文本里是否存在一段连续 >= min 字的原样片段；返回命中长度（0 = 没命中） */
function longestRun(needleRaw, min) {
  const needle = strip(needleRaw);
  if (needle.length < min) return 0;
  if (min === MIN_RUN && SBLOB.includes(needle)) return needle.length;
  for (let i = 0; i + min <= needle.length; i++) {
    const seg = needle.slice(i, i + min);
    if (min === MIN_RUN ? GRAMS.has(seg) : SBLOB.includes(seg)) return min;
  }
  return 0;
}

/** 词条级命中：淋语侧逐字命中（容忍 惹/��/厚… 这类语气后缀漂移），不用中文侧蒙混 */
function wordRun(zh) {
  const t = norm(zh).toLowerCase();
  if (t.length >= 2 && BLOB.includes(t)) return t.length;
  const alt = t.replace(/[惹噜厚靴熏翻素解]$/g, '');
  if (alt.length >= 2 && BLOB.includes(alt)) return alt.length;
  return 0;
}

function hasVerify(o) {
  if (!o) return false;
  if (String(o.verify || '').trim()) return true;
  for (const s of [o.source, o.src]) if (/https?:\/\//i.test(String(s || ''))) return true;
  for (const l of o.links || []) if (/https?:\/\//i.test(String((l && l.url) || ''))) return true;
  return false;
}
const hasHttpLink = (o) => (o.links || []).some((l) => /^https?:\/\//i.test(String((l && l.url) || '')));

const report = [];
const un = [];
const line = (board, status, text) => (status === 'NO' ? un : report).push(board + '\t' + status + '\t' + text);

const mark = (okCorpus, verified) => (verified ? 'WEB' : okCorpus ? 'OK' : 'NO');

// ---- 词库 words：必须淋语侧逐字命中，或带 verify ----
for (const w of seed.words) {
  const web = WEB.has(w.zh + '->' + w.linyu);
  const verified = web || hasVerify(w);
  line('WORD', mark(wordRun(w.linyu) > 0, verified), w.zh + ' -> ' + w.linyu);
}

// ---- 句式 rules：pattern 必须能在真实语料里命中至少一条样例 ----
const CORPUS_LINES = blob.split(/\r?\n/);
for (const r of seed.rules) {
  let re;
  try {
    re = new RegExp(r.pattern);
  } catch {
    re = null;
  }
  let sample = '';
  if (re) {
    for (const l of CORPUS_LINES) {
      if (l.length < 2 || l.length > 400) continue;
      try {
        if (re.test(l)) {
          sample = l.trim().slice(0, 40);
          break;
        }
      } catch {
        /* 个别行可能触发灾难性回溯，跳过 */
      }
    }
  }
  line('RULE', mark(!!sample, hasVerify(r)), r.pattern + (sample ? '  ← ' + sample : ''));
}

// ---- 词卡 cards：禁用 meaning（中文释义）单独放行，只认 term/aliases/example 逐字命中或 verify ----
for (const c of lore.flashcards) {
  const run = Math.max(
    longestRun(c.term, 2),
    (c.aliases || []).reduce((m, a) => Math.max(m, longestRun(a, 2)), 0),
    longestRun(c.example || '', 4)
  );
  line('CARD', mark(run > 0, hasVerify(c)), c.term + (c.verify ? '' : '  [' + (c.hero || c.type || '') + ']'));
}

// ---- 名言 quotes：必须连续 >=10 字逐字命中，或带 verify ----
for (const q of lore.quotes) {
  line('QUOTE', mark(longestRun(q.text, MIN_RUN) > 0, hasVerify(q)), (q.hero || q.author || '?') + '\t' + q.text.slice(0, 40));
}

// ---- 人物传 heroes：intro/baike 必填、works 至少 1 条可命中、且必须有带 URL 的来源 ----
for (const h of lore.heroes) {
  const works = Array.isArray(h.works) ? h.works : [];
  const worksHit = works.filter((w) => longestRun(w, 2) > 0).length;
  const problems = [];
  if (!String(h.intro || '').trim()) problems.push('intro 缺');
  if (!String(h.baike || '').trim()) problems.push('baike 缺');
  if (!works.length) problems.push('works 缺');
  else if (!worksHit && !hasHttpLink(h)) problems.push('works 无一可命中且无来源链接');
  if (!hasHttpLink(h)) problems.push('无可访问来源链接');
  line('HERO', problems.length ? 'NO' : mark(worksHit > 0, hasVerify(h)), h.name + (problems.length ? '  ← ' + problems.join('/') : '  ← works命中 ' + worksHit + '/' + works.length));
}

fs.writeFileSync('attest.txt', report.concat(['', '##### NOT ATTESTED #####'], un).join('\n'), 'utf8');
const n = (b) => un.filter((l) => l.startsWith(b + '\t')).length;
const tot = (b, total) => total + ' 条，unattested ' + n(b);
console.log(
  'corpus chars', SBLOB.length,
  '| words', tot('WORD', seed.words.length),
  '| rules', tot('RULE', seed.rules.length),
  '| cards', tot('CARD', lore.flashcards.length),
  '| quotes', tot('QUOTE', lore.quotes.length),
  '| heroes', tot('HERO', lore.heroes.length),
  '| 合计 unattested', un.length
);
process.exitCode = un.length ? 1 : 0;
