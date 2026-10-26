'use strict';

// 第二十轮：从《漫威争锋》国服官网英雄列表页抓「官方事实」。
//
// 这一步解决两个问题：
//   1) 官方三种职责（捍卫者 / 决斗家 / 策略家）在 B 站语料里几乎不出现，
//      但没有官方出处就去写「该英雄是什么位分」等于凭空编词。官网每个英雄卡片上都带
//      data-tag="捍卫者" 这类属性，是逐字可核的第一手事实。
//   2) 官方英雄立绘本身就是最合规的配图来源（比百度图库转手还要近源头），
//      顺便把图片 URL 与所属英雄一起落进 evidence，供 fetch-hero-images20.js 取用。
//
// 只用公开页面 marvelrivals.163.com/heroes/index.html，不带任何凭据。
//
// 产出 corpus/corpus-official20.txt + evidence/official-heroes20.json
const fs = require('fs');
const path = require('path');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const ROOT = path.join(__dirname, '..');
const SRC = 'https://marvelrivals.163.com/heroes/index.html';

(async () => {
  const r = await fetch(SRC, { headers: { 'User-Agent': UA } });
  const html = await r.text();
  // 每张卡片是 <a ...data-tag><img><img><img><img></a>，四张依次是：
  //   ① 99x83 小头像 ② 154x281 半身 ③ 181x330 立绘 ④ 145x86 徽章
  // 配图要第 ③ 张（最大且是竖版全身），所以整组都抓下来再选。
  const re = /data-tag="([^"]+)"[^>]*?data-name="([^"]+)"[^>]*?title="([^"]*)"[^>]*>\s*((?:\s*<img src='[^']+'[^>]*>\s*)+)/g;
  const re2 = /data-tag="([^"]+)"[^>]*?data-name="([^"]+)"[^>]*?title="([^"]*)"/g;
  const items = [];
  const seen = new Set();
  let m;
  while ((m = re.exec(html)) !== null) {
    const role = m[1];
    const name = m[2];
    const en = m[3];
    const imgs = [...m[4].matchAll(/<img src='([^']+)'[^>]*>/g)].map((x) => x[1]);
    if (seen.has(name + role)) continue;
    seen.add(name + role);
    items.push({
      role,
      name,
      en,
      img: imgs[0] || '',
      imgs,
      // 立绘：四张里最大那张（181x330），取不到就退回第一张
      imgBig: imgs.length >= 3 ? imgs[2] : imgs[0] || '',
    });
  }
  if (!items.length) {
    // 退一步：属性顺序不同时，先割 role + name，图片留空
    while ((m = re2.exec(html)) !== null) {
      const role = m[1];
      const name = m[2];
      const en = m[3];
      if (seen.has(name + role)) continue;
      seen.add(name + role);
      items.push({ role, name, en, img: '', imgs: [], imgBig: '' });
    }
  }

  // ---- 地图：官网首页的介绍段落，逐字可核 ----
  const HOME = 'https://marvelrivals.163.com/';
  const MAP_KEYS = ['瓦坎达', '东京2099', '地狱火晚宴', '阿斯加德', '仙宫', '世界树', '昆仑', '克林塔', '九头蛇', '底比斯', '时代广场', '阿拉寇', '蜘蛛岛', '天尊花园'];
  const hr = await fetch(HOME, { headers: { 'User-Agent': UA } });
  const home = await hr.text();
  const plain = home
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ');
  const mapLines = [];
  for (const k of MAP_KEYS) {
    let i = plain.indexOf(k);
    while (i !== -1) {
      const seg = plain.slice(Math.max(0, i - 30), i + 120).trim();
      if (seg.length > 20) mapLines.push(`【简介】官方地图介绍：${seg}。出处：${HOME}`);
      i = plain.indexOf(k, i + k.length);
    }
  }

  const out = [];
  out.push('# 《漫威争锋》国服官网英雄列表与地图介绍快照（第二十轮）');
  out.push(`# 抓取时间: ${new Date().toISOString()}`);
  out.push('# 来源：https://marvelrivals.163.com/heroes/index.html 与官网首页（公开页面，未使用任何凭据）');
  out.push('# 英雄部分逐字取自卡片上的 data-tag / data-name / title 属性');
  for (const it of items) {
    out.push(`【视频】漫威争锋 ${it.name} ${it.en ? '（' + it.en + '）' : ''}`);
    out.push(`【简介】官方定位：${it.role}。出处：${SRC}`);
  }
  for (const l of [...new Set(mapLines)].slice(0, 60)) out.push(l);
  fs.writeFileSync(path.join(ROOT, 'corpus', 'corpus-official20.txt'), out.join('\n') + '\n', 'utf8');
  fs.writeFileSync(
    path.join(ROOT, 'evidence', 'official-heroes20.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), src: SRC, total: items.length, items }, null, 2),
    'utf8'
  );
  const roles = {};
  for (const it of items) roles[it.role] = (roles[it.role] || 0) + 1;
  console.error(`[done] 英雄 ${items.length} 位，职责分布 ${JSON.stringify(roles)}`);
  console.error(`  语料 corpus/corpus-official20.txt，图源清单 evidence/official-heroes20.json`);
})();
