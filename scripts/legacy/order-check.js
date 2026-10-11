'use strict';
// 模拟老库场景：新增句式被追加到规则表末尾时，是否仍能被正确命中
const fs = require('fs');
const { translateText } = require('../../src/core/translator');
const seed = JSON.parse(fs.readFileSync('src/core/seed.json', 'utf8'));

const NEW = [
  '灵感', '五毛特效', '配音', '人美心善', '冰雪聪明', '太美了', '王炸', '背景板',
  '直男认证', '调理', '水牛音', '蠢死了', '吓到', '怪美的', '太美', '淋雨',
  '床戏', '电音', '谢谢谢谢', '恶心', '天哪', '去世', '野鸡', '高贵', '马戏团',
  '钢索', '命大', '艾莉', '恒河水', '墙板报', '假发', '鹅螺狮', '吱花', '一梦奇缘',
];

const samples = {
  '灵感': '我突然有灵感了', '五毛特效': '这五毛特效', '配音': '他用配音', '人美心善': '她人美心善',
  '冰雪聪明': '你可真冰雪聪明', '太美了': '这造型太美了', '王炸': '这局王炸', '背景板': '他没镜头的',
  '直男认证': '他已经变直男了', '调理': '调理好了吧', '水牛音': '一上来就是水牛音', '蠢死了': '我蠢死了',
  '吓到': '真的吓到我', '怪美的': '这衣服怪美的', '太美': '林林太美', '淋雨': '外面下雨了',
  '床戏': '她演床戏', '电音': '这电音太响', '谢谢谢谢': '太谢谢了', '恶心': '好恶心',
  '天哪': '我的天哪', '去世': '你怎么不去死', '野鸡': '哪里来的野鸡', '高贵': '真高贵',
  '马戏团': '马戏团表演', '钢索': '他走钢索', '命大': '你命大', '艾莉': '有点像艾莉',
  '恒河水': '喝恒河水', '墙板报': '破坏墙板报', '假发': '假发位移了', '鹅螺狮': '鹅螺狮辣辣',
  '吱花': '不素吱花', '一梦奇缘': '一个是一梦奇缘',
};

const rules = [...seed.rules];
for (const r of rules) if (!r.isNew) { /* keep */ }
// 追加序：把与 NEW 相关的新规则移到最后，模拟老库自增 id 的顺序
const newPatterns = new Set([
  '(?:灵感来了?|有灵感|突然想到|灵光一闪)(?:了)?',
  '(?:五毛特效|特效很差|渣特效)',
  '(?:用配音|台词太差|用替身|假唱)',
  '(?:人美心善|又美又善良)(?:了)?',
  '(?:冰雪聪明|真聪明)(?:了)?',
  '(?:美翻了|美得冒泡|好看到爆)',
  '(?:开局王炸|一把好牌)',
  '(?:没镜头|没台词|当路人|没姓名)(?:了)?',
  '(?:已经变直男|变成直男|变直男了)',
  '(?:调理好了?|养好了|治好了)',
  '(?:淋雨|下雨)(?:了)?',
  '(?:听你说|倾诉|诉苦)(?:了)?',
  '(?:赶紧去死|你怎么不去死|去死吧?)',
  '(?:太谢谢了?|多谢多谢|感激不尽)',
]);
const head = rules.filter((r) => !newPatterns.has(r.pattern));
const tail = rules.filter((r) => newPatterns.has(r.pattern));
const asLast = [...head, ...tail];
console.log('new rules count', tail.length);

let bad = 0;
for (const k of NEW) {
  const s = samples[k];
  const a = translateText(s, { words: seed.words, rules: seed.rules });
  const b = translateText(s, { words: seed.words, rules: asLast });
  if (a !== b) {
    bad++;
    console.log('DIFF', k, '\n  seed顺序:', a, '\n  老库顺序:', b);
  }
}
console.log('order-sensitive cases:', bad, '/', NEW.length);
