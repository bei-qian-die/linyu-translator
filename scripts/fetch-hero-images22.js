'use strict';
// 第二十二轮配图抓取（第五淋格板块修复）。
// 背景：第 18 轮百度图库检索结果被《无畏契约》等其它游戏污染，本板块 40+ 人物图文不符。
// 本轮检索词一律带游戏 tag：「第五人格 + 人名」，个别加本名消歧。
// UP 主按规则用 B 站头像（view API owner.face）。
// 产出 evidence/qc22-cand/<名>/N.jpg + evidence/qc22-cand.json，供人工拼图复核后落地。
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'evidence', 'qc22-cand');
const OUT_JSON = path.join(ROOT, 'evidence', 'qc22-cand.json');
fs.mkdirSync(OUT_DIR, { recursive: true });

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 检索词：默认「第五人格 <名> 官方立绘」，需要消歧的在这里覆盖
const QUERY = {
  医生: '第五人格 医生 艾米丽 官方立绘',
  蜘蛛: '第五人格 蜘蛛 瓦尔莱塔 官方立绘',
  空军: '第五人格 空军 玛尔塔 官方立绘',
  佣兵: '第五人格 佣兵 奈布 官方立绘',
  愚人金: '第五人格 愚人金 诺顿 官方立绘',
  摄影师: '第五人格 摄影师 约瑟夫 官方立绘',
  梦之女巫: '第五人格 梦之女巫 官方立绘',
  黄衣之主: '第五人格 黄衣之主 哈斯塔 官方立绘',
  红夫人: '第五人格 红夫人 玛丽 官方立绘',
  邦邦: '第五人格 邦邦 邦邦女郎 官方立绘',
  律师: '第五人格 律师 弗雷迪 官方立绘',
  大副: '第五人格 大副 何塞 官方立绘',
  爱哭鬼: '第五人格 爱哭鬼 罗比 官方立绘',
  使徒: '第五人格 使徒 安 官方立绘',
  守夜人: '第五人格 守夜人 安德鲁 官方立绘',
  蜡像师: '第五人格 蜡像师 官方立绘',
  破轮: '第五人格 破轮 威尔 三兄弟 官方立绘',
  记录员: '第五人格 记录员 官方立绘',
  疯眼: '第五人格 疯眼 巴尔克 官方立绘',
  盲女: '第五人格 盲女 海伦娜 官方立绘',
  机械师: '第五人格 机械师 特蕾西 官方立绘',
  舞女: '第五人格 舞女 玛格莎 官方立绘',
  魔术师: '第五人格 魔术师 塞尔吉 官方立绘',
  冒险家: '第五人格 冒险家 库特 官方立绘',
  勘探员: '第五人格 勘探员 诺顿 官方立绘',
  调酒师: '第五人格 调酒师 官方立绘',
  杂技演员: '第五人格 杂技演员 迈克 官方立绘',
  画家: '第五人格 画家 艾格 官方立绘',
  病患: '第五人格 病患 埃米尔 官方立绘',
  心理学家: '第五人格 心理学家 艾达 官方立绘',
  玩具商: '第五人格 玩具商 安妮 官方立绘',
  咒术师: '第五人格 咒术师 潘帕 官方立绘',
  前锋: '第五人格 前锋 威廉 官方立绘',
  昆虫学者: '第五人格 昆虫学者 梅莉 官方立绘',
  囚徒: '第五人格 囚徒 卢卡 官方立绘',
  邮差: '第五人格 邮差 维克多 官方立绘',
  入殓师: '第五人格 入殓师 伊索 官方立绘',
  园丁: '第五人格 园丁 艾玛 官方立绘',
  小提琴家: '第五人格 小提琴家 安东尼奥 官方立绘',
  隐士: '第五人格 隐士 官方立绘',
  喧嚣: '第五人格 喧嚣 官方立绘',
  时空之影: '第五人格 时空之影 官方立绘',
  凤蝶: '第五人格 凤蝶 官方立绘',
  淋人金Daddy: '第五人格 愚人金 诺顿 官方立绘',
};

// UP 主：用代表作 BV 拿头像
const AVATARS = [
  ['一只叫艾文的海豚', 'BV1Smpj69E1d'],
  ['松下丶Aoki', 'BV1AWPxzqEu5'],
  ['gulpppppp', 'BV1MmqpBgE9u'],
  ['懂法的txz', 'BV19JvgeYE3t'],
];

