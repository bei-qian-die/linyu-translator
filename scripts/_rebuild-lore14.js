'use strict';
// 一次性:整体重建 curated-lore14.js。
// 现文件经多轮文本补丁出现了 verify 错位与重复键;这里 require 模块拿「生效值」,
// 按 人工核实的最终 BV 映射 覆盖 verify、给 HEROES 补 group、修 HEROES 链接,
// 然后整文件重新序列化(数据文件,注释由 banner 提供)。
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const file = path.join(ROOT, 'scripts/curated-lore14.js');
const cur = require(file);

const V = (bv) => 'https://www.bilibili.com/video/' + bv;
const S = (kw) => 'https://search.bilibili.com/all?keyword=' + encodeURIComponent(kw);

// —— 语录最终 verify 映射(前缀匹配) ——
const QUOTE_BV = [
  ['音色胡艺莲秒了', 'BV1hzjX65E4R'],
  ['要索就索那艺娜的命', 'BV1HAd6YbEC7'],
  ['俄罗斯娜娜那个诈骗犯', 'BV1HAd6YbEC7'],
  ['那艺娜已经在操控通讯录', 'BV1SQKKzYErk'],
  ['娜娜紧急公关', 'BV1ZL41127Ss'],
  ['我也想要绿如卡', 'BV12Yau6WErQ'],
  ['我是贞子先在娜娜直播间', 'BV1ZL41127Ss'],
  ['其实没骂过', 'BV1o24y1m7ty'],
  ['艾莎女王', 'BV1FenJ65EpE'],
  ['为了守护贝塔', 'BV1odwVefEpo'],
  ['玛皇是玛薇卡女王', 'BV1YutieDEUJ'],
  ['其实相比于王者', 'BV1qNbX6QEvQ'],
  ['我尼美神降临', 'BV13nVG6sEf3'],
  ['淋露的PV竟然被吸入惹', 'BV1BY411Z7vp'],
  ['最初开卖的阴婷', 'BV1avpc6mEmG'],
  ['你光怎么默认', 'BV1dctk6SEEb'],
  ['我的黑暗强过大黑佛母', 'BV1kN4y1X7DW'],
  ['其实当年害死阿兹尔', 'BV1oK421b7rC'],
  ['吓晕你光黑暗面', 'BV1oK421b7rC'],
  ['你光大谈不在意', 'BV1wAGgzLEkZ'],
  ['你辰这是铁柱', 'BV1GvzpYdEDe'],
  ['你辰的一键快煮', 'BV12QUNYWECf'],
  ['背后阴人你光', 'BV1oK421b7rC'],
  ['好美好美的精神状态', 'BV1oK421b7rC'],
  ['还记得那年晌午', 'BV1fG41197xy'],
  ['Flop的是我鼠', 'BV1fG41197xy'],
  ['虫队姐妹表示正确', 'BV1CqGK6sEkW'],
  ['娥觉得打不打', 'BV1Uday6sE2q'],
  ['婷婷小姐姐', 'BV1zLuA6wE1B'],
  ['不是你记忆中的大副', 'BV1AWPxzqEu5'],
  ['冷门信仰玩家', 'BV1AWPxzqEu5'],
  ['仙子放心飞', 'BV1Bu4y1N7my'],
  ['通女一', 'BV1hzjX65E4R'],
  ['大姐你是周阴婷本人吗', 'BV19FKi66E4H'],
  ['啊啊啊啊，有点像脚淋', 'BV1PjJ86kEFP'],
  ['大妈连招都错噜', 'BV1PjJ86kEFP'],
  ['淋雨圈是独立文化圈', 'BV1AP411k7m2'],
  ['真素本质惹', 'BV1j4411t7Wo'],
  ['姐姐珍素努力惹', 'BV18W411k7j8'],
  ['网阴云音乐', 'BV1oJ41167Y6'],
  ['我凤一首歌', 'BV12Yau6WErQ'],
  ['首日3000w', 'BV12Yau6WErQ'],
  ['乘风破浪就要银', 'BV1KSMc6MEnb'],
  ['安迪！一库一库', 'BV1TKKiz2ECw'],
  ['我们LOL有自己的冰之巫女', 'BV1c34y1P7CT'],
  ['【淋神】水冰战舰', 'BV1pv3FzUEYz'],
  ['真的素杯糕爱好者', 'BV1uZg5zTERM'],
];
// —— 词卡最终 verify 映射 ——
const CARD_BV = {
  拉克丝做法: 'BV1oK421b7rC',
  圣水婆: 'BV19FKi66E4H',
  艺字辈: 'BV1NFnt6zE8f',
  大中国娜娜: 'BV1AP411k7m2',
  念器官: 'BV1ZL41127Ss',
  绿如卡: 'BV12Yau6WErQ',
  郭门: 'BV1hzjX65E4R',
  婊时代: 'BV1Mh4y1u75v',
  梵蜜淋: 'BV1KSMc6MEnb',
  鸡圈甜菜: 'BV1ub4y1D7gR',
  莓莓小姐: 'BV1mvYP6rETJ',
  化身为胱: 'BV1odwVefEpo',
  玛皇: 'BV1YutieDEUJ',
  阴萎者: 'BV1pch56oEH2',
  你杰: 'BV14ZFPeSEXo',
  婆崎: 'BV1GFWizhEYp',
  柔博士欧文: 'BV1bSJr6UEiX',
  高产似赵露思: 'BV19FKi66E4H',
  熊黛淋: 'BV1Uday6sE2q',
};

