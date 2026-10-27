'use strict';

// 第二十一轮策展源 · 守望淋锋（守望先锋）分区开区（人物传 + 词位译法合并 + 词卡 + 名言）
//
// 口径照抄 19/20 号：
//   - rank 一律「分区 · 位分」两段式
//   - baike 写清「本名 / 英文名 / 官方定位 / 淋名来源」，禁止模板尾句
//   - works 只放真实视频标题（UP 主）或真实官方/社区出处，不许拿别名当代表作
//   - img 由 scripts/fetch-hero-images21.js + apply-hero-images21.py 回填，这里留空
//   - 名言不手写：从 scripts/curated-quotes21.json 读（每条可回源）

const QUOTES = require('./curated-quotes21.json');

const BV = (id) => `https://www.bilibili.com/video/${id}`;
const BAIKE = (k) => `https://baike.baidu.com/item/${encodeURIComponent(k)}`;
const WIKI = (k) => 'https://overwatch.huijiwiki.com/wiki/' + encodeURIComponent(k);
const HERO_PAGE = 'https://ow.blizzard.cn/game/heroes/';

// 三个官方职责
const R_TC = '重装';
const R_SC = '输出';
const R_ZY = '支援';
const rankOf = (role) => `守望淋锋 · ${role}`;

// ---------------------------------------------------------------------------
// 一、英雄名册（54 位，按 2026 年 4 月官方名单）
// note 写真实设定与真实社区用法，不编设定。nick 与词库里的 linyu 严格一致。
// ---------------------------------------------------------------------------
const ROSTER = [
  // ===== 重装 15 =====
  { name: 'D.Va', en: 'D.Va / Hana Song', role: R_TC, sub: '斗士',
    note: '本名宋哈娜，前《星际争霸》职业选手，驾驶机甲 MEKA 作战；机甲爆掉后可以跳出来用手枪继续打，所以「核弹」既是她的大招也是她最出圈的梗。',
    nick: '宋哈娜、DVA、核弹、阿尼哟', nickSrc: '本区弹幕「我D」「你D」与英雄名梗「阿尼哟」', nickUrl: BV('BV1ys421K7Bh') },
  { name: '查莉娅', en: 'Zarya / Aleksandra Zaryanova', role: R_TC, sub: '铁壁',
    note: '俄罗斯举重运动员出身，粒子炮的护盾吸收的伤害越多，输出越高。她的盾分主盾（给自己）与副盾（给队友），报点必须区分。',
    nick: '毛妹、查莉雅、毛子、俄罗斯雨姐、主盾、副盾', nickSrc: '电玩帮外号盘点与 NGA 黑话帖「毛妹主盾副盾」', nickUrl: 'https://www.vgover.com/news/154735' },
  { name: '莱因哈特', en: 'Reinhardt Wilhelm', role: R_TC, sub: '铁壁',
    note: '十字军老兵，一把火箭重锤加一面屏障力场，是守望最经典的「举盾英雄」。冲锋把人顶到墙上是他最标志性的场面，也是「老汉推车」外号的来源。',
    nick: '大锤、王大锤、老汉推车、大锤哥', nickSrc: '电玩帮外号盘点「莱因哈特为什么叫大锤」', nickUrl: 'https://www.vgover.com/news/154735' },
  { name: '路霸', en: 'Roadhog / Mako Rutledge', role: R_TC, sub: '斗士',
    note: '废土拾荒者，链钩把人勾过来一枪带走，是守望最经典的抓人型重装。台服旧译「拦路猪」直接演化成外号「猪」。',
    nick: '猪、屠夫、胖子、猪头、拦路猪、钩子', nickSrc: '老玩家外号考据与台服旧译「拦路猪」', nickUrl: 'http://ow.replays.net/m/news/201606/845.html' },
  { name: '温斯顿', en: 'Winston', role: R_TC, sub: '先锋',
    note: '月球基地出身的基因改造大猩猩科学家，喷射背包进场、屏障发射器罩住队友，是守望最标准的「跳后排」重装。',
    nick: '猩猩、王师傅、罩子、跳', nickSrc: 'NGA 守望黑话昵称帖', nickUrl: 'https://bbs.nga.cn/read.php?tid=9339277' },
  { name: '奥丽莎', en: 'Orisa', role: R_TC, sub: '铁壁',
    note: '努巴尼的守护机器人，由小女孩伊菲设计。强固防御开启时全身泛金，玩家因此叫「金身」；外形加头顶弯角又被叫「美羊羊」。',
    nick: '美羊羊、金身', nickSrc: '什么值得买《守望先锋》英雄外号盘点', nickUrl: 'https://post.smzdm.com/p/apqpz4r0/' },
  { name: '破坏球', en: 'Wrecking Ball / Hammond', role: R_TC, sub: '先锋',
    note: '一只叫哈蒙德的仓鼠驾驶球形机甲，重力坠击砸地击飞，玩家把这一下叫「坐」或「下压」。',
    nick: '球、仓鼠、坐', nickSrc: 'B 站专栏《守望先锋小技能习惯用语指南》「球-重力坠击-坐」', nickUrl: 'https://www.bilibili.com/read/cv12440820/' },
  { name: '西格玛', en: 'Sigma / Siebren de Kuiper', role: R_TC, sub: '铁壁',
    note: '天体物理学家，能操控引力。普攻丢出的两颗球被玩家叫「核桃」，质量吸附的石头就叫「石头」，合起来是「核桃大爷」。',
    nick: '核桃大爷、核桃、石头', nickSrc: 'B 站专栏技能俗称表「西格玛-普攻-核桃 / 质量吸附-石头」', nickUrl: 'https://www.bilibili.com/read/cv12440820/' },
  { name: '渣客女王', en: 'Junker Queen / Odessa Stone', role: R_TC, sub: '斗士',
    note: '渣客镇的统治者，链锯斧加飞刀，靠吸血和流血打消耗。因为名字里带「女王」，在淋语区常和「女王」这个姐圈称谓叠用。',
    nick: '女王、渣客镇女王', nickSrc: '官网英雄介绍与姐圈「女王」称谓叠用', nickUrl: HERO_PAGE },
  { name: '拉玛刹', en: 'Ramattra', role: R_TC, sub: '铁壁',
    note: '智械僧侣出身，能在智械形态与报应形态之间切换。中文圈因为「拉玛刹」读音被叫「鲑鱼大帝」，也被叫「牢玛」。',
    nick: '鲑鱼大帝、牢玛', nickSrc: '中文社区谐音外号「鲑鱼大帝」，牢字辈来自「坐牢」', nickUrl: WIKI('拉玛刹') },
  { name: '毛加', en: 'Mauga', role: R_TC, sub: '斗士',
    note: '黑爪特工，双持燃火链式机枪，越打越猛。魁梧体型让他成为本区「体育生」「喜猪妹」弹幕的高频载体。',
    nick: '体育生、SSVGG', nickSrc: '本区弹幕与社区对其体型的调侃', nickUrl: BV('BV1qNnc6HEv6') },
  { name: '骇灾', en: 'Hazard', role: R_TC, sub: '先锋',
    note: '地下组织怪咖盟成员，用偷来的绿洲城科技作战，能坦能跑。因为技能组太全面，被玩家叫「三体人」（＝强度不像同一个维度的角色）。',
    nick: '三体人、哈扎德', nickSrc: '2026 赛季介绍与社区「三体人」强度梗', nickUrl: 'https://www.yxzzd.com/56183.html' },
  { name: '金驭', en: 'Jinwu', role: R_TC, sub: '铁壁',
    note: '2026 赛季加入的重装英雄，机械造物系设定，靠护盾与控制维持阵线。中文名「金驭」在社区尚未形成稳定外号。',
    nick: '金驭', nickSrc: '守望先锋中文维基英雄名单', nickUrl: WIKI('金驭') },
  { name: 'D.Mon', en: 'D.Mon / Yuna Lee', role: R_TC, sub: '斗士',
    note: 'MEKA 小队另一名驾驶员，与 D.Va 同属韩国机甲部队设定，2026 赛季进入正式英雄名单。',
    nick: 'D.Mon', nickSrc: '守望先锋中文维基英雄名单', nickUrl: WIKI('英雄') },
  { name: '末日铁拳', en: 'Doomfist / Akande Ogundimu', role: R_TC, sub: '斗士',
    note: '黑爪领袖，机械拳套一发火箭重拳能把人打飞。中文圈最有名的梗是「末日铁拳全曹飞」，也因此衍生出「铁拳转世」这种形容。',
    nick: '铁拳、铁拳转世', nickSrc: 'B 站专栏《守望先锋迷惑行为大全》「集火保人意识危，末日铁拳全曹飞」', nickUrl: 'https://www.bilibili.com/read/cv4001799/' },

  // ===== 输出 23 =====
  { name: '源氏', en: 'Genji Shimada', role: R_SC, sub: '奇袭',
    note: '岛田家的次子，被半藏重伤后改造成半机械忍者。大招台词「竜神の剣を喰らえ」被空耳成「有基佬拉我裤链」，是守望最出圈的空耳梗。',
    nick: '幼儿园、幼儿源、下忍、中忍、上忍、火影、根基、Genji、有基佬拉我裤链', nickSrc: 'NGA 黑话帖「幼儿源」与空耳「有基佬拉我裤链」', nickUrl: 'https://bbs.nga.cn/read.php?tid=9339277' },
  { name: '半藏', en: 'Hanzo Shimada', role: R_SC, sub: '神准',
    note: '岛田家长子，弓箭手。大招「龙魂」穿墙，语音「竜が我が敵を喰らう」也被空耳。源氏与半藏的组合在社区统称「岛田兄弟」。',
    nick: '半藏、忍者、岛田半藏', nickSrc: '官网英雄介绍与社区「岛田兄弟」说法', nickUrl: HERO_PAGE },
  { name: '死神', en: 'Reaper / Gabriel Reyes', role: R_SC, sub: '奇袭',
    note: '本名加布里埃尔·莱耶斯，守望先锋前指挥官，死后变成幽灵形态。本区把他的本名「莱耶斯」直接当外号用，还配了「食命必达」这种谐音。',
    nick: '活神、死神、莱耶斯、食命必达', nickSrc: '本区视频《食吧食吧！莱耶斯食命必达中》', nickUrl: BV('BV1QFWF61Eu8') },
  { name: '猎空', en: 'Tracer / Lena Oxton', role: R_SC, sub: '奇袭',
    note: '守望的封面人物，时间加速器让她能闪现回溯。台服旧译「闪光」，中文圈两种叫法并存。',
    nick: '闪光、猎空者', nickSrc: '台服旧译「闪光」与官方中文名对照', nickUrl: 'http://ow.replays.net/m/news/201606/845.html' },
  { name: '卡西迪', en: 'Cassidy / Cole Cassidy', role: R_SC, sub: '神准',
    note: '原名麦克雷（Jesse McCree），2021 年因暴雪内部事件改名卡西迪，但中文圈大多还是叫麦克雷、麦爹、麦卡利。',
    nick: '麦克雷、麦爹、麦卡利、牛仔、男枪、天王老子', nickSrc: '社区惯称与改名事件后的旧名沿用', nickUrl: WIKI('卡西迪') },
  { name: '狂鼠', en: 'Junkrat / Jamison Fawkes', role: R_SC, sub: '专业',
    note: '渣客镇的炸弹狂人，榴弹加捕兽夹，靠爆炸输出。中文圈因为外形和「老鼠」谐音被叫老鼠、黄鼠。',
    nick: '老鼠、黄鼠、炸弹人', nickSrc: '什么值得买外号盘点「狂鼠为什么叫老鼠」', nickUrl: 'https://post.smzdm.com/p/apqpz4r0/' },
  { name: '法老之鹰', en: 'Pharah / Fareeha Amari', role: R_SC, sub: '专业',
    note: '安娜的女儿，火箭发射器加喷射背包，是守望最经典的空中输出。打得好叫「法鸡」，飞不起来就叫「走地鸡」。',
    nick: '法鸡、法拉、法鹰', nickSrc: 'NGA 黑话帖「敌方法老之鹰，我方走地之鸡」', nickUrl: 'https://bbs.nga.cn/read.php?tid=9339277' },
  { name: '美', en: 'Mei / Mei-Ling Zhou', role: R_SC, sub: '专业',
    note: '本名周美灵，中国气候学家，冰墙加冰冻枪。急冻技能玩家叫「冰箱」，本区又把「美」当形容词用，于是有了「我美」「中国妹砸」「近战妈妈」这些叫法。',
    nick: '小美、麦克美、周美灵、中国妹砸、近战妈妈', nickSrc: 'B 站专栏技能俗称「小美-急冻-冰箱」与本区「我美」自称', nickUrl: 'https://www.bilibili.com/read/cv12440820/' },
  { name: '士兵:76', en: 'Soldier: 76 / Jack Morrison', role: R_SC, sub: '神准',
    note: '本名杰克·莫里森，守望先锋前指挥官，步枪加螺旋飞弹。生物立场被玩家叫「奶棒」，是新手最先学会的自奶手段。',
    nick: '士兵76、76号、76、自带外挂', nickSrc: 'B 站专栏技能俗称「76-生物立场-奶棒」', nickUrl: 'https://www.bilibili.com/read/cv12440820/' },
  { name: '托比昂', en: 'Torbjörn Lindholm', role: R_SC, sub: '专业',
    note: '瑞典工程师，造炮台、丢护甲。矮个子加大胡子的形象让他被叫「矮子」「矮人」，炮台叫「打铁」。',
    nick: '科比、打铁、矮子、矮人、炮台', nickSrc: '社区惯称「矮子」与炮台的「打铁」说法', nickUrl: WIKI('托比昂') },
  { name: '堡垒', en: 'Bastion', role: R_SC, sub: '专业',
    note: '智械战争遗留的战斗机器人，能变成哨兵模式架起机枪。因为「架起来就不动」的打法，被本区弹幕吐槽「机枪一转脑子不转」。',
    nick: '堡垒、哨兵模式', nickSrc: '官网英雄介绍与哨兵模式技能名', nickUrl: HERO_PAGE },
  { name: '黑百合', en: 'Widowmaker / Amélie Lacroix', role: R_SC, sub: '神准',
    note: '本名艾米丽·拉克瓦，被黑爪改造的狙击手。中文圈直接叫「狙」「黑寡妇」，是「女特务」这一类的代表。',
    nick: '黑寡妇、狙、狙击手', nickSrc: '社区惯称「狙」与「黑寡妇」', nickUrl: WIKI('黑百合') },
  { name: '艾什', en: 'Ashe / Elizabeth Caledonia Ashe', role: R_SC, sub: '神准',
    note: '死局帮首领，杠杆步枪加燃烧瓶，大招召唤管家 B.O.B.。本区弹幕「ashe 可以玩 bob 流惹」说的就是靠 B.O.B. 打伤害。',
    nick: '艾什', nickSrc: '本区弹幕「ashe 可以玩 bob 流惹」', nickUrl: BV('BV1qNnc6HEv6') },
  { name: '回声', en: 'Echo', role: R_SC, sub: '奇袭',
    note: '能复制敌方英雄形态的智能机器人，机动性极高。因为能变任何人，常被拿来和「万物皆可淋」的整活思路并提。',
    nick: '回声', nickSrc: '官网英雄介绍', nickUrl: HERO_PAGE },
  { name: '索杰恩', en: 'Sojourn / Vivian Chase', role: R_SC, sub: '神准',
    note: '本名维维安·蔡斯，守望先锋前队长，电磁炮蓄力射击。是《守望先锋2》上线时的标志性新英雄。',
    nick: '索杰恩、维维安·蔡斯', nickSrc: '守望先锋中文维基英雄条目', nickUrl: WIKI('索杰恩') },
  { name: '探奇', en: 'Venture', role: R_SC, sub: '奇袭',
    note: '考古学家，能钻地突进、用钻头输出。因为这个钻地动作，通讯录区直接叫「钻地婆」，还有「地鼠」「钻头女」两个变体。',
    nick: '钻地婆、地鼠、钻头女', nickSrc: '本区视频《【守望淋锋】钻地婆站街初体验》', nickUrl: BV('BV18m411U7sa') },
  { name: '秩序之光', en: 'Symmetra / Satya Vaswani', role: R_SC, sub: '专业',
    note: '本名塞特娅·法斯瓦尼，印度费斯卡集团的光子架构师。三轨名是本区最有名的一条：官方名秩序之光 → 台服音译辛梅塔 → 印度籍梗淋名阿三 / 三妹 → 自称我光 / 我辛。哨戒炮外形像摄像头，所以物件也叫摄像头。',
    nick: '辛梅塔、阿三、三妹、阿三妹、我光、我辛、摄像头', nickSrc: '电玩帮外号盘点、搜狗百科「别名三妹、阿三、辛梅塔」与本区「我光」自称', nickUrl: 'https://www.vgover.com/news/154735' },
  { name: '弗蕾娅', en: 'Freja', role: R_SC, sub: '神准',
    note: '前任守望特工，脱离组织后当赏金猎人，速射弩威力巨大、空中机动强。',
    nick: '弗蕾娅、赏金猎人', nickSrc: '2026 赛季英雄介绍', nickUrl: 'https://www.yxzzd.com/56183.html' },
  { name: '斩仇', en: 'Vendetta', role: R_SC, sub: '奇袭',
    note: '罗马斗兽场的前冠军，也是黑爪前任首领的女儿，用高机动高伤害的巨剑作战。',
    nick: '斩仇、斗兽场冠军', nickSrc: '2026 赛季英雄介绍', nickUrl: 'https://www.yxzzd.com/56183.html' },
  { name: '安燃', en: 'Anran', role: R_SC, sub: '专业',
    note: '2026 赛季加入的输出英雄，中文名单收录于守望先锋中文维基。',
    nick: '安燃', nickSrc: '守望先锋中文维基英雄名单', nickUrl: WIKI('英雄') },
  { name: '埃姆雷', en: 'Emre', role: R_SC, sub: '神准',
    note: '2026 赛季加入的输出英雄，本区弹幕里直接以「埃姆雷」称呼。',
    nick: '埃姆雷', nickSrc: '本区弹幕「埃姆雷」与中文维基名单', nickUrl: BV('BV1qNnc6HEv6') },
  { name: '西拉', en: 'Sierra', role: R_SC, sub: '奇袭',
    note: '2026 赛季加入的输出英雄，中文名单收录于守望先锋中文维基。',
    nick: '西拉', nickSrc: '守望先锋中文维基英雄名单', nickUrl: WIKI('英雄') },
  { name: '死怨', en: 'Wraith', role: R_SC, sub: '奇袭',
    note: '2026 赛季加入的输出英雄，中文名「死怨」本身就带淋语感，社区多直接沿用。',
    nick: '死怨', nickSrc: '守望先锋中文维基英雄名单', nickUrl: WIKI('英雄') },

  // ===== 支援 16 =====
  { name: '天使', en: 'Mercy / Angela Ziegler', role: R_ZY, sub: '医疗',
    note: '本名安吉拉·齐格勒，瑞士战地医师，治疗光束加复活。本区最出名的梗是「摩西女」——因为她一身白衣、能救死扶伤，被比作圣经里的摩西；衍生出「神秘摩西女」「你摩」「我摩」「单牵摩西女」。',
    nick: '摩西、摩西女、神秘摩西女、慈悲、你摩、我摩', nickSrc: 'NGA「为什么天使被称作摩西女」与本区《摩西女魅力时刻》', nickUrl: 'https://bbs.nga.cn/read.php?page=2&tid=43409821' },
  { name: '莫伊拉', en: 'Moira O\'Deorain', role: R_ZY, sub: '战术',
    note: '爱尔兰基因学家，左键治疗右键伤害，生化之球分黑球（伤害）与黄球（治疗），消散技能被叫「飘」。NGA 上「守望的阿三和莫伊拉就是一堆我莫我辛」说的就是她。',
    nick: '莫伊拉、莫姨、我莫、黑球、黄球、飘', nickSrc: 'B 站专栏技能俗称表「莫伊拉-生化之球-黑黄球 / 消散-飘」', nickUrl: 'https://www.bilibili.com/read/cv12440820/' },
  { name: '安娜', en: 'Ana Amari', role: R_ZY, sub: '医疗',
    note: '法老之鹰的母亲，狙击型治疗。麻醉镖叫「睡针」，生物手雷叫「禁疗瓶」，两个都是报点必用词。年纪大让她被叫「恐怖老太太」「娜娜」。',
    nick: '恐怖老太太、娜娜、睡针、禁疗瓶', nickSrc: 'B 站专栏技能俗称表与本区弹幕', nickUrl: 'https://www.bilibili.com/read/cv12440820/' },
  { name: '卢西奥', en: 'Lúcio Correia dos Santos', role: R_ZY, sub: '战术',
    note: '巴西 DJ，靠音乐给队友加速与治疗。因为「用音乐救人」这一点，被本区和天使并列叫「打碟摩西」。',
    nick: 'DJ、打碟摩西、卢西奥', nickSrc: '社区惯称「DJ」与「打碟摩西」的衍生说法', nickUrl: WIKI('卢西奥') },
  { name: '禅雅塔', en: 'Zenyatta', role: R_ZY, sub: '战术',
    note: '智械僧侣，靠和谐宝珠远程治疗、纷乱宝珠增伤。中文圈直接叫「和尚」。',
    nick: '和尚、禅雅塔', nickSrc: '社区惯称「和尚」与迷惑行为大全「和尚安娜活不了」', nickUrl: 'https://www.bilibili.com/read/cv4001799/' },
  { name: '布丽吉塔', en: 'Brigitte Lindholm', role: R_ZY, sub: '生存',
    note: '托比昂的女儿、莱因哈特的教女，用连枷锤近身作战。为了和莱因哈特（大锤）区分，被叫「小锤」「锤妹」。',
    nick: '锤妹、小锤妹', nickSrc: '什么值得买外号盘点「布丽吉塔为什么叫小锤」', nickUrl: 'https://post.smzdm.com/p/apqpz4r0/' },
  { name: '巴蒂斯特', en: 'Baptiste / Jean-Baptiste Augustin', role: R_ZY, sub: '医疗',
    note: '海地战地医师，维生立场能给队友锁血（血量不会降到一定值以下），所以技能就叫「锁血」。简称巴蒂或 8D。',
    nick: '巴蒂、8D、锁血', nickSrc: 'B 站专栏技能俗称「巴蒂-维生立场-锁血」', nickUrl: 'https://www.bilibili.com/read/cv12440820/' },
  { name: '黑影', en: 'Sombra / Olivia Colomar', role: R_ZY, sub: '战术',
    note: '墨西哥黑客，黑客入侵能禁用技能，玩家叫「小黑」；位移传动留下的信标就叫「信标」。大招电磁脉冲英文缩写 EMP 也直接当外号用。',
    nick: 'EMP、小黑、信标', nickSrc: 'B 站专栏技能俗称「黑影-黑客入侵-小黑 / 位移传动-信标」', nickUrl: 'https://www.bilibili.com/read/cv12440820/' },
  { name: '雾子', en: 'Kiriko', role: R_ZY, sub: '生存',
    note: '岛田家的巫女，能传送、能净化、能爬墙，是守望里机动性最强的支援之一。本区常拿她和摩西女对打，标题「摩西女和雾子r」即此。',
    nick: '雾子、巫女、护符', nickSrc: '官网英雄介绍与本区「我雾」自称', nickUrl: HERO_PAGE },
  { name: '生命之梭', en: 'Lifeweaver / Niran Pruksamanee', role: R_ZY, sub: '医疗',
    note: '泰国植物学家，用生命之梭拉人、搭花台。因为也是「能把人救回来」的支援，被叫「花男」或「男摩西」，花台则被叫「花婆」。本区弹幕「花台你自由了」「我花本可独自美丽」都是他。',
    nick: '花男、男摩西、你花、花婆', nickSrc: '本区视频《我花本可独自美丽》与弹幕「花台你自由了」', nickUrl: BV('BV1YQnH6zEsE') },
  { name: '伊拉锐', en: 'Illari', role: R_ZY, sub: '医疗',
    note: '印蒂勇士的最后幸存者，靠太阳之力治疗与输出。',
    nick: '伊拉锐、太阳之力', nickSrc: '2026 赛季英雄介绍', nickUrl: 'https://www.yxzzd.com/56183.html' },
  { name: '朱诺', en: 'Juno', role: R_ZY, sub: '战术',
    note: '来自火星的支援英雄，能在空中飞行。因为同样是「天上飞的治疗」，被叫「火星摩西」。',
    nick: '火星摩西、朱诺', nickSrc: '2026 赛季英雄介绍与「摩西」衍生链', nickUrl: 'https://www.yxzzd.com/56183.html' },
  { name: '无漾', en: 'Wuyang', role: R_ZY, sub: '医疗',
    note: '五行大学水学院的学生，操控水流治疗与输出。本区标题「叶无漾的大水好像发到本可身上了」把治疗量写成「大水」，是双关。',
    nick: '无漾、大水、水学院', nickSrc: '本区视频《糟糕！叶无漾的大水好像发到本可身上了！》', nickUrl: BV('BV157pK6vExn') },
  { name: '飞天猫', en: 'Jetpack Cat', role: R_ZY, sub: '战术',
    note: '2026 赛季加入的支援英雄，中文名「飞天猫」本身就像整活外号，社区直接沿用。',
    nick: '飞天猫', nickSrc: '守望先锋中文维基英雄名单', nickUrl: WIKI('英雄') },
  { name: '瑞稀', en: 'Mizuki', role: R_ZY, sub: '生存',
    note: '2026 赛季加入的支援英雄，中文名单收录于守望先锋中文维基。',
    nick: '瑞稀', nickSrc: '守望先锋中文维基英雄名单', nickUrl: WIKI('英雄') },
  { name: '血律', en: 'Bloodhound', role: R_ZY, sub: '医疗',
    note: '2026 赛季加入的支援英雄，本区人气最高的「Daddy」型角色。UP 主「这个符很关键」的标题「又素血律Daddy掌掴单牵摩西女平凡的一天鸭」把他捧成了本区头号男主。',
    nick: '血律、血律大人、血律Daddy、Daddy', nickSrc: '本区视频《又素血律Daddy掌掴单牵摩西女平凡的一天鸭》', nickUrl: BV('BV1qNnc6HEv6') },
];

