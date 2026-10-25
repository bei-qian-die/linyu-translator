'use strict';
// 一次性:按已核实的 显式映射 修正 curated-lore14.js 的 verify / 链接,并给人物补 group 字段。
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const file = path.join(ROOT, 'scripts/curated-lore14.js');
let src = fs.readFileSync(file, 'utf8');

// 每项:锚点(条目 text:/term:/name: 的前缀) → 正确 BV
const QUOTE_BV = {
  '娜娜紧急公关！解释怒怼胡艺莲原因': 'BV1ZL41127Ss',
  '我的黑暗强过大黑佛母！': 'BV1kN4y1X7DW',
  '虫队姐妹表示正确': 'BV1CqGK6sEkW',
  '不是你记忆中的大副，但致命的程度没两样': 'BV1AWPxzqEu5',
  '淋雨圈是独立文化圈': 'BV1AP411k7m2',
  '乘风破浪就要银 解解都涂梵蜜淋': 'BV1KSMc6MEnb',
  '安迪！一库一库~干巴爹！': 'BV1TKKiz2ECw',
  '我们LOL有自己的冰之巫女': 'BV1c34y1P7CT',
  '【淋神】水冰战舰，正在成为一件艺术品……': 'BV1pv3FzUEYz',
  '那艺娜已经在操控通讯录了': 'BV1SQKKzYErk',
  '俄罗斯娜娜那个诈骗犯': 'BV1HAd6YbEC7',
  '要索就索那艺娜的命': 'BV1HAd6YbEC7',
  '音色胡艺莲秒了': 'BV1hzjX65E4R',
  '我是贞子先在娜娜直播间': 'BV1ZL41127Ss',
  '我也想要绿如卡': 'BV12Yau6WErQ',
  '其实没骂过': 'BV1o24y1m7ty',
  '艾莎女王为什么你前期清兵': 'BV1FenJ65EpE',
  '玛皇是玛薇卡女王': 'BV1YutieDEUJ',
  '其实相比于王者，你至冬': 'BV1qNbX6QEvQ',
  '我尼美神降临': 'BV13nVG6sEf3',
  '最初开卖的阴婷已经鼠惹': 'BV1avpc6mEmG',
  '你光怎么默认是阴暗面': 'BV1dctk6SEEb',
  '其实当年害死阿兹尔': 'BV1oK421b7rC',
  '吓晕你光黑暗面': 'BV1oK421b7rC',
  '你辰这是铁柱': 'BV1GvzpYdEDe',
  '你辰的一键快煮': 'BV12QUNYWECf',
  '胡艺莲和那艺娜的名字原来不是巧合': 'BV1NFnt6zE8f',
  '命大也鼠了，圣水婆阴婷(quote 圣水婆)': 'BV19FKi66E4H',
  '大姐你是周阴婷本人吗，高产似赵露思': 'BV19FKi66E4H',
};
const CARD_BV = {
  '拉克丝做法': 'BV1oK421b7rC',
  '婊时代': 'BV1Mh4y1u75v',
  '梵蜜淋': 'BV1KSMc6MEnb',
  '鸡圈甜菜': 'BV1ub4y1D7gR',
  '莓莓小姐': 'BV1mvYP6rETJ',
  '柔博士欧文': 'BV1bSJr6UEiX',
};

// 工具:在 anchor 之后第一个 verify: V('...') 替换为正确 BV
function patch(anchor, bv) {
  const i = src.indexOf(anchor);
  if (i < 0) return console.log('MISS', anchor.slice(0, 20));
  const j = src.indexOf("verify: V('", i);
  const k = src.indexOf('source:', i);
  if (j < 0 || (k >= 0 && k < j)) {
    // 没有 verify 行 → 在 source: 前插入
    src = src.slice(0, k) + "verify: V('" + bv + "'), " + src.slice(k);
    return console.log('ADD', bv, anchor.slice(0, 20));
  }
  const m = src.slice(j).match(/^verify: V\('([0-9A-Za-z]+)'\)/);
  if (m[1] === bv) return console.log('KEEP', bv, anchor.slice(0, 20));
  src = src.slice(0, j) + "verify: V('" + bv + "')" + src.slice(j + m[0].length);
  console.log('FIX', m[1], '→', bv, anchor.slice(0, 18));
}

for (const [a, bv] of Object.entries(QUOTE_BV)) {
  if (a.includes('(quote ')) continue;
  patch("text: '" + a.slice(0, 22), bv);
}
// 圣水婆/高产似赵露思/艺字辈 的语录 verify(命大也鼠了那条语录文本就是标题本身)
patch("text: '命大也鼠了，圣水婆阴婷", 'BV19FKi66E4H');
for (const [a, bv] of Object.entries(CARD_BV)) patch("term: '" + a, bv);

// 人物 group 字段:grp: 'up', → grp: 'up', group: 'up',
src = src.replace(/grp: '(up|game|real)', rank:/g, "grp: '$1', group: '$1', rank:");

// 人物链接修正
src = src.replace(
  "{ label: 'B站《那艺娜陨落，胡艺莲C位！艺字辈家族大盘点》', url: V('BV1Mh4y1u75v') }",
  "{ label: 'B站《娜娜紧急公关！解释怒怼胡艺莲原因》', url: V('BV1ZL41127Ss') }"
);
src = src.replace(
  "{ label: 'B站《王者淋系英雄盘点-鸡圈甜菜》', url: V('BV1Mh4y1u75v') }",
  "{ label: 'B站《王者淋系英雄盘点-鸡圈甜菜》', url: V('BV1ub4y1D7gR') }"
);
// 武田晴海 merge 补链接
src = src.replace(
  "    works: ['【淋神】水冰战舰，正在成为一件艺术品……', '【淋神】只是长得有点像儿而已'],\n  },",
  "    works: ['【淋神】水冰战舰，正在成为一件艺术品……', '【淋神】只是长得有点像儿而已'],\n    links: [{ label: 'B站《【淋神】水冰战舰》', url: V('BV1pv3FzUEYz') }],\n  },"
);

fs.writeFileSync(file, src);
console.log('done');
