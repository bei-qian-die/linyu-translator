'use strict';

// 语义位体系（slot taxonomy）—— 第十三轮
//
// 本文件只做一件事：定义「什么算合法的 slot 名」，供 curated-slots13.js / apply-slots13.js 校验用。
// key 一律沿用 seed.json 里已经存在的写法（40 个），本轮为补齐 465 条无 slot 的基础词，
// 另加 14 个新语义位（marked isNew:true）。合计 54 个 key。
//
// 约定：
//   - seed.json 里 slot 允许多值，用「/」分隔（例："基础谐音替换/程度副词"），与既有写法一致；
//     db.js 的 backfillWordMeta 也是按 /[、,，\/]/ 拆分后再 join(' / ') 合并的。
//   - examples 必须是真的在 seed.json（zh / linyu / alias）或 corpus/*.txt 里逐字可查的淋语词，
//     由 scripts/freq-slots13.js 的词频口径（忽略空白/标点/大小写）核对过；查不到的一律不写进 examples。
//   - desc 只描述语义位，不对具体词条下结论。
const TAXONOMY = [
  // ======== 既有 40 个（沿用，不改名）========
  {
    key: '第一人称自称',
    desc: '“我”的所有自称变体：本可系、本仙女系、自嘲系、宫斗系。',
    examples: ['本可', '本仙女', '本猪妞', '本宫'],
  },
  {
    key: '第二人称',
    desc: '称呼对方的说法，含“你+角色淋名”的主语式。',
    examples: ['小仙女', '你心', '你华'],
  },
  {
    key: '第三人称',
    desc: '“他/她/它”及远指代词。',
    examples: ['塔', '那银'],
  },
  {
    key: '群体自称',
    desc: '“我们/咱们”的复数自称。',
    examples: ['俺们仙女', '家人萌', '宝子萌'],
  },
  {
    key: '群体称呼',
    desc: '对听众/受众的复数称呼，开场白高频。',
    examples: ['仙女们', '集美们', '大银们'],
  },
  {
    key: '称呼类',
    desc: '亲属、同伴、身份称谓的淋语写法。',
    examples: ['解解', '麻麻', '集美', '婊贝'],
  },
  {
    key: '程度',
    desc: '程度副词及其谐音变体（很/太/非常/真/好），本轮从“只覆盖 很→超 等少数词”扩到全部程度词。',
    examples: ['超', '炒鸡', '淘', '珍'],
    isNew: false,
  },
  {
    key: '逻辑虚词',
    desc: '转折/因果/假设/结果等虚词的谐音写法，不成词只改拼写。',
    examples: ['氮素', '阴为', '如锅', '结锅'],
    isNew: true,
  },
  {
    key: '基础谐音替换',
    desc: '淋语最底层的拼写层：只换声母或韵母的单字/短词谐音，不是独立词汇。',
    examples: ['滴', '珍', '吼', '银'],
    isNew: true,
  },
  {
    key: '黏着语气词',
    desc: '句尾/词尾黏着的语气后缀（惹/噜/厚/靴/素/熏）以及由它们构成的整词。',
    examples: ['惹', '噜', '丸辣', '天呐噜'],
    isNew: true,
  },
  {
    key: '称呼后缀',
    desc: '接在称呼或代词后的复数/昵称后缀：们→萌、儿、酱、哒。',
    examples: ['家人萌', '宝子萌', '本可儿', '美美们'],
    isNew: true,
  },
  {
    key: '语气词',
    desc: '单个语气助词的淋语写法。',
    examples: ['惹', '噜', '叭', '捏'],
  },
  {
    key: '疑问',
    desc: '疑问代词与疑问句式。',
    examples: ['神马', '为神马', '尊嘟假嘟'],
  },
  {
    key: '否定',
    desc: '否定式与“不知道/没有”类。',
    examples: ['不素', '木冇', '母鸡'],
  },
  {
    key: '认同',
    desc: '肯定、应答、附和。',
    examples: ['素', '尊素', '好滴'],
  },
  {
    key: '惊讶',
    desc: '吃惊、破防、喊救命的叹语。',
    examples: ['天啦噜', '玛雅', '夭寿惹'],
  },
  {
    key: '情绪',
    desc: '喜怒哀乐的形容与状态词。',
    examples: ['喜翻', '开熏', '笑鼠'],
  },
  {
    key: '撒娇亲昵',
    desc: '亲昵、卖萌、抱抱亲亲一类的撒娇表达。',
    examples: ['么么', '啾咪', '吸吸', '阔爱'],
    isNew: true,
  },
  {
    key: '评价判断',
    desc: '对人作品的褒贬判词（厉害/低级/无语/绝了/超标）。',
    examples: ['厉海', '低菊', '崆峒', '绝惹'],
    isNew: true,
  },
  {
    key: '调侃',
    desc: '逗趣、反串、阴阳的玩笑表达。',
    examples: ['靴靴', '婷芷', '吸吸'],
  },
  {
    key: '戏谑',
    desc: '比调侃更损的嘲弄、贬称。',
    examples: ['鼠了', '衮', '赔钱货'],
  },
  {
    key: '贬义',
    desc: '明确骂人、嫌弃的说法。',
    examples: ['洗脚婢', '衮'],
  },
  {
    key: '告别',
    desc: '收场、退场、再见的说法。',
    examples: ['在见叭', 'bye噜', '溜了'],
  },
  {
    key: '催促',
    desc: '催更、快点、加油一类。',
    examples: ['家由', '搞快点', '速速'],
  },
  {
    key: '祈使',
    desc: '命令式句子。',
    examples: ['婷芷，我说婷芷'],
  },
  {
    key: '圈层黑话',
    desc: '只有淋语圈看得懂的专名、地名、梗名。',
    examples: ['淋王星', '地才', 'nbcs', '摸仙堡'],
  },
  {
    key: '构词法',
    desc: '可产性的造词规则本身（字替换、后缀黏着、中英混写）。',
    examples: ['素', '淋听', '阴到', '柱'],
  },
  {
    key: '同形异义',
    desc: '同一个淋语写法在不同分区指不同对象。',
    examples: ['我狸（英雄淋盟）', '我狸（淋神）'],
  },
  {
    key: '审美',
    desc: '性向与审美取向的黑话。',
    examples: ['白袜', '体育生', 'U熊'],
  },
  {
    key: '文化',
    desc: '身份、出柜、彩虹等圈层文化词。',
    examples: ['通讯录', '出柜', '彩虹'],
  },
  {
    key: '人物',
    desc: '真实人物/人设的淋语称呼。',
    examples: ['淋淋', '周阴婷', '那艺娜'],
  },
  {
    key: '自称',
    desc: '通用“仙女/本人”式自称（早期条目，与第一人称自称同族）。',
    examples: ['仙女'],
  },
  {
    key: '分区',
    desc: '淋语化地名/关卡/版本分区名。',
    examples: ['淋月峡谷', '淋安京', '三角淋行动'],
  },
  {
    key: '宫斗体',
    desc: '甄嬛传/清宫位分体系的称谓、台词与刑罚，用作身份戏仿。',
    examples: ['臣妾', '嫔起嫔坐', '冷宫', '掌嘴'],
    isNew: true,
  },
  {
    key: '英文谐音',
    desc: '英文词的空耳写法，或中文词套英文句式。',
    examples: ['婊贝', '喜翻', '奈斯', '欧米伽'],
    isNew: true,
  },
  {
    key: '字母缩写',
    desc: '拼音/英文首字母缩写构成的黑话。',
    examples: ['nbcs', 'xswl', 'xdm', 'T0'],
    isNew: true,
  },
  {
    key: '游戏术语',
    desc: '玩法、机制、强度判词等跨分区的通用游戏词（具体分区另挂分区 key）。',
    examples: ['阴雄', '破如防', '超标', '该削了'],
    isNew: true,
  },
  {
    key: '饭圈运营',
    desc: '打投、控评、站姐、毒唯等粉圈操作与身份词。',
    examples: ['黑子', 'flop', '阿婆主', '本质骑士'],
    isNew: true,
  },
  {
    key: '生活日常',
    desc: '吃穿住行、作息、校园、职场类日常词的淋语写法。',
    examples: ['乃茶', '尚班', '碗安', '靠试'],
    isNew: true,
  },
  {
    key: '歌舞影视',
    desc: '舞台、唱片、影视、配音相关的词。',
    examples: ['阴乐', '艳唱', '配阴', '开口跪'],
    isNew: true,
  },
  // ======== 游戏分区名（沿用既有 key）========
  { key: '英雄淋盟', desc: '《英雄联盟》分区的角色淋名。', examples: ['我狸', '蟑螂婆', '滚地婆'] },
  { key: '阴雄淋盟', desc: '“英雄联盟”整名的淋语写法（既有 key，本轮给整名条目复用）。', examples: ['阴雄淋盟'] },
  { key: '王者淋耀', desc: '《王者荣耀》整名与该分区角色淋名。', examples: ['王者淋耀', '拉客妹'] },
  { key: '淋者荣耀', desc: '“王者荣耀”的另一种既有写法（早期条目）。', examples: ['淋者荣耀'] },
  { key: '淋神', desc: '《原神》整名与该分区角色淋名。', examples: ['淋神', '炸弹婆'] },
  { key: '第五淋格', desc: '《第五人格》分区。', examples: ['第五淋格', '尖叫婆'] },
  { key: '街头霸淋', desc: '《街头霸王》分区。', examples: ['春淋女士', '我鬼'] },
  { key: '瓦罗淋特', desc: '《无畏契约》分区。', examples: ['为爱走钢索', '我梦'] },
  { key: '淋明杀鸡', desc: '《黎明杀机》分区。', examples: ['我珍', '我凤'] },
  { key: '洛克淋国', desc: '《洛克王国》分区。', examples: ['迪莫', '魔力猫'] },
  { key: '淋日方舟', desc: '《明日方舟》分区。', examples: ['阿米娅', '乌尔比安'] },
  { key: '绝区淋', desc: '《绝区零》分区。', examples: ['我薇'] },
  { key: '阴淋师', desc: '《阴阳师》分区。', examples: ['大天狗'] },
];

// key 去重自检：写重了立刻暴露，免得污染 seed
const seen = new Set();
for (const t of TAXONOMY) {
  if (seen.has(t.key)) throw new Error('slot-taxonomy13: 重复 key ' + t.key);
  seen.add(t.key);
  if (!t.desc || !Array.isArray(t.examples) || !t.examples.length)
    throw new Error('slot-taxonomy13: ' + t.key + ' 缺 desc/examples');
}

const KEYS = TAXONOMY.map((t) => t.key);
const NEW_KEYS = TAXONOMY.filter((t) => t.isNew).map((t) => t.key);

/** 'a/b' → ['a','b']，容忍空格与全角斜杠 */
const splitSlot = (s) =>
  String(s || '')
    .split(/[/／]/)
    .map((x) => x.trim())
    .filter(Boolean);

/** 校验一个（可能多值的）slot 串，返回非法 key 列表 */
const validateSlot = (s) => splitSlot(s).filter((k) => !seen.has(k));

module.exports = { TAXONOMY, KEYS, NEW_KEYS, splitSlot, validateSlot };
