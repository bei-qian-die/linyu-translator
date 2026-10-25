'use strict';

// 第九轮人物配图：百度图库真实图（禁用 AI 图），失败时退回该人物的 B 站淋语视频封面。
// 只用公开接口：image.baidu.com/search/acjson + api.bilibili.com/x/web-interface/view。
//
// 用法：
//   node scripts/fetch-hero-images9.js --dry-run   只打印候选，不下载
//   node scripts/fetch-hero-images9.js             下载、裁剪到 256x256 PNG
//
// 产出：src/renderer/img/hero-<n>.png + evidence/hero-images9.json（逐张记录来源 URL / 标题）

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const IMG_DIR = path.join(ROOT, 'src', 'renderer', 'img');
const RAW_DIR = path.join(ROOT, 'evidence', 'hero-img-raw9');
fs.mkdirSync(RAW_DIR, { recursive: true });

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const HD = { 'User-Agent': UA, Referer: 'https://image.baidu.com/' };
const DRY = process.argv.includes('--dry-run');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PLAN = [
  // [人物, 百度检索词, 必须命中的名字正则]
  ['阿狸', '英雄联盟 阿狸 官方原画 九尾狐', /阿狸/],
  ['卡莎', '英雄联盟 卡莎 官方原画', /卡莎/],
  ['薇恩', '英雄联盟 薇恩 官方原画', /薇恩|VN/i],
  ['佐伊', '英雄联盟 佐伊 官方原画', /佐伊/],
  ['阿卡丽', '英雄联盟 阿卡丽 官方原画', /阿卡丽/],
  ['金克丝', '英雄联盟 金克丝 官方原画', /金克丝|Jinx/i],
  ['卡尔玛', '英雄联盟 卡尔玛 官方原画', /卡尔玛/],
  ['娜美', '英雄联盟 娜美 官方原画', /娜美/],
  ['貂蝉', '王者荣耀 貂蝉 官方海报 原画', /貂蝉/],
  ['王昭君', '王者荣耀 王昭君 官方海报 原画', /王昭君/],
  ['西施', '王者荣耀 西施 官方海报 原画', /西施/],
  ['上官婉儿', '王者荣耀 上官婉儿 官方海报', /上官婉儿|婉儿/],
  ['米莱狄', '王者荣耀 米莱狄 官方海报', /米莱狄/],
  ['公孙离', '王者荣耀 公孙离 官方海报', /公孙离/],
  ['小乔', '王者荣耀 小乔 官方海报', /小乔/],
  ['可莉', '原神 可莉 官方立绘 角色', /可莉/],
  ['七七', '原神 七七 官方立绘 角色', /七七/],
  ['夜兰', '原神 夜兰 官方立绘 角色', /夜兰/],
  ['优菈', '原神 优菈 官方立绘 角色', /优菈/],
  ['北斗', '原神 北斗 官方立绘 角色', /北斗/],
  ['八重神子', '原神 八重神子 官方立绘 角色', /八重神子|神子/],
  ['纳西妲', '原神 纳西妲 官方立绘 角色', /纳西妲/],
  ['医生', '第五人格 医生 官方立绘', /医生|艾米丽/],
  ['渔女', '第五人格 渔女 官方立绘', /渔女|格蕾丝/],
  ['调香师', '第五人格 调香师 官方立绘', /调香师|薇拉/],
  ['小女孩', '第五人格 小女孩 官方立绘', /小女孩|爱丽丝/],
  ['祭司', '第五人格 祭司 官方立绘', /祭司|菲欧娜/],
  ['蝰蛇', '无畏契约 蝰蛇 角色设计 立绘', /蝰蛇|薇蝮|Viper/i],
  ['暮蝶', '无畏契约 暮蝶 角色设计 立绘', /暮蝶/],
  ['黑梦', '无畏契约 黑梦 角色设计 立绘', /黑梦/],
  ['奇乐', '无畏契约 奇乐 角色设计 立绘', /奇乐/],
  ['春丽', '街头霸王6 春丽 官方 角色设计', /春丽/],
  ['阿鬼', 'A.K.I. 街霸6 角色设计 立绘', /阿鬼|A\.K\.I|Aki/i],
  ['曼侬', '街头霸王6 曼侬 官方 角色设计', /曼侬/],
  ['李允珍', '黎明杀机 李允珍 官方', /李允珍|允珍/],
  ['凤敏', '黎明杀机 凤敏 官方', /凤敏/],
  ['迪莫', '洛克王国 迪莫 官方图', /迪莫/],
  ['魔力猫', '洛克王国 魔力猫 图鉴', /魔力猫/],
  ['阿米娅', '明日方舟 阿米娅 官方立绘', /阿米娅/],
  ['乌尔比安', '明日方舟 乌尔比安 官方立绘', /乌尔比安/],
  ['大天狗', '阴阳师 大天狗 官方立绘', /大天狗/],
  ['知更鸟', '崩坏星穹铁道 知更鸟 官方立绘', /知更鸟/],
];

