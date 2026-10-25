'use strict';
// 人物配图候选批量下载：把每个英雄的候选缩略图都抓下来，拼成联络表供人工/视觉核对。
//
// 用法:
//   node scripts/pick-hero-images11.js            下载候选并生成联络表
//   node scripts/pick-hero-images11.js --only 李华 只跑某人
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CAND_DIR = path.join(ROOT, 'evidence', 'hero-cand11');
const SHEET_DIR = path.join(ROOT, 'evidence', 'hero-sheet11');
fs.mkdirSync(CAND_DIR, { recursive: true });
fs.mkdirSync(SHEET_DIR, { recursive: true });

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const HD = { 'User-Agent': UA, Referer: 'https://image.baidu.com/' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 每行：人物名 | 搜索词 | 必须命中标题 | 排除标题
const PLAN = [
  ['罗玉凤', '罗玉凤 凤姐 照片 真人', /罗玉凤|凤姐/, /ai|ai生成|生成图|漫画|表情包|cos|剪拼|ps|拼图|手绘/],
  ['英中啊英中', '周阴婷 周英庭 南宁仙子 照片', /周阴婷|周英庭|英中啊英中|南宁仙子/, /ai|生成图|漫画|表情包|cos|整容|新闻|报道|去世|离世|塌房|zs/],
  ['FLY组合', '蔡依林 淋凤阴 组合', /蔡依林|淋凤阴|罗玉凤|周阴婷/, /ai|生成图|漫画|表情包|cos/],
  ['张元英', '张元英 官方照 个人写真', /张元英/, /ai|生成图|漫画|表情包|cos|素颜|手机自拍|偷拍/],
  ['李华', '王者荣耀 李华 法师 英雄 立绘', /李华/, /杨玉环|ai|生成图|漫画|表情包|cos|壁纸|动态|解说|攻略|出装|教学/],
  ['孙尚香', '王者荣耀 孙尚香 英雄 立绘 官方', /孙尚香/, /ai|生成图|漫画|表情包|cos|壁纸|动态|解说|攻略|出装|教学/],
  ['百里守约', '王者荣耀 百里守约 英雄 立绘 官方', /百里守约|守约/, /ai|生成图|漫画|表情包|cos|壁纸|动态|解说|攻略|出装|教学/],
  ['杨玉环', '王者荣耀 杨玉环 英雄 立绘 官方', /杨玉环/, /ai|生成图|漫画|表情包|cos|壁纸|动态|解说|攻略|出装|教学/],
  ['青行灯', '阴阳师 青行灯 立绘 官方', /青行灯/, /ai|生成图|漫画|表情包|cos|壁纸|动态|解说|攻略|出装|教学/],
  ['黑天鹅', '崩坏星穹铁道 黑天鹅 立绘 官方', /黑天鹅/, /ai|生成图|漫画|表情包|cos|壁纸|动态|解说|攻略|出装|教学/],
  ['陈', '明日方舟 陈 干员 立绘 官方', /陈/, /ai|生成图|漫画|表情包|cos|壁纸|动态|解说|攻略|出装|教学|威龙/],
  ['青子', 'Fate 青子 从者 立绘 官方', /青子|青子公主/, /ai|生成图|漫画|表情包|cos|壁纸|动态|解说|攻略|出装|教学/],
  ['琴女', '英雄联盟 娑娜 琴女 立绘 官方', /娑娜|琴女/, /ai|生成图|漫画|表情包|cos|壁纸|动态|解说|攻略|出装|教学|布兰妮/],
];

async function baiduImages(word) {
  const u =
    'https://image.baidu.com/search/acjson?tn=resultjson_com&ipn=rj&ct=201326592&is=&fp=result&word=' +
    encodeURIComponent(word) +
    '&pn=0&rn=30&gsm=1e';
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(u, { headers: HD });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      return (j.data || []).filter((x) => x && x.thumbURL);
    } catch (e) {
      if (i === 2) console.error('  [ERR] ' + e.message);
      await sleep(1500 * (i + 1));
    }
  }
  return [];
}

async function download(url, dest) {
  const full = /^https?:/i.test(url) ? url : 'https:' + url;
  for (let i = 0; i < 2; i++) {
    try {
      const r = await fetch(full, { headers: HD });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 3000) throw new Error('too small');
      fs.writeFileSync(dest, buf);
      return buf.length;
    } catch {
      await sleep(900);
    }
  }
  return 0;
}

(async () => {
  const onlyIdx = process.argv.indexOf('--only');
  const only = onlyIdx >= 0 ? process.argv[onlyIdx + 1] : null;
  const N = 8; // 每个英雄取前 8 个候选
  const manifest = [];

  for (const [name, query, must, bad] of PLAN) {
    if (only && name !== only) continue;
    console.log('\n=== ' + name + ' (' + query + ') ===');
    const list = await baiduImages(query);
    const hits = list
      .map((x) => ({
        title: String(x.fromPageTitleEnc || x.fromPageTitle || '').replace(/\s+/g, ' ').trim(),
        url: x.middleURL || x.thumbURL,
        thumb: x.thumbURL,
        w: Number(x.width || 0),
        h: Number(x.height || 0),
      }))
      .filter((x) => x.url && must.test(x.title) && !bad.test(x.title));

    console.log('  命中 ' + hits.length + ' / 共 ' + list.length);
    const got = [];
    for (let i = 0; i < Math.min(N, hits.length); i++) {
      const h = hits[i];
      const file = path.join(CAND_DIR, `${name}__${i}.jpg`);
      const size = await download(h.thumb, file);
      if (size) {
        got.push({ name, idx: i, title: h.title, url: h.url, file: path.basename(file), size });
        console.log(`  [${i}] ${h.w}x${h.h} ${h.title.slice(0, 60)}`);
      }
      await sleep(250);
    }
    manifest.push(...got);
    await sleep(700);
  }

  fs.writeFileSync(
    path.join(ROOT, 'evidence', 'hero-cand11.json'),
    JSON.stringify({ fetchedAt: new Date().toISOString(), items: manifest }, null, 2),
    'utf8'
  );
  console.log('\n[done] 候选 ' + manifest.length + ' 张');
})();
