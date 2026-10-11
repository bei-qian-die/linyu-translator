'use strict';
// 定点补采：把人工检索到的淋语生态视频（淋者荣耀/阴雄淋盟/第五淋格/守望淋锋/淋明杀鸡 等系列）
// 的标题、简介、弹幕、评论区逐字拉成语料块，供 attest.js 溯源。
const fs = require('fs');
const path = require('path');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const HD = { 'User-Agent': UA, Referer: 'https://www.bilibili.com/', Cookie: 'buvid3=1ABC2DEF-3456-7890-ABCD-EF012345678939623infoc' };
const ROOT = path.join(__dirname, '..', '..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function json(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: HD });
      return JSON.parse(await r.text());
    } catch {
      await sleep(1200 * (i + 1));
    }
  }
  return null;
}
async function raw(url) {
  try {
    const r = await fetch(url, { headers: HD });
    return Buffer.from(await r.arrayBuffer()).toString('utf8');
  } catch {
    return '';
  }
}
function parseDm(xml) {
  const out = [];
  const re = /<d p="[^"]*"[^>]*>([^<]*)<\/d>/g;
  let m;
  while ((m = re.exec(xml))) out.push(m[1]);
  return out
    .join('\n')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .split('\n');
}

(async () => {
  const DM = Number(process.env.DM || 300);
  const RP = Number(process.env.RP || 3);
  const OUT = process.env.OUT || 'corpus13.manual.txt';
  const bvs = (process.argv[2] || '').split(',').map((s) => s.trim()).filter(Boolean);
  // 不带 BV 清单直接跑会把已有语料文件覆盖成空文件，而 attest 依赖其中的标题/简介行。
  if (!bvs.length) throw new Error('用法：node scripts/corpus/fetch-bvs.js BVxxx,BVyyy（清单为空，拒绝覆盖 ' + OUT + '）');
  const lines = [];
  for (const bvid of bvs) {
    const j = await json('https://api.bilibili.com/x/web-interface/view?bvid=' + encodeURIComponent(bvid));
    if (!j || j.code !== 0) {
      console.error('skip', bvid, j && j.code);
      continue;
    }
    const d = j.data;
    const tj = await json('https://api.bilibili.com/x/tag/archive/tags?bvid=' + encodeURIComponent(bvid));
    const tags = tj && tj.code === 0 && Array.isArray(tj.data) ? tj.data.map((x) => x.tag_name) : [];
    lines.push(`\n==== [manual] ${d.bvid} ${d.title} ==== up:${d.owner.name} play:${d.stat.view} like:${d.stat.like} tags:${tags.join('/')}`);
    if (d.desc && d.desc.trim()) lines.push('[desc] ' + d.desc.trim().replace(/\s+/g, ' ').slice(0, 600));
    const xml = await raw('https://api.bilibili.com/x/v1/dm/list.so?oid=' + d.cid);
    if (xml) parseDm(xml).slice(0, DM).forEach((x) => x.trim() && lines.push('[dm] ' + x.replace(/\s+/g, ' ')));
    for (let pn = 1; pn <= RP; pn++) {
      const rj = await json(`https://api.bilibili.com/x/v2/reply?type=1&oid=${d.aid}&sort=2&ps=20&pn=${pn}`);
      if (!rj || rj.code !== 0 || !rj.data || !Array.isArray(rj.data.replies) || !rj.data.replies.length) break;
      for (const c of rj.data.replies) {
        lines.push('[cmt] ' + String(c.content.message).replace(/\s+/g, ' ').slice(0, 300));
        for (const s of (c.replies || []).slice(0, 4)) lines.push('[sub] ' + String(s.content.message).replace(/\s+/g, ' ').slice(0, 200));
      }
      await sleep(500);
    }
    fs.writeFileSync(path.join(ROOT, OUT), lines.join('\n'), 'utf8');
    console.error(`${d.bvid} -> ${lines.length} 行`);
    await sleep(600);
  }
  fs.writeFileSync(path.join(ROOT, OUT), lines.join('\n'), 'utf8');
  console.log('写出', OUT, lines.length, '行');
})();
