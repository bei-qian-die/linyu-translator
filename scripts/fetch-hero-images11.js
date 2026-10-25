'use strict';

// 第十一轮人物配图（最终版）：只用合规来源，禁用 AI 图、禁止凑数。
//
// 取图来源（与用户要求一致）：
//   1) 百度图库 image.baidu.com —— 真实照片 / 官方立绘；
//   2) 百度百科词条图 —— 公众人物官方图；
//   3) B 站「淋语」相关视频封面 —— 允许用于组合/UP 主；
//   4) 贴吧头像直链 —— 未露脸 UP 主一律用头像。
//   以上都没有 → 记「待补图」，绝不拿无关图或 AI 图充数。
//
// 本轮已修正的三处问题：
//   - 「狐狸」＝《英雄联盟》九尾妖狐·阿狸，与既有 hero「阿狸」同角色 → 合并，不新建人物；
//   - 「李华」＝《王者荣耀》杨玉环的圈内绰号（官方曾把「杨玉环」误写成「杨玉华」）→ 合并进杨玉环；
//   - 「英中啊英中」与既有 hero「周阴婷」（淋宇宙圣子，情感博主）是两个人 → 保留独立条目但加同名区分说明。
//
// 用法:
//   node scripts/fetch-hero-images11.js            下载 + 裁剪到 256x256 PNG
//   node scripts/fetch-hero-images11.js --dry-run  只打印将要取什么，不落盘
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const IMG_DIR = path.join(ROOT, 'src', 'renderer', 'img');
const RAW_DIR = path.join(ROOT, 'evidence', 'hero-img-raw11');
const CAND = path.join(ROOT, 'evidence', 'hero-cand11.json');
fs.mkdirSync(RAW_DIR, { recursive: true });

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const DRY = process.argv.includes('--dry-run');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 候选图库（evidence/hero-cand11.json）：按人物 + 候选序号取图
// 注意：百度图库的 middleURL 指向原网页的大图，偶尔与该条目的缩略图不是同一张
// （例如「如何评价…黑天鹅立绘」那条的 middleURL 是回答里的局部放大图）。
// 因此这里统一以百度图库自身的缩略图（已落盘到 evidence/hero-cand11/）作为取图依据，
// 保证「看到的就是收录的」，来源链接记百度图库检索页 + 命中标题，可回源核对。
const CANDIDATES = JSON.parse(fs.readFileSync(CAND, 'utf8')).items;
function cand(name, idx) {
  const it = CANDIDATES.find((c) => c.name === name && c.idx === idx);
  if (!it) throw new Error('候选缺失: ' + name + ' #' + idx);
  return it;
}

// 百度图库检索页（可回源）
function baiduSearchUrl(name) {
  return (
    'https://image.baidu.com/search/index?tn=baiduimage&word=' + encodeURIComponent(name)
  );
}

// [人物名, 取图方式, 参数, 来源说明, 来源链接, 裁剪模式]
//   way: 'cand' = 百度图库候选序号；'direct' = 直接 URL
//   mode: 'fit' = 满幅裁切；'contain' = 补黑边保留完整角色（竖长立绘用）
const PLAN = [
  ['罗玉凤', 'cand', ['罗玉凤', 5], '百度图库 · 罗玉凤本人真实照片（红蝴蝶结那张流传最广）', null, 'fit'],
  [
    '英中啊英中',
    'cand',
    ['英中啊英中', 0],
    '百度图库 · 2009 贴吧红人「周阴婷」的流传照片（黑裙白领「端庄自拍」）',
    null,
    'fit',
  ],
  [
    'FLY组合',
    'direct',
    'https://i1.hdslb.com/bfs/archive/4e04216d41cc9f77c9c58bbaacdf7ce0b7282213.jpg',
    'B 站《【FLY组合】“淋语”Linbracadabra 暌违13年凤淋阴再度合体》视频封面',
    'https://www.bilibili.com/video/BV1as4y1R76r',
    'fit',
  ],
  [
    '张元英',
    'direct',
    'https://bkimg.cdn.bcebos.com/pic/cb8065380cd7912397dd9687b76d4e82b2b7d1a22ab5?x-bce-process=image/format,f_auto',
    '百度百科词条《张元英》词条图',
    'https://baike.baidu.com/item/%E5%BC%A0%E5%91%98%E7%91%9B',
    'fit',
  ],
  ['杨玉环', 'cand', ['杨玉环', 0], '百度图库 · 《王者荣耀》杨玉环官方立绘（霓裳曲模型图）', null, 'fit'],
  ['孙尚香', 'cand', ['孙尚香', 5], '百度图库 · 《王者荣耀》孙尚香官方角色模型图', null, 'fit'],
  ['百里守约', 'cand', ['百里守约', 1], '百度图库 · 《王者荣耀》百里守约官方角色模型图', null, 'fit'],
  ['青行灯', 'cand', ['青行灯', 1], '百度图库 · 《阴阳师》青行灯官方立绘', null, 'fit'],
  [
    '黑天鹅',
    'cand',
    ['黑天鹅', 0],
    '百度图库 · 《崩坏：星穹铁道》黑天鹅官方抽卡立绘（带官方角色名卡与 miHoYo 版权标识）',
    null,
    'contain',
  ],
  ['陈', 'cand', ['陈', 0], '百度图库 · 《明日方舟》干员「陈」官方立绘', null, 'fit'],
  [
    '青子',
    'direct',
    'https://img0.baidu.com/it/u=3578828807,341964694&fm=253&fmt=auto&app=138&f=JPEG?w=500&h=854',
    '百度图库 · FGO 中文 wiki「碧池青子（骑兵/rider）」官方从者卡面',
    'https://fategrandorder.fandom.com/zh/wiki/%E9%A9%91%E5%85%B5(rider)',
    'fit',
  ],
  ['琴女', 'cand', ['琴女', 0], '百度图库 · 《英雄联盟》娑娜（琴女）官方原画', null, 'fit'],
  [
    '本吧英雄绰号大科普',
    'direct',
    'https://himg.bdimg.com/sys/portrait/item/tb.1.67129f3.MmLreTfMbEmmE-4M0NsOTA?t=1792873911',
    '百度贴吧用户头像（未露脸 UP 主，按项目规则用头像）',
    'https://tieba.baidu.com/p/7604738466',
    'fit',
  ],
  [
    '聊赠一枝竹',
    'direct',
    'https://gss0.bdstatic.com/6LZ1dD3d1sgCo2Kml5_Y_D3/sys/portrait/item/tb.1.c1855c35.gdw2vM2C5Xf21u8963UaEQ?t=1748595517',
    '百度贴吧用户头像（未露脸 UP 主，按项目规则用头像）',
    'https://tieba.baidu.com/f?kw=%E6%B7%8B%E8%AF%AD',
    'fit',
  ],
  [
    '杯糕姐',
    'direct',
    'https://i2.hdslb.com/bfs/archive/208b8e9bfcbead470180ddbd31a5fdba713ad504.jpg',
    'B 站《【杯糕姐】盘点各种音效出处（1）》视频封面（该 UP 主本人节目）',
    'https://www.bilibili.com/video/BV1QWpK68Eg3',
    'fit',
  ],
  [
    '淋形针LinerClip',
    'direct',
    'https://i2.hdslb.com/bfs/archive/12d707c1ed8a06f1bf88519f825bf8853ff20708.jpg',
    'B 站《【淋形针LinerClip】如何快速掌握淋语》视频封面（该 UP 主本人节目）',
    'https://www.bilibili.com/video/BV1zK4y1T7d3',
    'fit',
  ],
];

