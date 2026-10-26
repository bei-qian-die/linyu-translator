'use strict';

// 第十七轮质检：为「图片不合规」的洛克淋国人物重新抓候选图。
//
// 只用两个来源，禁止 AI 生成图：
//   1. 百度图库（官方立绘 / 图鉴 / 百科配图 / 官方素材）
//   2. B 站 UP 主头像（view API 的 owner.face，用于没露脸的 UP 主）
//
// 与第十六轮脚本的差别：
//   - 每人抓 10 张候选（上一轮 6 张不够挑）
//   - 分辨率权重提高，明显小于 260px 的直接降权，避免又选到低清放大图
//   - 标题命中「壁纸/高清/立绘/图鉴/百科/官方」加分，命中「攻略/价格/水印/抽卡/交易」重罚
//
// 产出 evidence/hero-cand17/<name>_<idx>.jpg 与 evidence/hero-cand17.json
// 用法: node scripts/fetch-hero-cand17.js [名字,名字,...]
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
// 第二轮（--retry）换关键词重抓那几位「首轮候选全是带字截图」的，结果单独落盘，不覆盖首轮证据。
const RETRY = process.argv.includes('--retry');
const OUT_DIR = path.join(ROOT, 'evidence', RETRY ? 'hero-cand17-retry' : 'hero-cand17');
const OUT_JSON = path.join(ROOT, 'evidence', RETRY ? 'hero-cand17-retry.json' : 'hero-cand17.json');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const HD = { 'User-Agent': UA, Referer: 'https://image.baidu.com/' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const GOOD = /立绘|原画|图鉴|百科|官方|宠物档案|形象|全身|高清|壁纸|设定|精灵图/;
const BAD =
  /攻略|技能|配招|强度|打法|阵容|一览|排行|推荐|怎么|如何|教学|获取|价格|报价|炫彩|异色|黑白|抽卡|晒|出货|交易|代练|脚本|模拟器|广告|二维码|聊天|商城|礼包|预约|下载|安卓|ios|私服/i;

// 本轮判定为不合规、需要重抓的 19 位（理由见 evidence/qc17-image-review.md）
// 首轮「洛克王国 X」全被攻略/实机截图占满的几位，第二轮换检索词：
// 加「图鉴 / 立绘 / 精灵」这类词能把百科词条图顶上来，把视频截图压下去。
const RETRY_PLAN = ['瞌睡王', '龙希帕尔', '幽颖树', '云梦豚', '上岸蛙'];
const KEYWORDS = {
  瞌睡王: '瞌睡王 图鉴 立绘',
  龙希帕尔: '龙希帕尔 图鉴 立绘',
  幽颖树: '幽颖树 图鉴 立绘',
  云梦豚: '云梦豚 图鉴 精灵',
  上岸蛙: '上岸蛙 图鉴 精灵',
};

const PLAN = RETRY
  ? RETRY_PLAN
  : process.argv[2]
    ? process.argv[2].split(',')
    : [
        '魔力猫',
        '瞌睡王',
        '鬼雾',
        '喷火鸟',
        '龙希帕尔',
        '圣羽翼王',
        '幽颖树',
        '幽铃',
        '多灵主',
        '巴哈姆特',
        '卡瓦重',
        '阿布',
        '卷毛鸭',
        '云梦豚',
        '咔咔鸟',
        '障眼魔',
        '上岸蛙',
        '吸泥鸥',
        // UP 主：走 B 站头像分支，不查百度图库
        '翊坤宫娘娘',
      ];

// UP 主头像走 B 站 view API（没露脸的用头像）。键=人物名，值=该 UP 主的任一视频 bvid。
const UP_AVATAR = {
  翊坤宫娘娘: 'BV1z2eM6kEJQ',
};

function score(it) {
  const t = String(it.fromPageTitleEnc || it.fromPageTitle || '');
  let s = 0;
  if (GOOD.test(t)) s += 60;
  if (BAD.test(t)) s -= 45;
  const w = it.width || 0;
  const h = it.height || 0;
  const short = Math.min(w, h);
  // 低清图直接压到底：上一轮几张糊图就是从小图上放大的
  if (short >= 500) s += 25;
  else if (short >= 300) s += 12;
  else if (short >= 200) s -= 10;
  else s -= 40;
  if (w >= h * 2) s -= 15; // 横幅多带字
  return s;
}

async function search(word, rn) {
  const u =
    'https://image.baidu.com/search/acjson?tn=resultjson_com&ipn=rj&ct=201326592&is=&fp=result&word=' +
    encodeURIComponent(word) +
    `&pn=0&rn=${rn}&gsm=1e`;
  const r = await fetch(u, { headers: HD });
  const txt = await r.text();
  let j;
  try {
    j = JSON.parse(txt.replace(/[\u0000-\u001f]/g, ' '));
  } catch (e) {
    throw new Error('JSON 解析失败 ' + e.message);
  }
  return (j.data || []).filter((x) => x && (x.middleURL || x.thumbURL));
}

async function download(url, file) {
  const r = await fetch(url, { headers: HD });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 4000) throw new Error('too small');
  fs.writeFileSync(file, buf);
}