// ---------------------------------------------------------------------------
// 二、UP 主（守望淋锋区的内容源）
// ---------------------------------------------------------------------------
const UP_LIST = [
  {
    name: '守望淋锋 · 阿三专题区',
    alias: '阿三专题、秩序之光专题',
    intro: 'B 站上「阿三」相关视频的合集标签。这一批视频标题把「阿三」这个外号反复复读（《0死阿三》《如何用阿三优雅的打出18888的输出？》《只玩阿三坚持10年有多流畅？》《恶臭老阴B！阿三玩家被所有人讨厌的原因！》），是「阿三」这个淋名在中文圈固化的直接证据。',
    baike: '并非单一 UP 主，而是 B 站搜索「阿三 守望先锋」返回的视频集合。本轮把它作为「阿三」这一淋名的语料锚点收录：15 条以上标题逐字含「阿三」。',
    tags: ['守望淋锋', 'UP主', '语料锚点'],
    works: [
      '如何用阿三优雅的打出18888的输出？',
      '0死阿三',
      '只玩阿三坚持10年有多流畅？',
      '恶臭老阴B！阿三玩家被所有人讨厌的原因！',
    ],
    words: ['阿三'],
    links: [
      [BV('BV1rT4y68E51'), '如何用阿三优雅的打出18888的输出？'],
      [BV('BV1g2ni6gE3c'), '0死阿三'],
      [BV('BV1gou46HEC8'), '只玩阿三坚持10年有多流畅？'],
      [BV('BV1gz4y1v7dX'), '恶臭老阴B！阿三玩家被所有人讨厌的原因！'],
    ],
  },
  {
    name: '摩西女专题区',
    alias: '摩西女专题、天使专题',
    intro: 'B 站「摩西女」相关视频的集合标签。《摩西女魅力时刻》《好见的摩西女》《我们摩西女这一块》《玩摩西使人心情舒畅》《强制iiii摩西女王》，这一串标题证明「摩西女」已经从 NGA 的一个提问长成了一个独立的内容品类。',
    baike: '并非单一 UP 主。本轮把它作为「摩西女」这一淋名的语料锚点：「摩西女」＝天使（Mercy），因为一身白衣与救死扶伤的形象被比作摩西，衍生出神秘摩西女、单牵摩西女、火星摩西、男摩西等一整条链。',
    tags: ['守望淋锋', 'UP主', '语料锚点'],
    works: [
      '摩西女魅力时刻',
      '好见的摩西女',
      '我们摩西女这一块',
      '强制iiii摩西女王',
    ],
    words: ['摩西女', '摩西'],
    links: [
      [BV('BV1iyn96eEsz'), '摩西女魅力时刻'],
      [BV('BV15oxKzfEDt'), '好见的摩西女'],
      [BV('BV1oYMDz3EBL'), '我们摩西女这一块'],
      [BV('BV1JUnU64ERb'), '强制iiii摩西女王'],
    ],
  },
];

