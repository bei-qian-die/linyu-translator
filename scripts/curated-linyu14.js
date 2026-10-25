'use strict';

// 第十四轮精选扩充（2026-10-25）：词库 + 句式。
// 来源：corpus/ 下 17 份语料（含 harvest14 新抓的 corpus-bili-20261024*/20261025* 五份），
// 由 scripts/mine14.js 出候选、evidence/cand14-review.txt 人工逐条评审后采纳。
// 每条 linyu 写法都逐字出现在语料里（verify 给 BV 的优先）；给出处的给出处，宁缺不编。
// WORDS 里 zh 已存在的条目会被 apply-linyu14.js 并入 alias 集合（不覆盖已有解释）。

const V = (bv) => 'https://www.bilibili.com/video/' + bv;

const WORDS = [
  // —— 鼠化家族补全 ——
  { zh: '吓死', linyu: '吓鼠了', alias: '吓鼠惹、吓鼠、吓鼠啦啦、我命大也吓鼠了', slot: '情绪/基础谐音替换', sense: '“吓死”的鼠化谐音，与笑鼠、赔鼠同族的鼠系构词，弹幕惊吓专用。', source: 'B站《【淋日方舟】面对爱看不穿衣服小动物的博士》评论区 https://www.bilibili.com/video/BV1rW41127QK', verify: V('BV1rW41127QK'), pop: '高', rel: ['笑鼠', '去鼠'] },
  { zh: '去死', linyu: '去鼠', alias: '去鼠惹、高燃去鼠', slot: '调侃/戏谑/基础谐音替换', sense: '“去死”的鼠化谐音。“高燃去鼠”是对炸场名场面的捧杀式惊呼：燃到可以直接去死了。', source: 'B站《魔法小浦西》弹幕 https://www.bilibili.com/video/BV1E8n46FEJF', pop: '高', rel: ['笑鼠', '吓鼠了'] },
  { zh: '赔死', linyu: '赔鼠', alias: '赔钱鼠', slot: '调侃/戏谑/基础谐音替换', sense: '“赔死”的鼠化谐音，赔钱兽文化语境里骂人破财的固定写法。', source: 'B站《【淋明杀鸡】爆炸0菲利克斯会不会梦到天菜三角头》评论区 https://www.bilibili.com/video/BV1Jf421B7Uk', pop: '中', rel: ['赔钱兽'] },
  { zh: '笑死惹', linyu: '孝鼠惹', alias: '孝鼠、孝鼠了、孝鼠我了', slot: '情绪/基础谐音替换/黏着语气词', sense: '“笑死惹”的孝/鼠双谐音变体，一次完成笑死与惹两步淋化。', source: 'B站《天啦嚕,你還沒過淋語8級惹》相关语料评论区 https://www.bilibili.com/video/BV1k14y147ED', pop: '中', rel: ['笑鼠', '惹'] },
  // —— 虚词与质感词 ——
  { zh: '但是', linyu: '但素', alias: '但素惹、氮素', slot: '逻辑虚词/基础谐音替换', sense: '“但是”的淋化谐音，与“氮素”同义并存；语料里“但素武田解解的淋神死都不退”即标准用法。', source: 'B站《【淋神】天理给纳塔关上了一扇门……》评论区 https://www.bilibili.com/video/BV1odwVefEpo', verify: V('BV1odwVefEpo'), pop: '高', rel: ['氮素'] },
  { zh: '阴阴的', linyu: '阴阴的', alias: '阴阴、有点阴阴的', slot: '情绪/戏谑', sense: '形容人阴湿、阴阳气质拉满的质感词，《通讯录心理学》用它解释男通讯录的说话方式。', source: 'B站《【通讯录心理学】为啥男通讯录那么爱说淋语？？！》 https://www.bilibili.com/video/BV16BX6Y9ELP', verify: V('BV16BX6Y9ELP'), pop: '中', rel: ['阴湿美感标准用语', '表情阴暗'] },
  { zh: '发疯', linyu: '发阴', alias: '发阴惹', slot: '情绪/基础谐音替换', sense: '“发疯/发癫”的阴化写法，弹幕用“(指正)”标注自家姐姐发阴。', source: 'B站淋语弹幕实录 https://www.bilibili.com/video/BV1k14y147ED', pop: '低', rel: ['阴湿美感标准用语'] },
  { zh: '阴间', linyu: '阴间', alias: '很阴间', slot: '评价判断/基础谐音替换', sense: '泛网络梗“阴间”在淋语圈的高频借用，形容画面/内容阴森离谱；淋系整活视频标题常客，标注 泛用/待确认。', source: 'B站淋语视频弹幕实录 https://www.bilibili.com/video/BV12BeG6eEww', pop: '中' },
  // —— 通讯录行为学 ——
  { zh: '背后阴人', linyu: '背后阴人', alias: '背后阴人你光、背后阴人怎么了', slot: '圈层黑话/调侃/戏谑', sense: '通讯录行事风格的自认与指认句：“我艾罗阴者自阴背后阴人怎么了”。也用来指名道姓“背后阴人你光”。', source: 'B站《【淋撒的结合】我艾罗阴者自阴背后阴人怎么了》《拉克丝做法，篡位德玛妈祖！》 https://www.bilibili.com/video/BV1oK421b7rC', verify: V('BV1oK421b7rC'), pop: '中', rel: ['阴者自阴', '我光'] },
  { zh: '欠吸', linyu: '欠吸', alias: '欠吸惹', slot: '圈层黑话/调侃/戏谑', sense: '“欠收拾”的淋化：淋王星的引力场里人人都欠吸，弹幕用“欠吸[黑洞]”送人进吸坑。', source: 'B站淋语弹幕实录 https://www.bilibili.com/video/BV1k14y147ED', pop: '低', rel: ['吸入', '难逃一吸'] },
  { zh: '低聚', linyu: '低聚', alias: '太低聚', slot: '评价判断/圈层黑话', sense: '“低质量聚会/低质内容”的缩写，弹幕嫌视频太低聚就会被“吸入”。', source: 'B站《【淋神】角色演示-「淋露：须弥舞娘」》评论区 https://www.bilibili.com/video/BV1BY411Z7vp', verify: V('BV1BY411Z7vp'), pop: '低', rel: ['吸入'] },
  { zh: '长红', linyu: '阴长红', alias: '我阴长红、我凤长红', slot: '饭圈运营/基础谐音替换', sense: '“长红”（长期当红）的淋化写法，通讯录英雄巅峰时刻盘点里“我X长红”句式的高频成分。', source: 'B站《盘点通讯录英雄们的巅峰时刻！》评论区 https://www.bilibili.com/video/BV1ns8Tz5EMn', pop: '低', rel: ['世女一'] },
  // —— 人称与称呼 ——
  { zh: '我', linyu: '我郭', alias: '郭门', slot: '第一人称自称/称呼类', sense: '郭老师门徒（郭门）的第一人称自称，“我郭是txl女一”是郭门粉丝的应援开场。', source: 'B站《六大通讯录英雄音乐成就盘点》评论区 https://www.bilibili.com/video/BV1hzjX65E4R', pop: '低', rel: ['郭老师', '集美'], hero: '郭老师' },
  { zh: '我命小', linyu: '我命小', alias: '我命小我先鼠', slot: '第一人称自称/调侃/戏谑', sense: '自称命格小的求生欲发言，“玛雅，我命小我先鼠”与“命大也鼠了”构成命学一对。', source: 'B站淋语弹幕实录 https://www.bilibili.com/video/BV1k14y147ED', pop: '中', rel: ['命大也鼠了'] },
  { zh: '单眼皮', linyu: '单阴纯', alias: '双阴纯', slot: '审美/基础谐音替换', sense: '“单眼皮”的淋化写法，阴湿审美体系里的五官评价词。', source: 'B站《通讯录女歌手们的初登场走秀》评论区 https://www.bilibili.com/video/BV1R1KS6jEpG', pop: '低', rel: ['阴湿美感标准用语'] },
  { zh: '邻家女孩', linyu: '淋家女孩', alias: '淋家女孩惹', slot: '称呼类/基础谐音替换', sense: '“邻家女孩”的淋化写法，形容亲切系偶像。', source: 'B站淋语弹幕实录 https://www.bilibili.com/video/BV1k14y147ED', pop: '低' },
  { zh: '闺蜜', linyu: '淋比', alias: '淋比们', slot: '称呼类/基础谐音替换', sense: '“闺蜜”的淋化谐音，淋王星子民之间互称。', source: 'B站淋语弹幕实录 https://www.bilibili.com/video/BV1k14y147ED', pop: '中', rel: ['集美', '姐妹'] },
  { zh: '淋粉', linyu: '淋分', alias: '淋分们', slot: '称呼类/饭圈运营', sense: '“淋粉”（淋淋粉丝）的谐音写法，弹幕报家门用。', source: 'B站《【女王驾到4】这个也吸！那个也吸！统统都能吸！！！》弹幕 https://www.bilibili.com/video/BV1s94y1r7SG', pop: '低', rel: ['本质骑士'] },
  { zh: '妈呀大姐', linyu: '玛雅哒解', alias: '玛雅哒解妮、玛雅大解、妈呀哒解', slot: '语气词/称呼类/基础谐音替换', sense: '“妈呀大姐”的淋化写法，把感叹词妈呀与人称大姐缝成一个惊叹词，可再黏“妮”字收尾。', source: 'B站《【淋者荣耀】她是一个满分女，但是爱出冰杖…【重生版】》弹幕 https://www.bilibili.com/video/BV1tTpq6kEZ9', verify: V('BV1tTpq6kEZ9'), pop: '中', rel: ['玛雅大姐'] },
  // —— 审美与家族 ——
  { zh: '零美感', linyu: '淋美感', alias: '高难度淋美感', slot: '审美/圈层黑话/基础谐音替换', sense: '《高等淋语》判词“高难度零美感”的淋化写法，玛雅式舞蹈专用评价。', source: 'B站淋语视频弹幕（BV1r1DnY8Eii） https://www.bilibili.com/video/BV1r1DnY8Eii', verify: V('BV1r1DnY8Eii'), pop: '中', rel: ['高难度零美感'] },
  { zh: '最美的样子', linyu: '最美的样柱', alias: '这素最美的样柱', slot: '审美/基础谐音替换', sense: '“最美的样子”的柱化写法（子→柱），萌娘百科淋语条目收录的经典句。', source: '萌娘百科「淋语」词条 https://zh.moegirl.org.cn/%E6%B7%8B%E8%AF%AD', verify: 'https://zh.moegirl.org.cn/%E6%B7%8B%E8%AF%AD', pop: '中', rel: ['孩柱'] },
  { zh: '生化危机', linyu: '淋化危机', alias: '淋化危鸡、淋化危鸡8、淋化全宇宙', slot: '歌舞影视/基础谐音替换', sense: '《生化危机》的淋化区名，整活视频写作“淋化危鸡8”，弹幕接“淋化全宇宙中……”。', source: 'B站《【淋化危鸡8】女特务揭露贝内文托地下室的秘密》 https://www.bilibili.com/video/BV1qk4y177iD', verify: V('BV1qk4y177iD'), pop: '中', rel: ['降淋'] },
  { zh: '淋凤联手', linyu: '淋凤联手', alias: '淋凤联手惹', slot: '饭圈运营/圈层黑话', sense: '淋淋（蔡依林）与罗玉凤（我凤）梦幻联动的弹幕口号。', source: 'B站淋语弹幕实录 https://www.bilibili.com/video/BV1k14y147ED', pop: '低', rel: ['罗玉凤', '淋淋'] },
  // —— 老歌与经典句 ——
  { zh: '仙子放心飞', linyu: '仙子放心飞', alias: '仙草永相随', slot: '圈层黑话/饭圈运营', sense: '通讯录英雄们自己的 BGM 梗的上下句，弹幕成对刷屏：“仙子放心飞，仙草永相随”。', source: 'B站《属于通讯录英雄们自己的BGM，看看谁赢了？》（芒果君101号）弹幕 https://www.bilibili.com/video/BV1Bu4y1N7my', verify: V('BV1Bu4y1N7my'), pop: '中', hero: '芒果君101号' },
  { zh: '砍你130刀', linyu: '砍你130刀', alias: '130刀', slot: '圈层黑话/调侃/戏谑', sense: '萌娘百科淋语条目收录的经典威胁句，130 系数字梗与“你已经被锁定”同族。', source: '萌娘百科「淋语」词条 https://zh.moegirl.org.cn/%E6%B7%8B%E8%AF%AD', verify: 'https://zh.moegirl.org.cn/%E6%B7%8B%E8%AF%AD', pop: '中', rel: ['130级'] },
  { zh: '我买瓶饮料厚', linyu: '我买瓶饮料厚', alias: '我买瓶饮料', slot: '圈层黑话/语气词', sense: '淋语教学的高频例句：把平淡日常句尾加“厚”立刻变淋，常被拿来当淋语八级入门考题。', source: '萌娘百科「淋语」词条 https://zh.moegirl.org.cn/%E6%B7%8B%E8%AF%AD', verify: 'https://zh.moegirl.org.cn/%E6%B7%8B%E8%AF%AD', pop: '中', rel: ['厚'] },
  // —— 蔡依林歌典补全 ——
  { zh: '日不落', linyu: '日不落', alias: '淋不落', slot: '歌舞影视/歌词梗', sense: '淋淋《日不落》，淋语八级教材级歌词来源，台湾淋语圈繁体讨论高频。', source: '淋淋《日不落》（2007） https://baike.baidu.com/item/%E6%97%A5%E4%B8%8D%E8%90%BD', verify: 'https://baike.baidu.com/item/%E6%97%A5%E4%B8%8D%E8%90%BD', pop: '高', rel: ['淋淋'], hero: '淋淋' },
  { zh: '大艺术家', linyu: '大艺术家', alias: '淋艺术家', slot: '歌舞影视/歌词梗', sense: '淋淋《大艺术家》，媒体评“蔡依林发明了全宇宙最流行的淋语”的报道标题即用此歌指代。', source: '淋淋《大艺术家》（2007）、柠檬娱乐台报道 https://baike.baidu.com/item/%E5%A4%A7%E8%89%BA%E6%9C%AF%E5%AE%B6', verify: 'https://baike.baidu.com/item/%E5%A4%A7%E8%89%BA%E6%9C%AF%E5%AE%B6', pop: '高', rel: ['淋淋'], hero: '淋淋' },
  { zh: '美人计', linyu: '美人计', alias: '淋人计', slot: '歌舞影视/歌词梗', sense: '淋淋《美人计》，走钢索、锁定、路人甲等一批淋语词的母本专辑主打。', source: '淋淋《美人计》（2010） https://baike.baidu.com/item/%E7%BE%8E%E4%BA%BA%E8%AE%A1', verify: 'https://baike.baidu.com/item/%E7%BE%8E%E4%BA%BA%E8%AE%A1', pop: '高', rel: ['淋淋', '走钢索', '锁定'], hero: '淋淋' },
  { zh: '唯舞独尊', linyu: '唯舞独尊', alias: '唯淋独尊', slot: '歌舞影视/歌词梗', sense: '淋淋《唯舞独尊》，地才系舞台精神代表曲目，萌娘百科淋语条目收录。', source: '淋淋《唯舞独尊》（2006） https://baike.baidu.com/item/%E5%94%AF%E8%88%9E%E7%8B%AC%E5%B0%8A', verify: 'https://baike.baidu.com/item/%E5%94%AF%E8%88%9E%E7%8B%AC%E5%B0%8A', pop: '中', rel: ['淋淋'], hero: '淋淋' },
  { zh: '看我72变', linyu: '看我72变', alias: '看我72變', slot: '歌舞影视/歌词梗', sense: '淋淋《看我72变》，淋语体系里“变身/变美”语境的引用源。', source: '淋淋《看我72变》（2003） https://baike.baidu.com/item/%E7%9C%8B%E6%88%9172%E5%8F%98', verify: 'https://baike.baidu.com/item/%E7%9C%8B%E6%88%9172%E5%8F%98', pop: '中', rel: ['淋淋'], hero: '淋淋' },
  { zh: '爱的练习语', linyu: '爱的练习语', alias: '淋的练习语', slot: '歌舞影视/歌词梗', sense: '淋淋《爱的练习语》，萌娘百科淋语条目引用的曲目之一。', source: '淋淋《爱的练习语》（2009） https://baike.baidu.com/item/%E7%88%B1%E7%9A%84%E7%BB%83%E4%B9%A0%E8%AF%AD', verify: 'https://baike.baidu.com/item/%E7%88%B1%E7%9A%84%E7%BB%83%E4%B9%A0%E8%AF%AD', pop: '低', rel: ['淋淋'], hero: '淋淋' },
  { zh: '唇唇欲动', linyu: '唇唇欲动', alias: '唇唇欲動', slot: '歌舞影视/歌词梗', sense: '淋淋《唇唇欲动》，淋语教学视频里常被引用的歌词梗。', source: '淋淋《唇唇欲动》（2007） https://baike.baidu.com/item/%E5%94%87%E5%94%87%E6%AC%B2%E5%8A%A8', verify: 'https://baike.baidu.com/item/%E5%94%87%E5%94%87%E6%AC%B2%E5%8A%A8', pop: '低', rel: ['淋淋'], hero: '淋淋' },
  { zh: '努力论', linyu: '努力论', alias: '努力一定会成功', slot: '文化/圈层黑话', sense: '对“努力一定会成功，不努力就去死”精神内核的概括式说法，地才学的理论名。', source: '萌娘百科「淋语」词条 https://zh.moegirl.org.cn/%E6%B7%8B%E8%AF%AD', verify: 'https://zh.moegirl.org.cn/%E6%B7%8B%E8%AF%AD', pop: '中', rel: ['地才', '不努力就去死'], hero: '淋淋' },
  // —— 同形异义与简繁 ——
  { zh: '谢谢', linyu: '靴靴', alias: '謝謝、谢谢谢谢、蟹蟹', slot: '基础谐音替换/礼貌用语', sense: '台湾淋语圈用繁体“謝謝”书写，简繁两制并存；“蟹蟹”为评论区近音变体。', source: 'B站《乖乖听话药粉》等语料评论区 https://zh.moegirl.org.cn/%E6%B7%8B%E8%AF%AD', pop: '高', rel: ['靴靴'] },
  { zh: '喜欢', linyu: '喜翻', alias: '喜歡', slot: '基础谐音替换', sense: '台湾淋语圈保留繁体“喜歡”写法。', source: 'B站淋语语料评论区 https://zh.moegirl.org.cn/%E6%B7%8B%E8%AF%AD', pop: '高', rel: ['喜翻'] },
  { zh: '淋淋', linyu: '淋淋', alias: '蔡依淋、Jolin淋', slot: '人物/称呼类', sense: '“蔡依淋”为淋淋的淋化本名写法，弹幕高频率替写。', source: 'B站《通讯录英雄大合集！来看看通讯录发掘了多少英雄吧！》 https://www.bilibili.com/video/BV1AP411k7m2', pop: '高', rel: ['淋淋'], hero: '淋淋' },
  { zh: '淋语', linyu: '通讯录', alias: '淋语堂、淋文、淋學', slot: '圈层黑话/文化', sense: '淋语圈自称“淋语堂”（萌娘百科词条所载别称），淋文/淋學为繁体圈写法。', source: '萌娘百科「淋语」词条 https://zh.moegirl.org.cn/%E6%B7%8B%E8%AF%AD', verify: 'https://zh.moegirl.org.cn/%E6%B7%8B%E8%AF%AD', pop: '高', rel: ['通讯录'] },
  // —— 别名并入既有条目（apply 会按 zh 并进 alias） ——
  { zh: '命大', linyu: '命大也鼠惹', alias: '命大也鼠噜、我命大也鼠了、命大也鼠了', slot: '调侃/戏谑/黏着语气词', sense: '“命大也鼠了”的惹/噜收尾变体。', source: 'B站淋语弹幕实录 https://www.bilibili.com/video/BV1k14y147ED', pop: '中', rel: ['命大也鼠了'] },
  { zh: '停止', linyu: '婷芷', alias: '婷止', slot: '祈使/基础谐音替换', sense: '“停止”的谐音，婷芷的同形写法，弹幕“婷止，我狸也是1.0天后”。', source: 'B站《拉克丝做法，篡位德玛妈祖！》弹幕 https://www.bilibili.com/video/BV1oK421b7rC', verify: V('BV1oK421b7rC'), pop: '中', rel: ['婷芷'] },
  { zh: '罗马战靴', linyu: '罗马战靴', alias: '', slot: '圈层黑话/文化', sense: '罗马大帝梗的道具位：我泔变身罗马大帝时穿的那双靴子，直播看罗马战靴笑到踢翻摄像头。', source: 'B站《四乐化碳》相关语料评论区 https://www.bilibili.com/video/BV13K4y1j7jk', pop: '低', rel: ['罗马大帝'] },
  { zh: '黎明杀机', linyu: '淋明杀鸡', alias: '淋明杀机', slot: '圈层黑话/分区', sense: '《黎明杀机》淋化区名的又一种写法（机/鸡混用）。', source: 'B站《【淋明杀机】克里斯？克里斯在哪里啊克里斯！》 https://www.bilibili.com/video/BV16NwweNEQH', verify: V('BV16NwweNEQH'), pop: '低', rel: ['淋明杀鸡'] },
  { zh: '淋异', linyu: '淋异', alias: '淋异复兴', slot: '圈层黑话/文化', sense: '淋语文化圈自称“淋异”（淋＋异），语料见“淋异复兴”口号。', source: 'B站《【经典重现】来自淋淋的强大吸力 恶搞蔡依淋神作》相关弹幕 https://www.bilibili.com/video/BV1Ax411K7qv', verify: V('BV1Ax411K7qv'), pop: '低', rel: ['淋文化'] },
  { zh: '吸入惹', linyu: '吸入惹', alias: '被吸入惹、要被吸入惹、吸入噜、全部吸入、准备吸入', slot: '圈层黑话/黏着语气词', sense: '“吸入”句与惹/噜的组合，被淋文化吸进去的标准句式。', source: 'B站《【淋神】角色演示-「淋露：须弥舞娘」》弹幕 https://www.bilibili.com/video/BV1BY411Z7vp', verify: V('BV1BY411Z7vp'), pop: '中', rel: ['吸入', '难逃一吸'] },
  { zh: '好强的吸力', linyu: '好强的吸力', alias: '好强的吸力惹、好强大的吸力惹', slot: '圈层黑话/调侃/戏谑', sense: '淋王星引力场强度的赞叹句，常与“玛雅”连用。', source: 'B站《【淋系绘画过程】地才の龙龙》评论区 https://www.bilibili.com/video/BV1Yfpm6mE7M', pop: '中', rel: ['吸入', '难逃一吸'] },
  { zh: '真神降淋', linyu: '真神降淋', alias: '', slot: '饭圈运营/基础谐音替换', sense: '“真神降临”的淋化写法，美神降淋的高配版，弹幕迎接真神压场专用。', source: 'B站《属于通讯录英雄们自己的BGM》弹幕 https://www.bilibili.com/video/BV1Bu4y1N7my', verify: V('BV1Bu4y1N7my'), pop: '中', rel: ['美神降淋'] },
  { zh: '好高的阴', linyu: '好高的阴', alias: '', slot: '评价判断/圈层黑话', sense: '阴阳/阴湿浓度的计量句：“好高的阴”，与“好高的心机”同构。', source: 'B站淋语弹幕实录 https://www.bilibili.com/video/BV1k14y147ED', pop: '低', rel: ['阴湿美感标准用语'] },
];

