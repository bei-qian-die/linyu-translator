'use strict';

// 第十六轮人物配图候选抓取（洛克淋国）。
// 只从百度图库（官方立绘 / 图鉴 / 百科配图 / 官方素材）取图，禁止 AI 生成图。
// 产出：
//   evidence/hero-cand16/<name>_<idx>.jpg   候选原图
//   evidence/hero-cand16.json               {items:[{name,idx,title,w,h,url,file,score}]}
//
// 用法: node scripts/fetch-hero-cand16.js [名字,名字,...]
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'evidence', 'hero-cand16');
const OUT_JSON = path.join(ROOT, 'evidence', 'hero-cand16.json');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const HD = { 'User-Agent': UA, Referer: 'https://image.baidu.com/' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 加分：官方立绘 / 图鉴 / 百科 / 精灵档案
const GOOD = /立绘|原画|图鉴|百科|官方|宠物档案|精灵|角色|形象|全身|进化|海报|壁纸|设定/;
// 减分：截图 / 攻略 / 数值表 / 群像 / 水印重灾
const BAD = /攻略|技能|配招|强度|打法|阵容|一览|表|排行|推荐|怎么|如何|教学|获取|价格|报价|炫彩|异色|黑白|抽卡|晒|出货|交易|代练|脚本|模拟器|多开|广告|群|二维码|聊天|商城|礼包|预约|下载|安卓|ios/i;

const PLAN = (process.argv[2] ? process.argv[2].split(',') : [
  // —— 洛克王国 精灵 ——
  '喵喵', '火花', '罗隐', '瞌睡王', '鸭吉吉', '水球球', '奇丽花', '草依虫',
  '鬼雾', '利灯鱼', '炫目鸡', '刺蜗贝', '独眼巨魔', '河马小天使', '喷火鸟',
  '陈铁兽', '龙希帕尔', '圣羽翼王', '幽颖树', '幽铃', '多灵主', '巴哈姆特',
  '凡鹰', '钨丝贝贝', '大耳帽兜', '卡瓦重', '阿布', '卷毛鸭', '云梦豚', '吉洛斯',
  '咔咔鸟', '梦想三三',
  // —— NPC ——
  '可丽希亚', '斯嘉丽', '阿洛', '加尔', '朔夜伊芙',
  // —— 精灵（谐音系 / 新区热门） ——
  '绒仙子', '失心蜂', '恶魔叮', '障眼魔', '夜游魔', '上岸蛙', '吸泥鸥',
  // —— 洛克淋国 UP 主 ——
  '鬼妈妈', '茶博士蔚星', '安宁',
]);

function score(it) {
  const t = String(it.fromPageTitleEnc || it.fromPageTitle || '');
  let s = 0;
  if (GOOD.test(t)) s += 60;
  if (BAD.test(t)) s -= 40;
  const area = (it.width || 0) * (it.height || 0);
  if (area >= 300 * 300 && area <= 2200 * 2200) s += 10;
  if ((it.width || 0) >= (it.height || 0) * 1.7) s -= 12; // 过宽多为横幅
  return s;
}

async function search(word) {
  const u =
    'https://image.baidu.com/search/acjson?tn=resultjson_com&ipn=rj&ct=201326592&is=&fp=result&word=' +
    encodeURIComponent(word) +
    '&pn=0&rn=24&gsm=1e';
  const r = await fetch(u, { headers: HD });
  const j = await r.json();
  return (j.data || []).filter((x) => x && (x.middleURL || x.thumbURL));
}

async function download(url, file) {
  const r = await fetch(url, { headers: HD });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 3000) throw new Error('too small');
  fs.writeFileSync(file, buf);
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const items = [];
  for (const name of PLAN) {
    const noun = name.includes('妈妈') || name.includes('博士') || name === '安宁' ? name : `洛克王国 ${name}`;
    let list;
    try {
      list = await search(noun);
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
      .slice(0, 6);
    let idx = 0;
    for (const { raw, s } of ranked) {
      const file = `${name}_${idx}.jpg`;
      try {
        await download(raw.middleURL || raw.thumbURL, path.join(OUT_DIR, file));
      } catch (e) {
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
    await sleep(600);
  }
  fs.writeFileSync(OUT_JSON, JSON.stringify({ generatedAt: new Date().toISOString(), items }, null, 2) + '\n', 'utf8');
  console.log(`候选 ${items.length} 张 / ${new Set(items.map((x) => x.name)).size} 个对象 -> ${OUT_JSON}`);
})();