// ---------------------------------------------------------------------------
// 三、人物条目组装
// ---------------------------------------------------------------------------
const HEROES = [
  ...ROSTER.map((h) => ({
    name: h.name,
    alias: [h.en, h.nick].filter(Boolean).join('、'),
    rank: rankOf(h.role),
    intro: h.note,
    baike: `本名 ${h.en}，官方定位 ${h.role}（副职责 ${h.sub}），收录自《守望先锋》2026 赛季 54 位正式英雄名单。淋语外号来源：${h.nickSrc}。`,
    tags: ['守望淋锋', h.role, h.sub],
    works: [h.nickSrc.replace(/^本区(?:视频|弹幕)/, '').replace(/^[《」]|》.*$/g, '').trim()].filter(Boolean),
    words: String(h.nick || '').split('、').filter(Boolean),
    links: [[h.nickUrl, h.nickSrc.slice(0, 40)], [HERO_PAGE, '《守望先锋》官网英雄页'], [BAIKE(h.name), `百度百科「${h.name}」词条`]],
  })),
  ...UP_LIST.map((u) => ({
    name: u.name,
    alias: u.alias,
    rank: 'UP主 · 守望淋锋',
    intro: u.intro,
    baike: u.baike,
    tags: u.tags,
    works: u.works,
    words: u.words,
    links: u.links.map(([url, label]) => [url, label]),
  })),
];

