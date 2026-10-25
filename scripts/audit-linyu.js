'use strict';
// 现状盘点：五大板块词条数、语义位覆盖、变体矩阵缺口、来源标注率、配图率。
// 用于「扩充前基线」与「扩充后复检」两次运行，直接对比。
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const seed = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/core/seed.json'), 'utf8'));
const lore = require(path.join(ROOT, 'src/core/lore'));

const words = seed.words;
const rules = seed.rules;
const cards = lore.flashcards;
const heroes = lore.heroes;
const quotes = lore.quotes;

const SLOT_CANON = [
  '第一人称自称', '第二人称', '第三人称', '群体自称', '群体称呼',
  '疑问', '否定', '惊讶', '认同', '催促', '调侃/戏谑', '告别',
  '称呼类', '程度', '语气词', '祈使', '情绪',
];

function slotOf(w) {
  const s = String(w.slot || '');
  if (!s) return '（未标注）';
  // 「调侃/戏谑」本身就是标准语义位，不能按复合 slot 切头，
  // 否则会被切成「调侃」，在缺口表里对不上名字。
  if (SLOT_CANON.includes(s)) return s;
  // 复合 slot（"称呼类 / 调侃"、"情绪 / 调侃"）取第一段作为主语义位
  const head = s.split('/')[0].trim();
  return head;
}

const bySlot = {};
for (const w of words) {
  const s = slotOf(w);
  (bySlot[s] = bySlot[s] || []).push(w);
}

const hasSource = (x) => {
  const s = x.source || x.src || '';
  return s && s.trim().length > 0 && !/^未知$/.test(s.trim());
};

// 人物传没有 source 字段，出处记在 links[] 里，所以按 links 判定
const heroHasSource = (h) =>
  hasSource(h) || (Array.isArray(h.links) && h.links.some((l) => l && l.url && l.url.trim()));

console.log('=== 五大板块词条数 ===');
console.log(`词库 words   : ${words.length}`);
console.log(`句式 rules   : ${rules.length}`);
console.log(`词卡 cards   : ${cards.length}`);
console.log(`人物 heroes  : ${heroes.length}`);
console.log(`名言 quotes  : ${quotes.length}`);

console.log('\n=== 语义位分布（词库） ===');
const slots = Object.keys(bySlot).sort((a, b) => bySlot[b].length - bySlot[a].length);
for (const s of slots) {
  const list = bySlot[s];
  const variants = list.reduce((a, w) => a + (w.alias ? w.alias.split(/[、,，]/).filter(Boolean).length : 0), 0);
  console.log(`  ${s.padEnd(12)} 条目 ${String(list.length).padStart(4)}  变体数 ${variants}`);
}

console.log('\n=== 变体矩阵缺口（目标 >=8 变体） ===');
const CORE = ['第一人称自称', '第二人称', '第三人称', '群体自称', '疑问', '否定', '惊讶', '认同', '催促', '调侃/戏谑', '告别', '称呼类', '程度', '语气词', '情绪'];
for (const s of CORE) {
  const list = bySlot[s] || [];
  const variants = list.reduce((a, w) => a + (w.alias ? w.alias.split(/[、,，]/).filter(Boolean).length : 0), 0);
  const flag = variants >= 8 ? 'OK ' : 'GAP';
  console.log(`  ${flag} ${s.padEnd(12)} 条目 ${String(list.length).padStart(4)}  变体数 ${variants}`);
}

console.log('\n=== 来源标注率 ===');
console.log(`  词库  ${words.filter(hasSource).length}/${words.length}`);
console.log(`  句式  ${rules.filter(hasSource).length}/${rules.length}`);
console.log(`  词卡  ${cards.filter(hasSource).length}/${cards.length}`);
console.log(`  名言  ${quotes.filter(hasSource).length}/${quotes.length}`);
console.log(`  人物  ${heroes.filter(heroHasSource).length}/${heroes.length}（人物出处记在 links[]）`);

console.log('\n=== 配图率 ===');
const withImg = heroes.filter((h) => h.img && h.img.trim());
console.log(`  人物带图 ${withImg.length}/${heroes.length}`);
const noImg = heroes.filter((h) => !h.img || !h.img.trim());
if (noImg.length) console.log('  缺图：' + noImg.map((h) => h.name).join(' '));

console.log('\n=== 人物分区 ===');
const grp = {};
for (const h of heroes) {
  const k = h.group || 'real';
  (grp[k] = grp[k] || []).push(h.name);
}
for (const k of Object.keys(grp)) console.log(`  ${k}: ${grp[k].length}`);

console.log('\n=== 词卡类型分布 ===');
const typ = {};
for (const c of cards) typ[c.type || 'none'] = (typ[c.type || 'none'] || 0) + 1;
console.log('  ' + JSON.stringify(typ));

console.log('\n=== 名言按归属人物 top ===');
const qh = {};
for (const q of quotes) qh[q.hero || '（无归属）'] = (qh[q.hero || '（无归属）'] || 0) + 1;
console.log(
  '  ' +
    Object.entries(qh)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([k, v]) => `${k}:${v}`)
      .join(' ')
);

// 来源平台分布：把所有出处链接按域名归类，看内容主要来自哪些平台
console.log('\n=== 来源平台分布 ===');
const PLATFORMS = [
  ['bilibili', /bilibili\.com|hdslb\.com/i],
  ['百度贴吧', /tieba\.baidu\.com/i],
  ['萌娘百科', /moegirl/i],
  ['维基百科', /wikipedia\.org/i],
  ['百度百科', /baike\.baidu\.com/i],
  ['NGA', /nga\.cn|ngabbs\.com/i],
  ['知乎', /zhihu\.com/i],
  ['豆瓣', /douban\.com/i],
  ['抖音', /douyin\.com/i],
  ['小红书', /xiaohongshu|xhslink/i],
  ['米游社', /miyoushe\.com/i],
  ['百度图库', /image\.baidu\.com/i],
  ['微博', /weibo\.com/i],
];
const plat = {};
let urlTotal = 0;
const collect = (s) => {
  const str = String(s || '');
  if (!str) return;
  for (const m of str.matchAll(/https?:\/\/[^\s"'）)】]+/g)) {
    urlTotal++;
    const u = m[0];
    let hit = '其他';
    for (const [name, re] of PLATFORMS) {
      if (re.test(u)) { hit = name; break; }
    }
    plat[hit] = (plat[hit] || 0) + 1;
  }
};
for (const w of words) collect(w.source);
for (const r of rules) collect(r.src);
for (const c of cards) { collect(c.source); collect(c.verify); }
for (const q of quotes) { collect(q.src); collect(q.verify); }
for (const h of heroes) for (const l of h.links || []) collect(l.url);
console.log(`  出处链接总数 ${urlTotal}`);
for (const [k, v] of Object.entries(plat).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(12)} ${String(v).padStart(5)}  ${((v / urlTotal) * 100).toFixed(1)}%`);
}

// 人物传的图源分布：确认没有混进 AI 图或来源不明的图
console.log('\n=== 人物配图来源 ===');
const imgSrc = {};
for (const h of heroes) {
  for (const l of h.links || []) {
    if (!/配图来源/.test(String(l.label || ''))) continue;
    const u = String(l.url || '');
    let hit = '未标注';
    for (const [name, re] of PLATFORMS) {
      if (re.test(u)) { hit = name; break; }
    }
    imgSrc[hit] = (imgSrc[hit] || 0) + 1;
  }
}
for (const [k, v] of Object.entries(imgSrc).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(12)} ${String(v).padStart(5)}`);
}
