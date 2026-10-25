// 小程序词库 / UGC 内容合规扫描（A3）。
// 运行时只拦截 BLOCK 词表；REVIEW 词表仅用于提审前人工复核，不进入小程序包。
// 用法：node scripts/audit-weapp-content.mjs [--out evidence/xxx.md]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

const { BLOCK, ALLOW_CONTEXT, CATEGORY_LABELS, normalize } = require('../miniprogram/services/sensitive-words');
const lore = require('../src/core/lore');
const seed = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'core', 'seed.json'), 'utf8'));

const REVIEW = {
  vulgar: [
    '傻逼',
    '煞笔',
    '婊子',
    '贱人',
    '骚货',
    '去死',
    '死妈',
    '妓女',
    '肉棒',
    '奶子',
    '操你',
    '妈的',
    '屌',
    '发情',
  ],
  bullying: ['糊穿', '地心', '拉踩', '黑粉', '过气'],
};

const REVIEW_LABELS = {
  vulgar: '低俗 / 辱骂',
  bullying: '饭圈攻击',
};

function buildTerms() {
  const terms = [];
  for (const category of Object.keys(BLOCK)) {
    for (const term of BLOCK[category]) {
      terms.push({ level: 'block', category, label: CATEGORY_LABELS[category], term, key: normalize(term) });
    }
  }
  for (const category of Object.keys(REVIEW)) {
    for (const term of REVIEW[category]) {
      terms.push({ level: 'review', category, label: REVIEW_LABELS[category], term, key: normalize(term) });
    }
  }
  terms.sort((a, b) => b.key.length - a.key.length);
  return terms;
}

function addEntry(entries, collection, id, label, fields) {
  for (const [field, value] of Object.entries(fields)) {
    let text;
    if (Array.isArray(value)) text = value.filter(Boolean).join(' / ');
    else text = value === null || value === undefined ? '' : String(value);
    if (!text.trim()) continue;
    entries.push({ collection, id, label, field, text });
  }
}

function collectEntries() {
  const entries = [];
  seed.words.forEach((w, i) =>
    addEntry(entries, '词条', i + 1, w.zh, {
      zh: w.zh,
      linyu: w.linyu,
      alias: w.alias,
      sense: w.sense,
      pop: w.pop,
      source: w.source,
      slot: w.slot,
    })
  );
  seed.rules.forEach((r, i) =>
    addEntry(entries, '句式', i + 1, r.note || r.pattern, {
      pattern: r.pattern,
      template: r.template,
      note: r.note,
      scene: r.scene,
      examples: r.examples,
      src: r.src,
    })
  );
  lore.flashcards.forEach((c, i) =>
    addEntry(entries, '词卡', i + 1, c.term, {
      term: c.term,
      type: c.type,
      meaning: c.meaning,
      detail: c.detail,
      example: c.example,
      source: c.source,
      hero: c.hero,
      aliases: c.aliases,
    })
  );
  lore.quotes.forEach((q, i) =>
    addEntry(entries, '名言', i + 1, q.text, {
      text: q.text,
      author: q.author,
      hero: q.hero,
      src: q.src,
      scene: q.scene,
    })
  );
  lore.heroes.forEach((h, i) =>
    addEntry(entries, '人物', i + 1, h.name, {
      name: h.name,
      alias: h.alias,
      rank: h.rank,
      intro: h.intro,
      baike: h.baike,
      group: h.group,
      tags: h.tags,
      works: h.works,
    })
  );
  return entries;
}

// 同一段文字同一类别只保留最长命中，避免「儿童色情」与「色情」重复计数
function scanText(text, terms) {
  const value = normalize(text);
  const best = new Map();
  for (const term of terms) {
    if (value.indexOf(term.key) < 0) continue;
    const allowed = ALLOW_CONTEXT[term.term];
    if (allowed) {
      let probe = value;
      for (const phrase of allowed) probe = probe.split(normalize(phrase)).join('');
      if (probe.indexOf(term.key) < 0) continue;
    }
    const prev = best.get(term.category);
    if (!prev || term.key.length > prev.key.length) best.set(term.category, term);
  }
  return Array.from(best.values());
}

function clip(value, max = 80) {
  const s = String(value || '').replace(/\s+/g, ' ').trim();
  return s.length > max ? s.slice(0, max) + '…' : s;
}