// ---------------------------------------------------------------------------
// 四、多译法合并：把本区的「我X / 你X」灌进既有词条的 alias
//     纪律同 13 号：一个中文词头一条主记录，多种译法全进 alias，不另立词条。
// ---------------------------------------------------------------------------
const WORD_MERGE = [
  {
    zh: '我',
    alias: ['我光', '我莫', '我辛', '我摩', '我律', '我雾', '我花', '我美', '我源', '我法', '我妈', '我猪', '我D', '我奶'],
  },
  {
    zh: '你',
    alias: ['你摩', '你花', '你光', '你铁', '你D', '你竹'],
  },
  {
    zh: '本可',
    alias: ['本可儿', '本仙女', '本祝妞', '本猪妞', '本可爱', '本宫', '本奶'],
  },
  {
    zh: '降临',
    alias: ['美神降淋'],
  },
];

// 百度百科检索 key 候选（fetch-baike21.js 用）
const HERO_BAIKE = {};
for (const h of ROSTER) {
  HERO_BAIKE[h.name] = [`${h.name}（守望先锋）`, `守望先锋 ${h.name}`, h.name];
}

// ---------------------------------------------------------------------------
// 五、给既有条目合并（Heroes merge）：这位 UP 早在第 4 轮就已立条（img/hero-140.png），
//     跨轮不重复立条，只把本轮新增的作品、链接、标签补进去。
// ---------------------------------------------------------------------------
const HERO_MERGE = [
  {
    name: '这个符很关键',
    tags: ['守望淋锋', 'UP主'],
    works: [
      '【守望淋锋】我律大概就素摩西女眼中的自己吧',
      '【守望淋锋】悬壶济世救死扶伤跟我摩的关系素？',
      '【守望淋锋】钻地婆站街初体验',
      '【守望淋锋】是士兵76是源氏是死神是堡垒，都给你游全能天后跪下啊啊啊',
    ],
    words: ['血律', '摩西女', '钻地婆', '全能天后'],
    links: [
      [BV('BV1hWey6NEXB'), '【守望淋锋】我律大概就素摩西女眼中的自己吧'],
      [BV('BV1mxJS6TEpS'), '【守望淋锋】悬壶济世救死扶伤跟我摩的关系素？'],
      [BV('BV18m411U7sa'), '【守望淋锋】钻地婆站街初体验'],
    ],
    baikeAppend:
      '守望淋锋分区作品续录：另有《我律大概就素摩西女眼中的自己吧》《悬壶济世救死扶伤跟我摩的关系素？》《钻地婆站街初体验》《都给你游全能天后跪下啊啊啊》等，本轮另采集其 4 条标题，并从 45 个守望淋锋视频抓到 1013 条弹幕、579 条评论作为语料。',
  },
];

