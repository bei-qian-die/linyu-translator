'use strict';

// 第二十轮策展源 · 淋威争锋分区（词库 + 句式）
//
// 口径同 Nineteenth 轮：
//   - zh 是中文原词，linyu 是本区的淋语译法；多种译法全部塞进 alias（顿号分隔），
//     同义变体绝不拆成独立词条
//   - slot 一律取 scripts/slot-taxonomy20.js 里的 key，多值用 / 分隔
//   - source 只写能回源的链接（B 站视频 / 官网 / 百科），不写「网络」这种无法核对的来源
//   - pop 由 apply-linyu20.js 用 corpus/*.txt 逐字计数算出，这里不手写
//
// 语料依据：corpus/corpus-bili-20261026165222.txt（140 视频 / 2511 评论，漫威争锋 tag）、
//   corpus-bili20-20261026172122.txt（200 视频 / 1322 评论）、
//   corpus-bili20-20261026173637.txt（28 视频 / 1110 评论）、
//   corpus-dm20-20261026173435.txt（25 个淋威争锋视频的 649 弹幕 / 1067 评论）、
//   corpus-official20.txt（官网 54 英雄卡片）、corpus-baike20.txt（百度百科英雄词条）。
// 全部来自公开接口，未使用任何凭据。

const BV = (id) => `https://www.bilibili.com/video/${id}`;
const SEARCH = (kw) => `https://search.bilibili.com/all?keyword=${encodeURIComponent(kw)}`;
const OFFICIAL = 'https://marvelrivals.163.com/heroes/index.html';
const MG = (n) => 'https://zh.moegirl.org.cn/' + encodeURIComponent(`漫威争锋:${n}`);

// 本批语料里反复出现的出处
const SRC = {
  official: OFFICIAL,
  tag: SEARCH('淋威争锋'),
  gameTag: SEARCH('漫威争锋'),
  // 【淋威争锋】系列（甜甜痞颜）
  woBing: BV('BV1iHqQYgEtS'), // 【淋威争锋】我冰艺术大过天
  yueGuang: BV('BV1USPLebE5m'), // 【淋威争锋】漫威争锋只能有一个光，那就是我月光骑士
  woBi: BV('BV1PLua6REYV'), // 【淋威争锋】9.5赛季，我匕是唯一T0谢谢
  woJi: BV('BV1WZ6XBREKQ'), // 【淋威争锋】我基的胸部很狂野…
  woHong: BV('BV1c4wNemEZ9'), // 【淋威争锋】没人爱你们的话我红来爱你们
  fuQin: BV('BV1stPgeuEB2'), // 【淋威争锋】做一位父亲其实很简单，只要坐上去就好惹
  tieQuan: BV('BV1239bYiESm'), // 【淋威争锋】被铁拳踢的时候首先飘过来的是黑袜的闷热
  dongDong: BV('BV1kfE2zPETb'), // 【淋威争锋】只素冬冬在淋威的处女秀
  // 鑫河万点 daddy 系列
  daddyWan: BV('BV1cKpgzzEws'), // （淋威争锋）自改daddy万磁王和大包
  shouKao: BV('BV1o7pczuEBm'), // （淋威争锋）万磁王daddy的手铐play
  yeMoXia: BV('BV1pj4Cz1E6H'), // （淋威争锋）夜魔侠daddy泳装爆料（X）
  wenShen: BV('BV1gtexzfE8E'), // （淋威争锋）这位也是纹身魔法老头daddy
  tieNan: BV('BV1mMGnzDEt5'), // （淋威争锋）这下不得不吃铁男的激光了
  boShi: BV('BV1ptM3zGEhd'), // （淋威争锋）有点像博士的超绝不经意露出
  dongBing: BV('BV1avaQzAE74'), // （淋威争锋）忍不住对冬兵again了
  // 其他作者
  suShan: BV('BV1Ar69BxEek'), // 【淋威争锋】你苏珊为这个家付出的太多了
  jinZhu: BV('BV1K9Pie7EZC'), // 【淋威争锋】西景镇颁布禁蛛令
  jiaoChou: BV('BV1BHjrzTEbk'), // ［淋威争锋］对比雷神不同皮肤的脚臭程度
  leiGuang: BV('BV1Y57j6UEkU'), // [淋威争锋] 雷光鲜榨
  nbcs: BV('BV1QJoZYeEUb'), // 「淋威争锋」治愈并保护大家？NBCS！
  xiLin: BV('BV15B3v6WEag'), // 【淋威争锋】我们心有淋吸~不是吗~
  meiBiao: BV('BV1BHjrzTEbk'), // 【淋威争锋】美国彪子啊不是宝子，向你致敬
  zhiZhu1: BV('BV1pn8uzRE61'), // 【淋威蜘蛛侠2】第一集
  zhiZhu3: BV('BV13f84zXE5N'), // 【淋威蜘蛛侠2】第三集
  // 官方与社区
  dongBingSkin: BV('BV1Gino6qEJJ'), // 冬兵「星河神兵」官方皮肤公告
  saiShi: BV('BV1sDnR6JEUm'), // 鲨鱼三T帮助REJECT复活的阵容！漫威争锋季后赛决赛
  xuanJiao: BV('BV1KeJb6GExo'), // 漫威选角最正常的一集
  qianHuan: BV('BV1Zzes6HEey'), // 国外女主播cos李千欢睡衣
  jeff: 'https://www.bilibili.com/read/cv40893634', // 《漫威争锋》杰夫的历史
};

