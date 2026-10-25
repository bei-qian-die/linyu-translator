'use strict';

// 第十四轮证据核验器（由 scripts/verify13.js 改造，逻辑一致，两点增强）：
//   1) 支持 `--curated scripts/curated-linyu14.js`（位置参数写法，verify13 只认 --curated=…）
//   2) 新增 --lore 模式：核 CARDS / QUOTES / HEROES 的 term、text、alias、works 是否逐字在语料里
// 判据不变：语料逐字命中 或 带真实 HTTP 出处；两者都没有 = 可能杜撰，必须清零。
// 只读，不写任何文件。

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const flag = (n) => argv.some((a) => a === '--' + n || a.startsWith('--' + n + '='));
const opt = (n, d) => {
  const h = argv.find((a) => a.startsWith('--' + n + '='));
  return h ? h.split('=').slice(1).join('=') : d;
};
const positionalAfter = (n) => {
  const i = argv.indexOf('--' + n);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : '';
};
const CTX = Number(opt('ctx', '30'));

const seed = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/core/seed.json'), 'utf8'));
const vm = require('vm');
const lm = { exports: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'src/core/lore.js'), 'utf8'), {
  module: lm,
  exports: lm.exports,
  require: (p) => require(path.join(ROOT, 'src/core/' + String(p).replace(/^.*[\\/]/, ''))),
});
const lore = lm.exports;
const HERO_NAMES = new Set(lore.heroes.map((h) => h.name));

const norm = (s) => String(s || '').replace(/\s+/g, '').toLowerCase();
const variantsOf = (s) =>
  String(s || '')
    .split(/[、,，;；]/)
    .map((x) => x.trim())
    .filter(Boolean);

const knownLinyu = new Map();
const knownZh = new Set();
for (const w of seed.words) {
  for (const f of [w.linyu, ...variantsOf(w.alias)]) {
    const n = norm(f);
    if (n && !knownLinyu.has(n)) knownLinyu.set(n, w.zh);
  }
  knownZh.add(norm(w.zh));
}

// ---------------------------------------------------------------- 语料（含出处）
const CORPUS_DIR = path.join(ROOT, 'corpus');
const files = fs
  .readdirSync(CORPUS_DIR)
  .filter((f) => /^corpus.*\.txt$/.test(f))
  .map((f) => 'corpus/' + f);

const BV = new Map(); // title -> bvid（从 evidence/manifest-*.json 反查）
for (const g of fs.readdirSync(path.join(ROOT, 'evidence'))) {
  if (!/^manifest-.*\.json$/.test(g)) continue;
  try {
    for (const v of JSON.parse(fs.readFileSync(path.join(ROOT, 'evidence', g), 'utf8'))) {
      if (v && v.title && v.bvid && !BV.has(v.title)) BV.set(v.title, v.bvid);
    }
  } catch {
    /* 个别 manifest 格式不同，忽略 */
  }
}

