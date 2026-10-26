'use strict';

// 第十九轮名言落地：从 evidence/cand19-quotes.json 取分最高的一批，产出
// scripts/curated-quotes19.json（curated-lore19.js 会直接 require 它）。
//
// 取用规则（写死在这里，避免每轮口径漂移）：
//   1) score >= 5 的全部收
//   2) 不够目标条数时，从 score == 4 里补「含瓦罗专属词」的（纯靠 TERM 进来的不要）
//   3) hero 只认精确别名映射，映射不上就不挂人物，绝不猜
//
// 用法：node scripts/build-quotes19.js [目标条数，默认 400]
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TARGET = Number(process.argv[2] || 400);

const VAGUE = /无畏契约|瓦罗兰特|瓦罗淋特|瓦罗|valorant|大沙田契约|淋格/i;
const AGENT =
  /捷风|婕提|夜露|夜戮|芮娜|蕾娜|瑞纳|苪娜|锐纳|猎枭|苏法|黑梦|菲德|贤者|圣祈|奇乐|恺宙|尚勃勒|钱博尔|钱包|瑟符|保安|炼狱|布史东|不死鸟|菲尼克斯|火男|雷兹|炸弹妹|星礈|黑妹|蝰蛇|薇蝮|暮蝶|克洛芙|慕蝶|幽影|海神|铁臂|斯凯|盖可|盖克|钛狐|钛湖|壹决|一决|一绝|幻棱|维斯|钢锁|霓虹|遐思/;

// 别名 → 人物传里的正式 name（必须与 curated-lore19.js 的 HEROES[].name 完全一致）
const ALIAS2HERO = {
  婕提: '捷风',
  夜戮: '夜露',
  蓝色小丑: '夜露',
  蕾娜: '芮娜',
  瑞纳: '芮娜',
  苪娜: '芮娜',
  锐纳: '芮娜',
  苏法: '猎枭',
  菲德: '黑梦',
  圣祈: '贤者',
  奶妈: '贤者',
  恺宙: '奇乐',
  钱博尔: '尚勃勒',
  钱包: '尚勃勒',
  保安: '瑟符',
  布史东: '炼狱',
  菲尼克斯: '不死鸟',
  火男: '不死鸟',
  炸弹妹: '雷兹',
  黑妹: '星礈',
  薇蝮: '蝰蛇',
  克洛芙: '暮蝶',
  慕蝶: '暮蝶',
  盖克: '盖可',
  钛湖: '钛狐',
  一决: '壹决',
  一绝: '壹决',
};

const OFFICIAL = [
  '捷风', '夜露', '芮娜', '猎枭', '黑梦', '贤者', '奇乐', '尚勃勒', '瑟符', '炼狱', '不死鸟',
  '雷兹', '星礈', '蝰蛇', '暮蝶', '幽影', '海神', '铁臂', '斯凯', '盖可', '钛狐', '壹决',
  '幻棱', '维斯', '钢锁', '霓虹', '遐思',
];

const heroOf = (t) => {
  for (const h of OFFICIAL) if (t.includes(h)) return h;
  for (const [alias, hero] of Object.entries(ALIAS2HERO)) if (t.includes(alias)) return hero;
  return '';
};

const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'evidence/cand19-quotes.json'), 'utf8'));
const all = data.items || [];

const hi = all.filter((x) => x.score >= 5);
const lo = all.filter((x) => x.score === 4 && (VAGUE.test(x.text) || AGENT.test(x.text)));

// 标题优先（作者精修过），其次长句（信息量更足），再按分数
const rank = (a, b) =>
  b.score - a.score ||
  (b.kind === '标题' ? 1 : 0) - (a.kind === '标题' ? 1 : 0) ||
  Math.abs(a.text.length - 30) - Math.abs(b.text.length - 30);

const pool = [...hi.sort(rank), ...lo.sort(rank)];
const picked = pool.slice(0, TARGET);

const out = picked.map((c) => {
  const text = c.text.trim();
  const hero = heroOf(text);
  return {
    text,
    author: c.up ? c.up : 'B站瓦罗淋特相关视频评论区',
    hero,
    src: 'https://www.bilibili.com/',
    scene: c.kind === '标题' ? '瓦罗淋特 / 标题' : '瓦罗淋特 / 评论',
    score: c.score,
  };
});

fs.writeFileSync(path.join(ROOT, 'scripts/curated-quotes19.json'), JSON.stringify(out, null, 2) + '\n');

const withHero = out.filter((q) => q.hero);
console.log(`[build-quotes19] 候选池 ${pool.length}（score>=5 的 ${hi.length} + 补 ${Math.max(0, picked.length - hi.length)}）`);
console.log(`[build-quotes19] 落地 ${out.length} 条，其中挂人物 ${withHero.length} 条`);
const byHero = {};
for (const q of withHero) byHero[q.hero] = (byHero[q.hero] || 0) + 1;
console.log('[build-quotes19] 人物分布：' + Object.entries(byHero).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join('  '));
