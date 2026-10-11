'use strict';
// 修正第三轮句式：吞掉句尾"了"避免叠语气词，并把句中插入不通顺的模板改短
const fs = require('fs');
const P = 'src/core/seed.json';
const seed = JSON.parse(fs.readFileSync(P, 'utf8'));

const FIX = {
  '(?:灵感来了?|有灵感|突然想到|灵光一闪)': { pattern: '(?:灵感来了?|有灵感|突然想到|灵光一闪)(?:了)?', template: '淋光乍现惹' },
  '(?:配音|用替身|假唱)': { pattern: '(?:用配音|台词太差|用替身|假唱)', template: '台词太差，所以用配阴惹' },
  '(?:人美心善|又美又善解人意)': { pattern: '(?:人美心善|又美又善良)(?:了)?', template: '珍素人美心善惹' },
  '(?:冰雪聪明|真聪明)': { pattern: '(?:冰雪聪明|真聪明)(?:了)?', template: '珍素冰雪聪明惹' },
  '(?:已经变直男|就是直男|变成直男)': { pattern: '(?:已经变直男|变成直男|变直男了)', template: '那已经素直男惹' },
  '(?:没镜头|没台词|当路人)': { pattern: '(?:没镜头|没台词|当路人|没姓名)(?:了)?', template: '连背景板都当不成惹' },
  '(?:淋雨|下雨了)': { pattern: '(?:淋雨|下雨)(?:了)?', template: '淋雨一直走，靴靴' },
  '(?:听你说|倾诉|诉苦)': { pattern: '(?:听你说|倾诉|诉苦)(?:了)?', template: '淋听你的故事秽惹' },
  '(?:赶紧去死|你怎么不去死|去死吧)': { pattern: '(?:赶紧去死|你怎么不去死|去死吧?)', template: '请你立即去世，靴靴' },
  '(?:太谢谢了|多谢多谢|感激不尽)': { pattern: '(?:太谢谢了?|多谢多谢|感激不尽)', template: '靴靴的靴靴惹' },
};

const WORDFIX = { 人美心善: '人美心善惹', 冰雪聪明: '冰雪聪明素本可天性', 配音: '配阴', 灵感: '淋光乍现惹' };

let n = 0;
seed.rules = seed.rules.filter((r) => {
  const f = FIX[r.pattern];
  if (!f) return true;
  r.pattern = f.pattern;
  r.template = f.template;
  n++;
  return true;
});
for (const w of seed.words) if (WORDFIX[w.zh]) w.linyu = WORDFIX[w.zh];

const wLines = seed.words.map((w) => '    { "zh": ' + JSON.stringify(w.zh) + ', "linyu": ' + JSON.stringify(w.linyu) + ' }').join(',\n');
const rLines = seed.rules.map((r) => '    { "pattern": ' + JSON.stringify(r.pattern) + ', "template": ' + JSON.stringify(r.template) + ', "note": ' + JSON.stringify(r.note) + ' }').join(',\n');
fs.writeFileSync(P, '{\n  "words": [\n' + wLines + '\n  ],\n  "rules": [\n' + rLines + '\n  ]\n}\n', 'utf8');
console.log('fixed rules', n, 'total', seed.rules.length, seed.words.length);

const { translateText } = require('./../src/core/translator');
const s2 = JSON.parse(fs.readFileSync(P, 'utf8'));
for (const t of ['我突然有灵感了', '他用配音', '她人美心善', '你可真冰雪聪明', '他就是直男', '外面下雨了', '我想跟你倾诉', '你怎么不去死', '太谢谢了', '这五毛特效', '他没镜头的', '美翻了']) {
  const o = translateText(t, s2);
  console.log(t, '->', o, /(惹惹|噜噜|靴靴惹惹)/.test(o) ? '  <== DOUBLE' : '');
}
