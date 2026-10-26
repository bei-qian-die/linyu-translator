'use strict';

// 第十八轮人物配图：第五人格角色（监管者 / 求生者 / UP 主）
//
// 图源只用两种（用户许可范围内）：
//   1. 百度图库「第五人格 X」——第五人格角色的立绘/壁纸大多在图库，百科词条因为用本名建词条、
//      且接口对「X 第五人格」这种组合词直接返回空，反而不如 图库 好用
//   2. B 站 UP 主头像（view API 的 owner.face）——没有露脸的 UP 主一律用头像
//
// 产出 evidence/hero-cand18/<name>_<idx>.jpg 与 evidence/hero-cand18.json
// 用法: node scripts/fetch-hero-images18.js [名字,名字,...]
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'evidence', 'hero-cand18');
const OUT_JSON = path.join(ROOT, 'evidence', 'hero-cand18.json');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const HD = { 'User-Agent': UA, Referer: 'https://image.baidu.com/' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 加分：官图 / 立绘 / 壁纸 / 全身 / 图鉴
const GOOD = /立绘|原画|官图|官方|壁纸|全身|图鉴|角色介绍|形象|设定/;
// 扣分：攻略封面 / 同人 / 表情包 / 群像 / 教学 / 交易
const BAD = /攻略|解析|技巧|教学|打法|阵容|排行|推荐|怎么|如何|获取|价格|报价|交易|代练|抽卡|出货|同人|二创|绘画|过程|表情包|群像|合影|拼图|九宫格|壁纸合集|头像|素材|下载|广告/i;

const PLAN = process.argv[2]
  ? process.argv[2].split(',')
  : [
      // —— 监管者 ——
      '红蝶', '杰克', '渔女', '雕刻家', '小丑', '鹿头', '宿伞之魂', '愚人金',
      '时空之影', '喧嚣', '红夫人', '摄影师', '使徒', '隐士', '爱哭鬼', '梦之女巫',
      '蜘蛛', '邦邦', '蜡像师', '守夜人', '破轮', '黄衣之主', '记录员', '疯眼',
      // —— 求生者 ——
      '盲女', '佣兵', '祭司', '调香师', '大副', '机械师', '舞女', '魔术师',
      '冒险家', '勘探员', '调酒师', '杂技演员', '画家', '病患', '心理学家', '玩具商',
      '空军', '咒术师', '前锋', '昆虫学者', '囚徒', '邮差', '入殓师', '园丁',
    ];

function score(it) {
  const t = String(it.fromPageTitleEnc || it.fromPageTitle || '');
  let s = 0;
  if (GOOD.test(t)) s += 40;
  if (BAD.test(t)) s -= 35;
  const w = it.width || 0;
  const h = it.height || 0;
  const short = Math.min(w, h);
  if (short >= 600) s += 25;
  else if (short >= 350) s += 14;
  else if (short >= 220) s -= 5;
  else s -= 30;
  // 竖图多为角色立绘/壁纸，横图多为攻略封面
  if (h >= w) s += 8;
  else if (w >= h * 1.9) s -= 12;
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

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const items = [];
  for (const name of PLAN) {
    let list;
    try {
      list = await search(`第五人格 ${name}`, 24);
    } catch (e) {
      console.error(`[失败] ${name}: ${e.message}`);
      continue;
    }
    if (!list.length) {
      console.error(`[无结果] ${name}`);
      continue;
    }
    const ranked = list
      .map((x, i) => ({ raw: x, i, s: score(x) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, 8);
    let idx = 0;
    for (const { raw, s } of ranked) {
      const file = `${name}_${idx}.jpg`;
      try {
        const r = await fetch(raw.middleURL || raw.thumbURL, { headers: HD });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const buf = Buffer.from(await r.arrayBuffer());
        if (buf.length < 4000) throw new Error('too small');
        fs.writeFileSync(path.join(OUT_DIR, file), buf);
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
      await sleep(110);
    }
    console.error(`[OK] ${name} 候选 ${idx}`);
    await sleep(650);
  }
  fs.writeFileSync(OUT_JSON, JSON.stringify({ generatedAt: new Date().toISOString(), items }, null, 2) + '\n', 'utf8');
  console.log(`候选 ${items.length} 张 / ${new Set(items.map((x) => x.name)).size} 个对象 -> ${OUT_JSON}`);
})();
