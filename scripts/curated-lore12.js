'use strict';

// 第十二轮扩充：词卡 / 名言 / 人物传。
// 全部来自第十一轮 B 站高强度检索语料（corpus/corpus-bili-20261024202023.txt），
// 每条名言都能在对应 BV 号的视频弹幕/评论里逐字核对；
// 评论作者已回 B 站评论接口核对（evidence/quote-authors11.json / quote-authors11b.json），
// 弹幕条目按项目既有惯例 author 留空。

const BV_Q = 'https://www.bilibili.com/video/BV18h4y1r7vu';
const BV_FYT = 'https://www.bilibili.com/video/BV1s4411K7Dd';
const BV_LX = 'https://www.bilibili.com/video/BV1zK4y1T7d3';
const BV_LM = 'https://www.bilibili.com/video/BV18W411k7j8';
const BV_BB = 'https://www.bilibili.com/video/BV1yiHa6WEVQ';
const BV_YY = 'https://www.bilibili.com/video/BV1TfmNYREjN';
const BV_FJ = 'https://www.bilibili.com/video/BV1UBpk6dEFV';
const BV_BG = 'https://www.bilibili.com/video/BV1QWpK68Eg3';
const BV_CY = 'https://www.bilibili.com/video/BV1mRJa6WEHJ';

const SRC_Q = 'B站《【Q&A】拖更？淋明杀鸡？淋王星女主持周阴中在线问答up主》（-俏婆娘-）';
const SRC_FYT = 'B站《周阴婷de眼泪》重播 罗玉凤与周阴婷开撕淋淋（阴TV）';
const SRC_LX = 'B站《【淋形针LinerClip】如何快速掌握淋语》（阴TV）';
const SRC_LM = 'B站《(入门级淋语)Look What You Made Me Do 淋语中字》（Olivia字幕咕）';
const SRC_BB = 'B站《【βeaβLock】#6：新地图新街道新顾客旧女人》';
const SRC_YY = 'B站《人人都爱听阴 语 歌》';
const SRC_FJ = 'B站《【富江辣辣】gulpgulpgulp》';
const SRC_BG = 'B站《【杯糕姐】盘点各种音效出处（1）》';

