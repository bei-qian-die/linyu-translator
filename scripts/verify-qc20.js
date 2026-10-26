'use strict';

// 第二十轮验真：核对 curated-linyu20.js / curated-cards20.json / curated-quotes20.json
// 里的每一条文本，是否真能在 corpus/*.txt 里逐字命中（忽略空白、标点、大小写），口径同 scripts/attest.js。
//
// 与 19 号的区别：
//   1) 数据源换成 20 号的三个文件（20 轮没有 curated-lore 聚合文件）
//   2) 名言除了「文本命中语料」，还要过「漫威指涉」检查——本区名言必须能看出是淋威争锋的句子
//   3) 词卡 example 必须命中语料，且必须与 cap 的分区一致
//
// 用法:
//   node scripts/verify-qc20.js            # 只报告
//   node scripts/verify-qc20.js --strict   # 有未命中即 exit 1
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const STRICT = process.argv.includes('--strict');

const norm = (s) =>
  String(s || '')
    .replace(/[\s，。、！？；：""''（）()【】［］[\]…~～·—\-_/\\|,.:;!?"']/g, '')
    .toLowerCase();
const stripEmoji = (s) => String(s || '').replace(/\[[^\]]{1,24}\]/g, '');

let blob = '';
for (const f of fs.readdirSync(path.join(ROOT, 'corpus')).filter((x) => x.endsWith('.txt') && !/21/.test(x)).sort()) {
  blob += fs.readFileSync(path.join(ROOT, 'corpus', f), 'utf8') + '\n';
}
const NB = norm(blob) + '\u0000' + norm(stripEmoji(blob));

// 既有数据里已经验真过的文本，作为第二命中源
let KNOWN = '';
try {
  const seed = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/core/seed.json'), 'utf8'));
  const L = require(path.join(ROOT, 'src/core/lore.js'));
  const parts = [];
  for (const w of seed.words || []) parts.push(w.zh, w.linyu, w.alias);
  for (const c of L.flashcards || []) parts.push(c.term, c.example, (c.aliases || []).join(''));
  for (const h of L.heroes || []) parts.push(h.name, h.alias, h.intro);
  for (const q of L.quotes || []) parts.push(q.text);
  KNOWN = norm(parts.filter(Boolean).join('\n'));
} catch (e) {
  console.warn('[verify20] 既有数据读取失败（只用语料判定）：' + e.message);
}

const countIn = (hay, s) => {
  const n = norm(s);
  if (!n) return 0;
  let c = 0;
  let i = hay.indexOf(n);
  while (i !== -1) {
    c++;
    i = hay.indexOf(n, i + n.length);
  }
  return c;
};

/** 语料优先；语料没有再看既有数据 */
const count = (s) => countIn(NB, s) || countIn(KNOWN, s);
const fromCorpus = (s) => countIn(NB, s) > 0;

const splitAl = (s) =>
  String(s || '')
    .split(/[、,，/|]/)
    .map((x) => x.trim())
    .filter(Boolean);

// 名言必须看得出是淋威争锋（同 build-quotes20 的口径）
const MR_MARK =
  /漫威|Marvel|marvel|争锋|复仇者|复联|X战警|银河护卫队|灭霸|阿斯加德|仙宫|瓦坎达|九头蛇|克林塔|东京2099|神盾局|捍卫者|决斗家|策略家|连携|时间流纠缠|美队|美国队长|钢铁侠|铁皮人|蜘蛛侠|小蜘蛛|猩红女巫|洛基|冰月花雪|毒液|冬兵|暴风女|万磁王|纳摩|黑寡妇|寡姐|黑豹|鹰眼|海拉|铁拳|月光骑士|灵蝶|松鼠女|星爵|惩罚者|金刚狼|霹雳火|凤凰女|刀锋战士|夜魔侠|黑猫|雷光眼|格尔|亚当术士|斗篷与匕首|隐形女|苏珊|杰夫|鲨鲨|鲨狗|曼蒂斯|火箭浣熊|奥创|牌皇|白狐|百光花火|死侍|格鲁特|树人|浩克|索尔|雷神|石头人|白皇后|安吉拉|小淘气|恶魔恐龙|红兜帽|神奇先生|橡皮人|哈哈男|魔剑客|潘妮|西景镇|地狱火晚宴|淋威|甜甜痞颜|鑫河万点|良心洗脚妹|地才女特务|地才蓝灬频道|鲁迅欺负周树人|Wooden依末|赫斯特特特|Z_Magnus|一小罐啤酒|Haker没有C/;

const report = {
  words: { total: 0, linyuMiss: [], aliasMiss: [], onlyKnown: [] },
  rules: { total: 0, exMiss: [], badTpl: [] },
  cards: { total: 0, exMiss: [], termMiss: [], slotBad: [] },
  quotes: { total: 0, miss: [], notMr: [] },
  heroes: { total: 0, miss: [] },
};

// ---------- 词库 + 句式 ----------
try {
  const RAW = require(path.join(ROOT, 'scripts/curated-linyu20.js'));
  // 与 apply-linyu20 走同一层验真：验的是「真正会落库的内容」，不是原始提案
  const { pruneWords } = require(path.join(ROOT, 'scripts/_attest20.js'));
  const P = pruneWords(RAW.WORDS);
  const WORDS = P.words;
  const RULES = RAW.RULES;
  console.log(`[verify20] 验真过滤：原始 ${RAW.WORDS.length} 条 → 保留 ${WORDS.length}（丢弃 ${P.dropped.length}），摘别名 ${P.trimmed.reduce((a, x) => a + x.lost.length, 0)} 个`);
  report.words.total = WORDS.length;
  for (const w of WORDS) {
    if (!count(w.linyu)) report.words.linyuMiss.push(`${w.zh} → ${w.linyu}`);
    else if (!fromCorpus(w.linyu)) report.words.onlyKnown.push(`${w.zh} → ${w.linyu}`);
    for (const a of splitAl(w.alias)) if (!count(a)) report.words.aliasMiss.push(`${w.zh} : ${a}`);
  }
  report.rules.total = RULES.length;
  for (const r of RULES) {
    try {
      new RegExp(r.pattern);
    } catch {
      report.rules.badTpl.push(`${r.pattern}（正则非法）`);
    }
    if (!r.template) report.rules.badTpl.push(`${r.pattern}（缺 template）`);
    for (const ex of String(r.examples || '').split(/[；;]/).map((x) => x.trim()).filter(Boolean)) {
      if (!count(ex)) report.rules.exMiss.push(`${r.template} :: ${ex}`);
    }
  }
} catch (e) {
  console.error('[verify20] 读取 curated-linyu20.js 失败：' + e.message);
  process.exit(1);
}

// ---------- 词卡 ----------
try {
  const CARDS = require(path.join(ROOT, 'scripts/curated-cards20.json'));
  report.cards.total = CARDS.length;
  for (const c of CARDS) {
    if (c.example && !count(c.example)) report.cards.exMiss.push(`${c.term} :: ${c.example}`);
    if (c.term && !count(c.term)) report.cards.termMiss.push(c.term);
    if (!/淋威争锋/.test(String(c.slot || ''))) report.cards.slotBad.push(`${c.term} → ${c.slot}`);
  }
} catch (e) {
  report.cards = null;
  console.warn('[verify20] 词卡未就绪：' + e.message);
}

// ---------- 名言 ----------
try {
  const QUOTES = require(path.join(ROOT, 'scripts/curated-quotes20.json'));
  report.quotes.total = QUOTES.length;
  for (const q of QUOTES) {
    if (!count(q.text)) report.quotes.miss.push(q.text.slice(0, 40));
    else if (!MR_MARK.test(q.text)) report.quotes.notMr.push(q.text.slice(0, 40));
  }
} catch (e) {
  report.quotes = null;
  console.warn('[verify20] 名言未就绪：' + e.message);
}

// ---------- 人物 ----------
try {
  const { HEROES } = require(path.join(ROOT, 'scripts/curated-heroes20.js'));
  report.heroes.total = HEROES.length;
  for (const h of HEROES) if (!count(h.name)) report.heroes.miss.push(h.name);
} catch (e) {
  report.heroes = null;
  console.warn('[verify20] 人物未就绪：' + e.message);
}

const p = (label, arr) => {
  if (!arr || !arr.length) return;
  console.log(`\n== ${label}（${arr.length}）`);
  for (const x of arr.slice(0, 40)) console.log('   ✗ ' + x);
  if (arr.length > 40) console.log(`   … 另有 ${arr.length - 40} 条`);
};

console.log(`[verify20] 语料 ${(blob.length / 10000).toFixed(1)} 万字｜既有数据命中源 ${(KNOWN.length / 10000).toFixed(1)} 万字`);
console.log(`[verify20] 词库 ${report.words.total} 条：linyu 未命中 ${report.words.linyuMiss.length}，alias 未命中 ${report.words.aliasMiss.length}`);
console.log(`[verify20] 句式 ${report.rules.total} 条：examples 未命中 ${report.rules.exMiss.length}，模板非法 ${report.rules.badTpl.length}`);
if (report.cards) console.log(`[verify20] 词卡 ${report.cards.total} 条：example 未命中 ${report.cards.exMiss.length}，slot 越界 ${report.cards.slotBad.length}`);
if (report.quotes) console.log(`[verify20] 名言 ${report.quotes.total} 条：未命中 ${report.quotes.miss.length}，非本区 ${report.quotes.notMr.length}`);
if (report.heroes) console.log(`[verify20] 人物 ${report.heroes.total} 位：名字未命中 ${report.heroes.miss.length}`);

p('linyu 未命中', report.words.linyuMiss);
p('alias 未命中', report.words.aliasMiss);
p('句式模板非法', report.rules.badTpl);
p('句式 examples 未命中', report.rules.exMiss);
if (report.cards) p('词卡 example 未命中', report.cards.exMiss);
if (report.cards) p('词卡 slot 越界', report.cards.slotBad);
if (report.quotes) p('名言未命中语料', report.quotes.miss);
if (report.quotes) p('名言不含漫威指涉', report.quotes.notMr);
if (report.heroes) p('人物名未命中', report.heroes.miss);

const bad =
  report.words.linyuMiss.length +
  report.words.aliasMiss.length +
  report.rules.exMiss.length +
  report.rules.badTpl.length +
  (report.cards ? report.cards.exMiss.length + report.cards.slotBad.length : 0) +
  (report.quotes ? report.quotes.miss.length : 0);

if (STRICT && bad > 0) {
  console.error(`\n[verify20] --strict：共 ${bad} 处未命中，不允许落库`);
  process.exit(1);
}
console.log(`\n[verify20] 合计未命中 ${bad} 处${STRICT ? '' : '（非 strict，仅报告）'}`);
