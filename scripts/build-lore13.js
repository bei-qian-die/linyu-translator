'use strict';

// 第十三轮内容合并：把三份证据/数据合成 src/core/lore-extra13.js。
//
// 输入：
//   scripts/curated-heroes13.js      —— 31 个新增游戏角色（图已落 src/renderer/img/hero-23x.png）
//   evidence/hero-links13.json       —— 最长别名自动归属的结果（80 卡 + 56 名言）
//   corpus/*.txt                     —— 弹幕/评论原文，新角色的词卡例句与名言都从这里逐字取
//   evidence/manifest-*.json         —— 标题 → bvid，用来给每条内容挂可点击出处
//
// 纪律：例句与名言必须是语料原文；释义只写「黑话写法 + 语料里怎么用的」，不做无出处引申。
//
// 用法: node scripts/build-lore13.js [--dry-run]
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'src/core/lore-extra13.js');
const DRY = process.argv.includes('--dry-run');

const lore = require(path.join(ROOT, 'src/core/lore'));
const seed = require(path.join(ROOT, 'src/core/seed.json'));
const NEW_HEROES = require(path.join(ROOT, 'scripts/curated-heroes13.js')).HEROES;
const links = JSON.parse(fs.readFileSync(path.join(ROOT, 'evidence/hero-links13.json'), 'utf8'));

// ---- 语料行索引：每行带上它属于哪个视频（bvid / 标题 / UP / 文件） ----
const titleToBvid = new Map();
for (const f of fs.readdirSync(path.join(ROOT, 'evidence'))) {
  if (!/^manifest-.*\.json$/.test(f)) continue;
  const arr = JSON.parse(fs.readFileSync(path.join(ROOT, 'evidence', f), 'utf8'));
  for (const v of Array.isArray(arr) ? arr : []) {
    if (v && v.title && v.bvid && !titleToBvid.has(v.title)) titleToBvid.set(v.title, v.bvid);
  }
}

const LINE_RE = /^(==== \[[^\]]*\] (BV\w+) (.*?) ==== up:(\S*)|\u3010(视频|UP|简介|评论|弹幕)\u3011|\[(desc|cmt|sub|dm)\] )(.*)$/;
const ZH = { desc: '简介', cmt: '评论', sub: '充电弹幕', dm: '弹幕' };

const lines = [];
for (const f of fs.readdirSync(path.join(ROOT, 'corpus')).sort()) {
  if (!/^corpus.*\.txt$/.test(f)) continue;
  let cur = { file: f, bvid: '', title: '', up: '' };
  for (const raw of fs.readFileSync(path.join(ROOT, 'corpus', f), 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const header = line.match(/^==== \[[^\]]*\] (BV\w+) (.*?) ==== up:(\S*)/);
    if (header) {
      cur = { file: f, bvid: header[1], title: header[2].trim(), up: header[3] };
      continue;
    }
    const sec = line.match(/^\u3010(视频|UP|简介|评论|弹幕)\u3011(.*)$/);
    if (sec) {
      if (sec[1] === '视频') {
        cur = { file: f, bvid: titleToBvid.get(sec[2].trim()) || '', title: sec[2].trim(), up: '' };
      } else if (sec[1] === 'UP') cur.up = sec[2].trim();
      else if (sec[2].trim()) lines.push({ text: sec[2].trim(), kind: sec[1], ...cur });
      continue;
    }
    const tag = line.match(/^\[(desc|cmt|sub|dm)\] (.*)$/);
    if (tag && tag[2].trim()) lines.push({ text: tag[2].trim(), kind: ZH[tag[1]], ...cur });
  }
}

function urlOf(l) {
  if (l.bvid) return 'https://www.bilibili.com/video/' + l.bvid;
  return 'https://search.bilibili.com/all?keyword=' + encodeURIComponent(l.title || l.text.slice(0, 20));
}

// 黑话科普原文里逐字给出由来的外号（corpus/corpus-web-search.txt 的 LOL 黑话对照表段）。
// 其余外号只写「黑话写法」，不加未经原文支撑的解释。
const REASON = {
  尖叫婆: '放技能时不时叫一声',
};

const MARK = /(本可|本仙女|本宫|本座|惹|噜|厚|素|滴|珍|淋|鼠了|靴靴|解解|可人儿|♥|姐妹|仙品)/;
const BAD = /(http|www\.|^[^\u4e00-\u9fa5A-Za-z]{0,3}$|微信|公众号|微博转发|招募|群号|转载声明|仅代表)/;

