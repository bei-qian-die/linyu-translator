'use strict';

// 第十三轮：把 scripts/curated-slots13.js 的语义位合并进 src/core/seed.json。
//
// 只做「填空」，绝不做「覆盖」：
//   - slot / pop / sense 只在目标词该字段为空时才写入；已有值原样保留（包括用户/前几轮填的）。
//   - extraAlias 用「、」并入 alias 集合并去重（与 apply-linyu11/12 的 splitVariants 口径一致）。
//   - 不新增、不删除 word 行；不碰 rules；不碰 rel / source / linyu / zh。
// 幂等：因为只填空，第二次跑时字段已非空 → 改动数必然为 0，输出与第一次一致。
//
// 用法:
//   node scripts/apply-slots13.js --dry-run   # 只报将要改多少
//   node scripts/apply-slots13.js             # 写盘
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SEED_FILE = path.join(ROOT, 'src/core/seed.json');
const { SLOTS } = require(path.join(ROOT, 'scripts/curated-slots13.js'));

const DRY = process.argv.includes('--dry-run');
const POP_LEVELS = new Set(['高', '中', '低']);

const splitVariants = (s) =>
  String(s || '')
    .split(/[、,，]/)
    .map((x) => x.trim())
    .filter(Boolean);

const blank = (v) => !String(v === null || v === undefined ? '' : v).trim();

const seed = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
const idx = new Map();
seed.words.forEach((w, i) => {
  if (!idx.has(w.zh)) idx.set(w.zh, i);
});

let filledSlot = 0;
let filledPop = 0;
let filledSense = 0;
let filledAlias = 0;
let newVariants = 0;
let skippedNotEmpty = 0;
let notFound = 0;
const touchedWords = new Set();

for (const item of SLOTS) {
  const w = seed.words[idx.get(item.zh)];
  if (!w) {
    notFound++;
    console.error(`[跳过] 词库里找不到：${item.zh}`);
    continue;
  }
  if (!POP_LEVELS.has(item.pop)) {
    console.error(`[拒绝] ${item.zh} 的 pop=${item.pop} 不在 高/中/低 之内`);
    process.exitCode = 1;
    continue;
  }
  if (blank(w.slot) && !blank(item.slot)) {
    w.slot = item.slot;
    filledSlot++;
    touchedWords.add(item.zh);
  } else if (!blank(w.slot) && !blank(item.slot) && w.slot !== item.slot) {
    skippedNotEmpty++;
  }
  if (blank(w.pop) && !blank(item.pop)) {
    w.pop = item.pop;
    filledPop++;
    touchedWords.add(item.zh);
  }
  if (blank(w.sense) && !blank(item.sense)) {
    w.sense = item.sense;
    filledSense++;
    touchedWords.add(item.zh);
  }
  const extra = splitVariants(item.extraAlias);
  if (extra.length) {
    const have = splitVariants(w.alias);
    const haveSet = new Set(have);
    const add = extra.filter((v) => !haveSet.has(v) && v !== w.linyu);
    if (add.length) {
      w.alias = [...have, ...add].join('、');
      filledAlias++;
      newVariants += add.length;
      touchedWords.add(item.zh);
    }
  }
}

// ---- 自检：写盘前把结构过一遍 ----
// 注意：只把「本次改动引入的问题」当错误中止；seed 里本来就存在的瑕疵（例如个别词条没有 linyu）
// 只报 warning，否则脚本会因为历史数据而永远跑不动。
const errs = [];
const warns = [];
const before = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
if (seed.words.length !== before.words.length) errs.push('词库行数变了');
if (seed.rules.length !== before.rules.length) errs.push('句式行数变了');
for (const w of before.words) {
  if (!w.zh || !w.linyu) warns.push(`原库即缺 zh/linyu: ${w.zh || '(无zh)'}`);
}
for (const w of seed.words) {
  if (w.pop && !POP_LEVELS.has(w.pop)) errs.push(`pop 非法: ${w.zh}=${w.pop}`);
  const a = splitVariants(w.alias);
  if (new Set(a).size !== a.length) errs.push(`alias 有重复: ${w.zh}`);
}
const slotCnt = {};
for (const w of seed.words) {
  String(w.slot || '')
    .split(/[/／]/)
    .map((x) => x.trim())
    .filter(Boolean)
    .forEach((k) => {
      slotCnt[k] = (slotCnt[k] || 0) + 1;
    });
}
try {
  const { validateSlot } = require(path.join(ROOT, 'scripts/slot-taxonomy13.js'));
  for (const k of Object.keys(slotCnt)) {
    if (validateSlot(k).length) errs.push(`语义位不在 taxonomy 里: ${k}`);
  }
} catch (e) {
  errs.push('taxonomy 校验失败: ' + e.message);
}

const stillNoSlot = seed.words.filter((w) => blank(w.slot)).length;
const stillNoPop = seed.words.filter((w) => blank(w.pop)).length;
const stillNoSense = seed.words.filter((w) => blank(w.sense)).length;

console.error(
  `[填空] slot ${filledSlot} / pop ${filledPop} / sense ${filledSense} / 加 alias 的条目 ${filledAlias}（新增变体 ${newVariants}）` +
    ` | 触及 ${touchedWords.size} 条 | 因已有值而保留 ${skippedNotEmpty} | 找不到 ${notFound}`
);
console.error(
  `[覆盖] 仍缺 slot ${stillNoSlot} / pop ${stillNoPop} / sense ${stillNoSense}（总 ${seed.words.length} 条，rules ${seed.rules.length} 条不动）`
);
console.error(
  `[语义位] 使用中的 key ${Object.keys(slotCnt).length} 个，最大的 5 个：${Object.entries(slotCnt)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map((x) => x[0] + '=' + x[1])
    .join(', ')}`
);

if (warns.length) {
  console.error(
    `[warn] 历史遗留 ${warns.length} 处（不是本轮引入，不影响写盘）：${[...new Set(warns)].slice(0, 6).join(' / ')}`
  );
}
if (errs.length) {
  console.error('[自检失败]');
  errs.slice(0, 20).forEach((e) => console.error('  - ' + e));
  process.exitCode = 1;
} else {
  console.error('[自检] 结构 OK');
}

if (process.exitCode === 1) {
  console.error('[中止] 有本轮引入的非法项，未写盘');
  process.exit(1);
}

if (DRY) {
  console.error('[dry-run] 未写入');
} else {
  fs.writeFileSync(SEED_FILE, JSON.stringify(seed, null, 2) + '\n', 'utf8');
  console.error(`-> ${SEED_FILE}`);
}