// 句式：pattern 均在 corpus 里实际命中过（见 evidence/cand14-review.txt 评审记录）。
const RULES = [
  { pattern: '我命小我先鼠', template: '玛雅！我命小我先鼠惹！', note: '玛雅命学·求生欲发言', scene: '吃瓜 / 求生欲', examples: '玛雅，我命小我先鼠；我命小我先鼠惹，别叫我看。', src: V('BV1T24y1P7pR') },
  { pattern: '命大也鼠(了|惹|噜)', template: '命大也鼠了！', note: '玛雅命学·命大梗', scene: '吃瓜 / 惊叹', examples: '命大也鼠了，圣水婆阴婷；我命大也鼠惹[翻白眼]。', src: 'https://search.bilibili.com/all?keyword=%E5%91%BD%E5%A4%A7%E4%B9%9F%E9%BC%A0%E4%BA%86' },
  { pattern: '大事不妙(惹|厚|噜|了)', template: '我亲爱的你们大事不妙厚！', note: '玛雅名场面·预告不妙', scene: '吃瓜 / 预警', examples: '我亲爱的你们大事不妙厚；戛纳级影后赵涛大事不妙。', src: 'https://search.bilibili.com/all?keyword=%E5%A4%A7%E4%BA%8B%E4%B8%8D%E5%A6%99%E5%8E%9A' },
  { pattern: '在座各位.{0,4}难逃一吸', template: '在座各位都难逃一吸惹！', note: '淋王星引力场·全员吸入', scene: '拉人入坑 / 恐吓', examples: '在座各位都难逃一吸惹；在座的姐妹都难逃一吸。', src: V('BV17p411d7Mh') },
  { pattern: '罚你.{0,6}130遍', template: '罚你看130遍me的mv惹！', note: '本质骑士家法', scene: '调侃 / 惩罚', examples: '真素本质惹，罚你看130遍me的mv惹。', src: V('BV1j4411t7Wo') },
  { pattern: '好美(好美)?的(精神状态|仙气|阴气)', template: '好美好美的精神状态！', note: '阴湿审美·状态夸', scene: '夸赞 / 玩梗', examples: '好美好美的精神状态；好美的仙气。', src: V('BV1oK421b7rC') },
  { pattern: '家人们谁懂(啊|呀|惹)', template: '家人们谁懂啊，本可真的会谢！', note: '家人们谁懂·泛用开场', scene: '吐槽 / 泛用', examples: '家人们谁懂啊，又能生又长寿；家人们谁懂惹。', src: 'https://search.bilibili.com/all?keyword=%E5%AE%B6%E4%BA%BA%E4%BB%AC%E8%B0%81%E6%87%82%E5%95%8A' },
  { pattern: '背后阴人你?光?', template: '背后阴人你光！', note: '通讯录行事风格·指认', scene: '互怼 / 指认', examples: '背后阴人你光；我艾罗阴者自阴背后阴人怎么了。', src: V('BV1oK421b7rC') },
  { pattern: '一个.{1,8}保了.{1,10}一辈子的荣华富贵', template: '一个大风来保了我虞一辈子的荣华富贵！', note: '王者淋耀·护主句式', scene: '游戏区 / 应援', examples: '一个大风来保了我虞一辈子的荣华富贵[喜欢]。', src: 'https://search.bilibili.com/all?keyword=%E4%B8%80%E4%B8%AA%E5%A4%A7%E9%A3%8E%E6%9D%A5%E4%BF%9D%E4%BA%86%E6%88%91%E8%99%9E' },
  { pattern: '仙子放心飞，?仙草永相随', template: '仙子放心飞，仙草永相随！', note: '通讯录英雄BGM·成对刷屏', scene: '应援 / 弹幕', examples: '仙子放心飞，仙草永相随。', src: V('BV1Bu4y1N7my') },
  { pattern: '臣妾.{0,6}叠(杀人书|伤害)', template: '臣妾现在素献祭家人来叠杀人书的光辉女郎拉克丝厚！', note: '阴雄淋盟·杀人书梗', scene: '游戏区 / 整活', examples: '最初开卖的阴婷已经鼠惹，臣妾现在素献祭家人来叠杀人书的光辉女郎拉克丝厚🙄💅', src: V('BV1Mh4y1u75v') },
  { pattern: '你光怎么默认是(阴暗面|光明面)', template: '你光怎么默认是阴暗面，处决的时候露出光明面啊！', note: '我光·光明黑暗面梗', scene: '游戏区 / 吐槽', examples: '你光怎么默认是阴暗面，处决的时候露出光明面啊[思考]。', src: V('BV1Mh4y1u75v') },
  { pattern: '本可(儿)?素(直男|直女|通讯录|txl)', template: '谢邀，本可素直男惹。', note: '本可素直男·身份免责声明', scene: '自嘲 / 免责', examples: '谢邀但本可素直男惹；本可素直男。', src: 'https://search.bilibili.com/all?keyword=%E6%9C%AC%E5%8F%AF%E7%B4%A0%E7%9B%B4%E7%94%B7' },
  { pattern: '真素本质惹', template: '真素本质惹，罚你看130遍me的mv惹！', note: '本质骑士·认证句', scene: '认证 / 调侃', examples: '真素本质惹，罚你看130遍me的mv惹。', src: V('BV1j4411t7Wo') },
  { pattern: '玛雅[，,]?(我命小|吓死噜|大姐你吓死人惹)', template: '玛雅，吓死噜！', note: '玛雅感叹·三连句', scene: '惊叹 / 吃瓜', examples: '玛雅，我命小我先鼠；玛雅吓死噜；玛雅大姐你吓死人惹🙄。', src: V('BV1T24y1P7pR') },
  { pattern: '妈呀吓死了?大姐', template: '妈呀吓死了大姐，呜呜我命小！', note: '玛雅命学·惊吓开场', scene: '惊叹 / 吃瓜', examples: '妈呀吓死了大姐，呜呜我命小。', src: V('BV1T24y1P7pR') },
  { pattern: '(音色|机能).{0,4}秒了，?.{0,4}(机能|音色)', template: '音色胡艺莲秒了，机能那艺娜！', note: '艺字辈斗法·各有所长', scene: '姐圈 / 评价', examples: '音色胡艺莲秒了，机能那艺娜。', src: 'https://search.bilibili.com/all?keyword=%E9%9F%B3%E8%89%B2%E8%83%A1%E8%89%BA%E8%8E%B2' },
  { pattern: '要索就索.{2,8}的命，?别索.{2,8}的命', template: '要索就索那艺娜的命，别索胡艺莲的命呀！', note: '姐圈互撕·拉踩标准句', scene: '姐圈 / 互撕', examples: '要索就索那艺娜的命，别索胡艺莲的命呀。', src: 'https://search.bilibili.com/all?keyword=%E8%A6%81%E7%B4%A2%E5%B0%B1%E7%B4%A2%E9%82%A3%E8%89%BA%E5%A8%9C%E7%9A%84%E5%91%BD' },
  { pattern: '(为什么|怎么)你(前期|后期)?(清兵|清野|推塔)?的速度和某位(神秘)?泔水(女子|男子)有点相似', template: '艾莎女王为什么你前期清兵的速度和某位神秘泔水女子有点相似？', note: '淋者荣耀·碰瓷式比较', scene: '游戏区 / 玩梗', examples: '艾莎女王为什么你前期清兵的速度和某位神秘泔水女子有点相似？[星星眼]', src: V('BV1FenJ65EpE') },
  { pattern: '虫队姐妹(表示|觉得)', template: '虫队姐妹表示正确！', note: '洛克淋国·虫队应援', scene: '游戏区 / 应援', examples: '回复 @零时序：虫队姐妹表示正确。', src: V('BV1CqGK6sEkW') },
  { pattern: '鼠鼠曾对我说', template: '鼠鼠曾对我说与它共创和风匠心绮丽世界，现如今再回首，只觉宛音绕耳旁。', note: '阴淋师·虐鼠文学', scene: '游戏区 / 文学化玩梗', examples: '还记得那年晌午，鼠鼠曾对我说与它共创和风匠心绮丽世界，如有来生，死生不复相见[翻白眼]。', src: V('BV1fG41197xy') },
  { pattern: '你辰(真素|的产能|这是|的一键快煮)', template: '你辰真素语言大视惹！', note: 'xx辰丶·整活UP弹幕', scene: '弹幕 / 夸UP', examples: '你辰的产能怎么会？需不需要本可嫁给富二代拉点赞助[吃瓜]；你辰的一键快煮功能又来噜。', src: V('BV1Mh4y1u75v') },
  { pattern: '为了守护贝塔，?我玛薇卡，?化身为胱', template: '为了守护贝塔，我玛薇卡，化身为胱！', note: '淋神·玛薇卡宣誓句', scene: '游戏区 / 应援', examples: '为了守护贝塔，我玛薇卡，化身为胱！', src: V('BV1Mh4y1u75v') },
  { pattern: '玛皇是玛薇卡(女王|陛下)?，?麻辣妮别来蹭', template: '玛皇是玛薇卡女王，麻辣妮别来蹭！', note: '淋神·玛皇护号', scene: '游戏区 / 护主', examples: '玛皇是玛薇卡女王，麻辣妮别来蹭。', src: V('BV1Mh4y1u75v') },
];

module.exports = { WORDS, RULES };