const WORDS = [
  // ================= 一、分区整名与玩家群体 =================
  {
    zh: '漫威争锋',
    linyu: '淋威争锋',
    alias: '淋威争锋、淋威、Marvel Rivals、MR',
    slot: '淋威争锋/分区',
    sense: '游戏整名的淋化写法，把「漫威」换成「淋威」；沿用项目「游戏原名淋化」惯例（洛克王国→洛克淋国）。',
    source: SRC.tag,
    rel: ['淋威人', '淋系玩家'],
  },
  {
    zh: 'Marvel Rivals',
    linyu: '淋威争锋',
    alias: '淋威争锋、漫威争锋、Marvel Rivals',
    slot: '淋威争锋/分区',
    sense: '英文名的淋化写法，评论区里英文原名与淋化名混用。',
    source: SRC.gameTag,
  },
  {
    zh: '漫威争锋玩家',
    linyu: '淋威人',
    alias: '淋威人、淋系玩家',
    slot: '淋威争锋/分区',
    sense: '淋威区玩家的自称：先有「淋系玩家」泛指玩淋语的玩家，再缩成「淋威人」专指本区玩家。语料原句是「每次想找人一起打，但淋威人太少找不到人」。',
    source: SRC.woJi,
  },
  {
    zh: '淋语玩家',
    linyu: '淋系玩家',
    alias: '淋系玩家、淋人、淋系',
    slot: '淋威争锋/分区',
    sense: '把「玩得懂淋语」当成身份标签的说法，语料原句「这游戏很多淋系玩家，经常能在快速遇到」。',
    source: SRC.woJi,
  },
  {
    zh: '淋语玩家群',
    linyu: '淋群',
    alias: '淋群、淋语群',
    slot: '淋威争锋/分区',
    sense: '淋系玩家联机群的简称，语料原句「这游戏有没有淋群惹」「请问有淋群吗」。',
    source: SRC.woJi,
  },
  {
    zh: '淋语浓度',
    linyu: '淋度',
    alias: '淋度、淋语浓度',
    slot: '淋威争锋/淋威整活梗',
    sense: '评价一条文案够不够淋的量化说法，语料原句「我去，淋度极高的视频，你到底是怎么做到的」。',
    source: SRC.woJi,
  },
  {
    zh: '淋语游戏',
    linyu: '淋game',
    alias: '淋game、淋系游戏',
    slot: '淋威争锋/分区',
    sense: '把「被淋语占领的游戏」说成淋game，语料原句「最爱看的淋game」。',
    source: SRC.woBing,
  },
  {
    zh: '淋语视频',
    linyu: '淋系视频',
    alias: '淋系视频、淋语视频',
    slot: '淋威争锋/分区',
    sense: 'UP 主产出的淋语文案视频，语料原句「啊啊啊我痞终于更新淋系视频惹」。',
    source: SRC.woJi,
  },
  {
    zh: '淋语圈子',
    linyu: '淋文化',
    alias: '淋文化、淋语圈',
    slot: '淋威争锋/淋威整活梗',
    sense: '淋语本身有一整套圈子规矩，语料原句「果然不管什么圈子都有这种淋文化」。',
    source: SRC.woBing,
  },
  {
    zh: '通讯录',
    linyu: '通讯录',
    alias: '通讯录、集美、姐妹',
    slot: '淋威争锋/分区',
    sense: '淋语圈的自称代词，本区联机群直接叫「通讯录联机游戏群」。',
    source: SRC.woJi,
  },

  // ================= 二、官方职责与位分黑话 =================
  {
    zh: '捍卫者',
    linyu: '捍卫者',
    alias: '捍卫者、坦克位、前排',
    slot: '淋威争锋/淋威英雄位分',
    sense: '官方三种职责之一（Vanguard），扛伤开路的那一档；玩家口语按职能叫「坦克位」「前排」。',
    source: SRC.official,
  },
  {
    zh: '决斗家',
    linyu: '决斗家',
    alias: '决斗家、输出位',
    slot: '淋威争锋/淋威英雄位分',
    sense: '官方三种职责之一（Duelist），负责打输出的一档。',
    source: SRC.official,
  },
  {
    zh: '策略家',
    linyu: '策略家',
    alias: '策略家、奶位、奶妈',
    slot: '淋威争锋/淋威英雄位分',
    sense: '官方三种职责之一（Strategist），负责治疗与增益；玩家一律喊「奶位」「奶妈」。',
    source: SRC.official,
  },
  {
    zh: '全能英雄',
    linyu: '全能英雄',
    alias: '全能英雄、三修',
    slot: '淋威争锋/淋威英雄位分',
    sense: '死侍的官方定位：捍卫者 / 决斗家 / 策略家三种职责都能切，官网原话是「（死侍自称）」。',
    source: 'https://marvelrivals.163.com/heroes/index.html?id=8d2e773d-ff5a-440e-9623-e0d46bbeca9e',
  },
  {
    zh: '治疗位',
    linyu: '奶位',
    alias: '奶位、奶妈、主奶',
    slot: '淋威争锋/淋威英雄位分',
    sense: '把策略家按职能叫「奶位」，语料原句「奶位就是舒服啊」。',
    source: SRC.woJi,
  },
  {
    zh: '三奶阵容',
    linyu: '三奶',
    alias: '三奶、三辅、三奶防守',
    slot: '淋威争锋/淋威模式玩法',
    sense: '三策略家抱团的防守阵容，语料原句「还让GNG拿到了亚当洛基的三奶防守」。',
    source: SRC.saiShi,
  },
  {
    zh: '后排输出',
    linyu: '后排',
    alias: '后排、后排双辅',
    slot: '淋威争锋/淋威模式玩法',
    sense: '报点时按站位分工的叫法，语料原句「7分半的那一波后排双辅和冬兵报团为什么先找冬兵」。',
    source: SRC.saiShi,
  },
  {
    zh: '挂机',
    linyu: '挂机',
    alias: '挂机、摆烂、送',
    slot: '淋威争锋/淋威模式玩法',
    sense: '排队里最招骂的行为，语料原句「队友牌皇上来挂机三分钟，天神3啊」。',
    source: SRC.saiShi,
  },

  // ================= 三、地图与模式 =================
  {
    zh: '阿斯加德',
    linyu: '阿斯加德',
    alias: '阿斯加德、阿斯加德人、仙宫、世界树',
    slot: '淋威争锋/淋威地图舞台',
    sense: '阿斯加德（Asgard）与连接十界的世界树融合后的地图组，含「仙宫」与「世界树」两张。',
    source: 'https://marvelrivals.163.com/',
  },
  {
    zh: '仙宫',
    linyu: '仙宫',
    alias: '仙宫、阿斯加德-仙宫',
    slot: '淋威争锋/淋威地图舞台',
    sense: '阿斯加德地图组的一张，洛基在时间流纠缠后建立新王国的地方。',
    source: 'https://marvelrivals.163.com/',
  },
  {
    zh: '蜘蛛岛',
    linyu: '蜘蛛岛',
    alias: '蜘蛛岛、东京2099-蜘蛛岛',
    slot: '淋威争锋/淋威地图舞台',
    sense: '东京 2099 地图组的一张，语料里有「蜘蛛岛海拉36杀全程爆头」的实况标题。',
    source: BV('BV1sHnb6VEGC'),
  },
  {
    zh: '时代广场',
    linyu: '时代广场',
    alias: '时代广场、皮姆三明治',
    slot: '淋威争锋/淋威地图舞台',
    sense: '纽约地图组的一张，语料原句「灭霸别得意，有本事来时代广场对掏」。',
    source: SRC.woBing,
  },
  {
    zh: '昆仑',
    linyu: '昆仑',
    alias: '昆仑、昆仑天都之心',
    slot: '淋威争锋/淋威地图舞台',
    sense: '与世隔绝的圣城，每十年开放一次入口，是铁拳（林烈）的主场地图。',
    source: 'https://marvelrivals.163.com/',
  },
  {
    zh: '底比斯',
    linyu: '底比斯',
    alias: '底比斯',
    slot: '淋威争锋/淋威地图舞台',
    sense: '月光骑士为了孔苏而来的坍缩时间线，红兜帽在此盗走死亡与熵石板。',
    source: 'https://marvelrivals.163.com/',
  },
  {
    zh: '克林塔',
    linyu: '克林塔',
    alias: '克林塔、深渊王座、天神遗骸',
    slot: '淋威争锋/淋威地图舞台',
    sense: '共生体巨龙盘踞的地下世界地图组，含「深渊王座」与「天神遗骸」。',
    source: 'https://marvelrivals.163.com/',
  },
  {
    zh: '九头蛇',
    linyu: '九头蛇',
    alias: '九头蛇、夏提厄冰山',
    slot: '淋威争锋/淋威地图舞台',
    sense: '九头蛇基地地图组，含「夏提厄冰山」。',
    source: 'https://marvelrivals.163.com/',
  },
  {
    zh: '瓦坎达',
    linyu: '瓦坎达',
    alias: '瓦坎达、黄金之城、贾利亚神殿',
    slot: '淋威争锋/淋威地图舞台',
    sense: '银河帝国瓦坎达地图组，含「黄金之城」与「贾利亚神殿」，是黑豹的主场。',
    source: 'https://marvelrivals.163.com/',
  },
  {
    zh: '东京2099',
    linyu: '东京2099',
    alias: '东京2099、新涩谷区',
    slot: '淋威争锋/淋威地图舞台',
    sense: '2099 时间线的东京地图组，含「新涩谷区」与「蜘蛛岛」。',
    source: 'https://marvelrivals.163.com/',
  },
  {
    zh: '地狱火晚宴',
    linyu: '地狱火晚宴',
    alias: '地狱火晚宴、阿拉寇',
    slot: '淋威争锋/淋威地图舞台',
    sense: '变种人岛屿克拉科与阿拉寇融合后的地图，白皇后上线赛季的主舞台。',
    source: 'https://marvelrivals.163.com/',
  },
  {
    zh: '占点',
    linyu: '占点',
    alias: '占点、占会挨打',
    slot: '淋威争锋/淋威模式玩法',
    sense: '推进到点内抢百分比的核心玩法，语料原句「不占点就会输，占会挨打，挨打就死」。',
    source: SRC.woJi,
  },
  {
    zh: '推车',
    linyu: '推车',
    alias: '推车、护送',
    slot: '淋威争锋/淋威模式玩法',
    sense: '护送载具前进的模式叫法，语料原句「小推车不会被撵吗」。',
    source: SRC.woBing,
  },
  {
    zh: '人机对战',
    linyu: 'pve',
    alias: 'pve、打灭霸、丧尸女王',
    slot: '淋威争锋/淋威模式玩法',
    sense: 'PVE 模式在本区一律喊 pve，其中「打灭霸」「丧尸女王」是两个常被单独点名的关卡。',
    source: SRC.leiGuang,
  },

  // ================= 四、皮肤经济 =================
  {
    zh: '金色品质皮肤',
    linyu: '金皮',
    alias: '金皮、金色皮肤',
    slot: '淋威争锋/淋威皮肤潮流',
    sense: '最高一档皮肤品质，玩家用它衡量官方对某个英雄的重视程度；语料原句「依旧丑的设计做金皮，好看的全是紫」。',
    source: SRC.dongBingSkin,
  },
  {
    zh: '紫色品质皮肤',
    linyu: '紫皮',
    alias: '紫皮、紫色皮肤',
    slot: '淋威争锋/淋威皮肤潮流',
    sense: '低于金皮一档，玩家用它吐槽待遇：语料原句「寡姐却又进入了连紫皮都没有的处境」。',
    source: SRC.xuanJiao,
  },
  {
    zh: '泳装皮肤',
    linyu: '泳装皮',
    alias: '泳装皮、泳装、下海卖肉',
    slot: '淋威争锋/淋威皮肤潮流',
    sense: '泳装通行证是每个赛季的热度中心，玩家拿它当待遇对比的刻度：语料原句「队2皮和泳装皮一个众望所归一个下海卖肉」。',
    source: SRC.dongBingSkin,
  },
  {
    zh: '限时上架',
    linyu: '限时',
    alias: '限时、限时上架',
    slot: '淋威争锋/淋威皮肤潮流',
    sense: '皮肤的售卖方式，限时与常驻的差别是玩家最常吵的话题。',
    source: SRC.dongBingSkin,
  },
  {
    zh: '常驻皮肤',
    linyu: '常驻',
    alias: '常驻、常驻金皮',
    slot: '淋威争锋/淋威皮肤潮流',
    sense: '不限时、随时能买的皮肤；语料原句「霓虹天籁」就是冰月花雪的常驻金皮。',
    source: SRC.dongBingSkin,
  },
  {
    zh: '皮肤',
    linyu: '皮肤',
    alias: '皮肤、皮、二手皮',
    slot: '淋威争锋/淋威皮肤潮流',
    sense: '本区最重要的经济系统与话题中心，一个英雄待遇好不好全看皮多不多。',
    source: SRC.dongBingSkin,
  },

  // ================= 五、本区通用梗与淋语口癖 =================
  {
    zh: '是无所谓吗',
    linyu: 'NBCS',
    alias: 'NBCS、nbcs',
    slot: '淋威争锋/淋威整活梗',
    sense: '「nobody cares」的缩写，本区用来表达漠不关心；语料原句「我红的e有点nbcs」「nbcs地雷女」。',
    source: SRC.nbcs,
  },
  {
    zh: '是在问出处吗',
    linyu: '素在',
    alias: '素在、素在？、素在🫦',
    slot: '淋威争锋/淋威整活梗',
    sense: '「是在？」的淋化写法，本区问封面/素材出处的固定说法（素＝是）：语料原句「封面素在？」「这个大招素在？」。',
    source: SRC.woJi,
  },
  {
    zh: '妈呀',
    linyu: '玛雅',
    alias: '玛雅、玛雅大姐、玛雅哒姐、玛雅大街',
    slot: '淋威争锋/淋威整活梗',
    sense: '「妈呀」的淋化谐音，本区出现频率最高的一个叹词，写法还能继续淋化成「玛雅大街」「玛雅哒姐」。',
    source: SRC.woBing,
  },
  {
    zh: '快点更新',
    linyu: 'soon',
    alias: 'soon、soon出',
    slot: '淋威争锋/淋威整活梗',
    sense: '直接用英文 soon 催更，语料原句「soon出出处，否则我红的黑暗魔法可不是好惹的」「下期，soon soon端上来」。',
    source: SRC.woHong,
  },
  {
    zh: '再来一次',
    linyu: 'again',
    alias: 'again',
    slot: '淋威争锋/淋威整活梗',
    sense: '英文直接嵌进标题的构词习惯，语料原句「（淋威争锋）忍不住对冬兵again了」。',
    source: SRC.dongBing,
  },
  {
    zh: '心有灵犀',
    linyu: '心有淋吸',
    alias: '心有淋吸、淋吸',
    slot: '淋威争锋/淋威整活梗',
    sense: '「心有灵犀」的淋化谐音，语料原句出自标题《【淋威争锋】我们心有淋吸~不是吗~》。',
    source: SRC.xiLin,
  },
  {
    zh: '拳死',
    linyu: '拳鼠',
    alias: '拳鼠、被黑豹daddy拳鼠',
    slot: '淋威争锋/淋威整活梗',
    sense: '「拳死」的淋化谐音（死→鼠），语料原句「被黑豹daddy拳鼠惹」。',
    source: SRC.woBing,
  },
  {
    zh: '赔钱货',
    linyu: '赔钱货',
    alias: '赔钱货、拒做赔钱货',
    slot: '淋威争锋/淋威整活梗',
    sense: '淋语里骂人没用的老词，本区用来吐槽强度垫底的英雄：语料原句「从此拒做赔钱货改成真男人」。',
    source: SRC.woBing,
  },
  {
    zh: '好厉害',
    linyu: '喜翻',
    alias: '喜翻、喜翻惹',
    slot: '淋威争锋/淋威整活梗',
    sense: '「喜欢」的淋化谐音（欢→翻），语料原句「素淋威争锋，喜翻惹喜翻惹」。',
    source: SRC.xiLin,
  },
  {
    zh: '蜘蛛女孩的昵称',
    linyu: '喜蛛妹',
    alias: '喜蛛妹',
    slot: '淋威争锋/淋威整活梗',
    sense: '把蜘蛛侠粉丝/蜘蛛系角色叫成「喜蛛妹」，语料原句「喜蛛妹来噜」。',
    source: SRC.woHong,
  },
  {
    zh: '大人',
    linyu: 'daddy',
    alias: 'daddy、Daddy、dad',
    slot: '淋威争锋/淋威整活梗',
    sense: '本区最成体系的称呼后缀：英雄名后面直接挂 daddy（万磁王daddy、黑豹daddy、夜魔侠daddy、林烈daddy、铁人daddy）。',
    source: SRC.daddyWan,
  },
  // ================= 五之二、版本与赛事经济 =================
  {
    zh: '终极技能',
    linyu: '大招',
    alias: '大招、终极技能',
    slot: '淋威争锋/淋威模式玩法',
    sense: '本区一律叫大招，语料原句「大招2段后，普攻衔接a3」。',
    source: SRC.woBing,
  },
  {
    zh: '连携技能',
    linyu: '连携技',
    alias: '连携技、连携',
    slot: '淋威争锋/淋威连携组合',
    sense: '特定英雄组合才能触发的联动技能，本区简称连携技；语料原句「我请问你磁的连携技能放着不用素在」。',
    source: SRC.boShi,
  },
  {
    zh: '被加强',
    linyu: '加强',
    alias: '加强、被加强',
    slot: '淋威争锋/淋威模式玩法',
    sense: '版本更新的三个方向之一，玩家拿它衡量一个英雄的处境。',
    source: SRC.dongBingSkin,
  },
  {
    zh: '被削弱',
    linyu: '削弱',
    alias: '削弱、惨遭削弱',
    slot: '淋威争锋/淋威模式玩法',
    sense: '与加强相对，本区吐槽常用的说法是「惨遭削弱」；语料原句「你摩再次惨遭削弱」。',
    source: SRC.woHong,
  },
  {
    zh: '技能重做',
    linyu: '重做',
    alias: '重做、被重做',
    slot: '淋威争锋/淋威模式玩法',
    sense: '第三个版本方向；重做往往意味着强度与待遇一起变，语料原句「还遇到重做，也能上场了」。',
    source: SRC.xuanJiao,
  },
  {
    zh: '赛季通行证',
    linyu: '通行证',
    alias: '通行证、赛季通行证',
    slot: '淋威争锋/淋威皮肤潮流',
    sense: '每个赛季的付费皮肤通道，玩家对它的评价标准是「一个小通行证一个金皮都没有」。',
    source: SRC.dongBingSkin,
  },
  {
    zh: '版本',
    linyu: '版本',
    alias: '版本、版本之子',
    slot: '淋威争锋/淋威模式玩法',
    sense: '英雄强弱随版本起伏，语料原句「漫威争锋版本T0输出」。',
    source: SRC.leiGuang,
  },
  {
    zh: '强度',
    linyu: '强度',
    alias: '强度、强度排行',
    slot: '淋威争锋/淋威模式玩法',
    sense: '玩家讨论英雄的第一维度，与待遇（皮肤数量）并列成本区两大话题。',
    source: SRC.leiGuang,
  },
  {
    zh: '队友',
    linyu: '队友',
    alias: '队友、队伍',
    slot: '淋威争锋/淋威模式玩法',
    sense: '所有吐槽的源头，语料原句「这么努力在C结果队友全在送」。',
    source: SRC.saiShi,
  },
  {
    zh: '秒杀',
    linyu: '秒了',
    alias: '秒了、秒杀',
    slot: '淋威争锋/淋威整活梗',
    sense: '淋语里表赞叹的动词，语料原句「我匕真的秒了~」。',
    source: SRC.woBi,
  },
  {
    zh: '角色建模',
    linyu: '建模',
    alias: '建模、建模组',
    slot: '淋威争锋/淋威皮肤潮流',
    sense: '本区讨论造型的核心词，夸与骂都用它：语料原句「人类建模史上永垂不朽的，巅峰」。',
    source: SRC.xuanJiao,
  },
  {
    zh: '官方制作团队',
    linyu: '制作组',
    alias: '制作组、策划、官方',
    slot: '淋威争锋/淋威赛事圈',
    sense: '玩家的吐槽对象，语料原句「制作组都弃疗了」「美术骑着策划上班的网易」。',
    source: SRC.woBing,
  },
  {
    zh: '制作人外号',
    linyu: '黑帮火锅',
    alias: '黑帮火锅、Danny Koo',
    slot: '淋威争锋/淋威赛事圈',
    sense: '玩家给漫威游戏执行制片人 Danny Koo 起的中文外号，起因是他在皮肤里塞自己名字彩蛋被扒出。',
    source: 'https://bbs.nga.cn/read.php?tid=47303235',
  },
  {
    zh: '官方偏爱',
    linyu: '内部爱',
    alias: '内部爱、皇族',
    slot: '淋威争锋/淋威赛事圈',
    sense: '玩家批判官方偏袒某个角色的说法，语料原句「从漫威超级战争开始就是内部爱」。',
    source: 'https://bbs.nga.cn/read.php?tid=47303235',
  },
  {
    zh: '复活点',
    linyu: '复活室',
    alias: '复活室、复活点',
    slot: '淋威争锋/淋威模式玩法',
    sense: '阵亡后等待复活的房间，语料原句「奶妈在复活室呆几秒变成了石头人叔叔怎么办」。',
    source: SRC.woBing,
  },
  {
    zh: '太平洋赛区',
    linyu: '太平洋赛区',
    alias: '太平洋赛区、季后赛',
    slot: '淋威争锋/淋威赛事圈',
    sense: '国服玩家最关注的赛区，语料原句「漫威争锋太平洋赛区REJECT vs GNG 图三」。',
    source: SRC.saiShi,
  },
  {
    zh: '天神段位',
    linyu: '天神',
    alias: '天神、天神3、白金',
    slot: '淋威争锋/淋威赛事圈',
    sense: '竞技模式的高段位叫法，语料原句「我已经在天神3保卫战了」「不是白金三」。',
    source: SRC.saiShi,
  },
  {
    zh: '钩锁技能',
    linyu: '钩子',
    alias: '钩子、钩锁',
    slot: '淋威争锋/淋威英雄位分',
    sense: '冬兵的标志性技能，语料原句「我冬的钩子吸力十足」。',
    source: SRC.dongDong,
  },
  {
    zh: '淋语圈地名',
    linyu: '地才城',
    alias: '地才城',
    slot: '淋威争锋/淋威整活梗',
    sense: '淋语圈里被当作地名用的老梗，本区拿它问人「还有在玩地才城吗」。',
    source: SRC.woJi,
  },
  {
    zh: '游戏里的男性角色',
    linyu: '你漫的男人',
    alias: '你漫的男人、淋威的男人',
    slot: '淋威争锋/淋威整活梗',
    sense: '把游戏里的男性角色当成集体来馋的说法，语料原句「你漫的男人真素可口」。',
    source: SRC.woJi,
  },

];

  // ================= 六、「我X / 你X」自称体系 =================