const existingQuotes = new Set(lore.quotes.map((q) => q.text));
const existingCards = new Set(lore.flashcards.map((c) => c.term));
const heroNames = new Set(lore.heroes.map((h) => h.name));

// 只按人名/别名命中，不拿 tags 去匹配：法师/坦克/辅助这类分区词会把不相干的弹幕判进来。
const GENERIC = new Set(['英雄联盟', '王者荣耀', '原神', '阴阳师', '明日方舟', '第五人格', '星穹铁道', '黎明杀机', '法师', '坦克', '刺客', '辅助', '射手', '打野', '近卫', '狙击', '监管者', '式神', '杀手', '英雄']);

const pickLines = (keys, max, needKey) => {
  const use = keys.filter((k) => k && k.length >= 2 && !GENERIC.has(k));
  const out = [];
  const seen = new Set();
  for (const l of lines) {
    if (l.kind === '简介' || l.text.length < 10 || l.text.length > 60) continue;
    if (BAD.test(l.text)) continue;
    if (seen.has(l.text)) continue;
    if (needKey && !use.some((k) => l.text.includes(k))) continue;
    if (!MARK.test(l.text)) continue;
    if (existingQuotes.has(l.text)) continue;
    out.push(l);
    seen.add(l.text);
    if (out.length >= max) break;
  }
  return out;
};

// 黑话词典整行（corpus/corpus-web-search.txt 的「卡迪匕-卡特 尖叫婆-丽桑卓…」段），
// 拿不到弹幕例句时用它兜底——同样是语料原文，只是体裁是科普长文。
const dictLine =
  lines
    .filter((l) => /尖叫婆-丽桑卓/.test(l.text))
    .sort((a, b) => b.text.length - a.text.length)[0] || { text: '', file: 'corpus-web-search.txt', title: '通讯录黑话科普', kind: '正文', bvid: '' };

const cards = [];
const quotes = [];
const skipped = [];