// 标题黑名单：排除其它游戏与明显杂图
const BAD = /无畏契约| valorant |瓦罗兰特|守望|王者荣耀|原神|明日方舟|三国|表情包|梗图|排行榜|强度|手绘|同人|绘画|教程|攻略|cos|真人/i;
const ONLY_GAME = /第五人格|identity v|监管者|求生者|庄园|立绘|皮肤|头像|图鉴/i;

const clean = (s) => String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

async function grab(url, referer) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Referer: referer || url } });
    if (!r.ok) return null;
    const ct = r.headers.get('content-type') || '';
    if (!/^image\//.test(ct)) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 8000) return null;
    return buf;
  } catch { return null; }
}

async function baiduCand(word, n = 6) {
  const u = 'https://image.baidu.com/search/acjson?tn=resultjson_com&ipn=rj&ct=201326592&is=&fp=result&word=' +
    encodeURIComponent(word) + '&pn=0&rn=30&gsm=1e';
  let j;
  try {
    const r = await fetch(u, { headers: { 'User-Agent': UA, Referer: 'https://image.baidu.com/' } });
    j = JSON.parse((await r.text()).replace(/[\u0000-\u001f]/g, ' '));
  } catch { return []; }
  const out = [];
  for (const x of (j.data || []).filter((v) => v && (v.middleURL || v.thumbURL))) {
    const title = clean(x.fromPageTitle || x.fromPageTitleEnc || '');
    if (BAD.test(title)) continue;
    if (x.width && x.width < 300) continue;
    const buf = await grab(x.middleURL || x.thumbURL, 'https://image.baidu.com/');
    if (!buf) continue;
    out.push({ buf, url: x.middleURL || x.thumbURL, title: title.slice(0, 90), w: x.width || 0, h: x.height || 0, from: 'baidu' });
    if (out.length >= n) break;
    await sleep(100);
  }
  return out;
}

async function avatarOf(bvid) {
  try {
    const r = await fetch('https://api.bilibili.com/x/web-interface/view?bvid=' + bvid, {
      headers: { 'User-Agent': UA, Referer: 'https://www.bilibili.com/' },
    });
    const j = await r.json();
    if (j.code !== 0 || !j.data || !j.data.owner) return null;
    const face = j.data.owner.face.startsWith('http') ? j.data.owner.face : 'https:' + j.data.owner.face;
    const buf = await grab(face, 'https://www.bilibili.com/');
    if (!buf) return null;
    return [{ buf, url: face, title: `B站头像：${j.data.owner.name}`, w: 0, h: 0, from: 'bili-avatar' }];
  } catch { return null; }
}

(async () => {
  const only = process.argv[2] ? new Set(process.argv[2].split(',')) : null;
  const items = [];

  for (const [name, bv] of AVATARS) {
    if (only && !only.has(name)) continue;
    const cands = (await avatarOf(bv)) || [];
    const dir = path.join(OUT_DIR, name);
    fs.mkdirSync(dir, { recursive: true });
    cands.forEach((c, i) => fs.writeFileSync(path.join(dir, i + '.jpg'), c.buf));
    items.push({ name, query: `avatar:${bv}`, cands: cands.map(({ buf, ...r }) => ({ ...r, file: `${name}/${r.url ? '' : ''}${''}` })) });
    console.log('avatar', name, cands.length);
    await sleep(200);
  }

  for (const [name, q] of Object.entries(QUERY)) {
    if (only && !only.has(name)) continue;
    const cands = await baiduCand(q);
    const dir = path.join(OUT_DIR, name);
    fs.mkdirSync(dir, { recursive: true });
    cands.forEach((c, i) => fs.writeFileSync(path.join(dir, i + '.jpg'), c.buf));
    items.push({ name, query: q, cands: cands.map((c) => ({ url: c.url, title: c.title, w: c.w, h: c.h, from: c.from, file: `${name}/${cands.indexOf(c)}.jpg` })) });
    console.log('baidu', name, cands.length);
    await sleep(250);
  }

  fs.writeFileSync(OUT_JSON, JSON.stringify({ generatedAt: new Date().toISOString(), items }, null, 1), 'utf8');
  console.log('done ->', OUT_JSON);
})();
