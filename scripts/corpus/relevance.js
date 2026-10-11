'use strict';
// 相关性筛查（用户要求"剔除与淋语无关的梗/名言"）：
// 只看"淋语生态语料"（filter-corpus 之后、淋语特征行足够多的视频块），
// 板块条目若在此语料里查不到，且它的出处标题本身也没有淋味特征 -> 列为待删候选，交给人工复核。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');
const m = { exports: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'src', 'core', 'lore.js'), 'utf8'), {
  module: m,
  exports: m.exports,
  require: (p) => require(path.join(ROOT, 'src', 'core', path.basename(p))),
});
const lore = m.exports;
const seed = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'core', 'seed.json'), 'utf8'));

const norm = (s) => String(s || '').replace(/\s+/g, '').toLowerCase();
const strip = (s) => norm(s).replace(/[，。！？、；：""''‘’“”（）()…~—\-《》〈〉,.!?;:"'\[\]【】·、*#@%&+=|\\/_^$]/g, '');

// graph.txt 由 harvest-graph 用"必须命中淋语 tag 或标题带淋"的门禁产出，本身就是生态语料。
const isEco = (f) => /f\.txt$/.test(f) || /\.graph\.txt$/.test(f);
const FILES = fs
  .readdirSync(ROOT)
  .filter((f) => isEco(f) || /^corpus\d+\.(raw\.)?txt$/.test(f));
let eco = '';
let all = '';
for (const f of FILES) {
  const txt = fs.readFileSync(path.join(ROOT, f), 'utf8');
  all += txt + '\n';
  if (isEco(f)) eco += txt + '\n';
}
const ECO = strip(eco);
const ALL = strip(all);
const LY = /(淋|通讯录|可人儿|本可|靴靴|噜|惹|厚$|姐圈|阴|地才|蔡依林|jolin|舞娘|玫瑰|花蝴蝶|特务J|13|贝塔|乌干达|仙女|锁姐|肘姐|那艺娜|完颜|三梦|万人迷|郭老师|楼兰|鹅妈妈|雷迪嘎嘎|曲婉婷|何老师|劳荣枝|周阴婷|霉霉|玛莎|梵谷|埃及艳后|老地瓜|开心姐|埋汰姐|施柔儿|庄周|元歌|妮蔻|拉比克|孙策|心海|腋淋)/i;

const SRC = (x) => String(x.source || x.src || x.hero || x.author || '');
const EV = (x) => String(x.verify || x.src || x.source || '');

// 条目内容本身是否带淋语用词特征（用户要求：剔除"与淋语无关"的梗/名言）。
// 只看出处带淋味不够——通讯录明星的普通台词同样与淋语无关。
const USAGE =
  /(淋|噜|惹|靴靴|可人儿|本可|通讯录|地才|吸入|开熏|喜翻|解解|天惹|鼠|阴|姐圈|130|贝塔|乌干达|美神|仙气|豪姐|锁姐|肘姐|gay|通讯录|吸干|难逃一吸)/i;

function review(kind, text, src, keys, evidence) {
  const list = (keys || [text]).map(strip).filter((t) => t.length >= 2);
  const hit = (hay) => list.some((t) => hay.includes(t) || hay.includes(t.slice(0, 10)));
  const inEco = hit(ECO);
  const inAll = hit(ALL);
  const usage = USAGE.test(text);
  const ev = !!evidence && evidence.length > 6;
  return {
    kind,
    text,
    src,
    inEco,
    inAll,
    usage,
    ev,
    // 内容无淋语特征 且 不在淋语生态语料里逐字出现 -> 剔除候选
    suspect: kind !== 'WORD' && kind !== 'HERO' && !usage && !inEco,
    // 有淋语特征但语料查无 -> 保留，需要补外部出处佐证
    untraced: kind !== 'WORD' && kind !== 'HERO' && usage && !inEco && !inAll,
  };
}

const rows = [];
for (const c of lore.flashcards) {
  rows.push(
    review('CARD', c.term + ' | ' + (c.example || c.meaning), SRC(c), [c.term, c.example, c.meaning], EV(c))
  );
}
for (const q of lore.quotes) rows.push(review('QUOTE', q.text, SRC(q), [q.text], EV(q)));
for (const w of seed.words) rows.push(review('WORD', w.zh + '->' + w.linyu, '', [w.linyu]));
for (const h of lore.heroes) rows.push(review('HERO', h.name, SRC(h), [h.name]));

const out = [];
const counts = {};
const sus = {};
const untr = {};
for (const r of rows) {
  counts[r.kind] = counts[r.kind] || { n: 0, suspect: 0, untraced: 0 };
  counts[r.kind].n++;
  const line = r.text.slice(0, 80) + '\t[出处] ' + r.src.slice(0, 44);
  if (r.suspect) {
    counts[r.kind].suspect++;
    (sus[r.kind] = sus[r.kind] || []).push(line + (r.inAll ? '\t(只在未过滤语料)' : '\t(语料查无)'));
  } else if (r.untraced) {
    counts[r.kind].untraced++;
    (untr[r.kind] = untr[r.kind] || []).push(line);
  }
}
out.push('## 一、剔除候选：内容无淋语用词特征，且未在淋语生态视频里逐字出现');
for (const k of ['CARD', 'QUOTE']) {
  if (!sus[k]) continue;
  out.push('\n### ' + k + ' ' + sus[k].length + ' 条');
  out.push(...sus[k]);
}
out.push('\n## 二、保留但缺溯源：有淋语特征，语料里查不到（需补 verify 出处）');
for (const k of ['CARD', 'QUOTE']) {
  if (!untr[k]) continue;
  out.push('\n### ' + k + ' ' + untr[k].length + ' 条');
  out.push(...untr[k]);
}
out.push('\n## 三、语料未提及的英雄（仅提示，不自动删）');
out.push(
  lore.heroes
    .filter((h) => !ALL.includes(strip(h.name)))
    .map((h) => h.name + ' [' + h.group + '] 名言 ' + lore.quotes.filter((q) => q.hero === h.name).length + ' 条')
    .join('\n')
);
out.push('\n## 四、词库里淋语形未在语料出现的（翻译资产，不自动删）');
out.push(seed.words.filter((w) => !ALL.includes(strip(w.linyu))).map((w) => w.zh + '->' + w.linyu).join('\n'));
fs.writeFileSync(path.join(ROOT, 'relevance-review.txt'), out.join('\n'), 'utf8');
console.log('生态语料字符', ECO.length, '全部语料', ALL.length);
console.log(JSON.stringify(counts));
console.log('剔除候选', rows.filter((r) => r.suspect).length, '-> relevance-review.txt');