// 本区最核心的构词法：把英雄名压成一个字，前面挂「我」表示我玩 TA、挂「你」表示你玩 TA。
// 语料里已实证的有 我基 / 我匕 / 我红 / 我冰 / 我冬 / 我月光骑士 / 我烈 / 我星 / 我风 /
// 你苏珊 / 你磁 / 你摩 / 你拳 / 你痞，其余是本区仍在扩展的同类构词。
const SELF = [
  { zh: '猩红女巫的自称', linyu: '我红', alias: '我红、你红、我神美红', src: SRC.woHong, sense: '本区用得最凶的一个自称：把旺达压成一个「红」字，配合「母亲」梗成句（没人爱你们的话我红来爱你们）。' },
  { zh: '洛基的自称', linyu: '我基', alias: '我基、你基、淋基', src: SRC.woJi, sense: '洛基压成「基」字，是本区唯一被写成长篇赞歌的自称（我基的胸部很狂野……）。' },
  { zh: '冰月花雪的自称', linyu: '我冰', alias: '我冰、你冰', src: SRC.woBing, sense: 'K-pop 偶像角色的自称，评论区里「我冰/你冰」几乎成对出现（我冰掌掴一众赔钱货、你冰是kpop靴靴）。' },
  { zh: '斗篷与匕首的自称', linyu: '我匕', alias: '我匕、匕匕、斗匕', src: SRC.woBi, sense: '双人英雄压成「匕」字，语料原句「9.5赛季，我匕是唯一T0谢谢」「因為那素對面的匕匕」。' },
  { zh: '冬兵的自称', linyu: '我冬', alias: '我冬、冬冬', src: SRC.dongDong, sense: '冬兵压成「冬」字，叠字成「冬冬」是撒娇版，语料原句「只素冬冬在淋威的处女秀」。' },
  { zh: '月光骑士的自称', linyu: '我月光骑士', alias: '我月光骑士、我月光', src: SRC.yueGuang, sense: '本区唯一不压字的自称，因为「只能有一个光」这个梗必须保留全名。' },
  { zh: '铁拳的自称', linyu: '我烈', alias: '我烈、你烈、林烈daddy', src: SRC.tieQuan, sense: '铁拳本名林烈，玩家取「烈」字；语料原句「我烈好广阔的胸怀」「你烈现在x上本子好多惹」。' },
  { zh: '星爵的自称', linyu: '我星', alias: '我星、你星', src: SRC.woHong, sense: '星爵压成「星」字，语料原句「不许诋毁我星是胖头苍蝇靴靴」。' },
  { zh: '暴风女的自称', linyu: '我风', alias: '我风、你风', src: SRC.woHong, sense: '暴风女取「风」字，语料原句「我风大招超绝充能速度超绝伤害超绝范围超绝机动超绝生存」。' },
  { zh: '隐形女的自称', linyu: '你苏珊', alias: '你苏珊、苏珊、你苏', src: SRC.suShan, sense: '隐形女本名苏珊·斯托姆，本区不压字而直呼本名，语料原句「你苏珊为这个家付出的太多了」。' },
  { zh: '万磁王的称呼', linyu: '你磁', alias: '你磁、万磁王daddy', src: SRC.woHong, sense: '万磁王压成「磁」字，daddy 形态是本区二创最多的写法。' },
  { zh: '纳摩的称呼', linyu: '你摩', alias: '你摩', src: SRC.woHong, sense: '纳摩压成「摩」字，语料原句「你摩再次惨遭削弱」。' },
  { zh: '铁拳的称呼', linyu: '你拳', alias: '你拳', src: SRC.woBing, sense: '取技能名的「拳」字，语料原句「你拳只会赐予我冰无限爱与被爱的力量」。' },
  { zh: 'UP主甜甜痞颜的称呼', linyu: '你痞', alias: '你痞、我痞、痞颜', src: SRC.woJi, sense: '观众对 UP 主的称呼也进同一套构词法，语料原句「你痞一daddy两吃素在?」「我痞终于更新淋系视频惹」。' },
  { zh: '蜘蛛侠粉丝的自称', linyu: '喜蛛妹', alias: '喜蛛妹、蛛蛛', src: SRC.zhiZhu3, sense: '蜘蛛系角色与粉丝的自称，语料原句「喜蛛妹来噜」。' },
  { zh: '美国队长的称呼', linyu: '美国彪子', alias: '美国彪子、美国宝子、美队、队长', src: SRC.meiBiao, sense: '「宝子」被拟音错位成「彪子」，是本区少数靠读音玩笑产生的称呼。' },
];
for (const s of SELF) {
  WORDS.push({
    zh: s.zh,
    linyu: s.linyu,
    alias: s.alias,
    slot: '淋威争锋/淋威自称体系',
    sense: s.sense,
    source: s.src,
    rel: [],
  });
}

