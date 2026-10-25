'use strict';
// 一次性:为 curated-lore14.js 的语录/词卡回查真实 BV。
// 做法:按 verify14 同款解析器重建 语料行→视频标题→BV(manifest 反查) 索引,
//      对每条 quote 找到逐字命中的行,取其 BV 回填 verify;
//      对每张 card 用 term 或 example 命中行回填。
// 只改 verify 为空、或命中了错误占位(同一段 BV 被复用)的条目。
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

// title -> bvid
const BV = new Map();
for (const g of fs.readdirSync(path.join(ROOT, 'evidence'))) {
  if (!/^manifest-.*\.json$/.test(g)) continue;
  try {
    for (const v of JSON.parse(fs.readFileSync(path.join(ROOT, 'evidence', g), 'utf8'))) {
      if (v && v.title && v.bvid && !BV.has(v.title)) BV.set(v.title, v.bvid);
    }
  } catch {}
}

const files = fs
  .readdirSync(path.join(ROOT, 'corpus'))
  .filter((f) => /^corpus.*\.txt$/.test(f))
  .map((f) => 'corpus/' + f);
const recs = [];
for (const f of files) {
  let cur = null;
  for (const raw of fs.readFileSync(path.join(ROOT, f), 'utf8').split(/\r?\n/)) {
    const l = raw.trim();
    if (!l) continue;
    const mv = l.match(/^【(视频|UP|简介|标签|弹幕|评论)】(.*)$/);
    if (mv) {
      if (mv[1] === '视频') cur = { title: mv[2].trim() };
      else if (cur && (mv[1] === '弹幕' || mv[1] === '评论'))
        recs.push({ text: mv[2].trim(), bv: BV.get(cur.title) || '', title: cur.title });
      else if (cur && mv[1] === '简介') recs.push({ text: mv[2].trim(), bv: BV.get(cur.title) || '', title: cur.title });
      continue;
    }
    if (/^={4,}/.test(l)) {
      const head = l.replace(/^={4,}\s*/, '').split(/\s={4,}\s/)[0];
      cur = { title: head.replace(/^\[[^\]]*\]\s*/, '').replace(/BV\w+/, '').trim(), bv: (head.match(/BV\w+/) || ['', ''])[0] };
      continue;
    }
    const mp = l.match(/^\[(desc|cmt|sub|dm)\]\s*(.+)$/);
    if (mp) {
      recs.push({ text: mp[2].trim(), bv: (cur && cur.bv) || '', title: cur ? cur.title : '' });
      continue;
    }
    if (cur && (cur.title || cur.bv)) recs.push({ text: l, bv: cur.bv || '', title: cur.title || '' });
  }
}
console.log('recs:', recs.length);

const norm = (s) => String(s || '').replace(/\s+/g, '');
const { CARDS, QUOTES, HEROES, HEROES_MERGE } = require(path.join(ROOT, 'scripts/curated-lore14.js'));

//语录:整行命中 → BV;找不到再试行内子串
const quoteBV = (t) => {
  const n = norm(t);
  let hit = recs.find((r) => norm(r.text) === n && r.bv);
  if (!hit) hit = recs.find((r) => r.bv && norm(r.text).includes(n.slice(0, 24)) && n.length >= 12);
  return hit ? hit.bv : '';
};
//卡片:term/example 命中行 → BV
const cardBV = (c) => {
  const n = norm(c.term);
  let hit = recs.find((r) => r.bv && norm(r.text).includes(n));
  if (!hit && c.example) {
    const e = norm(c.example);
    hit = recs.find((r) => r.bv && norm(r.text).includes(e.slice(0, 24)) && e.length >= 12);
  }
  return hit ? hit.bv : '';
};

let file = path.join(ROOT, 'scripts/curated-lore14.js');
let src = fs.readFileSync(file, 'utf8');
const patchVerify = (anchorText, bv, kind) => {
  if (!bv) return false;
  const url = "verify: V('" + bv + "')";
  // 在该条目对象内替换 verify 行:定位 `text: '<前24字>` 或 `term: '<词>` 的块
  const anchor = (kind === 'quote' ? "text: '" : "term: '") + anchorText.slice(0, 24);
  const i = src.indexOf(anchor);
  if (i < 0) {
    console.log('ANCHOR-MISS', anchorText.slice(0, 18));
    return false;
  }
  const j = src.indexOf('verify:', i);
  const k = src.indexOf("source:", i);
  if (j < 0 || (k >= 0 && k < j)) {
    // 无 verify 字段:在 source: 前插入
    const ins = src.slice(0, k) + url + ', ' + src.slice(k);
    src = ins;
    return true;
  }
  const m = src.slice(j).match(/^verify: V\('([0-9A-Z]+)'\)/);
  if (m) {
    if (m[1] === bv) return false;
    src = src.slice(0, j) + url + src.slice(j + m[0].length);
    return true;
  }
  return false;
};

let qFixed = 0;
for (const q of QUOTES) {
  const bv = quoteBV(q.text);
  if (bv && patchVerify(q.text, bv, 'quote')) {
    console.log('Q', bv, q.text.slice(0, 22));
    qFixed++;
  } else if (!bv) console.log('Q-NOBV', q.text.slice(0, 24));
}
let cFixed = 0;
for (const c of CARDS) {
  const bv = cardBV(c);
  if (bv && patchVerify(c.term, bv, 'card')) {
    console.log('C', bv, c.term);
    cFixed++;
  } else if (!bv) console.log('C-NOBV', c.term, '(保留人工出处)');
}
//人物补 group 字段(grp 之外再写一份,老校验器/老库都认)
let hFixed = 0;
for (const h of HEROES) {
  if (!src.includes("name: '" + h.name + "', alias:")) continue;
  // 给该条目加 group: 与 grp 相同 —— 用 replace 定位 grp: 'xx', rank: 前缀
}
fs.writeFileSync(file, src);
console.log('quotes patched:', qFixed, 'cards patched:', cFixed);
