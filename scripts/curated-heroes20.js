'use strict';

// 第二十轮策展源 · 淋威争锋（漫威争锋）分区开区（人物传 + 词位的译法合并）
//
// 口径同 Nineteenth 轮：
//   - rank 一律「分区 · 位分」两段式，不出现 18 号之前那种「瓦罗淋特 · · 我🐍」双分隔号
//   - baike 写清「本名 / 英文名 / 官方定位 / 淋语外号来源」，禁止模板尾句
//   - works 只放真实视频标题（UP 主）或真实官方/社区出处（角色），不许拿别名当代表作
//   - img 由 scripts/fetch-hero-images20.js + apply-hero-images20.py 回填，这里一律留空
//   - 名言不手写：从 scripts/curated-quotes20.json 读（build-quotes20.js 生成，每条可回源）

const QUOTES = require('./curated-quotes20.json');

const BV = (id) => `https://www.bilibili.com/video/${id}`;
const BAIKE = (k) => `https://baike.baidu.com/item/${encodeURIComponent(k)}`;
// 萌娘百科角色页：所有英雄的共同回源出处
const MG = (name) => 'https://zh.moegirl.org.cn/' + encodeURIComponent(`漫威争锋:${name}`);

// ---------------------------------------------------------------------------
// 一、英雄名册（54 位）
// 位分口径来自萌娘百科《漫威争锋》条目「可玩角色」（截至 S10 下半赛季 54 名）：
//   捍卫者 14 / 决斗家 27 / 策略家 12 / 特殊（死侍）1
// note 一律写真实设定或真实社区梗，不编设定。nick 只有在语料里查得到才写。
// ---------------------------------------------------------------------------
const ROSTER = [
  // ===== 捍卫者 14 =====
  { name: '美国队长', en: 'Captain America / Steve Rogers', role: '捍卫者', note: '史蒂夫·罗杰斯，举盾冲在最前面的复仇者领袖，游戏里用盾牌格挡与冲锋给队伍开路。', nick: '美国宝子、美国彪子、美队、队长', nickSrc: '视频《【淋威争锋】美国彪子啊不是宝子，向你致敬》', nickUrl: BV('BV1BHjrzTEbk') },
  { name: '奇异博士', en: 'Doctor Strange / Stephen Strange', role: '捍卫者', note: '斯蒂芬·斯特兰奇，至尊法师，游戏里靠护盾维持血线、能开传送门把队伍整组送到位。', nick: '博士、纹身魔法老头', nickSrc: '视频《（淋威争锋）有点像博士的超绝不经意露出》与《（淋威争锋）这位也是纹身魔法老头daddy》', nickUrl: BV('BV1ptM3zGEhd') },
  { name: '格鲁特', en: 'Groot', role: '捍卫者', note: '花神巨像族，台词只有一句「我是格鲁特」，靠木墙挡弹药、大招把敌人缠住。', nick: '树人', nickSrc: '游戏内台词「I am Groot」与本区弹幕「我是格鲁特」', nickUrl: MG('格鲁特') },
  { name: '浩克', en: 'Hulk / Bruce Banner', role: '捍卫者', note: '布鲁斯·班纳变身后的绿色巨人，能抓人当武器甩，也可以把班纳形态当远程输出换着打。', nick: '绿巨人、班纳博士', nickSrc: '视频简介「把邪恶铁皮人变成浦西boy送给浩克蹂躏」', nickUrl: BV('BV1c4wNemEZ9') },
  { name: '万磁王', en: 'Magneto / Erik Lehnsherr', role: '捍卫者', note: '艾瑞克·兰谢尔，操控金属，本区 daddy 梗的头号载体，金属护盾与金属球两大保命技都在他身上。', nick: '你磁、万磁王daddy、老王', nickSrc: '视频《（淋威争锋）自改daddy万磁王和大包》《（淋威争锋）万磁王daddy的手铐play》', nickUrl: BV('BV1cKpgzzEws') },
  { name: '潘妮·帕克', en: 'Peni Parker / SP//dr', role: '捍卫者', note: '驾驶蜘蛛机甲 SP//dr 的日系少女，摆蜘蛛雷、开机甲技能近身缠斗，与毒液、蜘蛛侠有连携。', nick: '潘妮帕克、机甲妹', nickSrc: '萌娘百科《漫威争锋》可玩角色名单', nickUrl: BAIKE('漫威争锋') },
  { name: '索尔', en: 'Thor / Thor Odinson', role: '捍卫者', note: '托尔，雷神，妙尔尼尔锤在手，能在近身重击与远程雷击之间切换。', nick: '雷神、雷神哥', nickSrc: '视频《［淋威争锋］对比雷神不同皮肤的脚臭程度》', nickUrl: BV('BV18AkkBzE4t') },
  { name: '毒液', en: 'Venom / Eddie Brock', role: '捍卫者', note: '埃迪·布洛克与共生体结合，甩触手突进、用共生体护体吸收伤害，是骚扰后排的典型。', nick: '猛毒、黑衣之王', nickSrc: 'B 站专栏《<漫威争锋>杰夫的历史！吃过无限手套？给死侍当过宠物！》里「毒液出鲨狗皮肤」一段', nickUrl: 'https://www.bilibili.com/read/cv40893634' },
  { name: '石头人', en: 'The Thing / Ben Grimm', role: '捍卫者', note: '本·格瑞姆，神奇四侠里的岩石大力士，减伤能力强，靠一身的岩石块硬顶伤害。', nick: '岩石人、母石头人', nickSrc: '弹幕「玛雅被母石头人吓晕」「被我光联合木石头人美美绞杀」', nickUrl: BV('BV1iHqQYgEtS') },
  { name: '白皇后', en: 'Emma Frost / White Queen', role: '捍卫者', note: '艾玛·弗斯特，心灵感应变种人，能钻石化扛伤，第二赛季上线因为建模引发全网二创。', nick: '艾玛·弗斯特、妈咪', nickSrc: '玩家社区「对着白皇后大喊妈咪」的二创热潮', nickUrl: BAIKE('漫威争锋') },
  { name: '安吉拉', en: 'Angela', role: '捍卫者', note: '来自十界之外的天使界女战士，主线里为寻找失散亲人进入天都，是典型的肉搏型女战士。', nick: '安吉拉宝贝', nickSrc: '弹幕「有点像安吉拉宝贝」', nickUrl: BV('BV1iHqQYgEtS') },
  { name: '小淘气', en: 'Rogue / Anna Marie', role: '捍卫者', note: '罗刹女，接触即吸收对手能力，扛线能力强，与牌皇有官方连携设定。', nick: '罗刹女', nickSrc: '萌娘百科《漫威争锋》可玩角色名单', nickUrl: BAIKE('漫威争锋') },
  { name: '恶魔恐龙', en: 'Devil Dinosaur', role: '捍卫者', note: '来自 Savage Land 的红色恐龙，体型巨大，靠踩踏与咆哮打乱阵型。', nick: '恐龙宝贝', nickSrc: '萌娘百科《漫威争锋》可玩角色名单', nickUrl: BAIKE('漫威争锋') },
  { name: '红兜帽', en: 'The Hood / Parker Robbins', role: '捍卫者', note: '帕克·罗宾斯，靠兜帽汲取黑暗力量，负责到底比斯线里盗走石板的一段主线。', nick: '兜帽', nickSrc: '官网地图「底比斯」主线介绍', nickUrl: 'https://marvelrivals.163.com/' },

  // ===== 决斗家 27 =====
  { name: '黑寡妇', en: 'Black Widow / Natasha Romanoff', role: '决斗家', note: '娜塔莎·罗曼诺夫，神盾局特工出身的狙击型输出，重做后又加上了充能与位移。', nick: '寡姐、寡妇', nickSrc: '评论「出俩皮肤了，寡姐却又进入了连紫皮都没有的处境」', nickUrl: BV('BV1KeJb6GExo') },
  { name: '黑豹', en: 'Black Panther / T’Challa', role: '决斗家', note: '特查拉，瓦坎达国王，振金爪突进收割，是很典型的刺客流突进手。', nick: '黑豹daddy', nickSrc: '弹幕「被黑豹daddy拳鼠惹」「黑豹daddy赔穿地心噜」', nickUrl: BV('BV1c4wNemEZ9') },
  { name: '鹰眼', en: 'Hawkeye / Clint Barton', role: '决斗家', note: '克林特·巴顿，箭矢带各种特殊效果，远距离消耗能力强。', nick: '', nickSrc: '弹幕「玩我红被对面的鹰眼海拉射得bfnz」', nickUrl: BV('BV1c4wNemEZ9') },
  { name: '海拉', en: 'Hela', role: '决斗家', note: '死亡女神，成群的匕首远程铺伤害，大招能召唤亡者，S0 皮肤常被拿来当对比标杆。', nick: '死亡女神', nickSrc: '评论「搞成s0海拉那个皮肤一样脸和身子统一不是没这么违和」', nickUrl: BV('BV1Gino6qEJJ') },
  { name: '铁拳', en: 'Iron Fist / Lin Lie', role: '决斗家', note: '林烈，网易自己的亚洲线主角，昆仑寿老之力加身，是本区「黑袜」「daddy」二创密度最高的角色。', nick: '我烈、你烈、林烈daddy', nickSrc: '弹幕「我烈好广阔的胸怀」「玛雅被林烈daddy的黑袜吸引进来了」', nickUrl: BV('BV1kfE2zPETb') },
  { name: '钢铁侠', en: 'Iron Man / Tony Stark', role: '决斗家', note: '托尼·斯塔克，掌心射线加胸炮，浮空输出是他最标志性的样子。', nick: '铁人、铁皮人、铁男', nickSrc: '评论「结算画面铁人daddy变光头了」与视频《这下不得不吃铁男的激光了》', nickUrl: BV('BV1mMGnzDEt5') },
  { name: '魔剑客', en: 'Magik / Illyana Rasputina', role: '决斗家', note: '伊丽亚娜·拉斯普廷，灵魂剑加地狱边境传送突进，属于典型的近身刺客打法。', nick: '秘客', nickSrc: '萌娘百科《漫威争锋》可玩角色名单', nickUrl: MG('魔剑客') },
  { name: '神奇先生', en: 'Mister Fantastic / Reed Richards', role: '决斗家', note: '里德·理查兹，橡皮体质伸长攻击，第二赛季的连携让他几乎是八秒一个满血的版本答案。', nick: '哈哈男、橡皮人', nickSrc: '社区热梗「哈哈！赖着硬不死，神秘哈哈男」', nickUrl: BV('BV1mMGnzDEt5') },
  { name: '月光骑士', en: 'Moon Knight / Marc Spector', role: '决斗家', note: '马克·斯佩克特，孔苏在人间的代理人，飞镖与多重人格是他的招牌设定。', nick: '我月光骑士、骑士', nickSrc: '视频《【淋威争锋】漫威争锋只能有一个光，那就是我月光骑士》', nickUrl: BV('BV1USPLebE5m') },
  { name: '纳摩', en: 'Namor / Namor McKenzie', role: '决斗家', note: '亚特兰蒂斯国王，能近能远，三叉戟近战配水系突进，也能短暂悬浮压制后排。', nick: '你摩', nickSrc: '评论「你摩再次惨遭削弱」', nickUrl: BV('BV1c4wNemEZ9') },
  { name: '灵蝶', en: 'Psylocke / Kwannon', role: '决斗家', note: '灵能忍者，影袭加灵刃，开服时因为立绘被称为「审美回归第一枪」。', nick: 'Psy、灵能忍者', nickSrc: '玩家归纳的「隐冰鲨蝶」（隐形女/冰月花雪/鲨鲨/灵蝶）内部爱四巨头', nickUrl: BV('BV1iHqQYgEtS') },
  { name: '猩红女巫', en: 'Scarlet Witch / Wanda Maximoff', role: '决斗家', note: '旺达·马克西莫夫，混沌魔法，命中即用；游戏社区把她和「母亲」牢牢绑在一起（我有母亲，她叫旺达）。', nick: '我红、你红、旺达、绯红女巫', nickSrc: '视频《【淋威争锋】没人爱你们的话我红来爱你们》与弹幕「我红是母亲是女儿啊」', nickUrl: BV('BV1c4wNemEZ9') },
  { name: '蜘蛛侠', en: 'Spider-Man / Peter Parker', role: '决斗家', note: '彼得·帕克，荡蛛丝、吐蛛网把人黏住，是机动性最高的突进手之一。', nick: '蛛蛛、蜘蛛人、小蜘蛛', nickSrc: '视频《【淋威争锋】西景镇颁布禁蛛令》', nickUrl: BV('BV1K9Pie7EZC') },
  { name: '松鼠女', en: 'Squirrel Girl / Doreen Green', role: '决斗家', note: '多琳·格林，召唤松鼠军团，投掷松鼠包；设定上是能打赢灭霸的存在。', nick: '松鼠女孩', nickSrc: '萌娘百科《漫威争锋》可玩角色名单', nickUrl: BAIKE('漫威争锋') },
  { name: '星爵', en: 'Star-Lord / Peter Quill', role: '决斗家', note: '彼得·奎尔，银河护卫队队长，双枪加推进靴，开大后全队得到额外的攻击增益。', nick: '我星', nickSrc: '评论「不许诋毁我星是胖头苍蝇靴靴」', nickUrl: BV('BV1c4wNemEZ9') },
  { name: '暴风女', en: 'Storm / Ororo Munroe', role: '决斗家', note: '奥罗罗·门罗，操控天气的变种人，X 战警成员，2026 年泳装皮事件的主角之一。', nick: '我风、风暴女神', nickSrc: '弹幕「我风大招超绝充能速度超绝伤害超绝范围超绝机动超绝生存素你红一辈子得不到的厚」', nickUrl: BV('BV1c4wNemEZ9') },
  { name: '惩罚者', en: 'The Punisher / Frank Castle', role: '决斗家', note: '弗兰克·卡塞尔，重型枪械压制配救治无人机，站桩输出型射手。', nick: '制裁者', nickSrc: '弹幕「惩罚者真老公，帅死惹」', nickUrl: BV('BV1iHqQYgEtS') },
  { name: '冬兵', en: 'Winter Soldier / Bucky Barnes', role: '决斗家', note: '巴基·巴恩斯，手臂钩锁可以把人钩过来，是本区 daddy 梗与 again 梗的高频角色。', nick: '我冬、冬冬、巴基', nickSrc: '视频《【淋威争锋】只素冬冬在淋威的处女秀》《（淋威争锋）忍不住对冬兵again了》', nickUrl: BV('BV1kfE2zPETb') },
  { name: '金刚狼', en: 'Wolverine / Logan', role: '决斗家', note: '罗根，自愈因子配艾德曼合金爪，突击与求生能力都拉满。', nick: '罗根、狼叔', nickSrc: '萌娘百科《漫威争锋》可玩角色名单', nickUrl: BAIKE('漫威争锋') },
  { name: '霹雳火', en: 'Human Torch / Johnny Storm', role: '决斗家', note: '约翰尼·斯托姆，全身火焰飞行输出，社区长期替他抱不平——元老英雄却迟迟没有金皮。', nick: '约翰尼、火焰人', nickSrc: '社区热帖《把神奇四侠全请进来了，待遇却冰火两重天》', nickUrl: BV('BV1Gino6qEJJ') },
  { name: '凤凰女', en: 'Phoenix / Jean Grey', role: '决斗家', note: '琴·葛蕾，凤凰之力宿主，大范围凤凰冲击伤害加上凤凰火机场威胁。', nick: '琴·葛蕾、Marvel Girl', nickSrc: '萌娘百科《漫威争锋》可玩角色名单', nickUrl: BAIKE('漫威争锋') },
  { name: '刀锋战士', en: 'Blade / Eric Brooks', role: '决斗家', note: '埃里克·布鲁克斯，吸血鬼猎人，枪剑并用，近身连斩的伤害极高。', nick: '日行者', nickSrc: '萌娘百科《漫威争锋》可玩角色名单', nickUrl: MG('刀锋战士') },
  { name: '夜魔侠', en: 'Daredevil / Matt Murdock', role: '决斗家', note: '马特·默多克，听声辨位的格斗家，棍术连打是他的输出方式。', nick: '超胆侠、夜魔侠daddy', nickSrc: '视频《（淋威争锋）夜魔侠daddy泳装爆料（X）》', nickUrl: BV('BV1pj4Cz1E6H') },
  { name: '艾尔莎·血石', en: 'Elsa Bloodstone', role: '决斗家', note: '怪物猎人出身，双枪加各式猎枪道具，对大体型目标压制力极强。', nick: '艾尔莎', nickSrc: '萌娘百科《漫威争锋》可玩角色名单', nickUrl: BAIKE('漫威争锋') },
  { name: '黑猫', en: 'Black Cat / Felicia Hardy', role: '决斗家', note: '菲丽西亚·哈代，猫盗般的近身刺客，上线时因为造型引爆社区创作。', nick: '都市丽爪', nickSrc: '新皮肤「都市丽爪」上线引发的同人创作热潮', nickUrl: BAIKE('漫威争锋') },
  { name: '雷光眼', en: 'Cyclops / Scott Summers', role: '决斗家', note: '斯科特·萨默斯，X 战警队长，眼部镭射需要抬手控向，扫线与点射手感完全不同。', nick: '镭射眼、独眼龙', nickSrc: '视频《[淋威争锋] 雷光鲜榨》', nickUrl: BV('BV1Y57j6UEkU') },
  { name: '屠神者格尔', en: 'Gorr the God Butcher', role: '决斗家', note: '屠神者格尔，被诸神背叛后走上屠神之路，黑刃迦利克是他的核心机制。', nick: '格尔', nickSrc: '官网世界观「神之坟场」段落', nickUrl: 'https://marvelrivals.163.com/' },

  // ===== 策略家 12 =====
  { name: '亚当术士', en: 'Adam Warlock', role: '策略家', note: '量子能量的使用者，靠复活链让全团有第二条命，是团战的定海神针。', nick: 'Adam、量子干部', nickSrc: '萌娘百科《漫威争锋》可玩角色名单', nickUrl: BAIKE('漫威争锋') },
  { name: '斗篷与匕首', en: 'Cloak & Dagger', role: '策略家', note: '泰隆与坦迪共用同一个英雄槽位，能切换 Lightforce 治疗与 Darkforce 伤害两种形态。', nick: '我匕、匕匕、斗匕', nickSrc: '视频《【淋威争锋】9.5赛季，我匕是唯一T0谢谢》与弹幕「因為那素對面的匕匕」', nickUrl: BV('BV1PLua6REYV') },
  { name: '隐形女', en: 'Invisible Woman / Susan Storm', role: '策略家', note: '苏珊·斯托姆，护盾加隐身，第一赛季上线时因为造型引发社区大规模讨论。', nick: '你苏珊、苏珊、隐形女侠', nickSrc: '视频《【淋威争锋】你苏珊为这个家付出的太多了》', nickUrl: BV('BV1Ar69BxEek') },
  { name: '陆行鲨杰夫', en: 'Jeff the Land Shark', role: '策略家', note: '小小鲨造型的治疗角色，水柱泡泡奶量夸张，是全服公认的吉祥物。', nick: '鲨鲨、鲨狗、小鲨鲨', nickSrc: '评论「靴靴，都不如我们鲨鲨，高额的奶量与超美的逃跑能力」', nickUrl: BV('BV1c4wNemEZ9') },
  { name: '洛基', en: 'Loki / Loki Laufeyson', role: '策略家', note: '恶作剧之神，分身加变形骗人，游戏主线里他是把阿斯加德改成新王国的人。', nick: '我基、你基、淋基、洛洛', nickSrc: '视频《【淋威争锋】我基的胸部很狂野……》与评论「来支持我基了」', nickUrl: BV('BV1WZ6XBREKQ') },
  { name: '冰月花雪', en: 'Luna Snow / Seol Hee', role: '策略家', note: '雪希，K-pop 偶像兼超能力者，光明之冰治疗、黑暗之冰输出，大招期间全队收益直接拉满。', nick: '我冰、你冰、露娜', nickSrc: '视频《【淋威争锋】我冰艺术大过天》与弹幕「我冰掌掴一众赔钱货」', nickUrl: BV('BV1iHqQYgEtS') },
  { name: '曼蒂斯', en: 'Mantis', role: '策略家', note: '螳螂女，情绪感知加睡眠控场，抬血与控心都在她一个人身上。', nick: '螳螂、螳螂女', nickSrc: '萌娘百科《漫威争锋》可玩角色名单', nickUrl: BAIKE('漫威争锋') },
  { name: '火箭浣熊', en: 'Rocket Raccoon', role: '策略家', note: '银河护卫队的机械师，重型枪械加炮台，兼具治疗与复活装置。', nick: '火箭、Rocket', nickSrc: '萌娘百科《漫威争锋》可玩角色名单', nickUrl: BAIKE('漫威争锋') },
  { name: '奥创', en: 'Ultron', role: '策略家', note: '人工智能反派，无人机群加能量射线，PVE 模式里是阶段性 Boss。', nick: 'Ultron、机械神经元', nickSrc: '评论「我还是觉得pve只有丧尸女王那次好玩，后面的打奥创和刷装备词条很无聊」', nickUrl: BV('BV1Y57j6UEkU') },
  { name: '牌皇', en: 'Gambit / Remy LeBeau', role: '策略家', note: '雷米·勒博，扑克牌充能爆炸，兼具治疗手牌与控制。', nick: '千王', nickSrc: '萌娘百科《漫威争锋》可玩角色名单', nickUrl: BAIKE('漫威争锋') },
  { name: '白狐', en: 'White Fox / Ami Han', role: '策略家', note: '阿美·韩，韩国出身的超能力特工，与冰月花雪、铁拳同属阿特拉斯线。', nick: '白狐姐姐', nickSrc: '评论「还是白狐的金皮最好看，可惜不给大招特效」', nickUrl: BV('BV1Gino6qEJJ') },
  { name: '百光花火', en: 'Firestar / Angelica Jones', role: '策略家', note: '安杰莉卡·琼斯，火焰能量控治疗与输出，是 X 战警线的年轻变种人之一。', nick: '李千欢、火焰星', nickSrc: '社区视频《国外女主播cos李千欢睡衣》', nickUrl: BV('BV1Zzes6HEey') },

  // ===== 特殊 1 =====
  { name: '死侍', en: 'Deadpool / Wade Wilson', role: '全能英雄', note: '韦德·威尔森，官方定位是「全能英雄」，可以在捍卫者/决斗家/策略家三种职责之间切换，嘴炮是他的招牌。', nick: '小贱蛛、贱贱', nickSrc: '官网英雄页面「这位全能英雄（死侍自称）……所有精彩表现都将附赠他那永不停歇的嘴炮」', nickUrl: 'https://marvelrivals.163.com/heroes/index.html?id=8d2e773d-ff5a-440e-9623-e0d46bbeca9e' },
];

