// 第二十四轮（淋安京）专用：枚举核心 UP 主与「撅战！淋安京」合集的全部视频。
// 产出 evidence/paj-bvids.json → 交给 harvest-dm24.js 深挖弹幕与评论。
// 用法: node scripts/enum-paj24.js
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// mid: 桐颜灿(锚点UP) / 八级大蜗牛 / 松下丶Aoki / 悲惨圣母院_Sebastian / 醒时末爱 / 一击肘飞女施主
const UPS = [
  ['476690125', '桐颜灿'],
  ['205410343', '八级大蜗牛'],
  ['199718382', '松下丶Aoki'],
  ['348973559', '悲惨圣母院_Sebastian'],
  ['1683524568', '醒时末爱'],
];

async function spaceList(mid, name, pages) {
  const out = [];
  for (let p = 1; p <= pages; p++) {
    const u = `https://api.bilibili.com/x/space/arc/search?mid=${mid}&ps=50&pn=${p}&order=pubdate`;
    try {
      const r = await fetch(u, { headers: { 'User-Agent': UA, Referer: `https://space.bilibili.com/${mid}` } });
      const j = await r.json();
      if (j.code !== 0) {
        console.log('  [space]', name, 'code', j.code, j.message);
        break;
      }
      const list = (j.data && j.data.list && j.data.list.vlist) || [];
      for (const v of list) out.push({ bvid: v.bvid, title: v.title, up: name, mid, play: v.play || 0 });
      if (list.length < 50) break;
    } catch (e) {
      console.log('  [space]', name, 'ERR', e.message);
      break;
    }
    await sleep(1200);
  }
  return out;
}

async function seasonEpisodes(bvid) {
  const u = `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`;
  const r = await fetch(u, { headers: { 'User-Agent': UA, Referer: 'https://www.bilibili.com/' } });
  const d = (await r.json()).data || {};
  const s = d.ugc_season;
  if (!s) return { season: null, eps: [] };
  const eps = [];
  for (const sec of s.sections || []) {
    for (const ep of sec.episodes || []) {
      eps.push({ bvid: ep.bvid, aid: ep.aid, title: ep.title, up: d.owner && d.owner.name, section: sec.title });
    }
  }
  return {
    season: { id: s.id, title: s.title, intro: s.intro, ep_count: s.ep_count, cover: s.cover, mid: s.mid },
    eps,
  };
}

(async () => {
  const all = [];
  // 1) 合集全 30 集
  const { season, eps } = await seasonEpisodes('BV16LeEz9EwM');
  console.log('== 合集 ==', season && season.title, '| 集数', season && season.ep_count, '| 实际取到', eps.length);
  if (season) console.log('   简介:', season.intro);
  for (const e of eps) {
    all.push({ bvid: e.bvid, title: e.title, up: e.up || '桐颜灿', group: '撅战！淋安京合集' });
    console.log('   ', e.bvid, '|', (e.title || '').slice(0, 60));
  }

  // 2) 各 UP 全部作品
  for (const [mid, name] of UPS) {
    const got = await spaceList(mid, name, 3);
    console.log('[UP]', name, '→', got.length);
    for (const v of got) all.push({ ...v, group: 'UP:' + name });
  }

  const seen = new Set();
  const uniq = all.filter((o) => o.bvid && !seen.has(o.bvid) && seen.add(o.bvid));
  fs.writeFileSync(path.join(ROOT, 'evidence', 'paj-bvids.json'), JSON.stringify(uniq, null, 2));
  console.log('\n== 去重后', uniq.length, '条 → evidence/paj-bvids.json');

  // 3) 把全部题名逐字入语料（题名本身就是淋语成句）
  const lines = [
    '',
    '# B 站「撅战！淋安京 / 决战！大沙田」视频题名快照（第二十四轮）',
    '# 用途：题名即淋语成句，逐字入语料供验真',
    '# 来源：B 站公开 view / space 接口，出处见 evidence/paj-bvids.json',
    '',
  ];
  if (season) {
    lines.push('【合集】' + season.title);
    lines.push('【简介】' + season.intro);
  }
  for (const v of uniq) {
    lines.push('【视频】' + v.title);
    lines.push('【UP】' + v.up);
  }
  fs.appendFileSync(path.join(ROOT, 'corpus', 'corpus-web24.txt'), lines.join('\n') + '\n');
  console.log('题名入语料', uniq.length, '条');
})();