// ---------------------------------------------------------------------------
// 六、词卡（flashcards）
//   纪律：term 必须是真实存在的叫法；example 必须能在语料里逐字查到（_attest21 校验）。
// ---------------------------------------------------------------------------
const CARDS = require('./curated-cards21.json');

// ---------------------------------------------------------------------------
// 六、外号一律要能回源
// ---------------------------------------------------------------------------
const { attested } = require('./_attest21.js');
const isLatin = (s) => /^[A-Za-z0-9 .'’\-·]+$/.test(s);

const PRUNE_LOG = { words: [], alias: [] };
for (const h of HEROES) {
  const w0 = h.words || [];
  h.words = w0.filter((w) => attested(w));
  for (const w of w0) if (!h.words.includes(w)) PRUNE_LOG.words.push(`${h.name}:${w}`);

  const a0 = String(h.alias || '')
    .split(/[、,，/／]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const a1 = a0.filter((a) => attested(a) || isLatin(a));
  for (const a of a0) if (!a1.includes(a)) PRUNE_LOG.alias.push(`${h.name}:${a}`);
  h.alias = a1.join(' / ');
}

module.exports = { HEROES, HERO_MERGE, WORD_MERGE, ROSTER, UP_LIST, QUOTES, CARDS, HERO_BAIKE, PRUNE_LOG };