// ---------------------------------------------------------------------------
// 二、通讯录 UP 主 / 整活作者（12 位）
// 都是「淋威争锋」系列视频的实际作者，works 取自第一手抓取的 manifest，点到即可核对。
// ---------------------------------------------------------------------------
const UP_LIST = [
  {
    name: '甜甜痞颜', intro: 'B 站「淋威争锋」系列产量最高、文案淋度最足的 UP，每期把一个英雄写成一整篇淋语文案，是本区自称体系（我基/我红/我匕/我冰）的主要产地。',
    baike: '本名不详，B 站 UP 主（mid 32271318）。与观众互称「你痞／我痞」，淋语外号来源：评论「你痞一daddy两吃素在?」「玛雅你痞的片头怎么变高脂了？疑似焕发第二春噜」。',
    alias: '你痞、痞颜、甜甜痞眼', works: ['【淋威争锋】我冰艺术大过天', '【淋威争锋】漫威争锋只能有一个光，那就是我月光骑士', '【淋威争锋】9.5赛季，我匕是唯一T0谢谢', '【淋威争锋】我基的胸部很狂野 屁股很坚挺 腰身很曼妙'],
    links: [[BV('BV1iHqQYgEtS'), '【淋威争锋】我冰艺术大过天'], [BV('BV1PLua6REYV'), '【淋威争锋】9.5赛季，我匕是唯一T0谢谢'], [BV('BV1USPLebE5m'), '【淋威争锋】漫威争锋只能有一个光，那就是我月光骑士']],
  },
  {
    name: '鑫河万点', intro: '专做「daddy」系列的改编搬运 UP，把万磁王、夜魔侠、博士、冬兵一个个写成 daddy 同人文案，是淋威区「XXdaddy」构词法的最大产地。',
    baike: 'B 站 UP 主。淋语外号来源：评论「2亿视图」未见；可回源证据是视频《（淋威争锋）万磁王daddy的手铐play》《（淋威争锋）忍不住对冬兵again了》以及他人的追问「老师在哪里更新呀，想看图」。',
    alias: '鑫河老师', works: ['（淋威争锋）自改daddy万磁王和大包', '（淋威争锋）万磁王daddy的手铐play', '（淋威争锋）夜魔侠daddy泳装爆料（X）', '（淋威争锋）忍不住对冬兵again了'],
    links: [[BV('BV1cKpgzzEws'), '（淋威争锋）自改daddy万磁王和大包'], [BV('BV1o7pczuEBm'), '（淋威争锋）万磁王daddy的手铐play'], [BV('BV1avaQzAE74'), '（淋威争锋）忍不住对冬兵again了']],
  },
  {
    name: '良心洗脚妹', intro: '「淋威蜘蛛侠」系列的作者，把蜘蛛侠相关剧情整段淋化重讲，标题就是一句淋语。',
    baike: 'B 站 UP 主。淋语外号来源：语料里三次出现其系列标题《【淋威蜘蛛侠2】第一集/第三集/第七集》，以及评论「时你不经意惹」等在该视频下的淋语回复。',
    alias: '洗脚妹', works: ['【淋威蜘蛛侠2】第一集', '【淋威蜘蛛侠2】第三集', '【淋威蜘蛛侠2】第七集'],
    links: [[BV('BV1pn8uzRE61'), '【淋威蜘蛛侠2】第一集'], [BV('BV13f84zXE5N'), '【淋威蜘蛛侠2】第三集'], [BV('BV1et8Zz5E6e'), '【淋威蜘蛛侠2】第七集']],
  },
  {
    name: '地才蓝灬频道', intro: '用 NBCS 当标题的淋语玩家，把漠不关心写成本区通用缩写。',
    baike: 'B 站 UP 主。淋语外号来源：视频《「淋威争锋」治愈并保护大家？NBCS！》，NBCS 在本区语料里反复出现（「我红的e有点nbcs」「nbcs地雷女」）。',
    alias: '地才蓝', works: ['「淋威争锋」治愈并保护大家？NBCS！'],
    links: [[BV('BV1QJoZYeEUb'), '「淋威争锋」治愈并保护大家？NBCS！']],
  },
  {
    name: '鲁迅欺负周树人', intro: '把隐形女（苏珊）的家庭伦理写得一本正经的文案型 UP。',
    baike: 'B 站 UP 主。淋语外号来源：视频《【淋威争锋】你苏珊为这个家付出的太多了》与弹幕「真正的美神是你苏」。',
    alias: '鲁迅', works: ['【淋威争锋】你苏珊为这个家付出的太多了'],
    links: [[BV('BV1Ar69BxEek'), '【淋威争锋】你苏珊为这个家付出的太多了']],
  },
  {
    name: 'Wooden依末', intro: '写「西景镇颁布禁蛛令」的作者，并是被评论区@talked 的另一个改编作者。',
    baike: 'B 站 UP 主。淋语外号来源：视频《【淋威争锋】西景镇颁布禁蛛令》，评论「回复 @Wooden依末：全新捍卫者英雄阴暗地雷女降临淋威，这地雷，将炸尽一切。」',
    alias: '依末', works: ['【淋威争锋】西景镇颁布禁蛛令'],
    links: [[BV('BV1K9Pie7EZC'), '【淋威争锋】西景镇颁布禁蛛令']],
  },
  {
    name: '赫斯特特特', intro: '专挑「对比 XX 皮肤」这种冷门角度做大选题的作者，脚臭程度那条是本区名场面。',
    baike: 'B 站 UP 主。淋语外号来源：视频《［淋威争锋］对比雷神不同皮肤的脚臭程度》。',
    alias: '赫斯特', works: ['［淋威争锋］对比雷神不同皮肤的脚臭程度'],
    links: [[BV('BV18AkkBzE4t'), '［淋威争锋］对比雷神不同皮肤的脚臭程度']],
  },
  {
    name: 'Z_Magnus', intro: '产出「雷光鲜榨」的画/视频作者，也在评论区被问「万磁王 daddy 图在哪更新」。',
    baike: 'B 站 UP 主。淋语外号来源：视频《[淋威争锋] 雷光鲜榨》与评论「前几期的万磁王daddy也是老师做的吗，老师在哪里更新呀，想看图」。',
    alias: 'Magnus老师', works: ['[淋威争锋] 雷光鲜榨'],
    links: [[BV('BV1Y57j6UEkU'), '[淋威争锋] 雷光鲜榨']],
  },
  {
    name: '一小罐啤酒', intro: '用「美国彪子啊不是宝子」玩拟音错位笑话的作者。',
    baike: 'B 站 UP 主。淋语外号来源：视频《【淋威争锋】美国彪子啊不是宝子，向你致敬》。',
    alias: '啤酒', works: ['【淋威争锋】美国彪子啊不是宝子，向你致敬'],
    links: [[BV('BV1BHjrzTEbk'), '【淋威争锋】美国彪子啊不是宝子，向你致敬']],
  },
  {
    name: 'Haker没有C', intro: '淋威区玩家群的群主之一，评论区多次被人 @ 着要「给万磁王 daddy 做图」。',
    baike: 'B 站 UP 主。淋语外号来源：评论「@Haker没有C 让我的万磁王daddy成为真男人」「可以去@Haker没有C 的群惹」。',
    alias: 'Haker', works: ['在评论区组织淋威争锋联机玩家群'],
    links: [[BV('BV1cKpgzzEws'), '评论出处：（淋威争锋）自改daddy万磁王和大包']],
  },
];