const recs = [];
for (const f of files) {
  let cur = null;
  for (const raw of fs.readFileSync(path.join(ROOT, f), 'utf8').split(/\r?\n/)) {
    const l = raw.trim();
    if (!l || /^(#|\[附加字段|\{")/.test(l)) continue;
    const mv = l.match(/^【(视频|UP|简介|标签|弹幕|评论)】(.*)$/);
    if (mv) {
      if (mv[1] === '视频') cur = { title: mv[2].trim() };
      else if (cur && (mv[1] === '弹幕' || mv[1] === '评论')) recs.push({ text: mv[2].trim(), file: f, title: cur.title, bv: BV.get(cur.title) || '', kind: mv[1] });
      else if (cur && mv[1] === 'UP') cur.up = mv[2].trim();
      continue;
    }
    if (/^={4,}/.test(l)) {
      const rest = l.replace(/^={4,}\s*/, '');
      const head = rest.split(/\s={4,}\s/)[0];
      cur = { title: head.replace(/^\[[^\]]*\]\s*/, '').replace(/BV\w+/, '').trim(), bv: (head.match(/BV\w+/) || ['', ''])[0] };
      continue;
    }
    const mp = l.match(/^\[(desc|cmt|sub|dm)\]\s*(.+)$/);
    if (mp) {
      recs.push({ text: mp[2].trim(), file: f, title: cur ? cur.title : '', bv: (cur && cur.bv) || '', kind: mp[1] });
      continue;
    }
    const ms = l.match(/^【来源】([^｜]*)｜([^｜]*)｜([^｜]*)｜(\S*)$/);
    if (ms) {
      cur = { title: ms[3].trim(), url: ms[4], bv: '' };
      continue;
    }
    const mr = l.match(/^【回复】(.*)$/);
    if (mr && cur) {
      recs.push({ text: mr[1].trim(), file: f, title: cur.title, url: cur.url, bv: '', kind: 'reply' });
      continue;
    }
    if (cur && (cur.title || cur.url)) recs.push({ text: l, file: f, title: cur.title, url: cur.url, bv: cur.bv || '', kind: 'raw' });
  }
}
console.log(`语料 ${files.length} 份 / 可核行 ${recs.length}`);

function lookup(word) {
  const n = norm(word);
  if (!n) return [];
  const hits = [];
  for (const r of recs) {
    if (norm(r.text).includes(n)) hits.push(r);
    if (hits.length >= 900) break;
  }
  return hits;
}

// ---------------------------------------------------------------- 调研模式
if (flag('grep')) {
  const arg = opt('grep', '') || positionalAfter('grep');
  const words = variantsOf(String(arg || ''));
  for (const w of words) {
    const hits = lookup(w);
    console.log(`\n### ${w}  →  ${hits.length} 行命中 | seed: ${knownLinyu.has(norm(w)) ? '已有淋语写法 ' + knownLinyu.get(norm(w)) : knownZh.has(norm(w)) ? '已有中文词头' : '未收录'}`);
    hits.slice(0, Number(opt('max', '6'))).forEach((r) => {
      const i = norm(r.text).indexOf(norm(w));
      console.log(`   [${r.file.replace('corpus/', '').replace('.txt', '')}] ${r.bv || (r.url || '').slice(0, 46) || r.title} | ${r.kind} …${r.text.slice(Math.max(0, i - CTX), i + CTX + w.length)}…`.slice(0, 240));
    });
  }
  process.exit(0);
}

// ---------------------------------------------------------------- WORDS / RULES 自检
let badTotal = 0;
if (flag('curated')) {
  const p = path.resolve(ROOT, opt('curated', '') || positionalAfter('curated') || 'scripts/curated-linyu13.js');
  const cur = require(p);
  const W = cur.WORDS || [];
  const R = cur.RULES || [];
  let badW = 0;
  let badR = 0;
  let merged = 0;
  let noHttp = 0;
  const dupLinyu = new Map();

  console.log(`\n===== WORDS ${W.length} 条 =====`);
  for (const w of W) {
    const forms = [w.linyu, ...variantsOf(w.alias)].filter(Boolean);
    const att = forms.map((f) => ({ f, n: lookup(f).length }));
    const okAny = att.some((a) => a.n > 0);
    const linOk = att[0].n > 0; // linyu 本体必须逐字可查
    const src = /https?:\/\//i.test(String(w.source || ''));
    if (!src) noHttp++;
    if (knownZh.has(norm(w.zh))) merged++;
    dupLinyu.set(norm(w.linyu), (dupLinyu.get(norm(w.linyu)) || 0) + 1);
    if (!linOk || !src) {
      badW++;
      console.log(`  [未证实] ${w.zh} → ${w.linyu} | linyu命中=${att[0].n} | 变体 ${att.map((a) => a.f + ':' + a.n).join(' , ')} | source=${w.source || '(空)'}`);
    }
  }
  const dup = [...dupLinyu.entries()].filter(([, n]) => n > 1);
  console.log(`WORDS：linyu 逐字可查且有 HTTP 出处 ${W.length - badW}/${W.length}；并入既有中文词头 ${merged} 条；缺 HTTP ${noHttp}；本文件内 linyu 重复 ${dup.length} 组`);
  dup.slice(0, 10).forEach(([k, n]) => console.log(`   [重复] ${k} ×${n}`));

  console.log(`\n===== RULES ${R.length} 条 =====`);
  for (const r of R) {
    let re;
    try {
      re = new RegExp(r.pattern);
    } catch (e) {
      console.log(`  [正则非法] ${r.pattern} :: ${e.message}`);
      badR++;
      continue;
    }
    const hit = recs.find((x) => x.text.length >= 2 && x.text.length <= 400 && re.test(x.text));
    if (!hit) {
      const src = /https?:\/\//i.test(String(r.src || ''));
      if (!src) {
        badR++;
        console.log(`  [语料不命中且无出处] ${r.pattern}`);
      } else {
        console.log(`  [语料不命中，但有出处] ${r.pattern} ← ${r.src}`);
      }
    }
  }
  console.log(`RULES：问题 ${badR} 条`);
  badTotal += badW + badR;
}

// ---------------------------------------------------------------- CARDS / QUOTES / HEROES 自检
if (flag('lore')) {
  const p = path.resolve(ROOT, opt('lore', '') || positionalAfter('lore') || 'scripts/curated-lore13.js');
  const data = require(p);
  const CARDS = data.CARDS || [];
  const QUOTES = data.QUOTES || [];
  const HEROES = data.HEROES || [];
  const MERGE = data.HEROES_MERGE || [];
  const TYPES = new Set(['particle', 'slang', 'lyric', 'meme', 'hero-alias']);
  let bad = 0;

  console.log(`\n===== CARDS ${CARDS.length} 条 =====`);
  for (const c of CARDS) {
    const problems = [];
    if (!TYPES.has(c.type)) problems.push(`type 非法:${c.type}`);
    if (!/https?:\/\//i.test(String(c.verify || c.source || ''))) problems.push('无 HTTP 出处');
    const termHits = lookup(c.term).length;
    const exHits = c.example ? lookup(c.example).length : 0;
    if (!termHits && !exHits && !/https?:\/\//i.test(String(c.verify || ''))) problems.push('term/example 语料均不命中');
    if (c.hero && !HERO_NAMES.has(c.hero)) problems.push(`hero 不在 195 人名单:${c.hero}`);
    if (problems.length) {
      bad++;
      console.log(`  [问题] ${c.term} :: ${problems.join(' / ')} | term命中=${termHits} example命中=${exHits}`);
    }
  }

  console.log(`\n===== QUOTES ${QUOTES.length} 条 =====`);
  for (const q of QUOTES) {
    const problems = [];
    if (String(q.text || '').length < 10) problems.push('少于 10 字');
    if (!q.hero) problems.push('hero 缺');
    else if (!HERO_NAMES.has(q.hero)) problems.push(`hero 不在 195 人名单:${q.hero}`);
    if (!/https?:\/\//i.test(String(q.verify || q.src || ''))) problems.push('无 HTTP 出处');
    const n = lookup(q.text).length;
    if (!n) problems.push('语料查不到（整行级）');
    if (problems.length) {
      bad++;
      console.log(`  [问题] ${(q.text || '').slice(0, 30)} :: ${problems.join(' / ')}`);
    }
  }

  console.log(`\n===== HEROES ${HEROES.length} 条 / HEROES_MERGE ${MERGE.length} 条 =====`);
  for (const h of HEROES) {
    const problems = [];
    if (!String(h.intro || '').trim()) problems.push('intro 缺');
    if (!String(h.baike || '').trim()) problems.push('baike 缺');
    if (!Array.isArray(h.works) || !h.works.length) problems.push('works 缺');
    if (!['real', 'game', 'up'].includes(h.group)) problems.push(`group 非法:${h.group}`);
    if (Array.isArray(h.alias)) problems.push('alias 必须是字符串');
    if (!/https?:\/\//i.test(String((h.links || [])[0] && h.links[0].url))) problems.push('links 无 HTTP');
    const nameHit = lookup(h.name).length;
    const workHit = (h.works || []).filter((w) => lookup(w).length).length;
    if (!nameHit && !workHit) problems.push('name/works 语料均不命中');
    if (problems.length) {
      bad++;
      console.log(`  [问题] ${h.name} :: ${problems.join(' / ')} | name命中=${nameHit} works命中=${workHit}/${(h.works || []).length}`);
    }
  }
  for (const h of MERGE) {
    if (!HERO_NAMES.has(h.name)) {
      bad++;
      console.log(`  [问题] HEROES_MERGE 名字不在 195 人名单：${h.name}`);
    }
    const workHit = (h.works || []).filter((w) => lookup(w).length).length;
    const linkHttp = (h.links || []).some((l) => /https?:\/\//i.test(String(l && l.url)));
    if ((h.works || []).length && !workHit && !linkHttp) {
      bad++;
      console.log(`  [问题] MERGE ${h.name} works 全部查不到且无链接`);
    }
  }
  console.log(`\nLORE 问题合计 ${bad} 条`);
  badTotal += bad;
}

process.exitCode = badTotal ? 1 : 0;
