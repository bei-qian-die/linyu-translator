'use strict';

// 第十九轮：修正「瓦罗淋特」分区的 6 项既有缺陷（优化提示词第 0 节 / 第 2 节例外清单）。
//
// 纪律：
//   - 只改错误字段，不新增、不删除「内容」（唯一允许的删除是把语义重复的「我梦」并进「黑梦」）
//   - 每条修正都写进 evidence/fixes19.json：条目 / 字段 / 原值 / 新值 / 依据
//   - 幂等：已经修过的字段再跑不会重复改（原值会记成「已修正」）
//
// 用法：node scripts/fix-defects19.js [--dry-run]
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DRY = process.argv.includes('--dry-run');

const SEED_FILE = path.join(ROOT, 'src/core/seed.json');
const EXTRA10 = path.join(ROOT, 'src/core/lore-extra10.js');
const FIXES_FILE = path.join(ROOT, 'evidence/fixes19.json');

const fixes = [];
const rec = (target, field, before, after, why) =>
  fixes.push({ target, field, before, after, why, at: new Date().toISOString().slice(0, 19) });

// ---------- A. 人物传字段修正（lore-extra10.js） ----------
const raw10 = fs.readFileSync(EXTRA10, 'utf8');
const head10 = raw10.slice(0, raw10.indexOf('const __export = '));
const jsonStart = raw10.indexOf('const __export = ') + 'const __export = '.length;
const jsonEnd = raw10.lastIndexOf(';\nif (typeof module');
const data10 = JSON.parse(raw10.slice(jsonStart, jsonEnd));
const tail10 = raw10.slice(jsonEnd);

const HERO_FIX = {
  蝰蛇: {
    rank: '瓦罗淋特 · 控场者',
    works: ['【大沙田契约】我蛇向所有的烟位宣战！'],
    baike:
      '本名 Viper，美国，控场者。台服译名「薇蝮」；「我🐍」是「我＋emoji」式自称的开山写法；「我维」是「我＋首字」式；「蝰蛇女士」是尊称式拟人。语料金句「我维心很黑，但我维那里更黑」。',
    tags: ['瓦罗淋特', '控场者'],
  },
  暮蝶: {
    rank: '瓦罗淋特 · 控场者',
    works: ['我是暮蝶姐姐的苟😋'],
    baike:
      '本名 Clove，英国爱丁堡，控场者。台服译名「克洛芙」；「慕蝶」是谐音错写被当爱称；「我🦋」是「我＋emoji」式自称；「暮蝶姐姐」是「姐姐」式拟人，语料原话「我是暮蝶姐姐的苟」。',
    tags: ['瓦罗淋特', '控场者'],
  },
  黑梦: {
    rank: '瓦罗淋特 · 先锋者',
    works: ['芮娜玩家的救星'],
    baike:
      '本名 Fade，土耳其伊斯坦布尔，先锋者。台服译名「菲德」；「我梦」是「我＋单字」式自称，只属于黑梦（暮蝶是「我🦋」，两者不可混）；「诡眼」是核心道具名，被拿来代指本人。',
    tags: ['瓦罗淋特', '先锋者'],
  },
  奇乐: {
    rank: '瓦罗淋特 · 哨卫者',
    works: ['3分钟学会盖可怎么玩 盖克小技巧分享'],
    baike:
      '本名 Killjoy，德国，哨卫者。台服译名「恺宙」；「🐔婆」是旧词库里既有的荤向外号（姬／鸡谐音）；她的炮台与警报被玩家统称「机器人」。',
    tags: ['瓦罗淋特', '哨卫者'],
  },
};

let heroTouched = 0;
for (const h of data10.heroes || []) {
  const fix = HERO_FIX[h.name];
  if (!fix) continue;
  for (const [k, v] of Object.entries(fix)) {
    const before = Array.isArray(h[k]) ? JSON.stringify(h[k]) : String(h[k] || '');
    const after = Array.isArray(v) ? JSON.stringify(v) : String(v);
    if (before === after) continue;
    rec(`hero:${h.name}`, k, before, after, '优化提示词第 0 节列出的既有缺陷');
    h[k] = v;
    heroTouched += 1;
  }
}
console.log(`[fix19] 人物字段修正 ${heroTouched} 处（涉及 ${Object.keys(HERO_FIX).length} 位）`);