function escapeCell(value) {
  const raw = value === null || value === undefined ? '' : value;
  return String(raw).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function parseOut() {
  const index = process.argv.indexOf('--out');
  if (index >= 0 && process.argv[index + 1]) return path.resolve(process.argv[index + 1]);
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return path.join(ROOT, 'evidence', `weapp-content-audit-${stamp}.md`);
}

const terms = buildTerms();
const entries = collectEntries();
const stats = new Map();
const byCollection = new Map();
let blockHits = 0;
let reviewHits = 0;

for (const entry of entries) {
  for (const term of scanText(entry.text, terms)) {
    const key = `${term.level}|${term.category}|${term.term}`;
    let row = stats.get(key);
    if (!row) {
      row = { ...term, count: 0, samples: [] };
      stats.set(key, row);
    }
    row.count += 1;
    if (row.samples.length < 6) {
      row.samples.push({
        collection: entry.collection,
        id: entry.id,
        field: entry.field,
        text: clip(entry.text),
        label: clip(entry.label, 24),
      });
    }
    if (term.level === 'block') blockHits += 1;
    else reviewHits += 1;
    byCollection.set(entry.collection, (byCollection.get(entry.collection) || 0) + 1);
  }
}

const rows = Array.from(stats.values()).sort(
  (a, b) => (a.level === b.level ? b.count - a.count : a.level === 'block' ? -1 : 1)
);

const lines = [];
lines.push('# 淋语翻译器 · 小程序内容合规扫描清单');
lines.push('');
lines.push(`- 生成时间：${new Date().toISOString()}`);
lines.push(`- 数据版本：${pkg.version}`);
lines.push('- 扫描源：`src/core/seed.json` + `src/core/lore*.js`（小程序 `data/` 由同一来源生成）');
lines.push(`- 运行时拦截词表：${Array.from(new Set(terms.filter((t) => t.level === 'block').map((t) => t.category))).length} 类 / ${terms.filter((t) => t.level === 'block').length} 个词`);
lines.push(`- 人工复核词表：${Object.keys(REVIEW).length} 类 / ${terms.filter((t) => t.level === 'review').length} 个词`);
lines.push(`- 扫描条目：${entries.length} 个字段值（词条 ${seed.words.length} / 句式 ${seed.rules.length} / 词卡 ${lore.flashcards.length} / 名言 ${lore.quotes.length} / 人物 ${lore.heroes.length}）`);
lines.push('');
lines.push('## 一、结论');
lines.push('');
lines.push(`- 运行时拦截词表命中：**${blockHits} 处**，涉及 **${rows.filter((r) => r.level === 'block').length} 个词**。`);
lines.push(`- 人工复核词表命中：**${reviewHits} 处**，涉及 **${rows.filter((r) => r.level === 'review').length} 个词**。`);
lines.push('- 命中不代表内容必然违规；运行时词表只用于拦截明确违法 / 高风险表达，人工复核项需结合上下文判断。');
lines.push('- 微信 `msgSecCheck` 是服务端接口，小程序客户端无法直接调用；当前版本采用「本地词表兜底 + 分享/历史双闸门」，不发起网络请求。');
if (byCollection.size) {
  const dist = Array.from(byCollection.entries())
    .map(([name, count]) => `${name} ${count}`)
    .join(' / ');
  lines.push(`- 命中分布：${dist}。`);
}
lines.push('');

function section(title, level) {
  lines.push(`## ${title}`);
  lines.push('');
  const list = rows.filter((r) => r.level === level);
  if (!list.length) {
    lines.push('无命中。');
    lines.push('');
    return;
  }
  lines.push('| 类别 | 命中词 | 次数 | 样例（集合 #id · 字段） |');
  lines.push('| --- | --- | ---: | --- |');
  for (const row of list) {
    const sample = row.samples
      .map((s) => `${s.collection} #${s.id} · ${s.field}：${escapeCell(s.text)}`)
      .join('<br>');
    lines.push(`| ${row.label} | ${row.term} | ${row.count} | ${sample} |`);
  }
  lines.push('');
}

section('二、运行时拦截词表命中（分享 / 历史会被拦下）', 'block');
section('三、人工复核词表命中（仅提示，不拦截）', 'review');

lines.push('## 四、提审动作');
lines.push('');
lines.push('1. 微信公众平台 → 设置 → 服务内容声明 → 用户隐私保护指引：勾选「读取你的剪切板」，提交审核。');
lines.push('2. 确认 `app.json` 的 `__usePrivacyCheck__` 为 `true`，且 `app.js` 已注册 `onNeedPrivacyAuthorization` 兜底说明。');
lines.push('3. 分享与历史写入均先过 `services/sec.js`：本地词表命中即拦截；远端校验不可用时 fail-open，不阻塞主流程。');
lines.push('4. 本清单随版本归档到 `evidence/`，如词库新增内容，重新运行 `npm run audit:weapp-content` 后再提审。');
lines.push('');

const out = parseOut();
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, lines.join('\n'), 'utf8');
console.log(
  `[audit] 扫描 ${entries.length} 个字段值：拦截词命中 ${blockHits} 处 / 复核词命中 ${reviewHits} 处`
);
console.log(`[audit] 清单已写入 ${path.relative(ROOT, out)}`);
