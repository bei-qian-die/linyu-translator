'use strict';
// 第十三轮人物配图候选批量下载（游戏角色 / 淋宇宙人物）。
// 复用 scripts/pick-hero-images11.js 的思路：百度图库 acjson 取图 + 严格标题过滤，
// 每个角色先抓前 N 张「缩略图」落盘到 evidence/hero-cand13/，再拼联络表供人工逐张核对。
// 收录时直接裁这张已落盘、已核对过的缩略图，保证「看到的就是收录的」。
//
// 硬性排除（宁缺毋滥）：AI 图、cos、手办、壁纸引擎、实机演示、对局/攻略/教学/解说/抽卡/五杀、
// 同人二创、表情包、漫画手绘、直播/赛事等与「角色本体真实立绘/官方图」无关的结果。
//
// 用法:
//   node scripts/pick-hero-images13.js            全量抓候选
//   node scripts/pick-hero-images13.js --only 安妮 只跑某人
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CAND_DIR = path.join(ROOT, 'evidence', 'hero-cand13');
const MANIFEST = path.join(ROOT, 'evidence', 'hero-cand13.json');
fs.mkdirSync(CAND_DIR, { recursive: true });

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const HD = { 'User-Agent': UA, Referer: 'https://image.baidu.com/' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 统一排除词（标题命中任一即否决候选）
const BAD =
  /ai|绘画|生成|midjourney|stable|扩散模型|插画师约稿|cos|cosplay|手办|模型测评|周边|壁纸|wallpaper|引擎|实机|演示视频|对局|实战|解说|攻略|教学|教程|抽卡|卡池|五杀|集锦|高光|直播|比赛|赛事|职业选手|同人|二创|表情包|梗图|搞笑图|漫画|手绘|速涂|拟人|性转|娘化|联动海报|皮肤海报|背景图|头像框|同人图|混剪|录屏|开黑/;

// [人物(收录名), 检索词, 必须命中的关键词(标题含其一)]
const PLAN = [
  // —— 阴雄淋盟（英雄联盟）——
  ['安妮', '英雄联盟 安妮 黑暗之女 原画 官方', ['安妮']],
  ['瑟庄妮', '英雄联盟 瑟庄妮 北地之怒 原画 官方', ['瑟庄妮', '北地之怒']],
  ['卡特琳娜', '英雄联盟 卡特琳娜 不祥之刃 原画 官方', ['卡特琳娜', '不祥之刃']],
  ['丽桑卓', '英雄联盟 丽桑卓 冰霜女皇 原画 官方', ['丽桑卓', '冰霜']],
  ['婕拉', '英雄联盟 婕拉 荆棘之兴 原画 官方', ['婕拉', '荆棘']],
  ['克烈', '英雄联盟 克烈 暴怒骑士 原画 官方', ['克烈', '暴怒']],
  ['阿木木', '英雄联盟 阿木木 殇之木乃伊 原画 官方', ['阿木木', '木乃伊']],
  ['芮尔', '英雄联盟 芮尔 铁铠冥魂 原画 官方', ['芮尔', '铁铠']],
  ['奈德丽', '英雄联盟 奈德丽 狂野女猎手 原画 官方', ['奈德丽', '狂野女']],
  ['厄运小姐', '英雄联盟 厄运小姐 赏金猎人 原画 官方', ['厄运小姐', '赏金猎人']],
  ['乐芙娜', '英雄联盟 乐芙娜 诡术妖姬 原画 官方', ['乐芙娜', '诡术妖姬']],
  // —— 淋神（原神）——
  ['凝光', '原神 凝光 立绘 官方 天权', ['凝光', '天权']],
  ['坎蒂丝', '原神 坎蒂丝 立绘 官方', ['坎蒂丝']],
  ['梦见月瑞希', '原神 梦见月瑞希 立绘 官方', ['梦见月', '瑞希']],
  // —— 星淋铁道（崩坏：星穹铁道）——
  ['翡翠', '崩坏星穹铁道 翡翠 立绘 官方', ['翡翠']],
  ['灵砂', '崩坏星穹铁道 灵砂 立绘 官方', ['灵砂']],
  ['黑塔', '崩坏星穹铁道 黑塔 立绘 官方', ['黑塔']],
  // —— 淋者荣耀 / 王者淋耀（王者荣耀）——
  ['女娲', '王者荣耀 女娲 英雄 立绘 官方', ['女娲']],
  ['安琪拉', '王者荣耀 安琪拉 英雄 立绘 官方', ['安琪拉']],
  ['芈月', '王者荣耀 芈月 英雄 立绘 官方', ['芈月']],
  ['镜', '王者荣耀 镜 英雄 立绘 官方 破镜之刃', ['镜']],
  ['海诺', '王者荣耀 海诺 英雄 立绘 官方', ['海诺']],
  // —— 淋日方舟（明日方舟）——
  ['重岳', '明日方舟 重岳 干员 立绘 官方', ['重岳']],
  ['玛恩纳', '明日方舟 玛恩纳 干员 立绘 官方', ['玛恩纳']],
  ['龙舌兰', '明日方舟 龙舌兰 干员 立绘 官方', ['龙舌兰']],
  ['能天使', '明日方舟 能天使 干员 立绘 官方', ['能天使', 'Exusiai']],
  // —— 第五淋格（第五人格）——
  ['红蝶', '第五人格 红蝶 监管者 立绘 官方', ['红蝶']],
  ['杰克', '第五人格 杰克 开膛手 监管者 立绘 官方', ['杰克']],
  // —— 阴淋师（阴阳师）——
  ['孔雀明王', '阴阳师 孔雀明王 式神 立绘 官方', ['孔雀明王', '孔雀']],
  // —— 淋明杀鸡（黎明杀机）——
  ['三角头', '黎明杀机 三角头 杀手 官方 形象', ['三角头', '金字塔头']],
  ['德古拉', '黎明杀机 德古拉 吸血鬼 杀手 官方 形象', ['德古拉', '吸血鬼']],
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