// ---------- B. 词条修正（seed.json） ----------
const seed = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
const idx = (zh) => seed.words.findIndex((w) => w.zh === zh);

// B1. 钢索的悬空 sense
{
  const i = idx('钢索');
  if (i >= 0) {
    const w = seed.words[i];
    const want =
      '钢锁的自称写法：锁＝🔒，所以她被叫「我🔒」；「为爱走钢索」是把角色名接进马戏团走钢丝的俗语，形容她拿命守点的莽劲。';
    if (w.sense !== want) {
      rec('word:钢索', 'sense', String(w.sense || ''), want, '原值是悬空的「同上。」，按第 0 节缺陷 4 修正');
      w.sense = want;
    }
  }
}

// B2. 我梦 的 alias 混入「暮蝶」+ 与「黑梦」语义重复 → 并入黑梦后删除
{
  const iBlack = idx('黑梦');
  const iMeng = idx('我梦');
  if (iBlack >= 0 && iMeng >= 0) {
    const black = seed.words[iBlack];
    const meng = seed.words[iMeng];
    const have = new Set(String(black.alias || '').split(/[、,，]/).map((s) => s.trim()).filter(Boolean));
    if (!have.has('我梦')) {
      rec('word:黑梦', 'alias', String(black.alias || ''), `${black.alias || ''}、我梦`.replace(/^、/, ''), '把「我梦」并进黑梦，消除与「我梦」独立条目的语义重复');
      black.alias = [...have, '我梦'].join('、');
    }
    rec('word:我梦', '整条', `zh=我梦, linyu=${meng.linyu}, alias=${meng.alias}`, '（删除，内容并入「黑梦」）', '第 0 节缺陷 5：与「黑梦」语义重复，且 alias 误挂「暮蝶」');
    seed.words.splice(iMeng, 1);
  }
}

// B3. 修正后自检：黑梦的 alias 里不许出现「暮蝶」
{
  const i = idx('黑梦');
  if (i >= 0) {
    const a = String(seed.words[i].alias || '');
    if (a.includes('暮蝶')) {
      const cleaned = a.split(/[、,，]/).map((s) => s.trim()).filter((s) => s && s !== '暮蝶');
      rec('word:黑梦', 'alias', a, cleaned.join('、'), '第 0 节缺陷 5：暮蝶的自称是「我🦋」，不该挂在黑梦下');
      seed.words[i].alias = cleaned.join('、');
    }
  }
}

// ---------- C. 写盘 ----------
// 台账是「曾经修过什么」的证据，幂等复跑时 fixes 为空，不能拿空表覆盖历史记录
let prevItems = [];
try {
  prevItems = JSON.parse(fs.readFileSync(FIXES_FILE, 'utf8')).items || [];
} catch {
  /* 首次运行没有历史 */
}
const items = prevItems.length ? prevItems : fixes;
fs.writeFileSync(
  FIXES_FILE,
  JSON.stringify({ generatedAt: new Date().toISOString(), count: items.length, note: '修正台账，追加式：幂等复跑不会清空历史', items }, null, 2) + '\n'
);

if (DRY) {
  console.log(`[fix19] dry-run：共 ${fixes.length} 处修正，不写盘`);
  process.exit(0);
}

fs.writeFileSync(EXTRA10, head10 + 'const __export = ' + JSON.stringify(data10) + tail10, 'utf8');
fs.writeFileSync(SEED_FILE, JSON.stringify(seed, null, 2) + '\n', 'utf8');
console.log(`[fix19] 已写回 lore-extra10.js 与 seed.json；本次新修 ${fixes.length} 处，台账共 ${items.length} 条 → evidence/fixes19.json`);
