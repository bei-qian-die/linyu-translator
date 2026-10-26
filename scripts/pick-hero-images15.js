'use strict';
// 第十五轮人物配图候选批量下载（洛克淋国 ·《洛克王国》精灵）。
// 复用 scripts/pick-hero-images13.js 的思路：百度图库 acjson 取图 + 严格标题过滤，
// 每个精灵先抓前 N 张「缩略图」落盘到 evidence/hero-cand15/，再拼联络表供逐张核对。
// 收录时直接裁这张已落盘、已核对过的缩略图，保证「看到的就是收录的」。
//
// 硬性排除（宁缺毋滥）：AI 图、cos、手办、壁纸、实机演示、对局/攻略/教学/解说/抽卡、
// 同人二创、表情包、漫画手绘、直播/赛事等与「精灵本体真实官方图」无关的结果。
//
// 用法:
//   node scripts/pick-hero-images15.js            全量抓候选
//   node scripts/pick-hero-images15.js --only 迪莫 只跑某只
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CAND_DIR = path.join(ROOT, 'evidence', 'hero-cand15');
const MANIFEST = path.join(ROOT, 'evidence', 'hero-cand15.json');
fs.mkdirSync(CAND_DIR, { recursive: true });

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const HD = { 'User-Agent': UA, Referer: 'https://image.baidu.com/' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 统一排除词（标题命中任一即否决候选）
const BAD =
  /ai|绘画|生成|midjourney|stable|扩散模型|插画师约稿|cos|cosplay|手办|模型测评|周边|壁纸|wallpaper|引擎|实机|演示视频|对局|实战|解说|攻略|教学|教程|抽卡|卡池|五杀|集锦|高光|直播|比赛|赛事|职业选手|同人|二创|表情包|梗图|搞笑图|漫画|手绘|速涂|拟人|性转|娘化|联动海报|皮肤海报|背景图|头像框|同人图|混剪|录屏|开黑/;

// [收录名, 检索词, 标题必须命中的关键词(含其一)]
// 检索词一律带「洛克王国」以压低同名通用词（火花/水灵/焰火/喵喵）的串味。
const mk = (name, extra) => [name, `洛克王国 ${name} 精灵 宠物 官方${extra ? ' ' + extra : ''}`, [name]];
const PLAN = [
  // —— 网页版经典御三家 / 人气精灵 ——
  mk('喵喵'), mk('火花'), mk('水蓝蓝'), mk('喵呜'), mk('魔力猫'),
  mk('焰火'), mk('火神'), mk('波波拉'), mk('水灵'), mk('护主犬'),
  mk('音速犬'), mk('罗隐'), mk('瞌睡王'), mk('鸭吉吉'), mk('圣光迪莫', '光系'),
  mk('圣水守护'), mk('烈火战神'), mk('伊兰龙'), mk('小独角兽'), mk('白金独角兽'),
  mk('恶魔狼'), mk('恶魔狼王'), mk('千棘盔'), mk('黄蜂后'), mk('花魁蜂后'),
  mk('奇丽花'), mk('雪影娃娃'), mk('奇梦咪'), mk('波普鹿'), mk('霜翼领主'),
  mk('仪式巨像'), mk('彩蝶鲨'), mk('板板壳'), mk('咔咔壳'), mk('水泡壳'),
  // —— 手游《洛克王国：世界》精灵 ——
  mk('阿布'), mk('机甲小子'), mk('上岸蛙'), mk('可立鸡'), mk('春兔'),
  mk('小鼠獭'), mk('幽狐'), mk('电光狐'),
  // —— 洛克淋国视频里点名出现的精灵 ——
  mk('珀尔', '光队'),
  // —— 第十五轮语料新核实精灵（洛克淋国对局高频）——
  mk('冥古龙'), mk('花衣蝶'), mk('锤头鹳'), mk('夜枭'), mk('布灵布灵', '布灵'),
  mk('波多西'), mk('饮雪狂兽'), mk('吉洛斯'), mk('卷毛鸭'), mk('梦想三三'),
  mk('咔咔鸟'), mk('云梦豚'), mk('小幽幽', '幽幽'), mk('奇梦咪'), mk('罗隐'),
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
      const j = await r.text();
      let data;
      try {
        data = JSON.parse(j).data || [];
      } catch {
        throw new Error('非 JSON（疑似反爬）');
      }
      return data.filter((x) => x && x.thumbURL);
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
      if (buf.length < 2500) throw new Error('too small');
      fs.writeFileSync(dest, buf);
      return buf.length;
    } catch {
      await sleep(800);
    }
  }
  return 0;
}

(async () => {
  const onlyIdx = process.argv.indexOf('--only');
  const only = onlyIdx >= 0 ? process.argv[onlyIdx + 1] : null;
  const N = 10;
  const manifest = [];

  for (const [name, query, must] of PLAN) {
    if (only && name !== only) continue;
    console.log('\n=== ' + name + ' (' + query + ') ===');
    const list = await baiduImages(query);
    const mustRe = new RegExp(must.join('|'));
    const hits = list
      .map((x) => ({
        title: String(x.fromPageTitleEnc || x.fromPageTitle || '').replace(/\s+/g, ' ').trim(),
        url: x.middleURL || x.thumbURL,
        thumb: x.thumbURL,
        w: Number(x.replaceHost === 'pic.zol.com.cn' ? 0 : x.width || 0),
        h: Number(x.height || 0),
      }))
      .filter((x) => x.thumb && mustRe.test(x.title) && !BAD.test(x.title));

    console.log('  通过过滤 ' + hits.length + ' / 共 ' + list.length);
    const got = [];
    for (let i = 0; i < Math.min(N, hits.length); i++) {
      const h = hits[i];
      const file = path.join(CAND_DIR, `${name}__${i}.jpg`);
      const size = await download(h.thumb, file);
      if (size) {
        got.push({ name, idx: i, title: h.title, url: h.url, thumb: h.thumb, w: h.w, h: h.h, file: path.basename(file), size });
        console.log(`  [${i}] ${h.w}x${h.h} ${h.title.slice(0, 55)}`);
      }
      await sleep(220);
    }
    manifest.push(...got);
    await sleep(650);
  }

  fs.writeFileSync(MANIFEST, JSON.stringify({ fetchedAt: new Date().toISOString(), items: manifest }, null, 2), 'utf8');
  console.log('\n[done] 候选 ' + manifest.length + ' 张 -> ' + MANIFEST);
})();
