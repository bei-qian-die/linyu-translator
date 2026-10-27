'use strict';

// 第二十一轮：把「守望淋锋」相关的 B 站视频题目全量探一遍。
// 目的：光靠 harvest 的 200 条抽样不够，【守望淋锋】标题是淋语成句的主矿，
// 必须先把题名全捞出来，才能挑出值得深挖弹幕/评论的那批（写进 evidence/ow-bvids.json）。
//
// 用法: node scripts/probe-ow21.js
const fs = require('fs');
const path = require('path');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const ROOT = path.join(__dirname, '..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const strip = (s) => String(s || '').replace(/<[^>]+>/g, '');

const KEYWORDS = [
  '守望淋锋',
  '守望先锋 淋语',
  '守望先锋 通讯录',
  '守望先锋 阿三',
  '守望先锋 摩西女',
  '守望先锋 辛梅塔',
  '守望先锋 我莫',
  '守望先锋 血律',
  '守望先锋 雾子',
  '守望先锋 站街',
  '守望先锋 姐妹',
  '守望 本可',
];

async function api(url) {
  for (let a = 0; a < 4; a++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, Referer: 'https://www.bilibili.com/' } });
      if (r.status === 412 || r.status === 429) {
        await sleep(8000 * (a + 1));
        continue;
      }
      const t = await r.text();
      if (!t.trim().startsWith('{')) throw new Error('非 JSON 响应');
      return JSON.parse(t);
    } catch (e) {
      await sleep(3000 * (a + 1));
    }
  }
  return null;
}

(async () => {
  const out = [];
  for (const kw of KEYWORDS) {
    for (let p = 1; p <= 5; p++) {
      const u = `https://api.bilibili.com/x/web-interface/search/type?search_type=video&keyword=${encodeURIComponent(kw)}&page=${p}`;
      const j = await api(u);
      const list = (j && j.data && j.data.result) || [];
      for (const v of list) {
        if (!v.bvid) continue;
        out.push({
          bvid: v.bvid,
          title: strip(v.title),
          up: v.author || '',
          play: v.play || 0,
          pubdate: v.pubdate ? new Date(v.pubdate * 1000).toISOString().slice(0, 10) : '',
          kw,
        });
      }
      console.error(`[probe] ${kw} p${p}: ${list.length}`);
      if (!list.length) break;
      await sleep(2000);
    }
  }
  const seen = new Set();
  const uniq = out.filter((o) => !seen.has(o.bvid) && seen.add(o.bvid));
  fs.writeFileSync(path.join(ROOT, 'evidence/ow-cand.json'), JSON.stringify(uniq, null, 2), 'utf8');
  console.error(`\n[done] 去重后 ${uniq.length} 条 → evidence/ow-cand.json`);
  const hot = uniq.filter((o) => /守望淋锋|摩西|我莫|我辛|阿三|辛梅塔|血律|通讯录|站街|我光|本可|姐妹/i.test(o.title));
  console.error(`[热候选] ${hot.length} 条：`);
  for (const o of hot) console.error(`  ${o.bvid} | ${o.up} | ${o.title.slice(0, 50)} | ${o.play}`);
})();
