'use strict';
// 审计：找出与淋语无关的词条/句式/词卡/名言
// 判定：文本里完全没有淋语构词特征，且出处也不是淋语tag视频 -> 需要人工复核或删除
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const m = { exports: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'lore.js'), 'utf8'), {
  module: m,
  exports: m.exports,
  require: (p) => require(path.join(__dirname, '..', 'src', 'core', path.basename(p))),
});
const lore = m.exports;
const seed = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'seed.json'), 'utf8'));

const MARK = /淋|素|噜|惹|厚|靴|可人|塔|隋|解解|阴|衮|喜翻|洞|13[03]|仙女|姐妹|锅锅|倒梅|咨熊|地才|天德|渊下宫|锁定|吸入|本可|蜜|嘎|礼蟹|珍|超|熏|拥|哭[cry]|flop|母体|第二春|本质骑士|乌干达|全体起立|大事不妙|碗安|枣安|啾咪|扯头花|趴体|精咽|橘势|牛皮涕|豪嗨心|燻|风姿|用洞|王钦朕|婷芷|华清者|墙头草|洗脚婢|珍珠音色|美神降临/;
const LY_SOURCE = /淋|高等淋语|地才|姐圈|阴后|通讯录|肘姐|那艺娜|三梦|万人迷|鹅妈妈|花露水|完颜|楼兰|本质艾淋|蔡依林|Jolin|jolin|Diva|淋神|玉兰花|贝塔|华|13/;

function judge(item, texts, srcText) {
  const inText = texts.some((t) => MARK.test(String(t || '')));
  const inSrc = LY_SOURCE.test(String(srcText || ''));
  return { ok: inText || inSrc, inText, inSrc };
}

const out = [];
const push = (kind, label, r) => { if (!r.ok) out.push(kind + '\t' + label); };

for (const w of seed.words) push('WORD', w.zh + ' -> ' + w.linyu, judge(w, [w.zh, w.linyu], w.zh));
for (const r of seed.rules) push('RULE', r.pattern + ' => ' + r.template + ' [' + (r.note || '') + ']', judge(r, [r.pattern, r.template, r.note], r.note));
for (const c of lore.flashcards) push('CARD', c.term + ' | ' + (c.example || '') + ' | src=' + (c.source || c.verify || ''), judge(c, [c.term, c.meaning, c.example, (c.aliases || []).join(' ')], c.source || c.verify));
for (const q of lore.quotes) push('QUOTE', q.text + ' | ' + (q.author || '') + ' | ' + (q.src || ''), judge(q, [q.text], (q.author || '') + ' ' + (q.src || '')));
for (const h of lore.heroes) {
  const prose = [h.intro, h.baike, (h.tags || []).join(' '), (h.works || []).join(' ')].join(' ');
  push('HERO', h.name + ' (' + h.group + ') | ' + (h.intro || ''), judge(h, [prose], h.name + ' ' + (h.intro || '') + ' ' + (h.baike || '')));
}

const cnt = (k) => out.filter((l) => l.startsWith(k)).length;
console.log('flagged: words', cnt('WORD'), 'rules', cnt('RULE'), 'cards', cnt('CARD'), 'quotes', cnt('QUOTE'), 'heroes', cnt('HERO'));
console.log('totals: words', seed.words.length, 'rules', seed.rules.length, 'cards', lore.flashcards.length, 'quotes', lore.quotes.length, 'heroes', lore.heroes.length);
fs.writeFileSync('audit.txt', out.join('\n'), 'utf8');
console.log(out.join('\n').slice(0, 4000));