const pickBV = (text, table) => {
  if (Array.isArray(table)) {
    for (const [p, bv] of table) if (text.startsWith(p)) return bv;
    return '';
  }
  for (const [p, bv] of Object.entries(table)) if (text === p || text.startsWith(p)) return bv;
  return '';
};

let qNoBV = 0;
const QUOTES = cur.QUOTES.map((q) => {
  const bv = pickBV(q.text, QUOTE_BV);
  const out = { text: q.text, author: q.author || '' };
  if (q.hero) out.hero = q.hero;
  out.src = q.src;
  if (bv) out.verify = V(bv);
  else qNoBV++;
  return out;
});
let cNoBV = 0;
const CARDS = cur.CARDS.map((c) => {
  const out = { term: c.term, type: c.type };
  if (c.hero) out.hero = c.hero;
  if (c.aliases) out.aliases = c.aliases;
  out.meaning = c.meaning;
  out.example = c.example || '';
  out.source = c.source;
  const bv = CARD_BV[c.term] || (/^BV[0-9A-Za-z]+$/.test(String(c.verify || '').replace('https://www.bilibili.com/video/', '')) ? String(c.verify).replace('https://www.bilibili.com/video/', '') : '');
  if (bv) out.verify = V(bv);
  else cNoBV++;
  return out;
});
const HEROES = cur.HEROES.map((h) => {
  const out = { ...h, group: h.grp };
  if (out.name === '胡艺莲') {
    out.links = [
      { label: 'B站检索：胡艺莲', url: S('胡艺莲') },
      { label: 'B站《娜娜紧急公关！解释怒怼胡艺莲原因》', url: V('BV1ZL41127Ss') },
      { label: 'B站《那艺娜陨落，胡艺莲C位！艺字辈家族大盘点》', url: V('BV1NFnt6zE8f') },
      { label: '配图来源（百度图库）：胡艺莲地铁唱歌新闻截图', url: S('胡艺莲 重庆轨道交通') },
    ];
  }
  if (out.name === 'poke萌虻') {
    out.links = [{ label: 'B站《王者淋系英雄盘点-鸡圈甜菜》', url: V('BV1ub4y1D7gR') }];
  }
  if (out.name === '大副') {
    out.links = [
      { label: 'B站《【第五淋格】不是你记忆中的大副》', url: V('BV1AWPxzqEu5') },
      { label: '配图来源（百度图库）：《第五人格》大副何塞·巴登官方立绘', url: S('第五人格 大副 何塞巴登 官方立绘') },
    ];
  }
  if (out.name === '玛薇卡') {
    out.links = [
      { label: 'B站《【淋神】天理给纳塔关上了一扇门……》', url: V('BV1odwVefEpo') },
      { label: '配图来源（百度百科）：玛薇卡词条官方立绘', url: S('原神 玛薇卡 官方立绘') },
    ];
  }
  return out;
});
const HEROES_MERGE = cur.HEROES_MERGE.map((m) =>
  m.name === '武田晴海' ? { ...m, links: [{ label: 'B站《【淋神】水冰战舰》', url: V('BV1pv3FzUEYz') }] } : m
);

const banner = `'use strict';

// 第十四轮精选扩充（2026-10-25）：词卡 + 名言 + 人物传 + 既有人物合并。
// 来源：corpus/ 全量语料（含 harvest14 新抓的五份 corpus-bili-20261024*/20261025*），
// evidence/lore14-cand.json 候选 + 人工评审（evidence/cand14-review.txt）。
// 全部语录逐字摘自语料；verify 为经 manifest 反查核实的 B 站链接；
// 配图为 B 站 UP 头像 / 百度图库官方立绘（evidence/hero-images14.json），无 AI 图。
// 本文件由 scripts/_rebuild-lore14.js 整体重排生成，改动请改映射后重跑。

`;

const clean = (arr) =>
  JSON.stringify(arr, null, 2)
    .replace(/\n {2}/g, '\n')
    .replace(/^\\\[/, '')
    .replace(/"([a-zA-Z_]+)":/g, '$1:');

const body =
  banner +
  'const CARDS = ' + clean(CARDS) + ';\n\n' +
  'const QUOTES = ' + clean(QUOTES) + ';\n\n' +
  'const HEROES = ' + clean(HEROES) + ';\n\n' +
  'const HEROES_MERGE = ' + clean(HEROES_MERGE) + ';\n\n' +
  'module.exports = { CARDS, QUOTES, HEROES, HEROES_MERGE, QUOTES_MERGE: [{ text: \'姐姐珍素努力惹\', hero: \'霉霉\' }] };\n';

fs.writeFileSync(file, body);
console.log('rebuilt: cards', CARDS.length, 'quotes', QUOTES.length, 'heroes', HEROES.length, '| 无BV语录', qNoBV, '无BV词卡', cNoBV);