async function upAvatar(name, bvid) {
  const r = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`, {
    headers: { 'User-Agent': UA, Referer: 'https://www.bilibili.com/' },
  });
  const j = await r.json();
  const owner = (j.data && j.data.owner) || {};
  if (!owner.face) throw new Error('无 owner.face');
  const face = owner.face.startsWith('http') ? owner.face : 'https:' + owner.face;
  const file = `${name}_up.jpg`;
  await download(face, path.join(OUT_DIR, file));
  return { name, idx: 0, title: `UP主 ${owner.name} 头像`, w: 0, h: 0, url: face, origin: face, file, score: 999, type: 'up' };
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const items = [];
  for (const [name, bvid] of Object.entries(UP_AVATAR)) {
    if (!PLAN.includes(name)) continue;
    try {
      items.push(await upAvatar(name, bvid));
      console.error(`[OK] ${name} UP 头像`);
    } catch (e) {
      console.error(`[头像失败] ${name}: ${e.message}`);
    }
    await sleep(500);
  }

  for (const name of PLAN) {
    if (UP_AVATAR[name]) continue;
    const noun = KEYWORDS[name] || `洛克王国 ${name}`;
    let list;
    try {
      list = await search(noun, 30);
    } catch (e) {
      console.error(`[搜索失败] ${name}: ${e.message}`);
      continue;
    }
    if (!list.length) {
      console.error(`[无结果] ${name}`);
      continue;
    }
    const ranked = list
      .map((x, i) => ({ raw: x, i, s: score(x) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, 10);
    let idx = 0;
    for (const { raw, s } of ranked) {
      const file = `${name}_${idx}.jpg`;
      try {
        await download(raw.middleURL || raw.thumbURL, path.join(OUT_DIR, file));
      } catch {
        idx++;
        continue;
      }
      items.push({
        name,
        idx,
        title: String(raw.fromPageTitleEnc || raw.fromPageTitle || '').slice(0, 90),
        w: raw.width,
        h: raw.height,
        url: raw.middleURL || raw.thumbURL,
        origin: raw.objURL || raw.fromURL || '',
        file,
        score: s,
      });
      idx++;
      await sleep(120);
    }
    console.error(`[OK] ${name} 候选 ${idx}`);
    await sleep(700);
  }
  fs.writeFileSync(OUT_JSON, JSON.stringify({ generatedAt: new Date().toISOString(), items }, null, 2) + '\n', 'utf8');
  console.log(`候选 ${items.length} 张 / ${new Set(items.map((x) => x.name)).size} 个对象 -> ${OUT_JSON}`);
})();
