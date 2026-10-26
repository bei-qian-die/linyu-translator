'use strict';

// 第十七轮质检：把 scripts/drop-words17.js 里的条目从 src/core/seed.json 剔除，
// 并清理其他词条 rel 里指向这些已删条目的悬空引用。
//
// 幂等：已删过的条目会被跳过（记为 already-absent），可反复运行。
// 用法: node scripts/qc-prune17.js [--dry-run]
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SEED_FILE = path.join(ROOT, 'src/core/seed.json');
const REPORT = path.join(ROOT, 'evidence/qc17-drop-report.md');
const { DROP } = require(path.join(ROOT, 'scripts/drop-words17.js'));

const DRY = process.argv.includes('--dry-run');

const seed = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
const before = seed.words.length;
const dropSet = new Set(DROP.map((d) => d.zh));

// 展示用元数据从策展源取：条目被删掉后 seed 里已经没有了，但源文件仍保留着历史记录，
// 这样本脚本重跑多少次，报告里的 linyu / slot / pop 都不会变成空。
let curatedIndex = new Map();
for (const f of ['curated-linyu15.js', 'curated-linyu16.js']) {
  try {
    const { WORDS } = require(path.join(ROOT, 'scripts/' + f));
    for (const w of WORDS) if (!curatedIndex.has(w.zh)) curatedIndex.set(w.zh, w);
  } catch {
    /* 源文件缺失时降级为占位符 */
  }
}

// pop 不是写在策展源里的，是 freq 脚本算出来的，从 evidence/slot-freq16.json 补。
let popMap = new Map();
try {
  const freq = JSON.parse(fs.readFileSync(path.join(ROOT, 'evidence/slot-freq16.json'), 'utf8'));
  popMap = new Map(freq.items.filter((x) => x.zh).map((x) => [x.zh, x.pop]));
} catch {
  /* 缺文件时降级 */
}
const removed = [];
const absent = [];
for (const d of DROP) {
  const i = seed.words.findIndex((w) => w.zh === d.zh);
  const src = curatedIndex.get(d.zh) || {};
  const meta = {
    ...d,
    linyu: src.linyu || '—',
    slot: src.slot || '—',
    pop: popMap.get(d.zh) || src.pop || '—',
  };
  if (i < 0) {
    absent.push(meta);
    continue;
  }
  removed.push(meta);
  seed.words.splice(i, 1);
}

// 清理悬空 rel：删掉的词条仍被别人 rel 引用时，引用也要摘掉，否则前端点进去是空页。
const dangling = [];
for (const w of seed.words) {
  if (!Array.isArray(w.rel) || !w.rel.length) continue;
  const kept = w.rel.filter((r) => !dropSet.has(r));
  if (kept.length !== w.rel.length) {
    dangling.push({ zh: w.zh, dropped: w.rel.length - kept.length });
    w.rel = kept;
  }
}

// 顺带体检：lore 侧（词卡/名言）有没有把已删词条当作 rel 引用。
// 注意：rel 的解析目标既可以是词库条目，也可以是词卡或人物，所以先把这三类都收进合法目标集，
// 只有「three 类都没有」才算真空引用（否则 占星台↔圣龙宝藏 这类互为词卡的对会被误报）。
let loreDangling = [];
try {
  const lore = require(path.join(ROOT, 'src/core/lore.js'));
  const valid = new Set([
    ...seed.words.map((w) => w.zh),
    ...lore.flashcards.map((c) => c.term),
    ...lore.heroes.map((h) => h.name),
  ]);
  const check = (label, arr) => {
    for (const x of arr) {
      if (!Array.isArray(x.rel)) continue;
      const hit = x.rel.filter((r) => dropSet.has(r) && !valid.has(r));
      if (hit.length) loreDangling.push(`${label}:${x.term || x.text || x.name} → ${hit.join('/')}`);
    }
  };
  check('词卡', lore.flashcards);
  check('名言', lore.quotes);
} catch (e) {
  loreDangling.push('（lore 读取失败：' + e.message + '）');
}

const after = seed.words.length;
console.error(`[QC] 词库 ${before} → ${after}（删除 ${removed.length} 条，${absent.length} 条已不存在）`);
console.error(`[QC] 清理悬空 rel：${dangling.length} 条词条被清理`);
if (loreDangling.length) console.error(`[QC] lore 侧仍有引用：${loreDangling.length} 处`);

const allMeta = DROP.map((d) => {
  const src = curatedIndex.get(d.zh) || {};
  const gone = !seed.words.some((w) => w.zh === d.zh);
  return { zh: d.zh, reason: d.reason, linyu: src.linyu || '—', slot: src.slot || '—', pop: popMap.get(d.zh) || src.pop || '—', gone };
});

const md = [
  '# 第十七轮质检 · 洛克淋国词库剔除记录',
  '',
  `- 生成时间：${new Date().toISOString()}`,
  `- 词库条目：本脚本运行时 ${before} 条；累计剔除 ${dropSet.size} 条（剔除后 ${after} 条）`,
  `- 本次运行删除：${removed.length} 条（其余为此前已删，幂等跳过）`,
  `- 清理悬空 rel：${dangling.length} 条词条`,
  '',
  '## 保留口径',
  '',
  '谐音空耳 / 拟人化·宫斗腔·饭圈腔 / 自称与人称体系 / 通讯录审美与圈层黑话 / 带调侃的角色外号 / 生动比喻型黑话，满足其一即保留。',
  '',
  '## 剔除口径',
  '',
  '`linyu` 与原词同形，或只是给官方机制、地图、赛季换个说法，释义里没有任何调侃语气的纯玩法词条。',
  '',
  '## 剔除明细',
  '',
  '| # | 词条 | linyu | 语义位 | pop | 剔除理由 |',
  '| --- | --- | --- | --- | --- | --- |',
  ...allMeta.map((d, i) => `| ${i + 1} | ${d.zh} | ${d.linyu} | ${d.slot} | ${d.pop} | ${d.reason} |`),
  '',
  '## 被清理悬空 rel 的词条',
  '',
  dangling.length
    ? ['| 词条 | 摘掉的引用数 |', '| --- | --- |', ...dangling.map((d) => `| ${d.zh} | ${d.dropped} |`)].join('\n')
    : '无。',
  '',
  '## lore 侧残留引用',
  '',
  loreDangling.length ? loreDangling.map((x) => '- ' + x).join('\n') : '无。',
  '',
  '> 被剔除的只是词库条目。对应的人物传（heroes）与词卡不动，',
  '> 因此「进化」「精灵球」这类词从翻译词库里消失，但精灵本人的介绍仍在人物传里。',
  '',
].join('\n');

if (DRY) {
  console.error('[QC] dry-run，不写盘；报告预览如下\n' + md.slice(0, 800));
  process.exit(0);
}

fs.writeFileSync(SEED_FILE, JSON.stringify(seed, null, 2) + '\n', 'utf8');
fs.writeFileSync(REPORT, md, 'utf8');
console.error('[QC] 已写回 ' + SEED_FILE);
console.error('[QC] 报告 ' + REPORT);
