'use strict';

// 第十三轮辅助：把 22 个语料文件解析成「视频块」，为仍零覆盖的人物批量筛候选句，
// 输出 evidence/mined13.json 供人工挑选写进 scripts/curated-lore13.js。
// 本脚本不写 src/core 任何文件，也不直接产出内容——只是检索器。
// 用法: node scripts/mine-lore13.js [人物名,逗号分隔]  缺省=当前零词卡/零名言人物
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const lore = require(path.join(ROOT, 'src/core/lore'));
const norm = (s) => String(s == null ? '' : s).replace(/\s+/g, '').toLowerCase();

// ---- 解析语料 ----
function parseFile(fp) {
  const raw = fs.readFileSync(fp, 'utf8');
  const lines = raw.split(/\r?\n/);
  const blocks = [];
  let cur = null;
  const fmt2 = /^\s*==== .*====\s*/;
  const fmt1 = /^\s*【视频】/;
  let pendingTitle = null;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (fmt2.test(l)) {
      const head = l.trim();
      const bv = (head.match(/BV[0-9A-Za-z]+/) || [''])[0];
      const tag = (head.match(/^==== \[([^\]]*)\]/) || ['', ''])[1];
      const title = head.replace(/^====(\s*\[[^\]]*\])?\s*/, '').replace(/ ====.*$/, '').replace(bv, '').trim();
      const up = (head.match(/up:(.*?)( play:| like:|$)/) || ['', ''])[1].trim();
      cur = { file: path.basename(fp), bvid: bv, tag, title, up, lines: [] };
      blocks.push(cur);
      continue;
    }
    if (fmt1.test(l)) {
      cur = { file: path.basename(fp), bvid: '', tag: '', title: l.replace(/^\s*【视频】/, '').trim(), up: '', lines: [] };
      const m = (lines[i + 1] || '').match(/^\s*【UP】(.*)$/);
      if (m) {
        cur.up = m[1].trim();
        i += 1;
      }
      blocks.push(cur);
      continue;
    }
    if (/^\s*【来源】/.test(l)) {
      const parts = l.trim().replace(/^\s*【来源】/, '').split('｜');
      cur = { file: path.basename(fp), bvid: '', tag: '来源', title: parts[2] || l.slice(0, 40), up: parts[1] || '', url: parts[3] || '', lines: [] };
      blocks.push(cur);
      continue;
    }
    if (!cur) continue;
    let m;
    if ((m = l.match(/^\s*\[(desc|cmt|sub|dm)\]\s*(.*)$/))) {
      if (m[2]) cur.lines.push({ kind: m[1], text: m[2] });
    } else if (/^\s*【评论】/.test(l)) {
      cur.lines.push({ kind: 'cmt', text: l.replace(/^\s*【评论】/, '') });
    } else if (/^\s*【弹幕】/.test(l)) {
      cur.lines.push({ kind: 'dm', text: l.replace(/^\s*【弹幕】/, '') });
    } else if (/^\s*【简介】/.test(l)) {
      cur.lines.push({ kind: 'desc', text: l.replace(/^\s*【简介】/, '') });
    } else if (/^\s*【回复】/.test(l)) {
      cur.lines.push({ kind: 'cmt', text: l.replace(/^\s*【回复】/, '') });
    } else if (l.trim() && !/^#/.test(l) && !/^\s*【(视频|UP)】/.test(l)) {
      cur.lines.push({ kind: 'body', text: l.trim() });
    }
  }
  return blocks;
}

const allBlocks = [];
for (const f of fs.readdirSync(path.join(ROOT, 'corpus'))) {
  if (!/^corpus.*\.txt$/.test(f)) continue;
  allBlocks.push(...parseFile(path.join(ROOT, 'corpus', f)));
}
console.error(`blocks ${allBlocks.length}`);

// ---- 人物别名 ----
function heroAliases(h) {
  const set = new Set();
  const add = (raw) => {
    const n = norm(raw);
    if (n.length >= 2) set.add(n);
  };
  add(h.name);
  String(h.alias || '').split(/[、,，/;；]/).forEach(add);
  return [...set];
}

const byName = new Map(lore.heroes.map((h) => [h.name, h]));
const targets = (process.argv[2] || '')
  .split(',')
  .filter(Boolean)
  .map((n) => byName.get(n) || n)
  .filter(Boolean);

// manifest：bvid -> {title, up, url}
const manifests = {};
for (const f of fs.readdirSync(path.join(ROOT, 'evidence'))) {
  const m = f.match(/^manifest-(.*)\.json$/);
  if (!m) continue;
  try {
    const arr = JSON.parse(fs.readFileSync(path.join(ROOT, 'evidence', f), 'utf8'));
    for (const v of Array.isArray(arr) ? arr : []) if (v.bvid) manifests[v.bvid] = v;
  } catch {}
}
const titleToBv = new Map();
for (const v of Object.values(manifests)) if (v.title) titleToBv.set(norm(v.title), v);

const out = {};
for (const h of targets) {
  const aliases = typeof h === 'string' ? [norm(h)] : heroAliases(h);
  const name = typeof h === 'string' ? h : h.name;
  const ownUp = [];
  const mentions = [];
  for (const b of allBlocks) {
    const upHit = norm(b.up) && aliases.some((a) => norm(b.up) === a || norm(b.up).includes(a));
    const tagHit = norm(b.tag) && aliases.some((a) => norm(b.tag).includes(a));
    const titleHit = aliases.some((a) => norm(b.title).includes(a));
    if (upHit || (tagHit && titleHit)) ownUp.push(b);
    for (const ln of b.lines) {
      const t = ln.text;
      if (t.replace(/\s/g, '').length < 10) continue;
      if (t.length > 90) continue;
      const aliasHit = aliases.find((a) => norm(t).includes(a));
      if (!aliasHit) continue;
      const mv = (b.bvid && manifests[b.bvid]) || titleToBv.get(norm(b.title));
      mentions.push({ file: b.file, bvid: b.bvid || (mv ? mv.bvid : ''), url: mv ? mv.url : '', title: b.title, up: b.up, kind: ln.kind, alias: aliasHit, text: t });
    }
  }
  out[name] = {
    ownUpBlocks: ownUp.slice(0, 8).map((b) => ({
      file: b.file,
      bvid: b.bvid,
      title: b.title,
      up: b.up,
      url: (b.bvid && manifests[b.bvid] ? manifests[b.bvid].url : b.url) || (titleToBv.get(norm(b.title)) ? titleToBv.get(norm(b.title)).url : ''),
      sampleLines: b.lines.filter((l) => l.text.length >= 10 && l.text.length <= 90).slice(0, 14).map((l) => l.kind + ' ' + l.text),
    })),
    mentions: mentions.slice(0, 30),
  };
}
fs.writeFileSync(path.join(ROOT, 'evidence/mined13.json'), JSON.stringify(out, null, 1), 'utf8');
console.error('-> evidence/mined13.json');
