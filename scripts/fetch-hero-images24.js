'use strict';

// 第二十四轮配图抓取（淋安京 / 决战！平安京）
//
// 三条来源 + 两条否决（同 IP 是本轮最大的坑）：
//   1) 式神 → 必应 / 百度图库，检索词必须带「决战平安京」游戏 tag
//      ★ 反向否决：候选标题命中「阴阳师」却不含「决战平安京 / 决战！平安京 / Onmyoji Arena」
//        的，判为《阴阳师》本体立绘 → 一律淘汰（否则大天狗/青行灯会配成本体图）
//   2) UP 主 / 真人 → B 站 view 接口的 owner.face（头像），**不走百度图库**
//   3) 跨游戏角色 → 原生游戏的官方立绘
// 禁用 AI 图 / 二创梗图 / 带 UI 与字幕的图；找不到合规图就留空并登记待补。
//
// 用法: node scripts/fetch-hero-images24.js
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'evidence', 'hero-cand24');
const OUT_JSON = path.join(ROOT, 'evidence', 'hero-cand24.json');
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

fs.mkdirSync(OUT_DIR, { recursive: true });

// name → { kind: 'shiki'|'up'|'cross', query, bv }
const TARGETS = [
  // —— 式神 41 ——
  ['紧那罗', 'shiki', '决战平安京 紧那罗 立绘', ''],
  ['阿织', 'shiki', '决战平安京 阿织 立绘', ''],
  ['彼岸花', 'shiki', '决战平安京 彼岸花 立绘', ''],
  ['铃彦姬', 'shiki', '决战平安京 铃彦姬 立绘', ''],
  ['妖狐', 'shiki', '决战平安京 妖狐 立绘', ''],
  ['化鲸', 'shiki', '决战平安京 化鲸 立绘', ''],
  ['鬼女红叶', 'shiki', '决战平安京 鬼女红叶 立绘', ''],
  ['鬼使白', 'shiki', '决战平安京 鬼使白 立绘', ''],
  ['千姬', 'shiki', '决战平安京 千姬 立绘', ''],
  ['兰兰', 'shiki', '决战平安京 兰兰 立绘', ''],
  ['天照', 'shiki', '决战平安京 天照 立绘', ''],
  ['不知火', 'shiki', '决战平安京 不知火 立绘', ''],
  ['桔梗', 'shiki', '决战平安京 桔梗 立绘', ''],
  ['青行灯（淋安京）', 'shiki', '决战平安京 青行灯 立绘', ''],
  ['雪女', 'shiki', '决战平安京 雪女 立绘', ''],
  ['神乐', 'shiki', '决战平安京 神乐 立绘', ''],
  ['鸩', 'shiki', '决战平安京 鸩 立绘', ''],
  ['铁鼠', 'shiki', '决战平安京 铁鼠 立绘', ''],
  ['九命猫', 'shiki', '决战平安京 九命猫 立绘', ''],
  ['妖刀姬', 'shiki', '决战平安京 妖刀姬 立绘', ''],
  ['茨木童子', 'shiki', '决战平安京 茨木童子 立绘', ''],
  ['酒吞童子', 'shiki', '决战平安京 酒吞童子 立绘', ''],
  ['鬼切', 'shiki', '决战平安京 鬼切 立绘', ''],
  ['须佐之男', 'shiki', '决战平安京 须佐之男 立绘', ''],
  ['闻人翊悬', 'shiki', '决战平安京 闻人翊悬 立绘', ''],
  ['灶门炭治郎', 'shiki', '决战平安京 灶门炭治郎 立绘', ''],
  ['二口女', 'shiki', '决战平安京 二口女 立绘', ''],
  ['首无', 'shiki', '决战平安京 首无 立绘', ''],
  ['以津真天', 'shiki', '决战平安京 以津真天 立绘', ''],
  ['西凉', 'shiki', '决战平安京 西凉 立绘', ''],
  ['阎魔', 'shiki', '决战平安京 阎魔 立绘', ''],
  ['白狼', 'shiki', '决战平安京 白狼 立绘', ''],
  ['管狐', 'shiki', '决战平安京 管狐 立绘', ''],
  ['小松丸', 'shiki', '决战平安京 小松丸 立绘', ''],
  ['御馔津', 'shiki', '决战平安京 御馔津 立绘', ''],
  ['百目鬼', 'shiki', '决战平安京 百目鬼 立绘', ''],
  ['鬼童丸', 'shiki', '决战平安京 鬼童丸 立绘', ''],
  ['青蛙瓷器', 'shiki', '决战平安京 青蛙瓷器 立绘', ''],
  ['樱花妖', 'shiki', '决战平安京 樱花妖 立绘', ''],
  ['山兔', 'shiki', '决战平安京 山兔 立绘', ''],
  ['萤草', 'shiki', '决战平安京 萤草 立绘', ''],
  // —— UP 主 16（走头像，bv 取代表作）——
  ['桐颜灿', 'up', '', 'BV16LeEz9EwM'],
  ['八级大蜗牛', 'up', '', 'BV1xEGFzWEwG'],
  ['悲惨圣母院_Sebastian', 'up', '', 'BV1jT2WYJECt'],
  ['醒时末爱', 'up', '', 'BV1XX6mBXE31'],
  ['一击肘飞女施主', 'up', '', 'BV1ghnD62EXy'],
  ['诗云工作室STANZA', 'up', '', 'BV1bupj6DEbh'],
  ['酣睡之乐', 'up', '', 'BV1nqxu6FE5i'],
  ['一大碗白米粥zz', 'up', '', 'BV16LnR6VEoD'],
  ['核桃包子味', 'up', '', 'BV1Fzxu6ZEBp'],
  ['情绪细菌', 'up', '', 'BV1X1HW6LEst'],
  ['喜欢辅助的涳明Ovo', 'up', '', 'BV1gDn461EcZ'],
  ['丶唯一的唯一', 'up', '', 'BV1jnnX6wEVN'],
  ['冬田美铃', 'up', '', 'BV1xWac6tEAk'],
  ['决战平安亰官方', 'up', '', 'BV1S6Jt67Eod'],
  ['玉南辉', 'up', '', 'BV1XWy7YxEQJ'],
  ['诗雨南宁', 'up', '', 'BV1Xw411A7rY'],
  // —— 跨游戏 3 ——
  ['拉克丝', 'cross', '英雄联盟 拉克丝 官方 立绘', ''],
  ['迪希雅', 'cross', '原神 迪希雅 官方 立绘', ''],
  ['卢雅那', 'cross', '卢雅那 角色 立绘', ''],
];