const BAD = /(\bai\b|ai绘画|ai生成|ai作图|midjourney|stable\s*diffusion|生成图|模型图|cosplay|coser|cos照|同人本|本子|漫画|表情包|五杀|实机|对局|攻略|教学|解说|测评|抽卡|阵容|出装|打法)/i;
const GOOD = /(官方|立绘|原画|海报|角色|皮肤|图鉴|高清|壁纸|全身)/;
const scoreTitle = (t) =>
  (/(官方|原画|立绘|角色设计|角色介绍)/.test(t) ? 6 : 0) +
  (/(高清|壁纸|海报|全身)/.test(t) ? 2 : 0) +
  (/(皮肤|图鉴)/.test(t) ? 1 : 0);

async function baiduImages(word) {
  const u =
    'https://image.baidu.com/search/acjson?tn=resultjson_com&ipn=rj&ct=201326592&is=&fp=result&word=' +
    encodeURIComponent(word) +
    '&pn=0&rn=12&gsm=1e';
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(u, { headers: HD });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      const list = (j.data || []).filter((x) => x && x.thumbURL);
      return list;
    } catch (err) {
      await sleep(1200 * (i + 1));
    }
  }
  return [];
}

async function biliSearchCover(kw, must) {
  const u = `https://api.bilibili.com/x/web-interface/search/type?search_type=video&keyword=${encodeURIComponent(kw)}&page=1`;
  try {
    const r = await fetch(u, { headers: { 'User-Agent': UA, Referer: 'https://www.bilibili.com/' } });
    const j = await r.json();
    const list = (j && j.data && j.data.result) || [];
    for (const v of list) {
      const title = String(v.title || '').replace(/<[^>]+>/g, '');
      if (!v.pic || !must.test(title)) continue;
      return { pic: v.pic, title, bvid: v.bvid, how: 'B 站视频封面' };
    }
  } catch {
    /* fallthrough */
  }
  return null;
}

async function download(url, dest) {
  const full = /^https?:/i.test(url) ? url : 'https:' + url;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(full, { headers: { 'User-Agent': UA, Referer: 'https://image.baidu.com/' } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 5000) throw new Error('too small');
      fs.writeFileSync(dest, buf);
      return buf.length;
    } catch {
      await sleep(1000 * (i + 1));
    }
  }
  return 0;
}

(async () => {
  const onDisk = new Set(fs.readdirSync(IMG_DIR));
  let next = 152;
  for (const f of onDisk) {
    const m = f.match(/^hero-(\d+)\./);
    if (m) next = Math.max(next, Number(m[1]) + 1);
  }

  const report = [];
  const assign = {};
  const PY = process.env.PY || 'py';

  for (const [name, query, must] of PLAN) {
    let picked = null;
    const list = await baiduImages(query);
    const sorted = list
      .map((x) => ({
        title: String(x.fromPageTitleEnc || x.fromPageTitle || '').replace(/\s+/g, ' ').trim(),
        url: x.middleURL || x.thumbURL,
        thumb: x.thumbURL,
        w: Number(x.width || 0),
        h: Number(x.height || 0),
      }))
      .filter((x) => x.url && must.test(x.title) && !BAD.test(x.title))
      .sort((a, b) => scoreTitle(b.title) - scoreTitle(a.title) || b.w * b.h - a.w * a.h);

    if (sorted.length) picked = { ...sorted[0], how: '百度图库' };
    if (!picked) picked = await biliSearchCover(name + ' 淋语', must);
    if (!picked) {
      report.push({ name, status: '待补图', reason: '百度图库与 B 站淋语封面都没有命中' });
      console.error(`[miss] ${name}`);
      await sleep(600);
      continue;
    }

    console.log(`[pick] ${name} ← ${picked.how} ${picked.title.slice(0, 50)} ${picked.url.slice(0, 70)}`);
    if (DRY) {
      report.push({ name, status: 'dry-run', how: picked.how, title: picked.title, url: picked.url });
      await sleep(500);
      continue;
    }

    const file = `hero-${next}.png`;
    const raw = path.join(RAW_DIR, file.replace(/\.png$/, '.raw'));
    const out = path.join(IMG_DIR, file);
    const size = await download(picked.url, raw);
    if (!size) {
      report.push({ name, status: '待补图', reason: '下载失败', url: picked.url });
      console.error(`[dl-fail] ${name}`);
      continue;
    }
    try {
      execFileSync(PY, [path.join(ROOT, 'scripts', 'crop-hero.py'), raw, out], { stdio: 'ignore' });
    } catch (err) {
      report.push({ name, status: '待补图', reason: '裁剪失败：' + err.message, url: picked.url });
      console.error(`[crop-fail] ${name}`);
      continue;
    }
    assign[name] = 'img/' + file;
    report.push({ name, file, how: picked.how, title: picked.title, url: picked.url });
    next += 1;
    console.error(`[ok] ${name} <- ${file}`);
    await sleep(500);
  }

  fs.writeFileSync(
    path.join(ROOT, 'evidence', 'hero-images9.json'),
    JSON.stringify({ fetchedAt: new Date().toISOString(), assign, report }, null, 2),
    'utf8'
  );
  console.error(`\n[done] 成功 ${Object.keys(assign).length} / 计划 ${PLAN.length}，待补图 ${report.filter((r) => r.status === '待补图').length}`);
})();