const CARDS = [
  {
    term: '引茎据典',
    type: 'meme',
    meaning:
      '「引经据典」的淋语谐音版，把「经」换成「茎」。B 站《【杯糕姐】盘点各种音效出处（1）》评论区有网友直接用「引茎据典[喜欢]」回复，是「成语换偏旁」这套淋语构词法的样本。',
    example: '引茎据典[喜欢]',
    source: SRC_BG + '评论（作者：Record-CL音樂診療室）',
    verify: BV_BG,
    aliases: ['引茎据典', '引经据典（淋语版）'],
  },
  {
    term: '珍素努力',
    type: 'meme',
    meaning:
      '「真素努力」的叠字加强写法：「真」谐音「珍」，「素」是淋语里「是/真」的固定写法。B 站《(入门级淋语)Look What You Made Me Do 淋语中字》评论区连续出现两条同款。',
    example: '吸吸，解解珍素努力噜。／姐姐珍素努力惹',
    source: SRC_LM + '评论（作者：可人噜、CarmenKass媛媛仙女）',
    verify: BV_LM,
    aliases: ['珍素努力', '真素努力（淋语版）'],
  },
  {
    term: '赛淋',
    type: 'meme',
    meaning:
      '仿「赛博朋克」的「赛XX」句式，XX 换成圈层自称或标签，等于「最X」。和「淋味」是同一句里成对出现的两个自造词。',
    example: '赛淋真的是这么多游戏里淋味最强的噜',
    source: SRC_BB + '评论（作者：深度灰黑）',
    verify: BV_BB,
    aliases: ['赛淋', '赛XX'],
  },
  {
    term: '淋味',
    type: 'meme',
    meaning:
      '把「味道」和圈层自称拼在一起，指「淋味最重」，可量化、可比较，用来给不同作品或主播排座次。',
    example: '赛淋真的是这么多游戏里淋味最强的噜',
    source: SRC_BB + '评论（作者：深度灰黑）',
    verify: BV_BB,
    aliases: ['淋味', '淋味最重'],
  },
  {
    term: '柱厚',
    type: 'slang',
    meaning:
      '「主播」的淋语谐音（厚→播）。骂人时的加强说法「狗表柱厚」，前缀「狗表」是淋语里给主播/黑粉的贬称。',
    example: '猪头凤都被封杀惹还敢出来蹭热度 真素个不折不扣的狗表柱厚',
    source: SRC_FYT + '评论（作者：我要睡一天了）',
    verify: BV_FYT,
    aliases: ['柱厚', '主播（淋语版）', '狗表柱厚'],
  },
  {
    term: '猪头凤',
    type: 'slang',
    meaning:
      '罗玉凤（凤姐）的圈内绰号，「猪头」是淋语里给「头」加前缀的造词法；同一场景里她也被叫「凤凤」。',
    example: '猪头凤都被封杀惹还敢出来蹭热度 真素个不折不扣的狗表柱厚',
    source: SRC_FYT + '评论（作者：我要睡一天了）',
    verify: BV_FYT,
    aliases: ['猪头凤', '凤凤'],
  },
  {
    term: '小阴',
    type: 'slang',
    meaning:
      '周阴婷（阴中）的圈内简称，常与「凤凤」（罗玉凤）对仗出现，是辨析这一组叫法的直接证据。',
    example: '我觉得凤凤和小阴应该角色换一下，凤凤更能掌握情绪变化惹',
    source: SRC_FYT + '评论（作者：刚学会铁砂掌的斐雯）',
    verify: BV_FYT,
    aliases: ['小阴', '阴中'],
  },
  {
    term: '杯糕',
    type: 'meme',
    meaning:
      '「抱歉」的淋语谐音，是淋语里最常用的谐音梗之一，还能当动词用：「杯糕化」＝「抱歉化成」。圈内有名的「杯糕姐」即由此而来。',
    example: '国外网友真的把好多经典都杯糕化了[喜欢]。／每次看到杯糕视频都笑得想死又没朋友可以分享',
    source: SRC_YY + '评论（作者：卫星露天咖啡屋、年度爱用捏麻薯）',
    verify: BV_YY,
    aliases: ['杯糕', '抱歉（淋语版）', '杯糕姐'],
  },
];

const QUOTES = [
  {
    text: '我要淋明杀鸡啊啊啊啊啊啊啊',
    author: '',
    hero: '周阴婷',
    src: SRC_Q + '弹幕',
    verify: BV_Q,
  },
  {
    text: '淋明杀鸡都这样啦',
    author: '',
    hero: '周阴婷',
    src: SRC_Q + '弹幕',
    verify: BV_Q,
  },
  {
    text:
      '素这样惹 因为受众群体不多收益也很低 up们基本都是带着热爱在做吧',
    author: '',
    hero: '周阴婷',
    src: SRC_Q + '评论',
    verify: BV_Q,
  },
  {
    text: '猪头凤都被封杀惹还敢出来蹭热度 真素个不折不扣的狗表柱厚',
    author: '我要睡一天了',
    hero: '罗玉凤',
    src: SRC_FYT + '评论',
    verify: BV_FYT,
  },
  {
    text: '我觉得凤凤和小阴应该角色换一下，凤凤更能掌握情绪变化惹',
    author: '刚学会铁砂掌的斐雯',
    hero: '周阴婷',
    src: SRC_FYT + '评论',
    verify: BV_FYT,
  },
  {
    text:
      '惹，第一次给这样的大制作配阴厚，希望各位解解不要手下留情，给我很多很好的评价厚，嘻嘻，我先补个唇蜜噜',
    author: '掐碎他的蛋',
    hero: '周阴婷',
    src: SRC_LX + '评论',
    verify: BV_LX,
  },
  {
    text:
      '我不能接受惹，“厚”明明可以用在句尾，讲解时居然只放在了句首，真素不够本质噜',
    author: '我家大王都是gay',
    hero: '周阴婷',
    src: SRC_LX + '评论',
    verify: BV_LX,
  },
  {
    text: '吸吸，解解珍素努力噜',
    author: '可人噜',
    hero: '',
    src: SRC_LM + '评论',
    verify: BV_LM,
  },
  {
    text: '姐姐珍素努力惹',
    author: 'CarmenKass媛媛仙女',
    hero: '',
    src: SRC_LM + '评论',
    verify: BV_LM,
  },
  {
    text: '赛淋真的是这么多游戏里淋味最强的噜',
    author: '深度灰黑',
    hero: '',
    src: SRC_BB + '评论',
    verify: BV_BB,
  },
  {
    text: '本可岁月静好',
    author: '',
    hero: '',
    src: 'B站《【淋明杀机】苍蝇妹大闹冻肉加工厂》弹幕',
    verify: BV_CY,
  },
  {
    text: '国外网友真的把好多经典都杯糕化了[喜欢]',
    author: '卫星露天咖啡屋',
    hero: '',
    src: SRC_YY + '评论',
    verify: BV_YY,
  },
  {
    text: '每次看到杯糕视频都笑得想死又没朋友可以分享',
    author: '年度爱用捏麻薯',
    hero: '',
    src: SRC_YY + '评论',
    verify: BV_YY,
  },
  {
    text:
      '杯糕姐来反对了 i really honor god so Sunday i let you rest 杯糕姐不会支持这个标注亵渎主的靴靴',
    author: '润沐',
    hero: '杯糕姐',
    src: SRC_FJ + '评论',
    verify: BV_FJ,
  },
  {
    text: '引茎据典[喜欢]',
    author: 'Record-CL音樂診療室',
    hero: '杯糕姐',
    src: SRC_BG + '评论',
    verify: BV_BG,
  },
];

