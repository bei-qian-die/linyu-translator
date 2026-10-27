'use strict';

// 第二十一轮配图挑选：从候选中给每位人物选一张「像本人、无大字、可正方裁切」的图。
//
// 打分维度（都可解释，不用模型）：
//   + 竖构图（h/w ≥ 1.15）：立绘多为竖图，裁 256 正方能留住脸和肩
//   + 标题含 立绘/设定/原画/形象/官方
//   - 标题含 威能/配音/讲解/演示/试玩/预告/实机：这类是视频缩略图，带大字与播放键
//   - 超宽构图（w/h ≥ 1.9）：横版 CG，裁正方会切掉主体
//   + 分辨率够（短边 ≥ 400）
//
// 产出 evidence/hero-images21.json：{ name: { file, url, title, w, h, crop } }
// 人工复核后可在这里手工覆盖（OVERRIDE）。
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIMS = JSON.parse(fs.readFileSync(path.join(ROOT, 'evidence/hero-cand21-dims.json'), 'utf8')).items;
const { HEROES } = require(path.join(ROOT, 'scripts/curated-heroes21.js'));

// 人工覆盖：跑完自动挑选后肉眼复核，发现不对的在这里钉死文件名
const OVERRIDE = {
  // 'D.Mon': 'D.Mon_2.jpg',
};

const GOOD_T = /立绘|设定|原画|形象|官方|全身|渲染|图鉴|海报|壁纸/;
const BAD_T = /威能|配音|讲解|演示|试玩|预告|实机|攻略|教学|排行|强度|价格|周边|雕像|同人|手绘|绘画|剪辑|直播|录播|素材/;

function score(it) {
  const w = it.w || 1;
  const h = it.h || 1;
  const ar = h / w;
  let s = 0;
  if (ar >= 1.15) s += 5;
  else if (ar >= 0.95) s += 2;
  if (w / h >= 1.9) s -= 3;
  if (Math.min(w, h) >= 400) s += 2;
  if (GOOD_T.test(it.title || '')) s += 3;
  if (BAD_T.test(it.title || '')) s -= 6;
  if (it.kind === 'bili-cover') s += 1;
  return s;
}

const safeName = (s) => String(s).replace(/[\\/:*?"<>|·]/g, '_');
// 文件名 → 人物名：取最长的安全名前缀（「士兵_76_fix1」→「士兵:76」）
const BY_SAFE = HEROES.map((h) => [safeName(h.name), h.name]).sort((a, b) => b[0].length - a[0].length);
const nameOfFile = (file) => {
  for (const [k, v] of BY_SAFE) if (file === k || file.startsWith(k + '_') || file.startsWith(k + '.')) return v;
  return '';
};

const byName = new Map();
for (const it of DIMS) {
  const n = nameOfFile(it.file) || it.name;
  if (!byName.has(n)) byName.set(n, []);
  byName.get(n).push(it);
}

const out = { generatedAt: new Date().toISOString(), map: {}, pending: [], auto: [] };
for (const h of HEROES) {
  const cands = (byName.get(h.name) || []).slice();
  if (!cands.length) {
    out.pending.push(h.name);
    continue;
  }
  let pick;
  if (OVERRIDE[h.name]) pick = cands.find((c) => c.file === OVERRIDE[h.name]) || cands[0];
  else {
    cands.sort((a, b) => score(b) - score(a) || (b.w * b.h) - (a.w * a.h));
    pick = cands[0];
  }
  out.map[h.name] = {
    file: pick.file,
    url: pick.url,
    title: pick.title,
    w: pick.w,
    h: pick.h,
    crop: pick.h / pick.w >= 1.15 ? 'top' : 'center',
    kind: pick.kind,
    score: score(pick),
    alt: cands.map((c) => `${c.file}(${c.w}x${c.h},${score(c)})`),
  };
}

fs.writeFileSync(path.join(ROOT, 'evidence/hero-images21.json'), JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log(`[pick] 选中 ${Object.keys(out.map).length} 位，缺图 ${out.pending.length} 位：${out.pending.join('、') || '无'}`);
for (const [k, v] of Object.entries(out.map)) {
  console.log(`  ${k.padEnd(10)} ${v.file.padEnd(22)} ${v.w}x${v.h} ${v.crop} s=${v.score}`);
}