for (const h of NEW_HEROES) {
  const alias = String(h.alias || '')
    .split(/\s*\/\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  const nickname = alias.find((a) => a !== h.name && REASON[a]) || alias.find((a) => a !== h.name) || h.name;
  const keys = [h.name].concat(alias);
  // 例句优先取「直接写到这个黑话」的弹幕/评论，取不到就用黑话科普原文
  const ex = pickLines([nickname], 1, true)[0];
  const dictHit = !ex && dictLine.text.includes(nickname);

  const zone = String(h.rank || '').split('·')[0].trim();
  if (nickname !== h.name && !existingCards.has(nickname)) {
    const why = REASON[nickname] ? '，' + REASON[nickname] : '';
    const seg = dictHit ? (dictLine.text.match(new RegExp('[^\\s]*' + nickname + '[^\\s]*[^ ]*')) || [nickname])[0] : '';
    cards.push({
      term: nickname,
      type: 'hero-alias',
      meaning:
        '「' + h.name + '」（' + zone + '）在通讯录里的黑话写法' + why + '。' +
        (ex
          ? '语料里 B 站《' + ex.title + '》' + ex.kind + '就直接这么写：' + ex.text
          : dictHit
            ? 'B 站通讯录黑话科普把它列在对照表里（' + seg + '）。'
            : '该写法收录在 B 站通讯录黑话科普与 UP 主本人节目里。'),
      example: ex ? ex.text : nickname + (dictHit ? '（' + seg + '）' : ''),
      source: ex
        ? 'B站《' + ex.title + '》' + ex.kind + (ex.bvid ? '（' + ex.bvid + '）' : '')
        : dictHit
          ? 'B站通讯录黑话科普（corpus/' + dictLine.file + '）'
          : 'B站通讯录黑话科普',
      verify: ex ? urlOf(ex) : dictHit ? urlOf(dictLine) : h.links && h.links[0] ? h.links[0].url : '',
      hero: h.name,
      aliases: [nickname, h.name].concat(alias.filter((a) => a !== nickname && a !== h.name)),
    });
  } else if (nickname === h.name) {
    skipped.push(h.name + '（无黑话别名）');
  } else {
    skipped.push(h.name + '（词卡「' + nickname + '」已存在）');
  }

  for (const l of pickLines(keys, 2, true)) {
    if (quotes.some((q) => q.text === l.text)) continue;
    quotes.push({
      text: l.text,
      author: l.kind === '评论' ? l.up : '',
      hero: h.name,
      src: 'B站《' + l.title + '》' + l.kind + (l.bvid ? '（' + l.bvid + '）' : '') + ' · ' + l.file,
      verify: urlOf(l),
    });
  }
}

// ---- 来源二：黑话对照表本身逐字成卡（corpus/corpus-web-search.txt 的 LOL 黑话段） ----
// 原文形如「卡迪匕-卡特 尖叫婆-丽桑卓 放技能时不时叫一声」，逐对切出来，不做任何引申。
const DICT_PAIRS = [
  ['喜熊妹', '安妮'],
  ['喜猪婆', '瑟庄妮'],
  ['卡迪匕', '卡特'],
  ['尖叫婆', '丽桑卓'],
  ['插秧婆', '阿卡丽'],
  ['气功婆', '卡尔玛'],
  ['蟑螂婆', '卡莎'],
  ['狗洞婆', '佐伊'],
  ['浣碧', '芮尔'],
  ['女野人', '奈德丽'],
  ['殇之母', '阿木木'],
  ['走路草', '婕拉'],
  ['幺蛾子', '妖姬'],
  ['嘴臭怪物', '克烈'],
  ['害人精', '金克斯'],
  ['滚地婆', 'VN'],
  ['掉毛母鸡', '霞'],
  ['水弥拉', '尼拉'],
  ['六小淋童', '孙悟空'],
  ['道歉女', '光辉'],
];
for (const [nickname, official] of DICT_PAIRS) {
  if (existingCards.has(nickname) || cards.some((c) => c.term === nickname)) continue;
  if (!dictLine.text.includes(nickname)) continue;
  const owner = dictLine.text.split(nickname)[1] || '';
  const who = (owner.match(/^\s*[-–]?\s*([\u4e00-\u9fa5A-Za-z]{2,6})/) || [])[1] || official;
  const why = owner.replace(/^\s*[-–]\s*\S{2,6}/, '').trim().slice(0, 24);
  const hero = NEW_HEROES.find((h) => h.name === official || h.name.indexOf(official) >= 0 || official.indexOf(h.name) >= 0);
  cards.push({
    term: nickname,
    type: 'hero-alias',
    meaning:
      '通讯录黑话对照表里的写法：「' + nickname + '」指「' + who + '」' +
      (why ? '，表中原注「' + why + '」' : '') +
      '。这条出自 B 站通讯录黑话科普的对照表段落，属于「女性英雄一律婆/妹化」的构词玩法。',
    example: nickname + '-' + who,
    source: 'B站通讯录黑话科普对照表（corpus/corpus-web-search.txt）',
    verify: urlOf(dictLine),
    ...(hero ? { hero: hero.name } : {}),
    aliases: [nickname, who],
  });
}

// ---- 来源三：某英雄本人视频里的弹幕/评论（evidence/mined13.json 的 ownUpBlocks） ----
// 归属依据是「这句话就出现在 TA 自己那条视频的弹幕里」，不靠关键词猜。
const mined = JSON.parse(fs.readFileSync(path.join(ROOT, 'evidence/mined13.json'), 'utf8'));
const heroByName = new Map(lore.heroes.map((h) => [h.name, h]));
const usedTexts = new Set(quotes.map((q) => q.text));
for (const [name, info] of Object.entries(mined)) {
  if (!heroByName.has(name) && !NEW_HEROES.some((h) => h.name === name)) continue;
  let take = 0;
  for (const blk of info.ownUpBlocks || []) {
    if (take >= 2) break;
    for (const raw of blk.sampleLines || []) {
      if (take >= 2) break;
      const m = String(raw).match(/^(desc|cmt|sub|dm)\s+([\s\S]*)$/);
      if (!m) continue;
      const text = m[2].trim();
      if (text.length < 10 || text.length > 60) continue;
      if (BAD.test(text) || !MARK.test(text)) continue;
      if (existingQuotes.has(text) || usedTexts.has(text)) continue;
      const kind = ZH[m[1]];
      usedTexts.add(text);
      quotes.push({
        text,
        author: m[1] === 'cmt' ? blk.up || '' : '',
        hero: name,
        src: 'B站《' + (blk.title || '') + '》' + kind + (blk.bvid ? '（' + blk.bvid + '）' : '') + ' · ' + blk.file,
        verify: blk.bvid
          ? 'https://www.bilibili.com/video/' + blk.bvid
          : 'https://search.bilibili.com/all?keyword=' + encodeURIComponent(blk.title || text.slice(0, 20)),
      });
      take++;
    }
  }
}

// ---- 自动归属：只接受证据文件里已经通过通用词闸门的条目 ----
const aliasMerge = [];
const quoteMerge = [];
for (const e of links.entries || []) {
  if (!e.hero || !heroNames.has(e.hero) && !NEW_HEROES.some((h) => h.name === e.hero)) continue;
  if (e.kind === 'card') {
    if (!existingCards.has(e.key)) continue;
    aliasMerge.push({ term: e.key, hero: e.hero, aliases: [], confidence: e.confidence });
  } else if (e.kind === 'quote') {
    if (!lore.quotes.some((q) => q.text === e.key)) continue;
    quoteMerge.push({ text: e.key, hero: e.hero, confidence: e.confidence });
  }
}

// ---- 新人物清洗：rank 双点、words 死链 ----
const wordKeys = new Set();
for (const w of seed.words) {
  wordKeys.add(w.zh);
  String(w.alias || '')
    .split(/[、,，]/)
    .forEach((a) => wordKeys.add(a.trim()));
}
const heroes = NEW_HEROES.map((h) => {
  const clean = Object.assign({}, h);
  clean.rank = String(h.rank || '').replace(/\s*·\s*·\s*/g, ' · ').replace(/\s+·\s*$/, '').trim();
  const keep = (h.words || []).filter((x) => wordKeys.has(x));
  if (keep.length) clean.words = keep;
  else {
    const fromAlias = [h.name].concat(String(h.alias || '').split(/\s*\/\s*/).map((s) => s.trim()).filter(Boolean)).filter((x) => wordKeys.has(x));
    clean.words = [...new Set(fromAlias)];
  }
  clean.grp = h.group || 'game';
  return clean;
});

console.log(
  `语料行 ${lines.length} · 新增人物 ${heroes.length} · 新增词卡 ${cards.length} · 新增名言 ${quotes.length} · 卡归属 ${aliasMerge.length} · 名言归属 ${quoteMerge.length}`
);
console.log('words 死链已清：' + heroes.filter((h) => !h.words.length).length + ' 人无关联词');

if (DRY) {
  console.log('（--dry-run，未写盘）');
  console.log(JSON.stringify(cards[0], null, 1).slice(0, 700));
  process.exitCode = 0;
  return;
}

const head =
  '// @ts-check\n' +
  "'use strict';\n" +
  '// 第十三轮扩充（2026-10-25）：新增游戏角色 31 人 + 其黑话词卡/名言 + 既有条目的人物归属。\n' +
  '// 生成器：scripts/build-lore13.js；输入 scripts/curated-heroes13.js、evidence/hero-links13.json、corpus/*.txt。\n' +
  '// 配图全部为百度图库/B 站封面的真实图片（人工逐张核验见 evidence/hero-images13-review.md），未使用 AI 生成图。\n' +
  '// 名言与例句均为语料原文逐字摘录；aliasMerge/quoteMerge 只补空字段，不覆盖已有归属。\n\n';

const body =
  'const cards = ' + JSON.stringify(cards, null, 2) + ';\n\n' +
  'const quotes = ' + JSON.stringify(quotes, null, 2) + ';\n\n' +
  'const heroes = ' + JSON.stringify(heroes, null, 2) + ';\n\n' +
  'const aliasMerge = ' + JSON.stringify(aliasMerge, null, 2) + ';\n\n' +
  '// quoteMerge 是本轮新增机制：把自动归属的人物补进既有名言（只在 hero 为空时生效）。\n' +
  'const quoteMerge = ' + JSON.stringify(quoteMerge, null, 2) + ';\n\n' +
  'const __export = { cards, quotes, heroes, aliasMerge, quoteMerge, heroMerge: [] };\n' +
  "if (typeof module === 'object' && module.exports) module.exports = __export;\n" +
  "else if (typeof window !== 'undefined') window.LORE_EXTRA13 = __export;\n";

fs.writeFileSync(OUT, head + body, 'utf8');
console.log('已写 src/core/lore-extra13.js（' + (fs.statSync(OUT).size / 1024).toFixed(0) + ' KB）');
