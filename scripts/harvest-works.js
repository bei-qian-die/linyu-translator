'use strict';

// 人物传「代表作」补全：只采可回源的真实内容，不编。
//
// 两条路：
//   1) UP主（group=up）—— 走 B 站公开搜索接口找该 UP 主本名发布的视频，
//      只收 author 与人物名一致的条目（避免把别人拍的二创挂到本人名下），
//      作品串写成「标题（BV号）」，点开就能核对。
//   2) 游戏角色 / 真人（group=game|real）—— 他们没有"作品"，但有"名场面"。
//      名场面就是挂在他们名下、且已经带可追溯来源的词卡与名言，
//      从 lore 里取，不新增任何断言。
//
// 产出 evidence/works-*.json，脚本只打印建议，不直接改内容文件——
// 改哪个人的哪一条要人看过再说。
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const lore = require(path.join(ROOT, 'src', 'core', 'lore'));

const WANT = 3;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stripTags = (s) => String(s || '').replace(/<[^>]+>/g, '');
const clip = (s, n) => (String(s || '').length > n ? String(s).slice(0, n) + '…' : String(s || ''));

async function api(url) {
  for (let a = 0; a < 3; a++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, Referer: 'https://www.bilibili.com/' } });
      if (r.status === 412 || r.status === 429) { await sleep(4000 * (a + 1)); continue; }
      return await r.json();
    } catch { await sleep(1500 * (a + 1)); }
  }
  return null;
}

(async () => {
  const heroes = lore.heroes;
  const cards = lore.flashcards;
  const quotes = lore.quotes;

  // ---- 名场面：挂在某人名下、且带来源的词卡/名言 ----
  const sceneOf = (name) => {
    const out = [];
    for (const c of cards) {
      if (c.hero !== name) continue;
      const src = String(c.source || '').trim();
      if (!src) continue;
      out.push({ kind: '词卡', label: c.term, src });
    }
    for (const q of quotes) {
      if (q.hero !== name) continue;
      const src = String(q.src || '').trim();
      if (!src) continue;
      out.push({ kind: '名言', label: clip(q.text, 30), src });
    }
    return out;
  };

  // ---- UP 主作品：只认本人发的视频 ----
  async function worksOf(h) {
    const got = [];
    const tried = new Set();
    for (const kw of [h.name + ' 淋语', h.name]) {
      if (got.length >= WANT) break;
      for (let p = 1; p <= 2 && got.length < WANT; p++) {
        const u = `https://api.bilibili.com/x/web-interface/search/type?search_type=video&keyword=${encodeURIComponent(kw)}&page=${p}`;
        const j = await api(u);
        const list = (j && j.data && j.data.result) || [];
        for (const v of list) {
          if (got.length >= WANT) break;
          if (!v.bvid || tried.has(v.bvid)) continue;
          tried.add(v.bvid);
          const author = stripTags(v.author || '');
          // 关键过滤：作者名必须就是这位人物，否则那条视频不是他的作品
          if (author !== h.name) continue;
          const title = stripTags(v.title || '');
          if (!title) continue;
          got.push({ kind: '视频', label: title, src: 'BV' + String(v.bvid).replace(/^BV/, ''), url: `https://www.bilibili.com/video/${v.bvid}` });
        }
        await sleep(900);
      }
    }
    return got;
  }

  const short = heroes.filter((h) => (h.works || []).length < WANT);
  console.error(`需要补的作品人物：${short.length} 位（目标每人不低于 ${WANT} 条）\n`);

  const report = [];
  for (const h of short) {
    const have = (h.works || []).length;
    const need = WANT - have;
    let add;
    if (h.group === 'up') {
      const found = await worksOf(h);
      add = found.slice(0, need);
    } else {
      add = sceneOf(h.name).slice(0, need);
    }
    report.push({
      hero: h.name, group: h.group || 'real', have, need, add,
      source: h.group === 'up' ? 'B 站公开搜索接口（作者名精确匹配）' : 'lore 内已带可追溯来源的词卡/名言',
    });
    console.error(`${h.name}（${h.group}）已有 ${have}，可补 ${add.length}：`);
    for (const a of add) console.error(`    + ${a.kind}｜${a.label}　← ${a.src}`);
    if (!add.length) console.error('    （没有可回源的素材，不补）');
  }

  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const out = path.join(ROOT, 'evidence', `works-${stamp}.json`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify({
    fetchedAt: new Date().toISOString(),
    note: '代表作候选，全部来自可回源的真实数据；未写入任何人物词条，需人工确认后采纳',
    report,
  }, null, 2), 'utf8');

  const okCount = report.filter((r) => r.add.length).length;
  const addTotal = report.reduce((n, r) => n + r.add.length, 0);
  console.error(`\n[done] ${okCount}/${short.length} 位有可用素材，合计可补 ${addTotal} 条`);
  console.error(`  清单 ${path.relative(ROOT, out)}`);
})();