// ---------------------------------------------------------------------------
// 三、导出
// ---------------------------------------------------------------------------
const rankOf = (role) => `淋威争锋 · ${role}`;

const HEROES = [
  ...ROSTER.map((h) => ({
    name: h.name,
    alias: [h.en, h.nick].filter(Boolean).join('、'),
    rank: rankOf(h.role),
    intro: h.note,
    baike: `本名 ${h.en}，官方定位 ${h.role}，收录自《漫威争锋》S10 赛季正式英雄名单。淋语外号来源：${h.nickSrc}。`,
    tags: ['淋威争锋', h.role],
    works: [h.nickSrc.replace(/^视频《?/, '').replace(/》.*$/, '').trim()].filter(Boolean),
    words: String(h.nick || '')
      .split('、')
      .filter(Boolean),
    links: [[h.nickUrl, h.nickSrc.slice(0, 40)], [BAIKE('漫威争锋'), '百度百科《漫威争锋》词条']],
  })),
  ...UP_LIST.map((u) => ({
    name: u.name,
    alias: u.alias,
    rank: 'UP主 · 淋威争锋',
    intro: u.intro,
    baike: u.baike,
    tags: ['淋威争锋', 'UP主'],
    works: u.works,
    words: String(u.alias).split('、').filter(Boolean),
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
    alias: ['我基', '我匕', '我红', '我冰', '我冬', '我月光骑士', '我烈', '我星', '我风'],
  },
  {
    zh: '你',
    alias: ['你基', '你冰', '你痞', '你磁', '你拳', '你摩', '你苏珊', '你骇', '你辰'],
  },
  {
    zh: '降临',
    alias: ['美神降淋', '标注降淋', '我红美神降淋'],
  },
];

// ---------------------------------------------------------------------------
// 五、给既有条目合并（Heroes merge）：同一位 UP 主跨分区不重复立条，只补标签/作品
// ---------------------------------------------------------------------------
const HERO_MERGE = [
  {
    // 该 UP 在第十九轮已以「瓦罗淋特」分区立条，这里只把淋威争锋的作品补进去
    name: '地才女特务',
    tags: ['淋威争锋'],
    works: ['【淋威争锋】我们心有淋吸~不是吗~🩷🩷'],
    words: ['心有淋吸'],
    links: [[BV('BV15B3v6WEag'), '【淋威争锋】我们心有淋吸~不是吗~🩷🩷']],
    baikeAppend: '淋威争锋分区外号来源：视频《【淋威争锋】我们心有淋吸~不是吗~🩷🩷》，「心有淋吸」＝「心有灵犀」的淋化谐音。',
  },
];

// 百度百科检索 key 候选（harvest-baike20.js 用）
const HERO_BAIKE = {};
for (const h of ROSTER) {
  HERO_BAIKE[h.name] = [`${h.name}（漫威争锋）`, `漫威争锋 ${h.name}`, h.name];
}

// ---------------------------------------------------------------------------
// 六、外号与外号型别名一律要能回源
//
// 初稿里混进了不少「我知道、但语料里没有」的写法：毒液的台译「猛毒」、惩罚者的旧译
// 「制裁者」、死侍的「小贱蛛」……这些不是幻觉，但本项目纪律是每条落库文本都要能
// 逐字回源，所以按 scripts/_attest20.js 的口径统一摘掉。
//
// 拉丁字母名（Stephen Strange / Wade Wilson 这类本名）保留：那是游戏里该角色的
// 官方英文名，不属于「我编的中文外号」这一类风险。
// ---------------------------------------------------------------------------
const { attested } = require('./_attest20.js');
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

module.exports = { HEROES, HERO_MERGE, WORD_MERGE, ROSTER, UP_LIST, QUOTES, HERO_BAIKE, PRUNE_LOG };