const HEROES = [
  {
    name: '杯糕姐',
    alias: '杯糕姐 / 杯糕',
    img: 'img/hero-228.png',
    group: 'up',
    rank: '淋语UP主 · 谐音梗',
    intro:
      'B 站淋语区 UP 主，「杯糕」（抱歉的谐音）一词的圈内代表人物。2026-10-07 发布《【杯糕姐】盘点各种音效出处（1）》。',
    tags: ['淋语UP主', '杯糕', '谐音梗'],
    baike:
      '杯糕姐，B 站淋语区 UP 主。名字来自淋语最常见的谐音梗之一「杯糕」＝「抱歉」。她的视频以盘点各类音效出处为主，评论区大量使用「引茎据典」「杯糕化」这类同套谐音构词法，因此「杯糕姐」也成了这个谐音梗在圈内的代名词——B 站《【富江辣辣】gulpgulpgulp》评论区就有网友写「杯糕姐不会支持这个标注亵渎主的靴靴」。',
    works: ['《【杯糕姐】盘点各种音效出处（1）》', '杯糕', '引茎据典'],
    words: ['杯糕', '引茎据典'],
    links: [
      {
        label: 'B 站《【杯糕姐】盘点各种音效出处（1）》',
        url: BV_BG,
      },
      {
        label: '配图来源（B 站视频封面）：《【杯糕姐】盘点各种音效出处（1）》封面',
        url: BV_BG,
      },
    ],
  },
  {
    name: '淋形针LinerClip',
    alias: '淋形针 / LinerClip / 淋形针LinerClip',
    img: 'img/hero-229.png',
    group: 'up',
    rank: '淋语UP主 · 教程',
    intro:
      'B 站淋语教程类节目，仿「回形针 PaperClip」的形式，2021-03-30 发布《【淋形针LinerClip】如何快速掌握淋语》。',
    tags: ['淋语UP主', '教程', '淋形针'],
    baike:
      '淋形针 LinerClip，B 站的淋语教程类节目，节目形式仿自「回形针 PaperClip」——后者在视频里只念「回形针」而不出现「PaperClip」，「淋形针」则是只念「淋形针」而不出现「LinerClip」。视频内容是系统讲淋语怎么用，评论区因此成了句式的活样本：有人吐槽「“厚”明明可以用在句尾，讲解时居然只放在了句首，真素不够本质噜」，也有人顺着教程的用词接梗「给我很多很好的评价厚，嘻嘻，我先补个唇蜜噜」。',
    works: ['《【淋形针LinerClip】如何快速掌握淋语》', '厚', '素'],
    words: ['厚', '素'],
    links: [
      {
        label: 'B 站《【淋形针LinerClip】如何快速掌握淋语》',
        url: BV_LX,
      },
      {
        label: '配图来源（B 站视频封面）：《【淋形针LinerClip】如何快速掌握淋语》封面',
        url: BV_LX,
      },
    ],
  },
];

module.exports = { CARDS, QUOTES, HEROES };
