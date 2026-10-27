'use strict';

// 第二十四轮名言生成：不手写，全部从本轮采集产物里提。
//
// 三个来源（按可信度排序）：
//   1) 「撅战！淋安京」合集 30 集视频标题 —— 作者＝真实 UP 主，链接＝真实 BV
//   2) 相关视频标题（决战！大沙田 系列、出装系列等）
//   3) 弹幕 / 评论里逐字命中的成句（带 淋安京 特征或淋语特征）
//
// 产出 scripts/curated-quotes24.json，字段：{ text, author, hero, src, scene, score }
// 用法: node scripts/build-quotes24.js
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// 式神名 → 人物页关联（名字必须与 curated-heroes24.js 的 name 完全一致）
const HERO_HINT = [
  ['紧那罗', '紧那罗'], ['我紧', '紧那罗'], ['阿织', '阿织'], ['我织', '阿织'],
  ['彼岸花', '彼岸花'], ['我花', '彼岸花'], ['红叶', '鬼女红叶'], ['我红', '鬼女红叶'],
  ['铃彦姬', '铃彦姬'], ['我铃', '铃彦姬'], ['妖狐', '妖狐'], ['我狐', '妖狐'],
  ['化鲸', '化鲸'], ['我鲸', '化鲸'], ['鬼使白', '鬼使白'], ['鬼白', '鬼使白'], ['我白', '鬼使白'],
  ['千姬', '千姬'], ['我千', '千姬'], ['兰兰', '兰兰'], ['我兰', '兰兰'],
  ['天照', '天照'], ['我照', '天照'], ['不知火', '不知火'], ['我离', '不知火'],
  ['桔梗', '桔梗'], ['我桔', '桔梗'], ['青行灯', '青行灯（淋安京）'], ['我灯', '青行灯（淋安京）'],
  ['雪女', '雪女'], ['我雪', '雪女'], ['神乐', '神乐'], ['我神', '神乐'],
  ['鸩', '鸩'], ['铁鼠', '铁鼠'], ['我鼠', '铁鼠'], ['九命猫', '九命猫'], ['我猫', '九命猫'],
  ['妖刀姬', '妖刀姬'], ['我刀', '妖刀姬'], ['茨木', '茨木童子'], ['酒吞', '酒吞童子'], ['我酒', '酒吞童子'],
  ['鬼切', '鬼切'], ['我切', '鬼切'], ['须佐', '须佐之男'], ['闻人翊悬', '闻人翊悬'],
  ['炭治郎', '灶门炭治郎'], ['二口女', '二口女'], ['首无', '首无'], ['以津真天', '以津真天'],
  ['西凉', '西凉'], ['阎魔', '阎魔'], ['白狼', '白狼'], ['管狐', '管狐'],
  ['小松丸', '小松丸'], ['御馔津', '御馔津'], ['百目鬼', '百目鬼'], ['鬼童丸', '鬼童丸'],
  ['青蛙瓷器', '青蛙瓷器'], ['樱花妖', '樱花妖'], ['山兔', '山兔'], ['萤草', '萤草'],
  ['拉克丝', '拉克丝'], ['迪希雅', '迪希雅'], ['铁T', '铁T成长'],
];

const guessHero = (t) => {
  for (const [k, v] of HERO_HINT) if (String(t).includes(k)) return v;
  return '';
};

const SCORE_TITLE = 12;
// 相关视频标题排到弹幕评论之后：每条标题都独占一个 BV URL（SST ~42B），
// 400 条上限下优先保留共享 src 的弹幕评论，能把 _sst 再省 ~8KB
const SCORE_REL = 3;
const SCORE_DM = 5;
const SCORE_CM = 4;

const out = [];
const seen = new Set();
const push = (q) => {
  const k = String(q.text || '').replace(/\s+/g, '');
  if (!k || k.length < 6 || seen.has(k)) return;
  seen.add(k);
  out.push(q);
};

// ---------- 1. 合集与相关视频标题 ----------
const BVJSON = path.join(ROOT, 'evidence', 'paj-bvids.json');
const MANIFEST = path.join(ROOT, 'evidence', 'manifest-bili24-20261027155112.json');
const vids = [];
if (fs.existsSync(BVJSON)) {
  for (const v of JSON.parse(fs.readFileSync(BVJSON, 'utf8'))) {
    vids.push({ title: v.title, up: v.up, bvid: v.bvid, group: v.group || '' });
  }
}
if (fs.existsSync(MANIFEST)) {
  for (const v of JSON.parse(fs.readFileSync(MANIFEST, 'utf8'))) {
    vids.push({ title: v.title, up: v.up, bvid: v.bvid, group: '检索' });
  }
}
const dmManifest = path.join(ROOT, 'evidence', 'manifest-dm24-20261027162451.json');
if (fs.existsSync(dmManifest)) {
  for (const v of JSON.parse(fs.readFileSync(dmManifest, 'utf8'))) {
    vids.push({ title: v.title, up: v.up, bvid: v.bvid, group: v.group || '深挖' });
  }
}

