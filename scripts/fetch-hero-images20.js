'use strict';

// 第二十轮配图抓取（淋威争锋 / 漫威争锋）。
//
// 来源优先级（优化提示词：百度图库 / 该英雄百度词条相关图 / B站淋语视频封面；UP 用头像）：
//   1) 网易国服官网英雄立绘（marvelrivals.163.com，官方美术资源，逐条对应官网英雄条目）
//   2) 百度图库「漫威争锋 + 英雄名 + 立绘」—— 官网拿不到时兜底，也用于人工复核
//   3) B 站 UP 主头像（owner.face）—— UP 主一律走这条
// 硬性淘汰：带大字标题的封面、攻略截图、强度排行图、二创拼贴、AI 图
//
// 产出 evidence/hero-cand20/ + evidence/hero-cand20.json，供人工 contact sheet 复核后
// 由 scripts/apply-hero-images20.py 裁切落地。
//
// 用法：
//   node scripts/fetch-hero-images20.js            # 全部
//   node scripts/fetch-hero-images20.js 洛基,冰月花雪 # 只抓指定人物
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'evidence/hero-cand20');
const OUT_JSON = path.join(ROOT, 'evidence/hero-cand20.json');
fs.mkdirSync(OUT_DIR, { recursive: true });

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const { HEROES } = require(path.join(ROOT, 'scripts/curated-heroes20.js'));
const OFFICIAL = JSON.parse(fs.readFileSync(path.join(ROOT, 'evidence/official-heroes20.json'), 'utf8')).items;

// 官网名 → 本区人物名（官网用漫威原名，本区用通用译名）
const OFF2MINE = { '艾玛·弗斯特': '白皇后', '陆行鲨 杰夫': '陆行鲨杰夫' };
const OFF_BY_MINE = new Map();
for (const it of OFFICIAL) OFF_BY_MINE.set(OFF2MINE[it.name] || it.name, it);

const IS_UP = (h) => /^UP主/.test(h.rank);

// 百度检索词：官网原名更好使，个别跨译名的单独指定
const BAIDU_QUERY = {
  白皇后: '漫威争锋 白皇后 艾玛弗斯特 立绘',
  陆行鲨杰夫: '漫威争锋 陆行鲨 杰夫 立绘',
  死侍: '漫威争锋 死侍 立绘',
  格鲁特: '漫威争锋 格鲁特 立绘',
};

const GOOD = /立绘|图鉴|官方|原画|角色|形象|全身|海报|壁纸|设定|档案|英雄|皮肤/;
const BAD =
  /攻略|配招|强度|打法|阵容|一览表|排行|推荐|怎么|如何|教学|获取|价格|报价|二创|手绘|同人|表情包|周边|键帽|抖音|抽卡|出货|ai|AI|绘画/;

// ---------- UP 头像 ----------
const UP2BVID = new Map();
for (const f of fs.readdirSync(path.join(ROOT, 'evidence')).filter((x) => /^manifest-.*\.json$/.test(x))) {
  let arr;
  try {
    arr = JSON.parse(fs.readFileSync(path.join(ROOT, 'evidence', f), 'utf8'));
  } catch {
    continue;
  }
  for (const v of Array.isArray(arr) ? arr : []) {
    if (v.up && v.bvid && !UP2BVID.has(v.up)) UP2BVID.set(v.up, v.bvid);
  }
}

