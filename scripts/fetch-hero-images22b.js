'use strict';
// 第二十二轮 · 第二批抓取：检索词升级为「第五人格 <名> <官方全名> 图鉴」。
// 产出 evidence/qc22-cand2/<名>/N.jpg + evidence/qc22-cand2.json
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'evidence', 'qc22-cand2');
const OUT_JSON = path.join(ROOT, 'evidence', 'qc22-cand2.json');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// [词库名, 检索词]
const PLAN = [
  ['医生', '第五人格 医生 艾米丽·黛儿 图鉴'],
  ['律师', '第五人格 律师 弗雷迪·莱利 图鉴'],
  ['园丁', '第五人格 园丁 艾玛·伍兹 图鉴'],
  ['空军', '第五人格 空军 玛尔塔·贝坦菲尔 图鉴'],
  ['佣兵', '第五人格 佣兵 奈布·萨贝达 图鉴'],
  ['机械师', '第五人格 机械师 特蕾西·列兹尼克 图鉴'],
  ['盲女', '第五人格 盲女 海伦娜·亚当斯 图鉴'],
  ['舞女', '第五人格 舞女 玛格丽莎 图鉴'],
  ['调香师', '第五人格 调香师 薇拉 图鉴'],
  ['魔术师', '第五人格 魔术师 勒罗伊 图鉴'],
  ['冒险家', '第五人格 冒险家 库特·弗兰克 图鉴'],
  ['勘探员', '第五人格 勘探员 诺顿·坎贝尔 图鉴'],
  ['调酒师', '第五人格 调酒师 黛米·波本 图鉴'],
  ['杂技演员', '第五人格 杂技演员 麦克·莫顿 图鉴'],
  ['画家', '第五人格 画家 艾格·瓦尔登 图鉴'],
  ['病患', '第五人格 病患 埃米尔 图鉴'],
  ['心理学家', '第五人格 心理学家 艾达·梅斯默 图鉴'],
  ['玩具商', '第五人格 玩具商 图鉴'],
  ['咒术师', '第五人格 咒术师 帕缇夏 图鉴'],
  ['前锋', '第五人格 前锋 威廉·艾利斯 图鉴'],
  ['昆虫学者', '第五人格 昆虫学者 图鉴'],
  ['囚徒', '第五人格 囚徒 卢卡·巴尔萨 图鉴'],
  ['邮差', '第五人格 邮差 维克多·格兰兹 图鉴'],
  ['入殓师', '第五人格 入殓师 伊索·卡尔 图鉴'],
  ['小提琴家', '第五人格 小提琴家 安东尼奥 图鉴'],
  ['牛仔', '第五人格 牛仔 凯文·阿尤索 图鉴'],
  ['野人', '第五人格 野人 穆罗 图鉴'],
  ['幸运儿', '第五人格 幸运儿 图鉴'],
  ['古董商', '第五人格 古董商 图鉴'],
  ['守墓人', '第五人格 守墓人 安德鲁·克雷斯 图鉴'],
  ['击球手', '第五人格 击球手 图鉴'],
  ['守夜人', '第五人格 守夜人 伊塔库亚 图鉴'],
  ['蜡像师', '第五人格 蜡像师 菲利普 图鉴'],
  ['记录员', '第五人格 记录员 图鉴'],
  ['疯眼', '第五人格 疯眼 伯克 图鉴'],
  ['隐士', '第五人格 隐士 阿尔瓦 图鉴'],
  ['使徒', '第五人格 使徒 安 图鉴'],
  ['梦之女巫', '第五人格 梦之女巫 伊德海拉 图鉴'],
  ['蜘蛛', '第五人格 蜘蛛 维奥莱塔 图鉴'],
  ['爱哭鬼', '第五人格 爱哭鬼 罗比·怀特 图鉴'],
  ['黄衣之主', '第五人格 黄衣之主 哈斯塔 图鉴'],
  ['摄影师', '第五人格 摄影师 约瑟夫 图鉴'],
  ['红夫人', '第五人格 红夫人 玛丽 图鉴'],
  ['愚人金', '第五人格 愚人金 诺顿 图鉴'],
  ['时空之影', '第五人格 时空之影 图鉴'],
  ['喧嚣', '第五人格 喧嚣 监管者 图鉴'],
  ['破轮', '第五人格 破轮 图鉴'],
  ['邦邦', '第五人格 邦邦 图鉴'],
  ['大副', '第五人格 大副 何塞·巴登 图鉴'],
];

// 淋化创作角色：直接用对应 B 站视频封面
const BILI_COVER = [
  ['凤蝶', 'BV1D9bx6AELi'],
];

const BAD = /无畏契约|瓦罗兰特|守望|王者荣耀|原神|明日方舟|三国|表情包|梗图|排行榜|强度榜|手绘|同人|绘画|教程|攻略|cos|真人|头像框/i;

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

async function baiduCand(word, n = 8) {
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

async function biliCover(bvid) {
  try {
    const r = await fetch('https://api.bilibili.com/x/web-interface/view?bvid=' + bvid, {
      headers: { 'User-Agent': UA, Referer: 'https://www.bilibili.com/' },
    });
    const j = await r.json();
    if (j.code !== 0 || !j.data || !j.data.pic) return [];
    const pic = j.data.pic.startsWith('http') ? j.data.pic : 'https:' + j.data.pic;
    const buf = await grab(pic, 'https://www.bilibili.com/');
    if (!buf) return [];
    return [{ buf, url: pic, title: `B站封面：${j.data.title}`, w: 0, h: 0, from: 'bili-cover' }];
  } catch { return []; }
}

(async () => {
  const only = process.argv[2] ? new Set(process.argv[2].split(',')) : null;
  const items = [];
  for (const [name, q] of PLAN) {
    if (only && !only.has(name)) continue;
    const cands = await baiduCand(q);
    const dir = path.join(OUT_DIR, name);
    fs.mkdirSync(dir, { recursive: true });
    cands.forEach((c, i) => fs.writeFileSync(path.join(dir, i + '.jpg'), c.buf));
    items.push({ name, query: q, cands: cands.map((c) => ({ url: c.url, title: c.title, w: c.w, h: c.h, from: c.from })) });
    console.log(name, cands.length);
    await sleep(250);
  }
  for (const [name, bv] of BILI_COVER) {
    if (only && !only.has(name)) continue;
    const cands = await biliCover(bv);
    const dir = path.join(OUT_DIR, name);
    fs.mkdirSync(dir, { recursive: true });
    cands.forEach((c, i) => fs.writeFileSync(path.join(dir, i + '.jpg'), c.buf));
    items.push({ name, query: 'bili:' + bv, cands: cands.map((c) => ({ url: c.url, title: c.title, from: c.from })) });
    console.log(name, cands.length);
  }
  fs.writeFileSync(OUT_JSON, JSON.stringify({ generatedAt: new Date().toISOString(), items }, null, 1), 'utf8');
  console.log('done ->', OUT_JSON);
})();