const isCore = (g) => String(g).includes('撅战！淋安京合集');
for (const v of vids) {
  const t = String(v.title || '').trim();
  if (!t) continue;
  const core = isCore(v.group);
  push({
    text: t,
    author: v.up || '',
    hero: guessHero(t),
    src: `https://www.bilibili.com/video/${v.bvid}`,
    scene: core ? '淋安京 / 撅战！淋安京合集标题' : '淋安京 / 相关视频标题',
    score: core ? SCORE_TITLE : SCORE_REL,
  });
}

// ---------- 2. 弹幕 / 评论成句 ----------
// 只取本轮（24 号）语料，且必须带淋语特征或平安京特征，避免把别区的句子搬过来。
const FEATURE = /淋|撅战|大沙田|平安京|安京|扒鸡|站街|本可|姐妹|地才|靴靴|浦西|素|惹|秒了|吸入|铁T|MVP|红温|下饭|混分|单排|卖辅|AD|资质赛|后宫|京嫔|解解|妈咪|赔|式神|出装|野怪|防御塔|兵线|阴阳|灵咒|段位|魂火|桔梗|千姬|青行灯|红叶|兰兰|神乐|天照/;
// 例句池只取「深挖弹幕」语料（corpus-dm24-*）：那 60 个视频就是本轮圈定的淋安京清单。
// corpus-bili24-* 是关键词检索产物，里面混着淋者荣耀 / 淋神 / 阴雄淋盟 的弹幕，
// 直接拿来当名言会造成跨区串味，故只用它取标题，不取正文。
const CORPUS = path.join(ROOT, 'corpus');
const rawLines = [];
for (const f of fs.readdirSync(CORPUS).filter((x) => /^corpus-dm24-.*\.txt$/.test(x))) {
  for (const line of fs.readFileSync(path.join(CORPUS, f), 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    rawLines.push(t.replace(/^【(评论|弹幕|视频|UP|简介|标签|正文|网页|合集)】\s*/, '').trim());
  }
}

const UP_OF = new Map();
for (const v of vids) if (v.up) UP_OF.set(String(v.title).trim(), v.up);

for (const line of rawLines) {
  if (line.length < 8 || line.length > 52) continue;
  if (!FEATURE.test(line)) continue;
  if (/^https?:/.test(line)) continue;
  // 去掉纯标签串（如「巫类式神:大天狗、鬼女红叶…」这类名单行）
  if (line.includes('、') && line.split('、').length > 4) continue;
  // 提到别区游戏名（淋神/淋者荣耀/阴雄淋盟/星淋铁道…）却不带任何平安京上下文的，判为串味
  if (/淋神|淋者荣耀|阴雄淋盟|王者淋耀|星淋铁道|瓦罗淋特|淋威争锋|绝区淋|第五淋格|洛克淋国|淋日方舟|街头霸淋|淋明杀鸡/.test(line)
      && !/平安京|安京|撅战|大沙田|式神|扒鸡/.test(line)) continue;
  push({
    text: line,
    author: UP_OF.get(line) || 'B站《决战！平安京》相关视频弹幕 / 评论',
    hero: guessHero(line),
    src: 'https://search.bilibili.com/all?keyword=%E6%92%85%E6%88%98%E6%B7%8B%E5%AE%89%E4%BA%AC',
    scene: '淋安京 / 弹幕评论',
    score: UP_OF.has(line) ? SCORE_TITLE : SCORE_CM,
  });
}

out.sort((a, b) => b.score - a.score);
// 名言条数上限：小程序主包 2MB 硬上限，582 条会把 _sst 顶过线。
// 400 条（本轮目标值）已经覆盖：合集 30 题名全量 + 相关视频标题 + 高分弹幕评论。
const QUOTE_CAP = Number(process.argv[2] || 372);
const capped = out.slice(0, QUOTE_CAP);
const OUT = path.join(ROOT, 'scripts', 'curated-quotes24.json');
fs.writeFileSync(OUT, JSON.stringify(capped, null, 2) + '\n', 'utf8');
console.error(`[quotes24] 候选 ${out.length} 条，截取 ${capped.length} 条 → ${path.relative(ROOT, OUT)}`);