async function biliAvatar(name) {
  const bvid = UP2BVID.get(name);
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

// ---------- 官网立绘 ----------
async function officialArt(name) {
  const it = OFF_BY_MINE.get(name);
  if (!it || !it.imgBig) return null;
  try {
    const r = await fetch(it.imgBig, {
      headers: { 'User-Agent': UA, Referer: 'https://marvelrivals.163.com/heroes/index.html' },
    });
    if (!r.ok) return null;
    const ct = r.headers.get('content-type') || '';
    if (!/^image\//.test(ct)) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 3000) return null;
    return { buf, url: it.imgBig, role: it.role, en: it.en };
  } catch {
    return null;
  }
}

// ---------- 百度图库兜底 ----------
async function baiduCand(name) {
  const word = BAIDU_QUERY[name] || `漫威争锋 ${name} 立绘`;
  const url =
    'https://image.baidu.com/search/acjson?tn=resultjson_com&ipn=rj&ct=201326592&is=&fp=result&word=' +
    encodeURIComponent(word) +
    '&pn=0&rn=24&gsm=1e';
  let j;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Referer: 'https://image.baidu.com/' } });
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
    if (x.width && x.width < 300) continue;
    try {
      const r2 = await fetch(x.middleURL || x.thumbURL, {
        headers: { 'User-Agent': UA, Referer: 'https://image.baidu.com/' },
      });
      const buf = Buffer.from(await r2.arrayBuffer());
      if (buf.length < 5000) continue;
      out.push({
        buf,
        url: x.middleURL || x.thumbURL,
        title: title.slice(0, 80),
        w: x.width,
        h: x.height,
        good: GOOD.test(title),
      });
    } catch {
      /* 单张失败跳过 */
    }
    if (out.length >= 5) break;
    await sleep(90);
  }
  out.sort((a, b) => (b.good ? 1 : 0) - (a.good ? 1 : 0));
  return out;
}

const safe = (s) => String(s).replace(/[\\/:*?"<>|·]/g, '_');

(async () => {
  const only = process.argv[2] ? new Set(process.argv[2].split(',')) : null;
  const items = [];
  let n = 0;

  for (const h of HEROES) {
    if (only && !only.has(h.name)) continue;
    n += 1;

    if (IS_UP(h)) {
      const av = await biliAvatar(h.name);
      if (av) {
        const file = `up_${safe(h.name)}.jpg`;
        fs.writeFileSync(path.join(OUT_DIR, file), av.buf);
        items.push({
          name: h.name,
          kind: 'up-avatar',
          file,
          url: av.url,
          w: 0,
          h: 0,
          idx: 0,
          title: `UP:${av.upName}`,
          bvid: av.bvid,
        });
        console.log(`[up] ${h.name} ← ${av.upName} (${(av.buf.length / 1024).toFixed(0)}KB)`);
      } else {
        console.log(`[up] ${h.name} 未取到头像（manifest 无该 UP 的视频）`);
      }
      await sleep(300);
      continue;
    }

    // 先官网，再百度兜底（百度结果也留着，供 contact sheet 复核官网图是否贴题）
    const off = await officialArt(h.name);
    if (off) {
      const file = `${safe(h.name)}_official.png`;
      fs.writeFileSync(path.join(OUT_DIR, file), off.buf);
      items.push({
        name: h.name,
        kind: 'official',
        file,
        url: off.url,
        w: 0,
        h: 0,
        idx: -1,
        title: `网易国服官网英雄立绘｜官方定位：${off.role}｜${off.en}`,
      });
      console.log(`[official] ${h.name} ${(off.buf.length / 1024).toFixed(0)}KB  ${off.role}`);
    } else {
      console.log(`[official] ${h.name} 官网无图`);
    }
    await sleep(220);

    const cands = await baiduCand(h.name);
    let idx = 0;
    for (const c of cands) {
      const file = `${safe(h.name)}_${idx}.jpg`;
      fs.writeFileSync(path.join(OUT_DIR, file), c.buf);
      items.push({ name: h.name, kind: 'baidu', file, url: c.url, w: c.w, h: c.h, title: c.title, idx });
      idx += 1;
    }
    console.log(`[baidu] ${h.name} ${idx} 张`);
    await sleep(500);
  }

  fs.writeFileSync(OUT_JSON, JSON.stringify({ generatedAt: new Date().toISOString(), total: items.length, items }, null, 2));
  console.log(`[done] 人物 ${n} 位，候选图 ${items.length} 张 → evidence/hero-cand20/`);
})();
