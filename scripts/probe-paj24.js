// 第二十四轮（淋安京 / 决战！平安京）专用深搜：只扫题名与 UP，不落库。
// 用途：先把「撅战！淋安京」这个 tag 到底有哪些视频、哪些 UP 摸清楚，
//       再决定 harvest-dm24 深挖弹幕的清单（evidence/paj-bvids.json）。
// 用法: node scripts/probe-paj24.js
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const strip = (s) => String(s || '').replace(/<[^>]+>/g, '');

const KEYWORDS = [
  '撅战！淋安京',
  '撅战淋安京',
  '淋安京',
  '决战平安京 淋语',
  '决战平安京 通讯录',
  '平安京 淋语',
  '平安京 铁T',
  '铁T成长',
  '决战！大沙田',
  '大沙田',
  '决战平安京 抽象',
  '决战平安京 整活',
  '平安京 姐妹',
  '决战平安京 本可',
];

async function search(kw, pages) {
  const out = [];
  for (let p = 1; p <= pages; p++) {
    const u =
      'https://api.bilibili.com/x/web-interface/search/type?search_type=video&keyword=' +
      encodeURIComponent(kw) +
      '&page=' +
      p;
    try {
      const r = await fetch(u, { headers: { 'User-Agent': UA, Referer: 'https://www.bilibili.com/' } });
      const j = await r.json();
      const list = (j && j.data && j.data.result) || [];
      for (const v of list) {
        if (!v.bvid) continue;
        out.push({
          bvid: v.bvid,
          title: strip(v.title),
          up: v.author,
          mid: v.mid,
          play: v.play || 0,
          danmaku: v.video_review || 0,
          pubdate: v.pubdate,
          kw,
        });
      }
      if (!list.length) break;
    } catch (e) {
      console.error('  search fail', kw, p, e.message);
    }
    await sleep(1100);
  }
  return out;
}

(async () => {
  const all = [];
  for (const kw of KEYWORDS) {
    const got = await search(kw, 4);
    console.log('[kw]', kw, '→', got.length);
    all.push(...got);
  }
  const seen = new Set();
  const uniq = all.filter((o) => !seen.has(o.bvid) && seen.add(o.bvid));
  fs.writeFileSync(path.join(ROOT, 'evidence', 'paj-cand.json'), JSON.stringify(uniq, null, 2));

  console.log('\n== 去重后总数', uniq.length, '==');
  // 淋语热度打分：标题里出现淋语特征词
  const score = (v) => {
    const t = v.title || '';
    let s = 0;
    if (/撅战|淋安京|大沙田/.test(t)) s += 100;
    if (/淋语|淋/.test(t)) s += 40;
    if (/通讯录|姐妹|本可|浦西|惹|姐妹们|婊/.test(t)) s += 30;
    if (/铁T/.test(t)) s += 30;
    if (/平安京/.test(t)) s += 20;
    if (/教学|单排|出装|实况|解说/.test(t)) s += 5;
    return s;
  };
  const hot = uniq.filter((v) => score(v) > 0).sort((a, b) => score(b) - score(a) || (b.play || 0) - (a.play || 0));
  console.log('热候选', hot.length);
  hot.slice(0, 60).forEach((v) =>
    console.log(String(score(v)).padStart(4), v.bvid, '|', v.up, '|', v.title.slice(0, 50))
  );

  const ups = {};
  for (const v of hot) ups[v.up] = (ups[v.up] || 0) + 1;
  console.log('\n== UP 主分布 ==');
  Object.entries(ups)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25)
    .forEach(([u, n]) => console.log(String(n).padStart(3), u));
})();
