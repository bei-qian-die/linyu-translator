'use strict';

// 第十六轮名言挖掘：把 corpus 的「视频 → 评论」结构解出来，按淋语特征打分，产出可人工复核的候选清单。
// 只读语料，不写库。输出：
//   evidence/cand16-quotes.json  候选（含 bvid / 视频标题 / UP / 评论原文 / 命中特征 / 分数）
//   evidence/cand16-quotes.txt   同内容的可读版，供逐条勾选
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MANIFESTS = fs
  .readdirSync(path.join(ROOT, 'evidence'))
  .filter((f) => /^manifest-20261026/.test(f))
  .map((f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'evidence', f), 'utf8')));

// bvid / UP 映射：标题 → 元信息
const byTitle = new Map();
for (const m of MANIFESTS) {
  const arr = Array.isArray(m.items) ? m.items : Object.values(m.items || m);
  for (const v of arr) if (v && v.bvid) byTitle.set(String(v.title || '').trim(), v);
}

const MARKERS = [
  ['鼠', 3], ['惹', 2], ['噜', 2], ['本可', 4], ['仙子', 3], ['姐妹', 2], ['通讯录', 4],
  ['南通', 3], ['赔钱', 3], ['白袜', 3], ['daddy', 3], ['娘娘', 3], ['宫', 2], ['阴', 2],
  ['骚', 2], ['吸入', 3], ['吸', 1], ['婊', 3], ['母', 2], ['老公', 2], ['天菜', 4],
  ['尤物', 4], ['直男', 2], ['0', 1], ['1', 1], ['母0', 5], ['亩', 3], ['正太', 3],
  ['玉足', 3], ['体育生', 3], ['黑皮', 3], ['通讯录英雄', 5], ['淋语', 5], ['洛克淋国', 5],
];

const files = fs.readdirSync(path.join(ROOT, 'corpus')).filter((f) => /^corpus-bili-20261026/.test(f)).sort();
const out = [];
const seen = new Set();

for (const f of files) {
  const lines = fs.readFileSync(path.join(ROOT, 'corpus', f), 'utf8').split(/\r?\n/);
  let cur = { title: '', up: '', bvid: '' };
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith('【视频】')) {
      cur = { title: line.slice(4).trim(), up: '', bvid: '' };
      const meta = byTitle.get(cur.title);
      if (meta) cur.bvid = meta.bvid;
      continue;
    }
    if (line.startsWith('【UP】')) {
      cur.up = line.slice(4).trim();
      const meta = byTitle.get(cur.title);
      if (meta && !cur.bvid) cur.bvid = meta.bvid;
      continue;
    }
    if (!line.startsWith('【评论】')) continue;
    let text = line.slice(4).trim();
    // 去掉纯表情尾巴，保留正文
    text = text.replace(/\[[^\]]{1,12}\]/g, '').replace(/[doge笑哭]/g, '').trim();
    if (text.length < 6 || text.length > 46) continue;
    if (/https?:\/\//.test(text)) continue;
    if (/^[\d\s.]+$/.test(text)) continue;
    const key = text.replace(/\s+/g, '');
    if (seen.has(key)) continue;

    let score = 0;
    const hit = [];
    for (const [w, s] of MARKERS) {
      if (text.includes(w)) {
        score += s;
        hit.push(w);
      }
    }
    if (!hit.length) continue;
    if (!cur.bvid) continue;
    seen.add(key);
    out.push({ text, bvid: cur.bvid, video: cur.title, up: cur.up, hit, score });
  }
}

out.sort((a, b) => b.score - a.score || a.text.length - b.text.length);
const top = out.slice(0, 260);
fs.mkdirSync(path.join(ROOT, 'evidence'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'evidence/cand16-quotes.json'), JSON.stringify(top, null, 2) + '\n', 'utf8');
fs.writeFileSync(
  path.join(ROOT, 'evidence/cand16-quotes.txt'),
  top.map((x, i) => `${i}\t[${x.score}]\t${x.text}\t<${x.bvid}> ${x.video.slice(0, 34)}`).join('\n') + '\n',
  'utf8'
);
console.log(`候选 ${out.length} 条，落盘 top ${top.length}`);
