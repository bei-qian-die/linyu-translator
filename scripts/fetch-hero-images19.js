'use strict';

// 第十九轮配图抓取。
//
// 来源优先级（优化提示词第 6 节）：
//   1) 百度图库官方立绘／「全英雄技能一览」类图鉴图
//   2) B 站该 UP 主头像（owner.face）——UP 主一律走这条
// 硬性淘汰：带 UI、字幕条、群像合影、二创拼贴、明显 PS、带文字的攻略截图
//
// 产出 evidence/hero-cand19/ + evidence/hero-cand19.json，供人工 contact sheet 复核后
// 由 scripts/pick-hero-images19.js 裁切落地。
//
// 用法：
//   node scripts/fetch-hero-images19.js            # 全部
//   node scripts/fetch-hero-images19.js 捷风,夜露   # 只抓指定人物
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'evidence/hero-cand19');
const OUT_JSON = path.join(ROOT, 'evidence/hero-cand19.json');
fs.mkdirSync(OUT_DIR, { recursive: true });

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const HD = { 'User-Agent': UA, Referer: 'https://image.baidu.com/' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const { HEROES } = require(path.join(ROOT, 'scripts/curated-heroes19.js'));

// UP 主／选手走头像分支
const IS_UP = (h) => /^UP主/.test(h.rank);

// 召唤兽与跨区角色用更精确的检索词
const QUERY = {
  'K/O': '无畏契约 KAY/O 特工',
  皮蛋: '无畏契约 盖可 皮蛋',
  丢丢: '无畏契约 盖可 丢丢',
  鲨鲨: '无畏契约 盖可 鲨鲨',
  '奇乐的机器人': '无畏契约 奇乐 炮台',
  '黑梦的狗': '无畏契约 黑梦 追猎者',
  猎天使魔女: '猎天使魔女 贝优妮塔',
  遐思: '无畏契约 遐思 新英雄',
};

const GOOD = /技能一览|图鉴|立绘|原画|官方|特工|角色|形象|全身|海报|壁纸|设定|档案|英雄/;
const BAD = /攻略|配招|强度|打法|阵容|一览表|排行|推荐|怎么|如何|教学|获取|价格|报价|炫彩|异色|黑白|抽卡|晒|出货|交易|表情包|键帽|周边|抖音|壁纸怎么|二创|手绘|同人/;

const IMG_MAP = new Map();
for (const f of fs.readdirSync(path.join(ROOT, 'evidence')).filter((x) => /^manifest-2026/.test(x))) {
  try {
    const arr = JSON.parse(fs.readFileSync(path.join(ROOT, 'evidence', f), 'utf8'));
    for (const v of Array.isArray(arr) ? arr : []) if (v.up && v.bvid) IMG_MAP.set(v.up, v.bvid);
  } catch {
    /* 单份坏掉不影响整体 */
  }
}

async function baikeAvatar(name) {
  const bvid = IMG_MAP.get(name);
  if (!bvid) return null;
  try {
    const r = await fetch('https://api.bilibili.com/x/web-interface/view?bvid=' + bvid, {
      headers: { 'User-Agent': UA, Referer: 'https://www.bilibili.com/' },
    });
    const j = await r.json();
    const owner = j.data && j.data.owner;
    if (!owner || !owner.face) return null;
    const face = owner.face.startsWith('http') ? owner.face : 'https:' + owner.face;
    const rr = await fetch(face, { headers: { 'User-Agent': UA, Referer: 'https://www.bilibili.com/' } });
    const buf = Buffer.from(await rr.arrayBuffer());
    if (buf.length < 2000) return null;
    return { buf, url: face, upName: owner.name, bvid };
  } catch {
    return null;
  }
}

async function baiduCand(name) {
  const word = QUERY[name] || '无畏契约 ' + name;
  const url =
    'https://image.baidu.com/search/acjson?tn=resultjson_com&ipn=rj&ct=201326592&is=&fp=result&word=' +
    encodeURIComponent(word) +
    '&pn=0&rn=20&gsm=1e';
  let j;
  try {
    const r = await fetch(url, { headers: HD });
    const t = (await r.text()).replace(/[\u0000-\u001f]/g, ' ');
    j = JSON.parse(t);
  } catch {
    return [];
  }
  const list = (j.data || []).filter((x) => x && (x.middleURL || x.thumbURL));
  const out = [];
  for (const x of list) {
    const title = String(x.fromPageTitleEnc || x.fromPageTitle || '');
    if (BAD.test(title)) continue;
    if (x.width && x.height && x.width < 260) continue;
    try {
      const r2 = await fetch(x.middleURL || x.thumbURL, { headers: HD });
      const buf = Buffer.from(await r2.arrayBuffer());
      if (buf.length < 5000) continue;
      out.push({ buf, url: x.middleURL || x.thumbURL, title: title.slice(0, 80), w: x.width, h: x.height, good: GOOD.test(title) });
    } catch {
      /* 单张失败跳过 */
    }
    if (out.length >= 6) break;
    await sleep(90);
  }
  // 图鉴类优先
  out.sort((a, b) => (b.good ? 1 : 0) - (a.good ? 1 : 0));
  return out;
}

(async () => {
  const only = process.argv[2] ? new Set(process.argv[2].split(',')) : null;
  const items = [];
  let n = 0;

  for (const h of HEROES) {
    if (only && !only.has(h.name)) continue;
    n += 1;

    if (IS_UP(h)) {
      const av = await baikeAvatar(h.name);
      if (av) {
        const file = `up_${h.name}.jpg`.replace(/[\\/:*?"<>|]/g, '_');
        fs.writeFileSync(path.join(OUT_DIR, file), av.buf);
        items.push({ name: h.name, kind: 'up-avatar', file, url: av.url, w: 0, h: 0, title: `UP:${av.upName}`, bvid: av.bvid });
        console.log(`[up] ${h.name} ← ${av.upName} (${(av.buf.length / 1024).toFixed(0)}KB)`);
      } else {
        console.log(`[up] ${h.name} 未取到头像（manifest 无该 UP 的视频）`);
      }
      await sleep(320);
      continue;
    }

    const cands = await baiduCand(h.name);
    let idx = 0;
    for (const c of cands) {
      const file = `${h.name}_${idx}.jpg`.replace(/[\\/:*?"<>|]/g, '_');
      fs.writeFileSync(path.join(OUT_DIR, file), c.buf);
      items.push({ name: h.name, kind: 'baidu', file, url: c.url, w: c.w, h: c.h, title: c.title, idx });
      idx += 1;
    }
    console.log(`[img] ${h.name} ${idx} 张`);
    await sleep(520);
  }

  fs.writeFileSync(OUT_JSON, JSON.stringify({ generatedAt: new Date().toISOString(), total: items.length, items }, null, 2));
  console.log(`[done] 人物 ${n} 位，候选图 ${items.length} 张 → evidence/hero-cand19/`);
})();