// 标题黑名单：带这些字样的候选直接淘汰（UI / 二创 / 攻略 / 梗图 / 视频封面大字）
const BAD = /攻略|详解|教学视频|资讯|漫画|同人|Cosplay|cos|表情包|梗图|壁纸合集|二维码|直播|剪辑|封面|战力|强度榜|节奏|爆料|资讯站|皮肤展示|抽卡|十连/;
// 同 IP 反向否决：命中「阴阳师」但不含平安京标识 → 《阴阳师》本体图
const ONLY_GAME = /决战平安京|决战！平安京|决战!平安京|Onmyoji Arena|onmyoji arena|平安京/;
const isBodyGame = (title) => /阴阳师/.test(title) && !ONLY_GAME.test(title);

const safeName = (s) => String(s).replace(/[\\/:*?"<>|（）()·]/g, '_');

async function bingImages(query, max) {
  const url =
    'https://www.bing.com/images/async?q=' +
    encodeURIComponent(query) +
    '&first=0&count=30&mkt=zh-CN&adlt=off';
  const r = await fetch(url, { headers: { 'User-Agent': UA, Referer: 'https://www.bing.com/' } });
  const html = await r.text();
  const items = [];
  for (const m of html.matchAll(/m="([^"]+)"/g)) {
    const raw = m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&');
    try {
      const j = JSON.parse(raw);
      if (!j.murl) continue;
      const t = String(j.t || '').replace(/<[^>]+>/g, '');
      if (BAD.test(t)) continue;
      items.push({ url: j.murl, title: t, page: j.purl || '' });
    } catch { /* 忽略解析失败的条目 */ }
    if (items.length >= max) break;
  }
  return items;
}

async function download(url, file) {
  const r = await fetch(url, {
    headers: { 'User-Agent': UA, Referer: 'https://www.bing.com/' },
    redirect: 'follow',
  });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 3000) throw new Error('too small ' + buf.length);
  fs.writeFileSync(file, buf);
  return buf.length;
}

async function upFace(bv, name) {
  const r = await fetch('https://api.bilibili.com/x/web-interface/view?bvid=' + bv, {
    headers: { 'User-Agent': UA, Referer: 'https://www.bilibili.com/' },
  });
  const j = await r.json();
  if (j.code !== 0) throw new Error('view ' + j.code);
  const face = j.data.owner && j.data.owner.face;
  if (!face) throw new Error('no face');
  const url = face.startsWith('//') ? 'https:' + face : face;
  const file = path.join(OUT_DIR, safeName(name) + '_face.jpg');
  await download(url, file);
  return { url, title: `${j.data.owner.name} 的 B 站头像（代表作 ${bv}）` };
}

(async () => {
  const items = [];
  let rejected = 0;
  for (const [name, kind, query, bv] of TARGETS) {
    if (kind === 'up') {
      try {
        const got = await upFace(bv, name);
        items.push({
          name, kind, file: safeName(name) + '_face.jpg',
          url: got.url, title: got.title, source: 'https://www.bilibili.com/video/' + bv, good: true,
        });
        console.log('[UP]', name, '→ 头像 ok');
      } catch (e) {
        console.log('[UP]', name, 'FAIL', e.message);
      }
      await sleep(900);
      continue;
    }

    let got = 0;
    try {
      const cands = await bingImages(query, 8);
      for (let i = 0; i < cands.length && got < 5; i++) {
        const c = cands[i];
        if (isBodyGame(c.title)) { rejected++; continue; }   // 同 IP 反向否决
        const file = safeName(name) + '_' + i + '.jpg';
        try {
          await download(c.url, path.join(OUT_DIR, file));
        } catch (e) {
          continue;
        }
        items.push({
          name, kind, file, url: c.url,
          title: (c.title || '').slice(0, 80),
          source: 'https://www.bing.com/images/search?q=' + encodeURIComponent(query),
          good: true,
        });
        got++;
        await sleep(400);
      }
      console.log('[' + kind + ']', name, '→', got, '张（否决', cands.length - got, '）');
    } catch (e) {
      console.log('[' + kind + ']', name, 'FAIL', e.message);
    }
    await sleep(900);
  }

  fs.writeFileSync(OUT_JSON, JSON.stringify({ items, rejectedBySameIP: rejected }, null, 2), 'utf8');
  console.log('\n候选', items.length, '张 | 同 IP 反向否决', rejected, '张');
  const missing = TARGETS.filter(([n]) => !items.some((i) => i.name === n)).map(([n]) => n);
  if (missing.length) console.log('无候选（待补）:', missing.join('、'));
})();
