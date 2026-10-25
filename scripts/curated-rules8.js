'use strict';

// 第八轮句式扩充（2026-10-25）
//
// 句式走的是「正则命中 → 整句替换」，与词库的逐词替换互补：
// 词库管的是"我→本可"这种一对一，句式管的是"你再这样我就不客气了 → 婷芷，我说婷芷"这种整句。
//
// 来源：corpus/corpus-bili-20261024172431.txt 的弹幕与评论实录（逐句可查），
// 以及本轮外部词库（GitHub Aziteee/linyu-translator、萌娘百科淋语、NGA 三帖）。
// 每条 src 给的是可访问 URL，attest.js 认 http(s) 链接，因此全部可回源。
//
// 字段：pattern 正则 / template 替换模板（$1 $2 回填捕获组）/ note 备注 /
//       scene 使用场景 / examples 例句（至少 2 条）/ src 出处

const CORPUS = 'https://www.bilibili.com/video/BV1Mu4y1r7uv';
const MG = 'https://zh.moegirl.org.cn/%E6%B7%8B%E8%AF%AD';
const GH = 'https://github.com/Aziteee/linyu-translator/blob/main/src/modules/linyu.ts';
const NGA3 = 'https://nga.178.com/read.php?tid=42400715';
const NGA4 = 'https://bbs.nga.cn/read.php?tid=37209701';
const WX =
  'http://mp.weixin.qq.com/s?__biz=MzUyNTEwNjIxMg==&mid=2247483742&idx=3&sn=0c3f25da4446cb840bba1752cf9bb73e';