// ================= 七、54 位英雄本体 =================
// 位分口径取自官网英雄卡片 data-tag（corpus-official20.txt 逐字可核）；
// 外号一律只收社区真在用的叫法，没有实证的一律留空、不再硬造。
// [名称, 淋语外号, 其他别名, 官方位分, 出处, 说明]
const HERO_WORDS = [
  ['美国队长', '美队', '美队、队长、美国宝子、美国彪子、Captain America', '捍卫者', SRC.meiBiao, '举盾冲锋的复仇者领袖，玩家不爱念全名，一律喊美队。'],
  ['奇异博士', '博士', '博士、纹身魔法老头、Doctor Strange', '捍卫者', SRC.boShi, '至尊法师，本区按年龄感的玩笑叫他「纹身魔法老头」。'],
  ['格鲁特', '树人', '树人、Groot', '捍卫者', SRC.woJi, '台词只有「我是格鲁特」的花神巨像，玩家按外形叫树人。'],
  ['浩克', '绿巨人', '绿巨人、班纳博士、Hulk', '捍卫者', SRC.woHong, '布鲁斯·班纳变身后的绿色巨人，两个称呼本区都在用。'],
  ['万磁王', '万磁王daddy', '你磁、万磁王daddy、Magneto', '捍卫者', SRC.daddyWan, '本区 daddy 梗的头号载体，老派叫法是压成单字的「你磁」。'],
  ['潘妮·帕克', '潘妮帕克', '潘妮帕克、SP//dr、Peni Parker', '捍卫者', SRC.official, '驾驶蜘蛛机甲的少女，与毒液、蜘蛛侠有「共生体羁绊」连携。'],
  ['索尔', '雷神', '雷神、雷神哥、Thor', '捍卫者', SRC.jiaoChou, '妙尔尼尔锤在手，玩家沿用影视译名叫他雷神。'],
  ['毒液', '猛毒', '猛毒、黑衣之王、Venom', '捍卫者', SRC.jeff, '埃迪·布洛克与共生体，台译「猛毒」在简中社区也常用。'],
  ['石头人', '母石头人', '母石头人、岩石人、The Thing', '捍卫者', SRC.woBing, '神奇四侠的岩石大力士，本区按外形加个「母」字当外号。'],
  ['白皇后', '艾玛', '艾玛、艾玛·弗斯特、妈咪、Emma Frost', '捍卫者', 'https://www.163.com/dy/article/JT648QLP0526D8LR.html', '心灵感应变种人，二创热潮里玩家直接喊她妈咪。'],
  ['安吉拉', '安吉拉宝贝', '安吉拉宝贝、Angela', '捍卫者', SRC.woBing, '来自天使界的大块头女战士，外号按梗图叫「安吉拉宝贝」。'],
  ['小淘气', '罗刹女', '罗刹女、Rogue', '捍卫者', MG('小淘气'), '接触即吸收对方能力的变种人，老译名罗刹女仍在用。'],
  ['恶魔恐龙', '恐龙', '恐龙、恐龙宝贝、Devil Dinosaur', '捍卫者', SRC.official, '体型巨大的红色恐龙，玩家直接喊恐龙。'],
  ['红兜帽', '兜帽', '兜帽、The Hood', '捍卫者', 'https://marvelrivals.163.com/', '帕克·罗宾斯，靠兜帽汲取黑暗力量，玩家省字叫兜帽。'],

  ['黑寡妇', '寡姐', '寡姐、寡妇、Black Widow', '决斗家', SRC.xuanJiao, '娜塔莎·罗曼诺夫，玩家按演员外号习惯叫她寡姐。'],
  ['黑豹', '黑豹daddy', '黑豹daddy、Black Panther', '决斗家', SRC.woBing, '瓦坎达国王，daddy 系列里出场频率第二高的角色。'],
  ['鹰眼', '鹰眼', '鹰眼、Hawkeye', '决斗家', SRC.woHong, '克林特·巴顿，箭矢带多种特效，名字没有任何简化空间。'],
  ['海拉', '死亡女神', '死亡女神、Hela', '决斗家', SRC.dongBingSkin, '奥丁长女，玩家按身份叫她死亡女神。'],
  ['铁拳', '我烈', '我烈、你烈、林烈daddy、Iron Fist', '决斗家', SRC.tieQuan, '林烈，本区黑袜与 daddy 二创密度最高的角色。'],
  ['钢铁侠', '铁皮人', '铁皮人、铁人、铁男、Iron Man', '决斗家', SRC.tieNan, '托尼·斯塔克，被玩家按战甲质地改成铁皮人。'],
  ['魔剑客', '秘客', '秘客、Magik', '决斗家', MG('魔剑客'), '伊丽亚娜·拉斯普廷，灵魂剑加地狱边境位移。'],
  ['神奇先生', '哈哈男', '哈哈男、橡皮人、Mister Fantastic', '决斗家', 'https://post.smzdm.com/p/axklelx3', '里德·理查兹，社区热梗是「哈哈！赖着硬不死」的哈哈男。'],
  ['月光骑士', '我月光骑士', '我月光骑士、骑士、Moon Knight', '决斗家', SRC.yueGuang, '孔苏的代理人，本区口号是「只能有一个光，那就是我月光骑士」。'],
  ['纳摩', '你摩', '你摩、Namor', '决斗家', SRC.woHong, '亚特兰蒂斯国王，本区按「你X」构词法叫他你摩。'],
  ['灵蝶', 'Psy', 'Psy、灵能忍者、Psylocke', '决斗家', 'https://www.163.com/dy/article/JT648QLP0526D8LR.html', '开服时被称为「审美回归第一枪」的灵能忍者。'],
  ['猩红女巫', '我红', '我红、你红、旺达、Scarlet Witch', '决斗家', SRC.woHong, '旺达·马克西莫夫，本区把她和「母亲」牢牢绑在一起。'],
  ['蜘蛛侠', '淋威蜘蛛侠', '淋威蜘蛛侠、蛛蛛、小蜘蛛、Spider-Man', '决斗家', SRC.zhiZhu1, '彼得·帕克，本区直接有以他命名的系列《淋威蜘蛛侠2》。'],
  ['松鼠女', '松鼠女孩', '松鼠女孩、Squirrel Girl', '决斗家', MG('松鼠女'), '多琳·格林，召唤松鼠军团，设定上能打赢灭霸。'],
  ['星爵', '我星', '我星、你星、Star-Lord', '决斗家', SRC.woHong, '彼得·奎尔，按「我X」构词法压成我星。'],
  ['暴风女', '我风', '我风、你风、风暴女神、Storm', '决斗家', SRC.woHong, '奥罗罗·门罗，X 战警成员，压成单字我风。'],
  ['惩罚者', '制裁者', '制裁者、The Punisher', '决斗家', SRC.woBing, '弗兰克·卡塞尔，旧译「制裁者」在国内老漫画读者里通用。'],
  ['冬兵', '我冬', '我冬、冬冬、巴基、Winter Soldier', '决斗家', SRC.dongBing, '巴基·巴恩斯，钩锁把人钩过来，again 梗的主角。'],
  ['金刚狼', '狼叔', '狼叔、罗根、Wolverine', '决斗家', MG('金刚狼'), '罗根，艾德曼合金爪，玩家按年龄习惯喊狼叔。'],
  ['霹雳火', '约翰尼', '约翰尼、火焰人、Human Torch', '决斗家', 'https://post.smzdm.com/p/axklelx3', '约翰尼·斯托姆，社区长期替他抱不平：元老英雄却没金皮。'],
  ['凤凰女', '琴', '琴、琴·葛蕾、Marvel Girl、Phoenix', '决斗家', MG('凤凰女'), '琴·葛蕾，凤凰之力宿主，玩家直接取名字首字。'],
  ['刀锋战士', '日行者', '日行者、Blade', '决斗家', MG('刀锋战士'), '埃里克·布鲁克斯，吸血鬼猎人，日行者是他的称号。'],
  ['夜魔侠', '夜魔侠daddy', '夜魔侠daddy、超胆侠、Daredevil', '决斗家', SRC.yeMoXia, '马特·默多克，daddy 系列里泳装爆料那条的主角。'],
  ['艾尔莎·血石', '艾尔莎', '艾尔莎、Elsa Bloodstone', '决斗家', SRC.official, '怪物猎人出身，名字太长，玩家喊首名艾尔莎。'],
  ['黑猫', '都市丽爪', '都市丽爪、Black Cat', '决斗家', 'https://danjigame.site/latest/marvel-rivals-black-cat-update', '菲丽西亚·哈代，上线时因造型引爆创作，外号取自皮肤名。'],
  ['雷光眼', '雷光', '雷光、镭射眼、Cyclops', '决斗家', SRC.leiGuang, '斯科特·萨默斯，X 战警队长，本区有以他命名的鲜榨系列。'],
  ['屠神者格尔', '格尔', '格尔、Gorr', '决斗家', 'https://marvelrivals.163.com/', '被诸神背叛后走上屠神之路，玩家省掉前缀只叫格尔。'],

  ['亚当术士', 'Adam', 'Adam、量子干部、Adam Warlock', '策略家', MG('亚当术士'), '复活链让全团有第二条命，玩家按英文首名喊 Adam。'],
  ['斗篷与匕首', '我匕', '我匕、匕匕、斗匕、Cloak & Dagger', '策略家', SRC.woBi, '双人共用一个英雄槽位，本区压成单字匕。'],
  ['隐形女', '你苏珊', '你苏珊、苏珊、隐形女侠、Invisible Woman', '策略家', SRC.suShan, '苏珊·斯托姆，本区不压字而直呼本名。'],
  ['陆行鲨杰夫', '鲨鲨', '鲨鲨、鲨狗、小鲨鲨、Jeff', '策略家', SRC.jeff, '全服公认的吉祥物，鲨狗是按外形起的另一个外号。'],
  ['洛基', '我基', '我基、你基、淋基、Loki', '策略家', SRC.woJi, '恶作剧之神，本区唯一被写成长篇赞歌的自称。'],
  ['冰月花雪', '我冰', '我冰、你冰、露娜、Luna Snow', '策略家', SRC.woBing, 'K-pop 偶像兼超能力者，玩家按艺名首字叫我冰。'],
  ['曼蒂斯', '螳螂', '螳螂、螳螂女、Mantis', '策略家', MG('曼蒂斯'), '情绪感知加睡眠控场，玩家按外形叫螳螂。'],
  ['火箭浣熊', '火箭', '火箭、Rocket、Rocket Raccoon', '策略家', MG('火箭浣熊'), '银河护卫队的机械师，名字太长直接喊火箭。'],
  ['奥创', 'Ultron', 'Ultron、机械反派', '策略家', SRC.leiGuang, '人工智能反派，PVE 模式里是阶段性 Boss。'],
  ['牌皇', '千王', '千王、Gambit', '策略家', MG('牌皇'), '雷米·勒博，纸牌能力与旧译「千王」都指他。'],
  ['白狐', '白狐姐姐', '白狐姐姐、White Fox', '策略家', SRC.dongBingSkin, '阿美·韩，与冰月花雪、铁拳同属阿特拉斯线。'],
  ['百光花火', '李千欢', '李千欢、火焰星、Firestar', '策略家', SRC.qianHuan, '安杰莉卡·琼斯，玩家沿用的是她的另一个译名李千欢。'],
  ['死侍', '小贱蛛', '小贱蛛、贱贱、Deadpool', '全能英雄', 'https://marvelrivals.163.com/heroes/index.html?id=8d2e773d-ff5a-440e-9623-e0d46bbeca9e', '官方定位全能英雄，三种职责都能切，嘴炮是他的招牌。'],
];