async function download(url, dest, referer) {
  const full = /^https?:/i.test(url) ? url : 'https:' + url;
  const headers = { 'User-Agent': UA };
  if (referer) headers.Referer = referer;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(full, { headers });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 3000) throw new Error('too small: ' + buf.length);
      fs.writeFileSync(dest, buf);
      return buf.length;
    } catch (e) {
      if (i === 2) console.error('    下载失败: ' + e.message);
      await sleep(1200 * (i + 1));
    }
  }
  return 0;
}

(async () => {
  const onDisk = fs.readdirSync(IMG_DIR);
  let next = 200;
  for (const f of onDisk) {
    const m = f.match(/^hero-(\d+)\./);
    if (m) next = Math.max(next, Number(m[1]) + 1);
  }

  const report = [];
  const assign = {};
  const PY = process.env.PY || 'py';

  // 沿用上一轮已经分配好的文件名，避免每跑一次就多出一批孤儿图
  const EVI = path.join(ROOT, 'evidence', 'hero-images11.json');
  const prev = fs.existsSync(EVI) ? JSON.parse(fs.readFileSync(EVI, 'utf8')) : { assign: {} };
  const prevAssign = prev.assign || {};

  for (const [name, way, arg, how, pageUrl, mode] of PLAN) {
    let url;
    let title = '';
    let localSrc = null;
    let srcPage = pageUrl || null;
    if (way === 'cand') {
      const it = cand(arg[0], arg[1]);
      title = it.title;
      localSrc = path.join(ROOT, 'evidence', 'hero-cand11', it.file);
      url = it.url;
      if (!srcPage) srcPage = baiduSearchUrl(arg[0]);
    } else {
      url = arg;
    }

    console.log(`[pick] ${name} ← ${how}`);
    console.log(`       ${localSrc ? localSrc : String(url).slice(0, 110)}`);
    if (title) console.log(`       命中标题: ${title.slice(0, 70)}`);

    if (DRY) {
      report.push({ name, status: 'dry-run', how, title, url, pageUrl: srcPage });
      await sleep(300);
      continue;
    }

    const prevFile = prevAssign[name];
    const file = prevFile ? prevFile.replace(/^img\//, '') : `hero-${next}.png`;
    const raw = path.join(RAW_DIR, file.replace(/\.png$/, '.raw'));
    const out = path.join(IMG_DIR, file);
    let size;
    if (localSrc) {
      fs.copyFileSync(localSrc, raw);
      size = fs.statSync(raw).size;
    } else {
      size = await download(url, raw, 'https://image.baidu.com/');
    }
    if (!size) {
      report.push({ name, status: '待补图', reason: '下载失败', how, url });
      console.error(`[dl-fail] ${name}`);
      continue;
    }
    try {
      execFileSync(PY, [path.join(ROOT, 'scripts', 'crop-hero.py'), raw, out, mode || 'fit'], { stdio: 'ignore' });
    } catch (err) {
      report.push({ name, status: '待补图', reason: '裁剪失败：' + err.message, how, url });
      console.error(`[crop-fail] ${name}`);
      continue;
    }
    assign[name] = 'img/' + file;
    report.push({ name, file, how, title, url, pageUrl: srcPage, bytes: size });
    next += 1;
    console.error(`[ok] ${name} <- ${file}`);
    await sleep(400);
  }

  if (!DRY) {
    fs.writeFileSync(
      path.join(ROOT, 'evidence', 'hero-images11.json'),
      JSON.stringify({ fetchedAt: new Date().toISOString(), assign, report }, null, 2),
      'utf8'
    );
  }
  console.error(
    `\n[done] 成功 ${Object.keys(assign).length} / 计划 ${PLAN.length}，待补图 ${report.filter((r) => r.status === '待补图').length}`
  );
})();