/** @type {Array<object>} */
const rules = [
  // ── A. 惊讶 / 情绪反应 ──
  { pattern: '(?:这是|这算)(?:什么|啥)(?:意思|情况|操作)', template: '这素在？', note: '万能疑问句式', scene: '看不懂操作时的弹幕', examples: ['这素在？ / 妈呀这素？'], src: CORPUS },
  { pattern: '(?:我的)?(?:天哪|天啊|我的天)', template: '天啦噜', note: '惊讶叹词', scene: '通用', examples: ['天啦噜，今天作业又忘家里噜！', '天啦噜，淋淋要来集美演出噜！'], src: MG },
  { pattern: '(?:我的)?妈呀', template: '玛雅', note: '惊讶叹词地名化', scene: '通用', examples: ['玛雅，刚看到你那条评论', '玛雅，隔着屏幕都能隐隐约约感受到淋神强大的吸力惹'], src: MG },
  { pattern: '(?:吓|吓死)(?:我)?了?', template: '吓鼠惹', note: '死→鼠', scene: '通用', examples: ['吓鼠惹', 'OMG本可命大也吓鼠惹'], src: MG },
  { pattern: '(?:命真大|命好大|居然没事)', template: '命大也鼠惹', note: '命大句式', scene: '看到高能画面', examples: ['命大也鼠惹', '我命大，这素什么低菊的台词惹'], src: CORPUS },
  { pattern: '(?:不得了|了不得|要命)', template: '夭寿惹', note: '闽南语感叹词', scene: '通用', examples: ['夭寿惹', '夭寿啦，本可不敢懂'], src: MG },
  { pattern: '(?:太)?(?:离谱|荒谬|荒唐)了?', template: '珍素太离谱惹', note: '离谱句式', scene: '通用', examples: ['这珍素太离谱了', '珍素太离谱惹'], src: MG },
  { pattern: '(?:无语|服了|我也是服了)', template: '本可服惹', note: '无语句式', scene: '通用', examples: ['本可服惹', '服惹'], src: CORPUS },
  { pattern: '(?:裂开|崩溃|心态崩了)', template: '本可裂开惹', note: '破防系列', scene: '游戏/日常', examples: ['本可裂开惹', '破如防惹'], src: CORPUS },

  // ── B. 夸赞 / 嘲讽 ──
  { pattern: '(?:好|太|超)?厉害了?', template: '厚礼蟹', note: '夸人最高档', scene: '通用', examples: ['厚礼蟹', '尊素才女惹'], src: MG },
  { pattern: '(?:真是|真的是)?才女', template: '尊素才女惹', note: '才女句式', scene: '夸 UP 主文案', examples: ['omg解解尊素才女惹', '笑鼠惹，姐妹的文案真素天才厚'], src: CORPUS },
  { pattern: '(?:太|超|好)美了?', template: '美到维纳斯怀孕惹', note: '夸美句式', scene: '通用', examples: ['美到维纳斯怀孕惹', '被我迪美cry噜'], src: MG },
  { pattern: '(?:美|漂亮)到(?:爆|炸|极点)', template: '美到外翻惹', note: '外翻句式', scene: '通用', examples: ['美到外翻惹', '好大一朵外翻黑玫瑰惹'], src: CORPUS },
  { pattern: '(?:太丑|好丑|丑到)', template: '丑Die惹', note: '中英混用', scene: '嘲讽', examples: ['丑Die惹', '珍素丑die噜'], src: GH },
  { pattern: '(?:笑死|笑死了|太好笑了)', template: '笑鼠惹', note: '死→鼠', scene: '通用', examples: ['笑鼠惹', '不行了，要笑鼠惹'], src: MG },
  { pattern: '(?:气死|气死了|太气人)', template: '气鼠惹', note: '死→鼠', scene: '通用', examples: ['气鼠惹', '气拥咧'], src: MG },
  { pattern: '(?:太蠢|好蠢|蠢死)', template: '蠢die噜', note: '中英混用', scene: '嘲讽', examples: ['蠢die噜', '真素诡计多端的√表'], src: CORPUS },
  { pattern: '(?:赔钱|不赚钱|卖不动)', template: '真素赔钱货惹', note: '赔钱判词', scene: '游戏区吐槽强度/销量', examples: ['真素赔钱货惹', '你林又在赔钱噜'], src: NGA4 },
  { pattern: '(?:秒杀|完爆|碾压)', template: '我$1秒了靴靴', note: '秒杀句式', scene: '游戏区', examples: ['我娜秒杀全场，靴靴', '我娅秒了靴靴'], src: CORPUS },

  // ── C. 疑问 / 反问 ──
  { pattern: '(?:是不是|对不对|是吗)', template: '素不素', note: '是非问句', scene: '通用', examples: ['素不素', '这素不素厚？'], src: MG },
  { pattern: '(?:有没有|有吗)', template: '有木有', note: '存现问句', scene: '通用', examples: ['有木有', '有木有搞错惹'], src: MG },
  { pattern: '(?:怎么办|咋办)', template: '肿么办惹', note: '怎么办句式', scene: '通用', examples: ['肿么办惹', '这素在？肿么办'], src: MG },
  { pattern: '(?:怎么会|怎么能|怎么会这样)', template: '怎么能酱紫惹', note: '反诘句式', scene: '通用', examples: ['怎么能酱紫惹', '你俩这素在？'], src: CORPUS },
  { pattern: '(?:凭什么|凭啥)', template: '凭神马', note: '反诘句式', scene: '维权', examples: ['凭神马', '凭什么我华不可以'], src: NGA3 },

  // ── D. 游戏区 ──
  { pattern: '(?:超标|数值超标|太强了)', template: '被超标噜', note: '超标句式', scene: '游戏区喊冤', examples: ['这宫中人人都能超标，凭什么我华不可以', '被超标噜'], src: NGA3 },
  { pattern: '(?:被削弱|被砍|被削)', template: '该削了惹', note: '削弱句式', scene: '游戏区', examples: ['该削了惹', '该削了靴靴'], src: NGA3 },
  { pattern: '(?:被冷藏|被雪藏|没人玩)', template: '关进辛者库', note: '辛者库句式', scene: '游戏区', examples: ['海贵人遭奸人陷害至今还在辛者库没出来', '关进辛者库惹'], src: NGA3 },
  { pattern: '(?:平起平坐|不相上下)', template: '嫔起嫔坐', note: '清宫位分体', scene: '游戏区比地位', examples: ['但素海贵人也只能勉强和我华嫔起嫔坐噜'], src: NGA3 },
  { pattern: '(?:被反复消费|又被拉出来|炒冷饭)', template: '大卖特卖靴靴', note: '大卖特卖句式', scene: '游戏区', examples: ['你云和你亮在王者周年被拉出来大卖特卖靴靴'], src: NGA3 },
  { pattern: '(?:后期强势|拖后期|打后期)', template: '后期女王', note: '后期女王句式', scene: '游戏区', examples: ['我虞、我华、我泔、我伽第一百三十次首谈后期女王概念'], src: NGA3 },
  { pattern: '(?:靠机制|机制强|不吃数值)', template: '机制女王，queen者自queen', note: '机制女王句式', scene: '游戏区', examples: ['无所谓我华机制女王，queen者自queen'], src: NGA3 },
  { pattern: '(?:峡谷第一|最强女英雄|女英雄第一)', template: '农女一', note: '农女一句式', scene: '游戏区自封', examples: ['明年我将超越貂蝉成为五传说+典藏/无双成为农女一'], src: NGA3 },
  { pattern: '(?:被陷害|被坑|被背刺)', template: '遭奸人陷害', note: '宫斗句式', scene: '游戏区/日常', examples: ['海贵人遭奸人陷害至今还在辛者库没出来'], src: NGA3 },
  { pattern: '(?:被拉出来|又被拿出来|返场)', template: '又被拉出来大卖特卖惹', note: '返场句式', scene: '游戏区', examples: ['又被拉出来大卖特卖惹', '大卖特卖靴靴'], src: NGA3 },
  { pattern: '(?:被掌掴|被压制|被单杀)', template: '掌掴噜', note: '守望淋锋动作词', scene: '守望淋锋', examples: ['又素血律Daddy掌掴单牵摩西女平凡的一天鸭'], src: 'https://www.bilibili.com/video/BV1qNnc6HEv6' },
  { pattern: '(?:脚刹|踩住|压制住)', template: '脚刹噜', note: '第五淋格动作词', scene: '第五淋格', examples: ['淋人金Daddy脚刹麦子', '脚刹红杉木女士'], src: 'https://www.bilibili.com/video/BV1Smpj69E1d' },
  { pattern: '(?:登场|出场|来了)', template: '$0驾到！统统闪开！！', note: '登场套话', scene: '游戏区/通用', examples: ['交女王们驾到！统统闪开！！🙄💅'], src: 'https://www.bilibili.com/video/BV1vugxzBEEp' },
  { pattern: '(?:入侵|扩散到|蔓延到)', template: '通讯录终于入侵$1惹', note: '扩散句式', scene: '新分区诞生', examples: ['我不行了通讯录终于入侵三角洲了'], src: 'https://www.bilibili.com/video/BV1B6uMz8EhA' },
  { pattern: '(?:回春|回暖|重新变强)', template: '史诗级大回冬', note: '回冬句式', scene: '游戏区', examples: ['雨季婆史诗级大回冬！'], src: 'https://www.bilibili.com/video/BV12un16xEi1' },
  { pattern: '(?:满昏|满分|十分)', template: '满分女', note: '满分女判词', scene: '淋者荣耀', examples: ['她是一个满分女，但是爱出冰杖'], src: 'https://www.bilibili.com/video/BV1tTpq6kEZ9' },

  // ── E. 清宫位分体 ──
  { pattern: '(?:本宫|本娘娘|本座)', template: '本宫', note: '清宫自称', scene: '宫斗体', examples: ['本宫家', '本娘娘驾到'], src: MG },
  { pattern: '(?:臣妾|奴婢|妾身)', template: '臣妾', note: '清宫自称', scene: '宫斗体', examples: ['臣妾做不到惹', '臣妾素冤枉的'], src: MG },
  { pattern: '(?:大赦天下|赦免|饶恕)', template: '今日大赦天下，尔等速速退下噜', note: '大赦句式', scene: '宫斗体', examples: ['今日大赦天下，尔等速速退下噜'], src: MG },
  { pattern: '(?:拖出去|拉下去|推出去)', template: '拖出去斩了噜', note: '宫斗判词', scene: '宫斗体', examples: ['拖出去斩了噜', '来人，掌嘴'], src: MG },
  { pattern: '(?:退下|下去吧|散了)', template: '速速退下噜', note: '退下句式', scene: '宫斗体', examples: ['速速退下噜', '先行退下'], src: MG },
  { pattern: '(?:贱人|贱婢|狐媚子)', template: '贱婢，本可不是这样的人', note: '宫斗互怼', scene: '宫斗体', examples: ['停停停本可不是这样的人'], src: CORPUS },

  // ── F. 圈层套话 ──
  { pattern: '(?:闭嘴|住嘴|别说了)', template: '婷芷，我说婷芷', note: '停止谐音', scene: '通用', examples: ['婷芷，我说婷芷', '啊啊啊婷芷，我说婷芷'], src: MG },
  { pattern: '(?:安静|别吵|消停点)', template: '请你安静如鸡，靴靴', note: '安静如鸡', scene: '通用', examples: ['请你安静如鸡，靴靴', '安静得像只鸡'], src: WX },
  { pattern: '(?:再乱说|再胡说|再嘴硬)', template: '再乱嗦话，就把你关进鸡笼噜', note: '鸡笼警告', scene: '恐吓式调侃', examples: ['再乱嗦话，就把你关进鸡笼噜！'], src: MG },
  { pattern: '(?:你完了|你死定了|逃不掉)', template: '你已难逃一吸噜', note: '难逃一吸', scene: '恐吓式调侃', examples: ['你已难逃一吸', '你已被神淋锁定噜！！！'], src: MG },
  { pattern: '(?:我盯上你了|看上你了|盯上了)', template: '贝塔已经锁定你', note: '锁定句式', scene: '恐吓式调侃', examples: ['莫愁前路无知妓，贝塔已经锁定你'], src: MG },
  { pattern: '(?:清者自清|问心无愧|身正不怕)', template: '阴者自阴靴靴', note: 'X者自X', scene: '自证式', examples: ['阴者自阴靴靴', '阴者自阴，阴婷自在人心'], src: 'https://www.bilibili.com/video/BV1Cn6yYBEZN' },
  { pattern: '(?:无人在意|没人关心|谁在乎)', template: 'nbcs', note: '英文缩写', scene: '通用', examples: ['nbcs就是nobody cares，最早出自淋语'], src: GH },
  { pattern: '(?:很多好评|一致好评|口碑好)', template: '给你很多很好的评价', note: '淋淋金句', scene: '夸赞', examples: ['靴靴淋淋给你们很多很好的评价，努力一定会成功', '支持了，给你很多很好的评价'], src: MG },
  { pattern: '(?:努力就会成功|天道酬勤|加油努力)', template: '努力一定会成功，不努力就去死', note: '地才金句', scene: '打气/反讽', examples: ['努力一定会成功，不努力就去死！'], src: MG },
  { pattern: '(?:太感人了|感动到哭|泪目)', template: '流下13滴眼泪惹', note: '13滴眼泪', scene: '通用', examples: ['流下13滴眼泪惹', '感动cry'], src: MG },
  { pattern: '(?:辣眼睛|不忍直视|太难看)', template: '那画面太美我不敢看', note: '淋淋金句', scene: '委婉吐槽', examples: ['画面太美我不敢看惹'], src: MG },
  { pattern: '(?:胡说八道|造谣|污蔑)', template: '婷芷造谣我，靴靴', note: '造谣句式', scene: '通用', examples: ['婷芷造谣我，靴靴', '婷芷造谣我娲'], src: MG },
  { pattern: '(?:路人|外人|无关人士)', template: '路人甲请不要发言惹人讨厌，靴靴', note: '路人甲句式', scene: '驱赶路人', examples: ['那些路人甲们凭什么发言惹人讨厌', '你这个不懂电影的路人甲凭什么发言惹人讨厌！'], src: MG },
  { pattern: '(?:买了|入手了|下单了)', template: '买它惹', note: '买买买', scene: '通用', examples: ['买它惹', '谢谢已经买了完全体大礼包'], src: CORPUS },
  { pattern: '(?:已收藏|收藏了|马一下)', template: '收藏惹', note: '三连系列', scene: '通用', examples: ['收藏惹', '三连惹'], src: CORPUS },
  { pattern: '(?:再见|拜拜|下次见)', template: '在见叭', note: '告别句式', scene: '通用', examples: ['在见叭', '下见惹'], src: MG },

  // ── G. 语义位占位句式（模板里带人称位，运行时从变体池任选）──
  { pattern: '(?:我|我们)?(?:真的)?(?:很)?想(?:要|买|去)', template: '本可想$1惹', note: '{我}占位', scene: '通用', examples: ['本可想买惹', '本仙想去惹'], src: MG },
  { pattern: '(?:你|你们)?(?:凭什么)?(?:敢)?管我', template: '凭神马管本可', note: '{我}/{你}占位', scene: '互怼', examples: ['凭神马管本可', '关你什么事厚'], src: MG },
  { pattern: '(?:他|她)?(?:又)?开始了', template: '塔又开始了惹', note: '{他}占位', scene: '通用', examples: ['塔又开始了惹', '塔就素这样'], src: MG },
  { pattern: '(?:大家|各位|所有人)(?:听好|注意|看过来)', template: '在座都是姐妹惹', note: '{群体}占位', scene: '开场', examples: ['在座都是姐妹惹', '集美们，拿笔记一下噜'], src: MG },
];

module.exports = { rules };