for (const [name, nick, alias, role, src, note] of HERO_WORDS) {
  const others = String(alias).split('、').filter((x) => x && x !== nick && x !== name);
  WORDS.push({
    zh: name,
    linyu: nick,
    alias: others.join('、'),
    slot: '淋威争锋/淋威英雄位分',
    sense: `${note}官方定位${role}，本区通行的淋语叫法是「${nick}」。`,
    source: src,
    rel: [],
  });
}

// ================= 八、句式 =================
// 纪律：句式按 seed 顺序定匹配优先级，所以本轮一律 unshift 到 rules 最前（apply-linyu20.js 负责）。
const RULES = [
  {
    pattern: '(?:淋威争锋|漫威争锋|Marvel Rivals)(?:[，,、]?\\s*启动[！!]?)?',
    template: '淋威争锋',
    note: '淋威争锋分区',
    scene: '游戏 / 分区',
    examples: '漫威争锋；淋威争锋；Marvel Rivals。',
    src: SRC.tag,
  },
  {
    pattern: '(?:^|(?<=[\\s]))【?淋威争锋】?',
    template: '【淋威争锋】',
    note: '分区招牌标题体：方括号包分区名，后面直接甩一句整活事件，不写主语。',
    scene: '视频标题',
    examples: '【淋威争锋】我冰艺术大过天；【淋威争锋】没人爱你们的话我红来爱你们；【淋威争锋】9.5赛季，我匕是唯一T0谢谢',
    src: SRC.woBing,
  },
  {
    pattern: '【?淋威蜘蛛侠】?\\d*',
    template: '【淋威蜘蛛侠】',
    note: '分区子系列标题体：蜘蛛侠单独有自己的淋化系列。',
    scene: '视频标题',
    examples: '【淋威蜘蛛侠2】第一集；【淋威蜘蛛侠2】第三集；【淋威蜘蛛侠2】第七集',
    src: SRC.zhiZhu1,
  },
  { pattern: '我(?:要|想|就)?(?:玩|用|选|是)?猩红女巫', template: '我红', note: '「我X」自称体系：猩红女巫压成我红。', scene: '自称', examples: '没人爱你们的话我红来爱你们；我红不语，只是一味slay', src: SRC.woHong },
  { pattern: '你(?:会|想)?(?:玩|用|选)?猩红女巫', template: '你红', note: '「你X」称呼体系：猩红女巫压成你红。', scene: '称呼', examples: '我红背负了太多不属于她的骂名，不会玩的人说你红是轮椅是超模', src: SRC.woHong },
  { pattern: '我(?:要|想|就)?(?:玩|用|选|是)?洛基', template: '我基', note: '「我X」自称体系：洛基压成我基。', scene: '自称', examples: '我基的胸部很狂野 屁股很坚挺 腰身很曼妙；来支持我基了', src: SRC.woJi },
  { pattern: '你(?:会|想)?(?:玩|用|选)?洛基', template: '你基', note: '「你X」称呼体系：洛基压成你基。', scene: '称呼', examples: '这jb漫威淋up与她的淋基；我请问你磁的连携技能放着不用素在', src: SRC.woJi },
  { pattern: '我(?:要|想|就)?(?:玩|用|选|是)?冰月花雪', template: '我冰', note: '「我X」自称体系：冰月花雪压成我冰。', scene: '自称', examples: '我冰艺术大过天；我冰掌掴一众赔钱货', src: SRC.woBing },
  { pattern: '你(?:会|想)?(?:玩|用|选)?冰月花雪', template: '你冰', note: '「你X」称呼体系：冰月花雪压成你冰。', scene: '称呼', examples: '你冰是kpop靴靴；你冰大招有点像高难度淋美感', src: SRC.woBing },
  { pattern: '我(?:要|想|就)?(?:玩|用|选|是)?(?:斗篷与匕首|斗篷匕首)', template: '我匕', note: '「我X」自称体系：斗篷与匕首压成我匕。', scene: '自称', examples: '9.5赛季，我匕是唯一T0谢谢；我匕自保奶量群拐秒了', src: SRC.woBi },
  { pattern: '我(?:要|想|就)?(?:玩|用|选|是)?冬兵', template: '我冬', note: '「我X」自称体系：冬兵压成我冬，叠字成冬冬是撒娇版。', scene: '自称', examples: '只素冬冬在淋威的处女秀；我冬的钩子吸力十足', src: SRC.dongDong },
  { pattern: '我(?:要|想|就)?(?:玩|用|选|是)?月光骑士', template: '我月光骑士', note: '本区唯一不压字的自称：只能有一个光这个梗必须保留全名。', scene: '自称', examples: '漫威争锋只能有一个光，那就是我月光骑士', src: SRC.yueGuang },
  { pattern: '我(?:要|想|就)?(?:玩|用|选|是)?铁拳', template: '我烈', note: '「我X」自称体系：铁拳本名林烈，取烈字。', scene: '自称', examples: '我烈好广阔的胸怀；玛雅被林烈daddy的黑袜吸引进来了', src: SRC.tieQuan },
  { pattern: '你(?:会|想)?(?:玩|用|选)?铁拳', template: '你烈', note: '「你X」称呼体系：铁拳压成你烈。', scene: '称呼', examples: '你烈现在x上本子好多惹；你拳只会赐予我冰无限爱与被爱的力量', src: SRC.tieQuan },
  { pattern: '我(?:要|想|就)?(?:玩|用|选|是)?星爵', template: '我星', note: '「我X」自称体系：星爵压成我星。', scene: '自称', examples: '不许诋毁我星是胖头苍蝇靴靴，他只是三梭子下去无事发生的可爱小男孩罢了', src: SRC.woHong },
  { pattern: '我(?:要|想|就)?(?:玩|用|选|是)?暴风女', template: '我风', note: '「我X」自称体系：暴风女取风字。', scene: '自称', examples: '我风大招超绝充能速度超绝伤害超绝范围超绝机动超绝生存', src: SRC.woHong },
  { pattern: '你(?:会|想)?(?:玩|用|选)?隐形女', template: '你苏珊', note: '本区不压字而直呼本名：隐形女本名苏珊·斯托姆。', scene: '称呼', examples: '你苏珊为这个家付出的太多了；真正的美神是你苏', src: SRC.suShan },
  { pattern: '你(?:会|想)?(?:玩|用|选)?万磁王', template: '你磁', note: '「你X」称呼体系：万磁王压成你磁，daddy 形态另算。', scene: '称呼', examples: '我请问你磁的连携技能放着不用素在', src: SRC.woHong },
  { pattern: '你(?:会|想)?(?:玩|用|选)?纳摩', template: '你摩', note: '「你X」称呼体系：纳摩压成你摩。', scene: '称呼', examples: '你摩再次惨遭削弱，你花的bug倒是还好', src: SRC.woHong },
  { pattern: '(?:我|你)(?:要|想|就)?(?:玩|用|选|是)?甜甜痞颜', template: '你痞', note: 'UP 主称呼也进同一套构词法。', scene: '称呼', examples: '你痞一daddy两吃素在?；啊啊啊我痞终于更新淋系视频惹', src: SRC.woJi },
  { pattern: '我(?:要|想|就)?(?:玩|用|选|是)?美国队长', template: '美国彪子', note: '拟音错位玩笑：宝子被念成彪子。', scene: '自称', examples: '【淋威争锋】美国彪子啊不是宝子，向你致敬', src: SRC.meiBiao },
  { pattern: '(?:万磁王|黑豹|夜魔侠|铁拳|钢铁侠|索尔|美国队长)(?![dD]addy)', template: '$0daddy', note: '本区最成体系的称呼后缀：英雄名后面直接挂 daddy。', scene: '称呼', examples: '（淋威争锋）自改daddy万磁王和大包；（淋威争锋）夜魔侠daddy泳装爆料（X）', src: SRC.daddyWan },
  { pattern: '(?:钢铁侠|钢铁人)(?:daddy)?', template: '铁皮人', note: '按战甲质地改的名字，是本区吐槽向叫法。', scene: '称呼', examples: '我红修改现实把邪恶铁皮人变成浦西boy 送给浩克蹂躏；结算画面铁人daddy变光头了', src: SRC.woHong },
  { pattern: '(?:陆行鲨杰夫|陆行鲨|杰夫)', template: '鲨鲨', note: '吉祥物级角色，鲨狗是同义的第二个外号。', scene: '称呼', examples: '靴靴，都不如我们鲨鲨，高额的奶量与超美的逃跑能力', src: SRC.jeff },
  { pattern: '(?:只是|只是吗|只是吧)', template: '只素', note: '「是」一律淋化成「素」，是本区写句子的地基。', scene: '口癖', examples: '只素冬冬在淋威的处女秀；其实这个女特务素内测玩家', src: SRC.dongDong },
  { pattern: '(?:是在|是在吗|是在？)', template: '素在？', note: '问封面/素材出处的固定说法。', scene: '口癖', examples: '封面素在？；后半段素在？；这个大招素在？', src: SRC.woJi },
  { pattern: '(?:心有灵犀|心有灵犀一点通)', template: '心有淋吸', note: '「灵犀」淋化成「淋吸」。', scene: '口癖', examples: '【淋威争锋】我们心有淋吸~不是吗~', src: SRC.xiLin },
  { pattern: '(?:美神降临|女神降临|降临)', template: '美神降淋', note: '「降临」淋化成「降淋」，本区用来形容大人物登场。', scene: '口癖', examples: '我红美神降淋；我神美红降淋；标注降淋', src: SRC.woBing },
  { pattern: '(?:毫不在乎|无所谓|没人关心)', template: 'NBCS', note: 'nobody cares 的缩写，本区用大写四字母。', scene: '口癖', examples: '我红的e有点nbcs；什么soon什么nbcs你清楚惹', src: SRC.nbcs },
  { pattern: '(?:快点出|赶紧更新|催更)', template: 'soon', note: '英文 soon 直接当动词用。', scene: '口癖', examples: 'soon出出处，否则我红的黑暗魔法可不是好惹的；下期，soon soon端上来', src: SRC.woHong },
  { pattern: '(?:好喜欢|喜欢)', template: '喜翻', note: '「欢」淋化成「翻」。注意不能把「好厉害」并进来——那句既有句式译为「厚礼蟹」。', scene: '口癖', examples: '素淋威争锋，喜翻惹喜翻惹', src: SRC.xiLin },
  { pattern: '(?:妈呀|我的天|天啦噜)', template: '玛雅', note: '「妈呀」的淋化谐音，本区最高频叹词。', scene: '口癖', examples: '玛雅被母石头人吓晕；玛雅你痞的片头怎么变高脂了；玛雅大街你', src: SRC.woBing },
  { pattern: '(?:又被|忍不住又|再玩一次)', template: 'again', note: '英文 again 直接嵌进句子表示又来了。', scene: '口癖', examples: '（淋威争锋）忍不住对冬兵again了', src: SRC.dongBing },
  { pattern: '(?:拳死|打死|锤死)', template: '拳鼠', note: '「死」淋化成「鼠」。', scene: '口癖', examples: '被黑豹daddy拳鼠惹', src: SRC.woBing },
];


