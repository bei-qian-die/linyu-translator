'use strict';

// 证据核验器（第十三轮专用）。两种用法：
//   1) 调研模式：node scripts/verify13.js --grep "词1,词2,词3" [--ctx=24]
//      逐个打印候选词在语料里的逐字命中次数、上下文窗口、所在视频/BV/URL，以及是否已在 seed 里。
//      ——用来在写 curated 之前确认「真的在语料里、真的是淋语用法」。
//   2) 自检模式：node scripts/verify13.js --curated scripts/curated-linyu13.js
//      把 WORDS 的 linyu/alias 每个变体、RULES 的每个 pattern 拿去语料里核，
//      报出「语料查不到且没有 HTTP 出处」的条目（= 可能杜撰），并检查 pattern 是否命中原文。
//
// 只读，不写任何文件。

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const flag = (n) => argv.includes('--' + n);
const opt = (n, d) => {
  const h = argv.find((a) => a.startsWith('--' + n + '='));
  return h ? h.split('=').slice(1).join('=') : d;
};
const CTX = Number(opt('ctx', '30'));

const seed = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/core/seed.json'), 'utf8'));
const norm = (s) => String(s || '').replace(/\s+/g, '').toLowerCase();

const knownLinyu = new Map();
const knownZh = new Set();
const variantsOf = (s) =>
  String(s || '')
    .split(/[、,，;；]/)
    .map((x) => x.trim())
    .filter(Boolean);
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

const recs = []; // {text, file, title, bv, url, kind}
for (const f of files) {
  let cur = null;
  for (const raw of fs.readFileSync(path.join(ROOT, f), 'utf8').split(/\r?\n/)) {
    const l = raw.trim();
    if (!l || /^(#|\[附加字段|\{")/.test(l)) continue;
    const mv = l.match(/^【(视频|UP|简介|标签|弹幕|评论)】(.*)$/);
    if (mv) {
      if (mv[1] === '视频') {
        cur = { title: mv[2].trim() };
        // 标题/简介/标签本身也是语料正文（attest.js 是把整份文件当 blob 核的）
        recs.push({ text: mv[2].trim(), file: f, title: mv[2].trim(), bv: BV.get(mv[2].trim()) || '', kind: 'title' });
      } else if (cur && (mv[1] === '弹幕' || mv[1] === '评论')) recs.push({ text: mv[2].trim(), file: f, title: cur.title, bv: BV.get(cur.title) || '', kind: mv[1] });
      else if (cur && mv[1] === 'UP') {
        cur.up = mv[2].trim();
        recs.push({ text: mv[2].trim(), file: f, title: cur.title, bv: BV.get(cur.title) || '', kind: 'up' });
      } else if (cur) {
        cur[mv[1]] = mv[2].trim();
        recs.push({ text: mv[2].trim(), file: f, title: cur.title, bv: BV.get(cur.title) || '', kind: mv[1] });
      }
      continue;
    }
    if (/^={4,}/.test(l)) {
      const rest = l.replace(/^={4,}\s*/, '');
      const head = rest.split(/\s={4,}\s/)[0];
      cur = { title: head.replace(/^\[[^\]]*\]\s*/, '').replace(/BV\w+/, '').trim(), bv: (head.match(/BV\w+/) || ['', ''])[0] };
      if (cur.title) recs.push({ text: head, file: f, title: cur.title, bv: cur.bv, kind: 'title' });
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

// ---------------------------------------------------------------- 调研模式
function lookup(word) {
  const n = norm(word);
  const hits = [];
  for (const r of recs) {
    const t = norm(r.text);
    let at = t.indexOf(n);
    while (at >= 0) {
      hits.push(r);
      break;
    }
    if (hits.length >= 900) break;
  }
  return hits;
}

if (argv.some((a) => a.startsWith('--grep'))) {
  const listIdx = argv.findIndex((a) => a.startsWith('--grep'));
  const arg = argv.find((a) => a.startsWith('--grep='));
  const raw = arg ? arg.split('=').slice(1).join('=') : argv[listIdx + 1];
  const words = String(raw || '')
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const w of words) {
    const hits = lookup(w);
    console.log(`\n### ${w}  →  ${hits.length} 行命中 | seed: ${knownLinyu.has(norm(w)) ? '已有淋语写法 ' + knownLinyu.get(norm(w)) : knownZh.has(norm(w)) ? '已有中文词头' : '未收录'}`);
    hits.slice(0, Number(opt('max', '5'))).forEach((r) => {
      const t = r.text;
      const i = norm(t).indexOf(norm(w));
      console.log(`   [${r.file.replace('corpus/', '').replace('.txt', '')}] ${r.bv || (r.url || '').slice(0, 46) || r.title} | ${r.title || ''} | ${r.kind} …${t.slice(Math.max(0, i - CTX), i + CTX + w.length)}…`.slice(0, 240));
    });
  }
  process.exit(0);
}

// ---------------------------------------------------------------- 自检模式
if (argv.some((a) => a.startsWith('--curated'))) {
  const argP = (argv.find((a) => a.startsWith('--curated=')) || '').split('=').slice(1).join('=');
  const p = argP ? path.resolve(ROOT, argP) : path.join(ROOT, 'scripts/curated-linyu13.js');
  const cur = require(p);
  const W = cur.WORDS || [];
  const R = cur.RULES || [];
  let badW = 0;
  let badR = 0;
  let merged = 0;

  console.log(`\n===== WORDS ${W.length} 条 =====`);
  for (const w of W) {
    const forms = [w.linyu, ...variantsOf(w.alias)].filter(Boolean);
    const att = forms.map((f) => ({ f, n: lookup(f).length }));
    const okAny = att.some((a) => a.n > 0);
    const src = /https?:\/\//i.test(String(w.source || ''));
    if (knownZh.has(norm(w.zh))) merged++;
    // --strict：不看出处，只要语料里一个变体都查不到就点名（防「有链接就绿灯」的假绿）
    if (flag('strict')) {
      if (!okAny) {
        badW++;
        console.log(`  [语料零命中] ${w.zh} → ${w.linyu} | ${att.map((a) => a.f + ':' + a.n).join(' / ')}`);
      }
      // 逐个变体核：alias 里写进语料查不到的写法同样算杜撰
      const seedOwner = seed.words.find((x) => norm(x.zh) === norm(w.zh));
      const seedForms = seedOwner ? new Set([seedOwner.linyu, ...variantsOf(seedOwner.alias)].map(norm)) : new Set();
      const ghost = att.filter((a) => a.n === 0 && !seedForms.has(norm(a.f)));
      if (ghost.length) console.log(`  [alias 语料查不到] ${w.zh} → ${ghost.map((g) => g.f).join('、')}`);
    } else if (!okAny && !src) {
      badW++;
      console.log(`  [未证实] ${w.zh} → ${w.linyu} | 变体 ${att.map((a) => a.f + ':' + a.n).join(',')} | source=${w.source || '(空)'}`);
    }
  }
  console.log(`WORDS：语料可查或带 HTTP 出处 ${W.length - badW}/${W.length}；其中并入既有中文词头 ${merged} 条`);

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
  process.exitCode = badW + badR ? 1 : 0;
}