// ================= 补：剧情线与连携的薄位（首轮漏收，语料里确有出处）=================
// 首次落库后发现「淋威剧情线」是空的、「淋威连携组合」只有 1 条，分区维度不完整。
// 这里只补语料里真能查到的词，查不到的一律不加（口径同 scripts/_attest20.js）。
const WORDS_FILL = [
  { zh: '时间流纠缠', linyu: '时间流纠缠', alias: '时空纠缠、流纠缠', slot: '淋威争锋/淋威剧情线',
    sense: '《漫威争锋》的世界观设定：多条时间线互相缠绕才让不同英雄同场，语料里常被用来解释「为什么这个人会和那个人一队」。',
    source: SRC.official },
  { zh: '多元宇宙', linyu: '多元宇宙', alias: '平行宇宙、multiverse', slot: '淋威争锋/淋威剧情线',
    sense: '剧情设定的总背景，社区用它解释皮肤、平行版本角色与赛季故事线。',
    source: SRC.official },
  { zh: '西景镇', linyu: '西景镇', alias: 'Westview、西景', slot: '淋威争锋/淋威剧情线',
    sense: '猩红女巫剧情线的舞台，语料原句「全西景镇最恩爱的一对拉拉噜」「西景镇颁布禁蛛令」。',
    source: SRC.official },
  { zh: '蓝甲', linyu: '蓝甲', alias: '护盾、蓝色护盾', slot: '淋威争锋/淋威连携组合',
    sense: '连携与技能给的蓝色护盾值，语料原句「赶紧给你红大招加100蓝甲」。',
    source: SRC.official },
  { zh: '连携', linyu: '连携', alias: '连携技、连携技能、组队技', slot: '淋威争锋/淋威连携组合',
    sense: '两名英雄同时上场才解锁的组合技，语料原句「我请问你磁的连携技能放着不用素在」。',
    source: SRC.official },
];

WORDS.push(...WORDS_FILL);

module.exports = { WORDS, RULES, SRC, BV, SEARCH, MG, OFFICIAL };
