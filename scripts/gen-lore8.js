'use strict';

// 第八轮内容生成器（2026-10-25）：把 corpus/corpus-bili-20261024172431.txt 里挖出来的
// 弹幕与评论，按视频归属到人，生成 src/core/lore-extra8.js。
//
// 之所以用生成器而不是手写：本轮名言量在 200+ 条，手抄不可避免会改字，
// 一旦改字 attest.js 的「连续 10 字逐字命中」就会判 unattested。
// 由脚本从语料原行直接搬运，才能保证每一条都能回源到具体视频。
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const mined = JSON.parse(fs.readFileSync(path.join(ROOT, 'evidence', 'mined8.json'), 'utf8'));
const manifest = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'evidence', 'manifest-20261024172431.json'), 'utf8')
);
const bvOf = new Map(manifest.map((v) => [v.title, v.bvid]));
const urlOf = (title) => 'https://www.bilibili.com/video/' + (bvOf.get(title) || '');

// ─────────────────────────────────────────────────────────────
// 人物传：分区沿用既有写法（rank 用「分区 · · 称号」）
// ─────────────────────────────────────────────────────────────
const H = (o) => Object.assign({ grp: 'game', tags: [], words: [], img: '' }, o);

const heroes = [
  // —— 淋神（原神）——
  H({
    name: '我雅',
    alias: '雅雅、你雅',
    grp: 'game',
    rank: '淋神 · · 女王是怎样炼成的',
    intro: '《【淋神】你雅首谈女王是怎样炼成的》的主角，淋神区把"我/你 + 单字"当主语的又一支，弹幕刷"雅雅素女王"为其定型。',
    baike: '我雅（雅雅/你雅）是 B 站 UP「ZaynZarka」《【淋神】你雅首谈女王是怎样炼成的》（BV1Mu4y1r7uv）的主角。该视频把原神角色放进"首谈女王"的访谈框架，弹幕因此产出成套定评：\'雅雅素女王啊啊啊！\'「我雅本色出演靴靴」「赔者自赔罢噜」「好赔钱的旋火轮惹」。它让"你雅"成为淋神区继"你心"之后的第二个通用第二人称。',
    tags: ['淋神', '女王', '你雅', '首谈'],
    works: ['【淋神】你雅首谈女王是怎样炼成的'],
    words: ['女王', '赔钱', '首谈', '本色出演'],
    links: [{ label: '【淋神】你雅首谈女王是怎样炼成的', url: 'https://www.bilibili.com/video/BV1Mu4y1r7uv' }],
  }),
  H({
    name: '纳阴妲',
    alias: '小骚仙草王、纳西妲',
    grp: 'game',
    rank: '淋神 · · 小骚仙草王',
    intro: '原神纳西妲的淋化形象，角色演示被整段改写为「纳阴妲：小骚仙草王」，是阴字替换 + 位分抬升的典型样本。',
    baike: '纳阴妲出自 B 站 UP「可淋」《【淋神】角色演示-「纳阴妲：小骚仙草王」（CV：茶多芬）》（BV1nR4y1r7Ga）。原神角色纳西妲的官方称号是"小吉祥草王"，淋化时把"纳西妲"换成"纳阴妲"、"吉祥"换成"骚"，构成一句完整的淋语头衔。这是淋神区"官方称号淋化改写"这一路数的代表。',
    tags: ['淋神', '纳西妲', '阴字替换', '草王'],
    works: ['【淋神】角色演示-「纳阴妲：小骚仙草王」（CV：茶多芬）'],
    words: ['阴字替换', '草王', '角色演示'],
    links: [{ label: '【淋神】角色演示-「纳阴妲：小骚仙草王」（CV：茶多芬）', url: 'https://www.bilibili.com/video/BV1nR4y1r7Ga' }],
  }),
  H({
    name: '莱欧斯利',
    alias: '公爵、典狱长',
    grp: 'game',
    rank: '淋神 · · 入赘草行久',
    intro: '原神枫丹角色，被淋神区写成「莱欧斯利入赘草行久」，把抽卡与配队写成一段婚嫁叙事。',
    baike: '莱欧斯利是原神枫丹角色，在 B 站 UP「棠梨煎雪碧噢」《【淋神】莱欧斯利入赘草行久，现人神巫女陷害万达国际》（BV11w411B7YX）里被写成入赘叙事的主角，弹幕与评论用"姐姐也抽莱欧了啊啊啊啊啊，本可只能为了等水神，看你你莱默默一个人寂寞扣"这样的句子参与共创。淋神区把抽卡 → 婚嫁、配队 → 宫斗的写法在这一条上最完整。',
    tags: ['淋神', '入赘', '抽卡', '草行久'],
    works: ['【淋神】莱欧斯利入赘草行久，现人神巫女陷害万达国际'],
    words: ['入赘', '抽卡', '水神'],
    links: [{ label: '【淋神】莱欧斯利入赘草行久，现人神巫女陷害万达国际', url: 'https://www.bilibili.com/video/BV11w411B7YX' }],
  }),

  // —— 王者淋耀 ——
  H({
    name: '蒜姐',
    alias: '飞天婆、上官婉儿',
    grp: 'game',
    rank: '王者淋耀 · · 推销自用好物',
    intro: '王者荣耀上官婉儿的淋语外号，源自其飞天大招；淋语区把它写成一位上门推销的姐姐。',
    baike: '蒜姐是王者荣耀上官婉儿的淋语外号（另称飞天婆，见 Aziteee/linyu-translator 王者淋耀词库）。B 站 UP「嘶哈嘶哈惹」《【王者淋耀】蒜姐推销自用好物红杉木》（BV1gFp26uEWj）把它写成一段带货短剧，"蒜姐"因此从单纯的外号升级成一个有人设的角色。',
    tags: ['王者淋耀', '外号', '推销', '红杉木'],
    works: ['【王者淋耀】蒜姐推销自用好物红杉木'],
    words: ['飞天婆', '外号', '推销'],
    links: [{ label: '【王者淋耀】蒜姐推销自用好物红杉木', url: 'https://www.bilibili.com/video/BV1gFp26uEWj' }],
  }),
  H({
    name: '我米',
    alias: '米莱狄、超生婆、下蛋婆',
    grp: 'game',
    rank: '王者淋耀 · · 累累的罪行',
    intro: '王者荣耀米莱狄的淋语自称，因机械仆从不断产出被叫超生婆/下蛋婆，是"我X"体系在王者区的又一支。',
    baike: '我米出自 B 站 UP「汤圆爱玩我椪的棘藤棒」《【王者淋耀】你们对我米所做的这些累累的罪行，不会消失，也不会被遗忘，更不会被原谅》（BV1NqKDzQEfz）。标题整段套用宫斗剧控诉句式，替米莱狄维权。米莱狄的淋语外号"超生婆/下蛋婆"见 Aziteee/linyu-translator 王者淋耀词库。',
    tags: ['王者淋耀', '超生婆', '维权', '宫斗体'],
    works: ['【王者淋耀】你们对我米所做的这些累累的罪行，不会消失，也不会被遗忘，更不会被原谅'],
    words: ['超生婆', '下蛋婆', '维权'],
    links: [{ label: '【王者淋耀】你们对我米所做的这些累累的罪行……', url: 'https://www.bilibili.com/video/BV1NqKDzQEfz' }],
  }),
  H({
    name: '我月',
    alias: '海月、蓝月亮',
    grp: 'game',
    rank: '王者淋耀 · · 吸力比李华强',
    intro: '王者荣耀海月的淋语自称，「吸人日记」系列的主角，被拿来与李华（杨玉环）比吸力。',
    baike: '我月出自 B 站 UP「Chongyue朔朔日记」《【淋月峡谷吸人日记】蓝月亮吸1🐔我月的优美伤害可不是李华能比拟的惹》（BV1zV4y137ya）。"淋月峡谷"是王者荣耀的淋化名，"吸人"对应海月把人拉进异空间的机制，评论区用"你月后期121的暴发伤害是李华搓脚一辈子都搓不出来的靴靴"继续拉踩。',
    tags: ['王者淋耀', '海月', '吸力', '李华'],
    works: ['【淋月峡谷吸人日记】蓝月亮吸1🐔我月的优美伤害可不是李华能比拟的惹'],
    words: ['吸力', '李华', '海月'],
    links: [{ label: '【淋月峡谷吸人日记】蓝月亮吸1🐔我月的优美伤害可不是李华能比拟的惹', url: 'https://www.bilibili.com/video/BV1zV4y137ya' }],
  }),
  H({
    name: '我曌',
    alias: '武则天、曌',
    grp: 'game',
    rank: '淋者荣耀 · · 知心性情大气巧思',
    intro: '淋者荣耀区对武则天一系角色的自称写法，"我曌"取武则天自造字，人设走知心姐姐路线。',
    baike: '我曌出自 B 站 UP「晦暗雨季」《【淋者荣耀】我曌知心性情大气巧思！》（BV1P3HK61Ea1）。晦暗雨季是淋者荣耀区的高产 UP，这条把"知心性情大气巧思"四组词堆成一句人设判词，是淋者荣耀区"用形容词堆叠塑造角色"这一写法的样本。',
    tags: ['淋者荣耀', '武则天', '判词', '人设'],
    works: ['【淋者荣耀】我曌知心性情大气巧思！'],
    words: ['知心', '判词', '淋者荣耀'],
    links: [{ label: '【淋者荣耀】我曌知心性情大气巧思！', url: 'https://www.bilibili.com/video/BV1P3HK61Ea1' }],
  }),

  // —— 第五淋格 ——
  H({
    name: '淋人金Daddy',
    alias: '淋人金',
    grp: 'game',
    rank: '第五淋格 · · 脚刹麦子',
    intro: '《第五人格》淋化区的一个男监管形象，Daddy 后缀是淋语里给成熟男角色加的敬称。',
    baike: '淋人金Daddy 出自 B 站 UP「一只叫艾文的海豚」《【第五淋格】淋人金Daddy脚刹麦子》（BV1Smpj69E1d）。第五淋格是《第五人格》在淋语区的叫法，该区习惯把监管者写成 Daddy / 女士等位分角色，再用"脚刹"这类动作词构成标题。',
    tags: ['第五淋格', 'Daddy', '脚刹', '监管者'],
    works: ['【第五淋格】淋人金Daddy脚刹麦子'],
    words: ['脚刹', 'Daddy', '监管者'],
    links: [{ label: '【第五淋格】淋人金Daddy脚刹麦子', url: 'https://www.bilibili.com/video/BV1Smpj69E1d' }],
  }),
  H({
    name: '凤蝶',
    alias: '冰雪女王',
    grp: 'game',
    rank: '第五淋格 · · 化身冰雪女王',
    intro: '《第五人格》求生者"凤蝶"的淋化形象，被写成与黑袜男宠共同脚刹红杉木女士的冰雪女王。',
    baike: '凤蝶出自 B 站 UP「一只叫艾文的海豚」《【第五淋格】凤蝶化身冰雪女王与黑袜男宠夜来香共同脚刹红杉木女士》（BV1D9bx6AELi）。这条标题把角色称号（冰雪女王）、搭档（黑袜男宠夜来香）与动作（脚刹红杉木女士）压成一句话，是第五淋格区标题构句法的典型：位分 + 男宠 + 脚刹。',
    tags: ['第五淋格', '冰雪女王', '脚刹', '红杉木'],
    works: ['【第五淋格】凤蝶化身冰雪女王与黑袜男宠夜来香共同脚刹红杉木女士'],
    words: ['冰雪女王', '脚刹', '红杉木'],
    links: [{ label: '【第五淋格】凤蝶化身冰雪女王与黑袜男宠夜来香共同脚刹红杉木女士', url: 'https://www.bilibili.com/video/BV1D9bx6AELi' }],
  }),

  // —— 守望淋锋 ——
  H({
    name: '血律Daddy',
    alias: '血律',
    grp: 'game',
    rank: '守望淋锋 · · 掌掴单牵摩西女',
    intro: '《守望先锋》淋化区的男角色形象，标题里固定与"摩西女"成对出现，构成掌掴/单牵的动作搭配。',
    baike: '血律Daddy 出自 B 站 UP「这个符很关键」《【守望淋锋】又素血律Daddy掌掴单牵摩西女平凡的一天鸭》（BV1qNnc6HEv6）。守望淋锋是《守望先锋》在淋语区的叫法，"又素……平凡的一天鸭"是该系列固定的标题尾巴；弹幕用"原来你符也素喜猪妹来的"给 UP 也安排了淋语身份。',
    tags: ['守望淋锋', 'Daddy', '掌掴', '摩西女'],
    works: ['【守望淋锋】又素血律Daddy掌掴单牵摩西女平凡的一天鸭'],
    words: ['掌掴', 'Daddy', '守望淋锋'],
    links: [{ label: '【守望淋锋】又素血律Daddy掌掴单牵摩西女平凡的一天鸭', url: 'https://www.bilibili.com/video/BV1qNnc6HEv6' }],
  }),
  H({
    name: '摩西女',
    alias: '单牵摩西女',
    grp: 'game',
    rank: '守望淋锋 · · 被掌掴的一方',
    intro: '《守望先锋》淋化区与血律Daddy 配对出现的女角色，"单牵"是她在标题里的固定动作。',
    baike: '摩西女出自 B 站 UP「这个符很关键」《【守望淋锋】又素血律Daddy掌掴单牵摩西女平凡的一天鸭》（BV1qNnc6HEv6），在标题里作为被掌掴的一方出现。守望淋锋区习惯把两个角色按施动/受动配对写进标题，摩西女是这套搭配里的常驻受动位。',
    tags: ['守望淋锋', '单牵', '受动位', '血律Daddy'],
    works: ['【守望淋锋】又素血律Daddy掌掴单牵摩西女平凡的一天鸭'],
    words: ['单牵', '守望淋锋'],
    links: [{ label: '【守望淋锋】又素血律Daddy掌掴单牵摩西女平凡的一天鸭', url: 'https://www.bilibili.com/video/BV1qNnc6HEv6' }],
  }),

  // —— 淋明杀鸡（黎明杀机）——
  H({
    name: '枝性美克里斯',
    alias: '克里斯',
    grp: 'game',
    rank: '淋明杀鸡 · · 惨遭冻肉陷害',
    intro: '《黎明杀机》淋化区的角色，标题走"惨遭陷害"的苦情叙事。',
    baike: '枝性美克里斯出自 B 站 UP「男孩你别叫我天使」《[淋明杀机]枝性美克里斯惨遭冻肉陷害》（BV1eibdzTEos）。淋明杀鸡是《黎明杀机》在淋语区的叫法，该区标题普遍走"某某惨遭某某陷害"的苦情宫斗句式，与第五淋格的"脚刹"系列形成两种不同风格。',
    tags: ['淋明杀鸡', '陷害', '苦情', '冻肉'],
    works: ['[淋明杀机]枝性美克里斯惨遭冻肉陷害'],
    words: ['陷害', '淋明杀鸡'],
    links: [{ label: '[淋明杀机]枝性美克里斯惨遭冻肉陷害', url: 'https://www.bilibili.com/video/BV1eibdzTEos' }],
  }),

  // —— 星淋铁道 ——
  H({
    name: '火淋',
    alias: '轰动演出',
    grp: 'game',
    rank: '星淋铁道 · · 轰动演出',
    intro: '《星穹铁道》淋化区的一个角色 PV 主角，PV 名被改写为「轰动演出」。',
    baike: '火淋出自 B 站 UP「软妹很努力」《《β坏:星淋铁道》火淋角色PV——「轰动演出」》（BV1mAL26DE2e）。星淋铁道是《崩坏：星穹铁道》在淋语区的叫法（另有"β坏"写法，β 是淋语圈代表符号），该系列把官方角色 PV 名整段淋化改写。',
    tags: ['星淋铁道', 'β坏', '角色PV', '轰动演出'],
    works: ['《β坏:星淋铁道》火淋角色PV——「轰动演出」'],
    words: ['轰动演出', '星淋铁道'],
    links: [{ label: '《β坏:星淋铁道》火淋角色PV——「轰动演出」', url: 'https://www.bilibili.com/video/BV1mAL26DE2e' }],
  }),
  H({
    name: '淋光',
    alias: '万湿如益',
    grp: 'game',
    rank: '星淋铁道 · · 万湿如益',
    intro: '《星穹铁道》淋化区的另一个角色 PV 主角，PV 名「万物如一」被改写为「万湿如益」。',
    baike: '淋光出自 B 站 UP「软妹很努力」《《β坏:星淋铁道》淋光角色PV——「万湿如益」》（BV1RgAUzDEVD）。与同系列的「火淋·轰动演出」一样，走的是把官方 PV 标题做谐音改写的路子，"万物如一 → 万湿如益"是其中改动最小、笑点最直接的一例。',
    tags: ['星淋铁道', 'β坏', '角色PV', '谐音改写'],
    works: ['《β坏:星淋铁道》淋光角色PV——「万湿如益」'],
    words: ['万湿如益', '星淋铁道'],
    links: [{ label: '《β坏:星淋铁道》淋光角色PV——「万湿如益」', url: 'https://www.bilibili.com/video/BV1RgAUzDEVD' }],
  }),

  // —— 三角淋行动 / 淋角洲行动 ——
  H({
    name: '威龙daddy',
    alias: '风暴玛焰、白袜',
    grp: 'game',
    rank: '三角淋行动 · · 白袜被窃',
    intro: '《三角洲行动》淋化区的男角色，被写成女特务潜入窃取白袜的对象。',
    baike: '威龙daddy 出自 B 站 UP「喊我一声欧尼酱」《三角淋行动》女特务首次潜入风暴玛焰窃取威龙daddy的白袜》（BV1B6uMz8EhA）。三角淋行动是《三角洲行动》在淋语区的叫法；评论区用"我不行了通讯录终于入侵三角洲了"标记这个分区的诞生，是 2025 年后新开的一支。',
    tags: ['三角淋行动', 'Daddy', '白袜', '女特务'],
    works: ['《三角淋行动》女特务首次潜入风暴玛焰窃取威龙daddy的白袜'],
    words: ['白袜', '女特务', 'Daddy'],
    links: [{ label: '《三角淋行动》女特务首次潜入风暴玛焰窃取威龙daddy的白袜', url: 'https://www.bilibili.com/video/BV1B6uMz8EhA' }],
  }),
  H({
    name: '交女王',
    alias: '交女王们',
    grp: 'game',
    rank: '淋角洲行动 · · 统统闪开',
    intro: '《三角洲行动》淋化区的女角色群体，以"驾到！统统闪开"的登场句式定型。',
    baike: '交女王出自 B 站 UP「清光山间月」《【淋角洲行动】交女王们驾到！统统闪开！！🙄💅》（BV1vugxzBEEp）。"淋角洲行动"是《三角洲行动》的另一种淋化写法，标题里"驾到 / 统统闪开"是淋语区把宫斗登场套话搬进射击游戏区的例子。',
    tags: ['淋角洲行动', '驾到', '统统闪开', '登场句式'],
    works: ['【淋角洲行动】交女王们驾到！统统闪开！！🙄💅'],
    words: ['驾到', '统统闪开'],
    links: [{ label: '【淋角洲行动】交女王们驾到！统统闪开！！🙄💅', url: 'https://www.bilibili.com/video/BV1vugxzBEEp' }],
  }),

  // —— DOTA 区 ——
  H({
    name: '杂技女亡帕克',
    alias: '帕克、杂技女亡',
    grp: 'game',
    rank: 'DOTA 区 · · 淋动全场',
    intro: 'DOTA 英雄帕克（Puck）的淋化形象，因位移技能多被封为"杂技女亡"。',
    baike: '杂技女亡帕克出自 B 站 UP「Arisus_」《βeta2 杂技女亡帕克淋动全场-完整版》（BV1vyZWYVE5V）。βeta 是淋语圈代表符号贝塔的英文写法，评论区用"简直是我在站内看过质量最高的刀塔淋系视频"给它定档，也提到冰女与尖叫婆（丽桑卓）同为该区的常见角色。',
    tags: ['DOTA', 'βeta', '杂技', '帕克'],
    works: ['βeta2 杂技女亡帕克淋动全场-完整版'],
    words: ['杂技', '淋动全场', 'βeta'],
    links: [{ label: 'βeta2 杂技女亡帕克淋动全场-完整版', url: 'https://www.bilibili.com/video/BV1vyZWYVE5V' }],
  }),
  H({
    name: '铁T成长',
    alias: '铁T、成长',
    grp: 'game',
    rank: '撅战淋安京 · · 用爱翻转全世界',
    intro: '《决战！平安京》淋化区（撅战！淋安京）的角色，标题走"铁T成长"的成长叙事。',
    baike: '铁T成长出自 B 站 UP「桐颜灿」《一秒不减！整局解说单排射手教学，铁T成长用爱翻转全世界【撅战！淋安京】26》（BV16LeEz9EwM）。"撅战！淋安京"是《决战！平安京》的淋化名；"铁T"是淋语里对短发硬朗女角色的分类（铁T拉=优菈、铁T斗=北斗、铁T雅=迪希雅）。',
    tags: ['撅战淋安京', '铁T', '成长', '单排'],
    works: ['一秒不减！整局解说单排射手教学，铁T成长用爱翻转全世界【撅战！淋安京】26'],
    words: ['铁T', '单排', '撅战淋安京'],
    links: [{ label: '铁T成长用爱翻转全世界【撅战！淋安京】26', url: 'https://www.bilibili.com/video/BV16LeEz9EwM' }],
  }),

  // —— UP 主 ——
  H({
    name: '武田晴海',
    alias: '世一琴',
    grp: 'up',
    rank: 'UP主 · 淋盟世一琴',
    intro: 'B 站 UP，《【淋盟】我依然是世一琴》作者，淋盟（英雄联盟）区的高产二创者。',
    baike: '武田晴海，B 站 UP，代表作《【淋盟】我依然是世一琴》（BV14UZtBiEB5）。该视频把"世一琴（世界第一琴女）"写进标题，弹幕因此产出成套淋语：\'琴瑟仙女-存活\'「你琴的超薄两下就被我胱扎穿噜」「你琴美美k到两个头素在？」「omg仙者自仙」「全队全都给滚地婆下跪十分钟磕头130次好吗」，是阴雄淋盟区外号密度最高的一条。',
    tags: ['淋盟', '世一琴', '外号密度', '滚地婆'],
    works: ['【淋盟】我依然是世一琴'],
    words: ['世一琴', '滚地婆', '扎穿'],
    links: [{ label: '【淋盟】我依然是世一琴', url: 'https://www.bilibili.com/video/BV14UZtBiEB5' }],
  }),
  H({
    name: '一只叫艾文的海豚',
    alias: '艾文',
    grp: 'up',
    rank: 'UP主 · 第五淋格双更',
    intro: 'B 站 UP，第五淋格区的主要作者，产出"淋人金Daddy脚刹麦子"与"凤蝶化身冰雪女王"两条。',
    baike: '一只叫艾文的海豚，B 站 UP，代表作《【第五淋格】淋人金Daddy脚刹麦子》（BV1Smpj69E1d）与《【第五淋格】凤蝶化身冰雪女王与黑袜男宠夜来香共同脚刹红杉木女士》（BV1D9bx6AELi）。第五淋格区的"位分 + 男宠 + 脚刹"标题构句法主要由这两条确立。',
    tags: ['第五淋格', '脚刹', '标题构句'],
    works: ['【第五淋格】淋人金Daddy脚刹麦子', '【第五淋格】凤蝶化身冰雪女王与黑袜男宠夜来香共同脚刹红杉木女士'],
    words: ['脚刹', '第五淋格'],
    links: [
      { label: '【第五淋格】淋人金Daddy脚刹麦子', url: 'https://www.bilibili.com/video/BV1Smpj69E1d' },
      { label: '【第五淋格】凤蝶化身冰雪女王……', url: 'https://www.bilibili.com/video/BV1D9bx6AELi' },
    ],
  }),
  H({
    name: '嘶哈嘶哈惹',
    alias: '嘶哈',
    grp: 'up',
    rank: 'UP主 · 王者淋耀带货短剧',
    intro: 'B 站 UP，《【王者淋耀】蒜姐推销自用好物红杉木》作者，把王者英雄外号写成带货短剧。',
    baike: '嘶哈嘶哈惹，B 站 UP，代表作《【王者淋耀】蒜姐推销自用好物红杉木》（BV1gFp26uEWj）。UP 名本身就是淋语（"嘶哈"是淋语圈常用拟声词 + "惹"黏着），作品把王者英雄的淋语外号放进短剧框架，让外号长成人设。',
    tags: ['王者淋耀', '短剧', '带货', '外号'],
    works: ['【王者淋耀】蒜姐推销自用好物红杉木'],
    words: ['蒜姐', '红杉木', '带货'],
    links: [{ label: '【王者淋耀】蒜姐推销自用好物红杉木', url: 'https://www.bilibili.com/video/BV1gFp26uEWj' }],
  }),
  H({
    name: '软妹很努力',
    alias: 'β坏系列',
    grp: 'up',
    rank: 'UP主 · 星淋铁道角色PV',
    intro: 'B 站 UP，《β坏:星淋铁道》系列作者，专做星穹铁道角色 PV 的淋化改写。',
    baike: '软妹很努力，B 站 UP，代表作《《β坏:星淋铁道》火淋角色PV——「轰动演出」》（BV1mAL26DE2e）与《《β坏:星淋铁道》淋光角色PV——「万湿如益」》（BV1RgAUzDEVD）。该系列把官方 PV 标题做谐音改写，是星淋铁道区最主要的产出方式。',
    tags: ['星淋铁道', 'β坏', 'PV改写'],
    works: ['《β坏:星淋铁道》火淋角色PV——「轰动演出」', '《β坏:星淋铁道》淋光角色PV——「万湿如益」'],
    words: ['轰动演出', '万湿如益'],
    links: [
      { label: '《β坏:星淋铁道》火淋角色PV——「轰动演出」', url: 'https://www.bilibili.com/video/BV1mAL26DE2e' },
      { label: '《β坏:星淋铁道》淋光角色PV——「万湿如益」', url: 'https://www.bilibili.com/video/BV1RgAUzDEVD' },
    ],
  }),
  H({
    name: '木槿软辅',
    alias: '软辅',
    grp: 'up',
    rank: 'UP主 · 阴者自阴',
    intro: 'B 站 UP，《阴者自阴靴靴》作者，把淋语核心金句直接当视频标题。',
    baike: '木槿软辅，B 站 UP，代表作《阴者自阴靴靴》（BV1Cn6yYBEZN）。"阴者自阴"是"清者自清"的通讯录进阶版，出自《高等淋语》第三课，本条把这句核心金句直接做成标题，属淋语圈"金句即标题"的极简写法。',
    tags: ['阴者自阴', '金句标题', '通用淋语'],
    works: ['阴者自阴靴靴'],
    words: ['阴者自阴', '靴靴'],
    links: [{ label: '阴者自阴靴靴', url: 'https://www.bilibili.com/video/BV1Cn6yYBEZN' }],
  }),
  H({
    name: '这个符很关键',
    alias: '你符',
    grp: 'up',
    rank: 'UP主 · 守望淋锋日常',
    intro: 'B 站 UP，《【守望淋锋】又素血律Daddy掌掴单牵摩西女平凡的一天鸭》作者。',
    baike: '这个符很关键，B 站 UP，代表作《【守望淋锋】又素血律Daddy掌掴单牵摩西女平凡的一天鸭》（BV1qNnc6HEv6）。UP 名里的"符"被弹幕淋化成"你符"，并配"原来你符也素喜猪妹来的"——淋语区把 UP 本人也纳入"你X"体系是常见操作。',
    tags: ['守望淋锋', '你符', '喜猪妹'],
    works: ['【守望淋锋】又素血律Daddy掌掴单牵摩西女平凡的一天鸭'],
    words: ['喜猪妹', '掌掴'],
    links: [{ label: '【守望淋锋】又素血律Daddy掌掴单牵摩西女平凡的一天鸭', url: 'https://www.bilibili.com/video/BV1qNnc6HEv6' }],
  }),
  H({
    name: '大沙田鱼罐头',
    alias: '大沙田',
    grp: 'up',
    rank: 'UP主 · 王者淋耀连续剧',
    intro: 'B 站 UP，《【王者淋耀】华儿与虾粥》系列作者，把王者英雄写成连续剧。',
    baike: '大沙田鱼罐头，B 站 UP，代表作《【王者淋耀】华儿与虾粥(第13季)》（BV13ZYu6wE7r）。"大沙田"是周阴婷住址所在的南宁市良庆区街道名，也是淋语圈的打卡梗；该系列已出到第 13 季，弹幕用"妈呀大姐本可不敢懂"回应。',
    tags: ['王者淋耀', '大沙田', '连续剧', '华儿'],
    works: ['【王者淋耀】华儿与虾粥(第13季)'],
    words: ['大沙田', '华儿', '连续剧'],
    links: [{ label: '【王者淋耀】华儿与虾粥(第13季)', url: 'https://www.bilibili.com/video/BV13ZYu6wE7r' }],
  }),
  H({
    name: '卡子有南云铁虎依赖症',
    alias: '卡子',
    grp: 'up',
    rank: 'UP主 · 撅区淋',
    intro: 'B 站 UP，《【撅区淋】我真首谈不惧电抗疑似fearless概念本身》作者。',
    baike: '卡子有南云铁虎依赖症，B 站 UP，代表作《【撅区淋】我真首谈不惧电抗疑似fearless概念本身》（BV1Cc3PztEV2）。"撅区淋"是淋语圈新开的一个分区写法，标题把"首谈""概念"等饭圈词与淋语混用，评论区用"惹，希望每天都能在真斗的大雷上醒来"参与共创。',
    tags: ['撅区淋', '首谈', '概念'],
    works: ['【撅区淋】我真首谈不惧电抗疑似fearless概念本身'],
    words: ['首谈', '撅区淋'],
    links: [{ label: '【撅区淋】我真首谈不惧电抗疑似fearless概念本身', url: 'https://www.bilibili.com/video/BV1Cc3PztEV2' }],
  }),
  H({
    name: '喂奶牛喝奶',
    alias: '我艾罗',
    grp: 'up',
    rank: 'UP主 · 阴者自阴金句',
    intro: 'B 站 UP，《【淋撒的结合】我艾罗阴者自阴背后阴人怎么了》作者。',
    baike: '喂奶牛喝奶，B 站 UP，代表作《【淋撒的结合】我艾罗阴者自阴背后阴人怎么了》（BV13m4y1N7mt）。标题把"阴者自阴"与"背后阴人"两个含阴的词叠在一起，是阴字替换造词法在标题里的密集演示。',
    tags: ['阴者自阴', '阴人', '阴字替换'],
    works: ['【淋撒的结合】我艾罗阴者自阴背后阴人怎么了'],
    words: ['阴者自阴', '阴人'],
    links: [{ label: '【淋撒的结合】我艾罗阴者自阴背后阴人怎么了', url: 'https://www.bilibili.com/video/BV13m4y1N7mt' }],
  }),
  H({
    name: '禁基的扣肉',
    alias: '淋潮',
    grp: 'up',
    rank: 'UP主 · 淋潮',
    intro: 'B 站 UP，《【淋潮】美好聚爆be the cure》作者，淋潮分区的开创者。',
    baike: '禁基的扣肉，B 站 UP，代表作《【淋潮】美好聚爆be the cure》（BV1bdVK6KEiE）。"淋潮"是淋语圈新开的一个分区写法，标题沿用淋语中英混用的习惯（be the cure 直接嵌入）。',
    tags: ['淋潮', '中英混用', '新分区'],
    works: ['【淋潮】美好聚爆be the cure'],
    words: ['淋潮', '中英混用'],
    links: [{ label: '【淋潮】美好聚爆be the cure', url: 'https://www.bilibili.com/video/BV1bdVK6KEiE' }],
  }),
  H({
    name: '13姬',
    alias: '林雅文鉴赏',
    grp: 'up',
    rank: 'UP主 · 林雅文鉴赏系列',
    intro: 'B 站 UP，《林雅文鉴赏原神角色》系列作者，系列名本身是淋语数字梗。',
    baike: '13姬，B 站 UP，代表作《林雅文鉴赏原神角色⑥：最重口味的一集！》（BV1dnpM6gE6f）。UP 名用了淋语圈的代表数字 13，视频弹幕里"林雅文玩太阳婆被ad打得bfnz前的幻想罢了""幸亏你阎婆的伤害比较艺术，不然你林雅文就惨鼠惹"把 XX婆 构词法直接用在实况解说上。',
    tags: ['13', '林雅文', '太阳婆', '鉴赏'],
    works: ['林雅文鉴赏原神角色⑥：最重口味的一集！'],
    words: ['太阳婆', '阎婆', 'bfnz'],
    links: [{ label: '林雅文鉴赏原神角色⑥：最重口味的一集！', url: 'https://www.bilibili.com/video/BV1dnpM6gE6f' }],
  }),
  H({
    name: '林雅文女王',
    alias: '大淋花',
    grp: 'up',
    rank: 'UP主 · 大淋花角色PV',
    intro: 'B 站 UP，《大淋花角色PV——「致命女人」》作者。',
    baike: '林雅文女王，B 站 UP，代表作《大淋花角色PV——「致命女人」》（BV1Vr5Y6sEn5）。"大淋花"是把"大红花"淋化的写法，该系列延续"官方 PV 名淋化改写"的路子，与软妹很努力的星淋铁道系列同属一个玩法。',
    tags: ['大淋花', '角色PV', '淋化改写'],
    works: ['大淋花角色PV——「致命女人」'],
    words: ['大淋花', '致命女人'],
    links: [{ label: '大淋花角色PV——「致命女人」', url: 'https://www.bilibili.com/video/BV1Vr5Y6sEn5' }],
  }),
  H({
    name: '清光山间月',
    alias: '淋角洲',
    grp: 'up',
    rank: 'UP主 · 淋角洲行动',
    intro: 'B 站 UP，《【淋角洲行动】交女王们驾到！统统闪开！！》作者。',
    baike: '清光山间月，B 站 UP，代表作《【淋角洲行动】交女王们驾到！统统闪开！！🙄💅》（BV1vugxzBEEp）。标题把宫斗登场套话搬进射击游戏区，并带上淋语圈的代表 emoji 💅🏻。',
    tags: ['淋角洲行动', '驾到', '💅🏻'],
    works: ['【淋角洲行动】交女王们驾到！统统闪开！！🙄💅'],
    words: ['驾到', '统统闪开'],
    links: [{ label: '【淋角洲行动】交女王们驾到！统统闪开！！🙄💅', url: 'https://www.bilibili.com/video/BV1vugxzBEEp' }],
  }),
  H({
    name: '恋爱顾问曹小派',
    alias: '淋语大全',
    grp: 'up',
    rank: 'UP主 · 淋语教材整理',
    intro: 'B 站 UP，《淋语大全》作者，做淋语词汇的系统整理。',
    baike: '恋爱顾问曹小派，B 站 UP，代表作《淋语大全》（BV1Sp4y1Z74c）。该视频属淋语教材类内容，与橘吱捞饭《给姐妹们做了一个简简单单的淋语本质解说的教程惹》同属"教学向"一支，是淋语出圈到路人层的主要载体。',
    tags: ['淋语大全', '教材', '教学向'],
    works: ['淋语大全'],
    words: ['淋语', '教材', '教学'],
    links: [{ label: '淋语大全', url: 'https://www.bilibili.com/video/BV1Sp4y1Z74c' }],
    verify: 'UP 与标题见 B 站公开搜索结果；《淋语大全》BV1Sp4y1Z74c',
  }),
  H({
    name: '橘吱捞饭',
    alias: '淋语本质解说',
    grp: 'up',
    rank: 'UP主 · 淋语本质解说教程',
    intro: 'B 站 UP，《给姐妹们做了一个简简单单的淋语本质解说的教程惹》作者。',
    baike: '橘吱捞饭，B 站 UP，代表作《给姐妹们做了一个简简单单的淋语本质解说的教程惹，希望能看到更多姐妹们的命大发言吸吸》（BV1D841177ZY）。评论区的"喜翻儿，以后可以和你橘抢生意惹💅🏻"是把 UP 名的单字套进"你X"体系的典型用法。',
    tags: ['教程', '命大发言', '你橘'],
    works: ['给姐妹们做了一个简简单单的淋语本质解说的教程惹，希望能看到更多姐妹们的命大发言吸吸'],
    words: ['喜翻儿', '命大', '你橘'],
    links: [{ label: '给姐妹们做了一个简简单单的淋语本质解说的教程惹……', url: 'https://www.bilibili.com/video/BV1D841177ZY' }],
  }),
];

// ─────────────────────────────────────────────────────────────
// 词卡：本轮新增概念 / 分区 / 构词法
// ─────────────────────────────────────────────────────────────
const cards = [
  { term: '淋月峡谷', type: 'meme', hero: '我月', meaning: '王者荣耀的又一种淋化写法（另有"王者淋耀""淋者荣耀"），因海月的机制与"吸人"系列结合而得名。', example: '蓝月亮吸1🐔我月的优美伤害可不是李华能比拟的惹', source: '《【淋月峡谷吸人日记】蓝月亮吸1🐔我月的优美伤害可不是李华能比拟的惹》标题' },
  { term: '淋安京', type: 'meme', hero: '铁T成长', aliases: ['撅战！淋安京'], meaning: '《决战！平安京》的淋化名，"撅战"取"决战"谐音。', example: '铁T成长用爱翻转全世界【撅战！淋安京】26', source: '《一秒不减！整局解说单排射手教学，铁T成长用爱翻转全世界【撅战！淋安京】26》标题' },
  { term: '三角淋行动', type: 'meme', hero: '威龙daddy', meaning: '《三角洲行动》的淋化名，2025 年后新开的一支分区。', example: '通讯录终于入侵三角洲了', source: '《《三角淋行动》女特务首次潜入风暴玛焰窃取威龙daddy的白袜》评论区' },
  { term: '淋角洲行动', type: 'meme', hero: '交女王', meaning: '《三角洲行动》的另一种淋化写法，与"三角淋行动"并存。', example: '交女王们驾到！统统闪开！！🙄💅', source: '《【淋角洲行动】交女王们驾到！统统闪开！！🙄💅》标题' },
  { term: '星奴谷', type: 'meme', aliases: ['星奴谷淋语'], meaning: '《星露谷物语》的淋化名（露→奴），淋语圈把模拟经营类也纳入了自己的分区体系。', example: '别问怎么做，爱才能长久', source: '《【星奴谷淋语#9】别问怎么做，爱才能长久》标题' },
  { term: 'β坏', type: 'meme', hero: '火淋', aliases: ['贝塔'], meaning: '《崩坏：星穹铁道》的淋化写法之一，用淋语圈代表符号 β（贝塔）替换"崩"字。', example: '《β坏:星淋铁道》火淋角色PV——「轰动演出」', source: '《《β坏:星淋铁道》火淋角色PV——「轰动演出」》标题' },
  { term: '撅区淋', type: 'meme', hero: '卡子有南云铁虎依赖症', meaning: '淋语圈新开的一个分区写法，标题习惯把"首谈""概念"等饭圈词与淋语混用。', example: '我真首谈不惧电抗疑似fearless概念本身', source: '《【撅区淋】我真首谈不惧电抗疑似fearless概念本身》标题' },
  { term: '淋潮', type: 'meme', hero: '禁基的扣肉', meaning: '淋语圈新开的一个分区写法，沿用中英混用的标题习惯。', example: '美好聚爆be the cure', source: '《【淋潮】美好聚爆be the cure》标题' },
  { term: '淋角洲行动', type: 'meme', hero: '交女王', meaning: '《三角洲行动》的另一种淋化写法。', example: '交女王们驾到！统统闪开！！🙄💅', source: '《【淋角洲行动】交女王们驾到！统统闪开！！🙄💅》标题' },
  { term: '淋撒的结合', type: 'meme', hero: '喂奶牛喝奶', meaning: '淋语区的一个系列名，标题把含"阴"的词密集叠用。', example: '我艾罗阴者自阴背后阴人怎么了', source: '《【淋撒的结合】我艾罗阴者自阴背后阴人怎么了》标题' },
  { term: '大淋花', type: 'meme', hero: '林雅文女王', meaning: '"大红花"的淋化写法，用于角色 PV 系列名。', example: '大淋花角色PV——「致命女人」', source: '《大淋花角色PV——「致命女人」》标题' },
  { term: '万湿如益', type: 'meme', hero: '淋光', meaning: '把官方 PV 标题「万物如一」做谐音改写的产物，是淋语区"官方文本淋化"路数里改动最小的一例。', example: '淋光角色PV——「万湿如益」', source: '《《β坏:星淋铁道》淋光角色PV——「万湿如益」》标题' },
  { term: '纳阴妲', type: 'meme', hero: '纳阴妲', aliases: ['小骚仙草王'], meaning: '原神纳西妲的淋化改写：纳西妲→纳阴妲、小吉祥草王→小骚仙草王，是把官方称号整段淋化的代表。', example: '角色演示-「纳阴妲：小骚仙草王」', source: '《【淋神】角色演示-「纳阴妲：小骚仙草王」（CV：茶多芬）》标题' },
  { term: '红杉木女士', type: 'meme', hero: '凤蝶', meaning: '跨区出现的淋语角色名，在王者淋耀与第五淋格两个分区的标题里都被写成被"脚刹/推销"的对象。', example: '凤蝶化身冰雪女王与黑袜男宠夜来香共同脚刹红杉木女士', source: '《【第五淋格】凤蝶化身冰雪女王与黑袜男宠夜来香共同脚刹红杉木女士》标题' },
  { term: '脚刹', type: 'meme', hero: '凤蝶', meaning: '第五淋格区的固定动作词，把竞技对抗写成用脚踩住对方的羞辱动作。', example: '淋人金Daddy脚刹麦子', source: '《【第五淋格】淋人金Daddy脚刹麦子》标题' },
  { term: '太阳婆', type: 'meme', hero: '13姬', meaning: '按 XX婆 构词法给角色起的绰号，出现在原神实况解说的弹幕里。', example: '林雅文玩太阳婆被ad打得bfnz前的幻想罢了', source: '《林雅文鉴赏原神角色⑥：最重口味的一集！》弹幕' },
  { term: '阎婆', type: 'meme', hero: '13姬', meaning: '同属 XX婆 构词法，弹幕用来调侃角色伤害"比较艺术"。', example: '幸亏你阎婆的伤害比较艺术，不然你林雅文就惨鼠惹', source: '《林雅文鉴赏原神角色⑥：最重口味的一集！》弹幕' },
  { term: '喜猪妹', type: 'meme', hero: '这个符很关键', meaning: '淋语圈给"喜欢某类人"的角色/UP 起的绰号，与"喜熊妹（安妮）"同构。', example: '原来你符也素喜猪妹来的', source: '《【守望淋锋】又素血律Daddy掌掴单牵摩西女平凡的一天鸭》弹幕' },
  { term: '仙者自仙', type: 'meme', hero: '武田晴海', aliases: ['赔者自赔'], meaning: '"X者自X"句式的又一支：清者自清 → 阴者自阴 → 仙者自仙/赔者自赔，把金句骨架留着换关键字。', example: 'omg仙者自仙', source: '《【淋盟】我依然是世一琴》弹幕' },
  { term: '赔者自赔', type: 'meme', hero: '我雅', meaning: '"X者自X"句式在赔钱梗上的变体，嘲讽强度/销量双双拉胯。', example: '赔者自赔罢噜', source: '《【淋神】你雅首谈女王是怎样炼成的》弹幕' },
  { term: '命大', type: 'meme', aliases: ['命大也鼠'], meaning: '淋语圈的感叹词，指"命真大/居然没事"，常与"鼠了"连用成"命大也鼠了"。', example: '玛雅命大也吓鼠了', source: '《【淋神】你雅首谈女王是怎样炼成的》弹幕' },
  { term: '这素在', type: 'meme', aliases: ['素在', '这素在？'], meaning: '淋语区的万能疑问句式，"这素在？"= "这是在？/这是在干嘛？"，几乎每个分区的弹幕里都能刷到。', example: '这个三技能素在？', source: '《【淋神】你雅首谈女王是怎样炼成的》弹幕' },
  { term: '有点像', type: 'meme', aliases: ['有点像XX'], meaning: '淋语区最高频的夸人/嘲人句式，把"勉强相似"写成碰瓷式判断，如"有点像花铁t""有点像琴瑟仙女"。', example: '有点像花铁t走出来', source: '《【淋盟】我依然是世一琴》弹幕' },
  { term: '统统闪开', type: 'meme', hero: '交女王', meaning: '宫斗登场套话搬进游戏区的产物，与"驾到"连用。', example: '交女王们驾到！统统闪开！！🙄💅', source: '《【淋角洲行动】交女王们驾到！统统闪开！！🙄💅》标题' },
  { term: '大沙田', type: 'meme', hero: '大沙田鱼罐头', meaning: '周阴婷住址所在的南宁市良庆区街道名，淋语圈的打卡梗，也被 UP 直接拿来当名字。', example: '雨婷仙子最新金曲《大沙田是我站的街》', source: '《【东北雨宙】雨婷仙子最新金曲《大沙田是我站的街》，不》标题' },
  { term: '阴者自阴', type: 'meme', hero: '木槿软辅', aliases: ['阴者自阴靴靴'], meaning: '"清者自清"的通讯录进阶版，走阴阳路线时的自证句式，可单独做视频标题。', example: '阴者自阴靴靴', source: '《阴者自阴靴靴》标题' },
  { term: '阴婷自在人心', type: 'meme', hero: '阴婷宝', meaning: '"阴者自阴"与周阴婷名字缝在一起的双关写法。', example: '阴者自阴，阴婷自在人心', source: '《阴者自阴，阴婷自在人心》标题' },
  { term: '淋性话', type: 'meme', hero: '阴婷宝', meaning: '"淋性化/拟人化"的谐音梗，用来形容 AI 语音包被淋语改造后的效果。', example: '一款真正淋性话的智能语阴', source: '《【阴婷宝】国内首个内置周阴婷语音包的人工智能，一款会》评论区' },
  { term: '智能语阴', type: 'meme', hero: '阴婷宝', meaning: '"智能语音"的阴字替换写法，是阴婷宝 AI 相关讨论里的标配词。', example: '一款真正淋性话的智能语阴', source: '《【阴婷宝】国内首个内置周阴婷语音包的人工智能，一款会》评论区' },
  { term: '首谈', type: 'meme', hero: '我雅', aliases: ['第130次首谈'], meaning: '饭圈词"首谈（首次谈到）"被淋语吸收，因重复太多次而自嘲成"第130次首谈"。', example: '你雅首谈女王是怎样炼成的', source: '《【淋神】你雅首谈女王是怎样炼成的》标题' },
  { term: '杂技女亡', type: 'meme', hero: '杂技女亡帕克', meaning: 'DOTA 区给位移多的英雄起的称号，"杂技天后（阿狸）"的恶化版。', example: 'βeta2 杂技女亡帕克淋动全场-完整版', source: '《βeta2 杂技女亡帕克淋动全场-完整版》标题' },
  { term: '淋动全场', type: 'meme', hero: '杂技女亡帕克', meaning: '"轰动全场"的淋化写法，淋字嵌入造词法的直接产物。', example: '杂技女亡帕克淋动全场', source: '《βeta2 杂技女亡帕克淋动全场-完整版》标题' },
  { term: '大汗淋淋', type: 'meme', meaning: '"大汗淋漓"的淋字替换写法，是把成语淋化的典型样本。', example: '震惊！下船后孙策竟大汗淋淋……跳舞', source: '《【王者荣耀MMD】震惊！下船后孙策竟大汗淋淋……跳舞》标题' },
  { term: '逆淋者亡', type: 'meme', aliases: ['顺淋者昌逆淋者亡'], meaning: '"顺我者昌逆我者亡"的淋化改写，用于淋淋相关盘点视频的标题。', example: '淋淋昔日对家和友家及其现状不完全盘点', source: '《【顺淋者昌逆淋者亡】淋淋昔日对家和友家及其现状不完全》标题' },
  { term: '神淋锁定', type: 'meme', aliases: ['你已被神淋锁定噜'], meaning: '"锁定"句式与"神淋"结合的产物，是淋语区经典恐吓句式的变体。', example: '你已被神淋锁定噜！！！', source: '《【顺淋者昌逆淋者亡】淋淋昔日对家和友家及其现状不完全》简介' },
  { term: '知阴', type: 'meme', meaning: '《知音》杂志名的阴字替换写法，属淋语区"杂志名淋化"的一支。', example: '《知阴》杂志2017年大合集噜', source: '《《知阴》杂志2017年大合集噜》标题' },
  { term: '图淋盖肉', type: 'meme', meaning: '《猫和老鼠》角色"图多盖洛"的淋化写法，说明淋语已扩散到动画区。', example: '图淋盖肉的太空泛性日记（甲油淋语实战排位）', source: '《图淋盖肉的太空泛性日记（甲油淋语实战排位）》标题' },
  { term: '淋语中字', type: 'meme', meaning: '字幕组把"淋语字幕"当作一种语言标注，与"中英字幕"并列，是淋语自我语言化的表现。', example: '[Jock Studio] 淋语中字 吸入性感游泳体育生', source: '《[Jock Studio] 淋语中字 吸入性感游泳体育生》标题' },
  { term: '淋语13级', type: 'meme', aliases: ['淋语130级'], meaning: '把淋语当成一门有等级考试的语言（淋语专业八级 / 13 级 / 130 级），13 与 130 是淋语圈的代表数字。', example: 'This Why We Can\'t Have Nice Things淋语中字淋语13级', source: '《【Taylor Swift】This Why We Can\'t Have Nice Things淋语中字淋语13级》标题' },
  { term: '淋语A1听力', type: 'meme', meaning: '把淋语套进欧洲语言共同参考框架（A1/A2…），是淋语"语言化"玩梗的极端形式。', example: 'Floptropican A1 Listening Pack 国际淋语A1听力资源包一览', source: '《Floptropican A1 Listening Pack 国际淋语A1听力资源包一览》标题' },
  { term: 'nbcs', type: 'meme', aliases: ['NBCS'], meaning: 'nobody cares 的缩写，是淋语圈使用频率最高的英文缩写，2018 年前后被饭圈借走并走红。', example: 'nbcs就是nobody cares，最早出自淋语，在18年左右被饭圈用去并走红', source: '《所以，NBCS到底是什么意思》评论' },
  { term: '通讯录心理学', type: 'meme', meaning: '把"为什么通讯录爱说淋语"当成一个心理学议题来讨论的内容品类，是淋语自我审视的一支。', example: '为啥男通讯录那么爱说淋语？？！', source: '《【通讯录心理学】为啥男通讯录那么爱说淋语？？！》标题' },
  { term: '本质骑士', type: 'meme', hero: '淋淋', meaning: '真心接纳淋文化的淋淋粉丝自称；只追蔡依林本人的粉丝被贬为"伪骑士"。', example: '不是曲解好吗，而且不是黑粉，是本质骑士', source: '《【通讯录心理学】为啥男通讯录那么爱说淋语？？！》弹幕' },
  { term: '人淡如菊', type: 'meme', hero: '周阴婷', meaning: '周阴婷那张出圈照片被评价的措辞，后来成为淋语圈"阴湿美感"的标准用语。', example: '我仙人淡如菊', source: '《【通讯录心理学】为啥男通讯录那么爱说淋语？？！》弹幕' },
  { term: '我阴', type: 'meme', hero: '周阴婷', aliases: ['我阴盛世美颜'], meaning: '"我 + 阴"的第一人称，周阴婷相关语境里的自称写法。', example: '我阴盛世美颜', source: '《【通讯录心理学】为啥男通讯录那么爱说淋语？？！》弹幕' },
  { term: '喜翻儿', type: 'meme', meaning: '"喜欢"的台湾腔儿化写法，语气比"喜翻"更腻。', example: '喜翻儿，以后可以和你橘抢生意惹💅🏻', source: '《给姐妹们做了一个简简单单的淋语本质解说的教程惹，希望》评论' },
  { term: '命大发言', type: 'meme', hero: '橘吱捞饭', meaning: '对淋语金句的统称，"命大"在淋语里是"居然没事/真有你的"的感叹。', example: '希望能看到更多姐妹们的命大发言吸吸', source: '《给姐妹们做了一个简简单单的淋语本质解说的教程惹，希望》标题' },
  { term: '淋言淋语', type: 'meme', meaning: '"疯言疯语"的淋化改写，形容一个人说话全是淋语。', example: '满嘴淋言淋语，但我真的不娘谢谢。', source: '《满嘴淋言淋语，但我真的不娘谢谢。》标题' },
  { term: '很多很好的评价', type: 'meme', hero: '淋淋', meaning: '出自《地才》演唱会的淋淋金句，衍生出反义用法"很多不好的评价"，是夸人/损人的万能句式。', example: '靴靴淋淋给你们很多很好的评价，努力一定会成功', source: '《满嘴淋言淋语，但我真的不娘谢谢。》评论' },
  { term: '瘦身成功', type: 'meme', meaning: '泛用/待确认：淋语区把游戏"削弱/加强"写成身材管理的说法，属待确认条目。', example: '雨季婆史诗级大回冬！', source: '《【淋神】你们至冬也充满了许多女性力量呢》评论' },
  { term: '大回冬', type: 'meme', aliases: ['史诗级大回冬'], meaning: '泛用/待确认：把角色"回春/回暖"写成"大回冬"的反义玩法，属分区内待确认条目。', example: '雨季婆史诗级大回冬！', source: '《【淋神】你们至冬也充满了许多女性力量呢》评论' },
  { term: '扯头花', type: 'meme', meaning: '淋语里"互撕/吵架"的说法，把女性互殴的想象写成揪头饰的动作。', example: '和北斗大姐扯头花，你们的至冬很美，靴靴', source: '《【淋神】你们至冬也充满了许多女性力量呢》评论' },
  { term: '冰杖', type: 'meme', meaning: '泛用/待确认：出装梗（冰杖 = 瑞莱的冰晶节杖），淋语区用"爱出冰杖"形容打法保守。', example: '她是一个满分女，但是爱出冰杖…【重生版】', source: '《【淋者荣耀】她是一个满分女，但是爱出冰杖…【重生版】》标题' },
  { term: '满分女', type: 'meme', meaning: '淋者荣耀区的人设判词，用"满分"给角色打总体分，后面再接转折。', example: '她是一个满分女，但是爱出冰杖…【重生版】', source: '《【淋者荣耀】她是一个满分女，但是爱出冰杖…【重生版】》标题' },
  { term: '屁股顶天又立地', type: 'meme', meaning: '淋者荣耀区的对仗式判词，把角色外观写成一句诗。', example: '塞下秋来风景异，屁股顶天又立地', source: '《〔淋者荣耀〕塞下秋来风景异，屁股顶天又立地》标题' },
  { term: '煮饭', type: 'meme', aliases: ['还是XX煮的饭好吃'], meaning: '淋语区"XX煮的饭"句式，用来夸某个角色的产出或某位 UP 的作品。', example: '还是XX辰煮的饭好 吃着不烧心', source: '《【阴雄淋盟】还是XX辰煮的饭好 吃着不烧心》标题' },
  { term: '丽人', type: 'meme', meaning: '街头霸淋区给路过的女角色用的敬称，配"悄然经过"构成标题。', example: '一位丽人悄然经过', source: '《〖街头霸淋6〗#89：一位丽人悄然经过》标题' },
  { term: '阴成啥样了', type: 'meme', meaning: '梗百科类内容对"阴"字的盘点式提问，是阴字替换出圈后的产物。', example: '十万个梗库之：阴成啥样了 #阴间 #抽象 #猎奇 #梗百科', source: '《十万个梗库之：阴成啥样了 #阴间 #抽象 #猎奇 #梗百科》标题' },
  { term: '阴暗沉重的秘密', type: 'meme', meaning: '把"阴"字的两重含义（阴暗/淋语的阴）压在一句话里的玩法。', example: '就这样释放阴暗沉重的秘密', source: '《就这样释放阴暗沉重的秘密》标题' },
  { term: '黑淋话', type: 'meme', aliases: ['黑淋话：β空'], meaning: '淋语圈的一个二创栏目名，"黑淋话"是"黑童话"的淋化写法。', example: '我的精壮老公因为我得了失心疯，我怎么会做这样的梦', source: '《【黑淋话：β空】我的精壮老公因为我得了失心疯，我怎么会做这样的梦》标题' },
  { term: '淋系视频', type: 'meme', meaning: '对使用淋语的二创视频的统称，评论区常用"怎么我洲都会有淋系视频产出"表达扩散程度。', example: '怎么我洲都会有淋系视频产出，真的很高级吼', source: '《【淋角洲行动】交女王们驾到！统统闪开！！🙄💅》评论' },
  { term: '淋系', type: 'meme', aliases: ['淋系视频', '淋系内容'], meaning: '淋语二创内容的前缀词，与"通讯录三大派系"里的淋系同源。', example: '真的很高级吼', source: '《【淋角洲行动】交女王们驾到！统统闪开！！🙄💅》评论' },
  { term: '通讯录入侵', type: 'meme', meaning: '形容淋语扩散到某个新游戏/新分区的说法，评论区见到新分区时的标准反应。', example: '我不行了通讯录终于入侵三角洲了', source: '《《三角淋行动》女特务首次潜入风暴玛焰窃取威龙daddy的白袜》评论' },
  { term: '甲油淋语', type: 'meme', meaning: '泛用/待确认：出现在猫和老鼠相关标题里的分区写法，具体所指待确认。', example: '图淋盖肉的太空泛性日记（甲油淋语实战排位）', source: '《图淋盖肉的太空泛性日记（甲油淋语实战排位）》标题' },
  { term: '淋文化', type: 'meme', hero: '淋淋', meaning: '淋语所依托的整套亚文化，包括淋语、淋图、淋剧；社区被设定为淋王星。', example: '嘎嘎科普淋文化是怎么来的', source: '《嘎嘎科普淋文化是怎么来的》标题' },
  { term: '杀伤力', type: 'meme', hero: '淋淋', meaning: '淋语圈评价淋文化破坏力的说法，常拿去和别的梗比"杀伤力"。', example: '淋文化圈子比较小。杀伤力比鸡哥我觉得要高点', source: '《嘎嘎科普淋文化是怎么来的》评论' },
  { term: '生图', type: 'meme', hero: '淋淋', meaning: '泛用/待确认：饭圈词"生图（未修图）"，在淋语圈用来给淋淋维权。', example: '为什么淋淋的是生图，其他两人是精修过的，淋淋又被排挤了是吗？', source: '《【FLY组合】"淋语"Linbracadabra 暌》评论' },
  { term: 'Linbracadabra', type: 'meme', hero: '淋淋', meaning: '把淋语写成英文的造词（Lin- + Abracadabra），是淋语"语言化"玩梗的产物。', example: '"淋语"Linbracadabra 暌违13年凤淋阴再度合体带来热辣舞曲', source: '《【FLY组合】"淋语"Linbracadabra 暌违13年凤淋阴再度合体带来热辣舞曲》标题' },
  { term: '凤淋阴', type: 'meme', hero: '淋淋', aliases: ['淋凤阴'], meaning: '淋系、凤系（罗玉凤）、阴系（周阴婷）三大淋系艺人的合称，奠定 2010 年淋文化格局，也叫 FLY 组合。', example: '暌违13年凤淋阴再度合体带来热辣舞曲', source: '《【FLY组合】"淋语"Linbracadabra 暌违13年凤淋阴再度合体带来热辣舞曲》标题' },
  { term: '我霉', type: 'meme', hero: '霉霉', meaning: '提到泰勒·斯威夫特时的自称式爱称，淋语圈把欧美 DIVA 也纳入"我X"体系。', example: '霉霉新单 Me！（淋语实用级入门翻译）', source: '《【Taylor Swift/Brendon Urie】霉霉新单 Me！（淋语实用级入门翻译）》标题' },
  { term: '淋语实用级入门', type: 'meme', hero: '霉霉', meaning: '把淋语分成"实用级/八级/13级"等等级的说法，是淋语自我语言化的产物。', example: '淋语实用级入门翻译', source: '《【Taylor Swift/Brendon Urie】霉霉新单 Me！（淋语实用级入门翻译）》标题' },
  { term: '淋气', type: 'meme', meaning: '淋语教学文末对"淋语精髓"的总结：婊气。习得婊气就掌握了一大半淋文化。', example: '淋语的精髓就是婊气', source: '微信公众号《天了噜!三分钟淋语速成指南来惹》' },
  { term: '安静如鸡', type: 'meme', aliases: ['安静得像只鸡'], meaning: '让对方闭嘴的委婉说法；"鸡"在淋语里可作通用代词，内部使用时不带攻击性。', example: '请你安静如鸡，靴靴', source: '微信公众号《天了噜!三分钟淋语速成指南来惹》' },
  { term: '国外XX', type: 'meme', meaning: '指喜欢的艺人来中国巡演却不在自己城市，淋语里用来表达遗憾与酸。', example: '惹，戳爷来亚洲巡演噜！哦，国外上海罢了。', source: '微信公众号《天了噜!三分钟淋语速成指南来惹》' },
  { term: '泰…勒', type: 'meme', meaning: '"太…了"的婊气加强写法，比"太…了"更拿捏。', example: '泰好孝勒，我们这篇推文的阅读量居然没有过130亿？', source: '微信公众号《天了噜!三分钟淋语速成指南来惹》' },
];

// ─────────────────────────────────────────────────────────────
// 名言：从 mined8.json 原行搬运
// ─────────────────────────────────────────────────────────────
// 视频标题关键词 → 人物
const TITLE_HERO = [
  [/淋者荣耀|我曌/, '我曌'],
  [/满分女/, '我曌'],
  [/淋神.*你雅|你雅首谈/, '我雅'],
  [/纳阴妲/, '纳阴妲'],
  [/莱欧斯利/, '莱欧斯利'],
  [/蒜姐|红杉木/, '蒜姐'],
  [/我米|累累的罪行/, '我米'],
  [/淋月峡谷|我月|蓝月亮/, '我月'],
  [/淋人金|脚刹麦子|凤蝶|红杉木女士/, '凤蝶'],
  [/守望淋锋|血律|摩西女/, '血律Daddy'],
  [/淋明杀机|枝性美/, '枝性美克里斯'],
  [/火淋|轰动演出/, '火淋'],
  [/淋光|万湿如益/, '淋光'],
  [/三角淋行动|威龙/, '威龙daddy'],
  [/淋角洲|交女王/, '交女王'],
  [/帕克|DOTA|刀塔/, '杂技女亡帕克'],
  [/淋安京|铁T/, '铁T成长'],
  [/淋盟|世一琴|我依然是世一琴/, '武田晴海'],
  [/阴雄淋盟|还是XX辰/, '武田晴海'],
  [/阴者自阴靴靴/, '木槿软辅'],
  [/阴者自阴，阴婷|我觉得阴者自阴|淋撒的结合/, '喂奶牛喝奶'],
  [/阴婷宝|智能语阴/, '阴婷宝'],
  [/淋潮/, '禁基的扣肉'],
  [/林雅文|13姬/, '13姬'],
  [/大淋花/, '林雅文女王'],
  [/撅区淋/, '卡子有南云铁虎依赖症'],
  [/王者淋耀|华儿|虾粥/, '大沙田鱼罐头'],
  [/淋语本质解说|教程惹/, '橘吱捞饭'],
  [/淋语大全/, '恋爱顾问曹小派'],
  [/周阴婷|Something 淋异|我阴/, '周阴婷'],
  [/霉霉|Taylor/, '霉霉'],
  [/通讯录心理学/, '淋淋'],
  [/FLY组合|Linbracadabra|淋淋昔日|顺淋者昌/, '淋淋'],
  [/嘎嘎科普淋文化/, '淋淋'],
];

function heroFor(title) {
  for (const [re, name] of TITLE_HERO) if (re.test(title)) return name;
  return '';
}

// 过滤：只要真正带淋语形态的行，剔掉医学/广告/无关
const JUNK =
  /阴道炎|阴唇|阴蒂|石女|高潮|霉菌|滴虫|细菌性|漫展|白板|拯救者|电竞本|词典|CATTI|朗文|牛津|纸张|鼠标|排版|阿婆主|欧路|美食街|误入|战败现场|毒液|법|丘丘人|法尔伽|得力|联想|模拟人生|后宫文|吹风机|泊野|玛门|碍事配角|私家车|救风尘|勘探员|佣兵|逆天音频|哥哥哥哥|没羞没臊|556|听立了|宴请八方|格调玩游戏|法尔伽|林舒晴|胡艺莲|雨婷仙子|大沙田是我站/;
const LIN =
  /(惹|噜|厚|靴|吸|本可|淋|阴|素|珍|尊|鼠|熏|柱|婷芷|通讯录|贵人|答应|嫔|婆|铁t|地才|骑士|锁定|仙|β|贝塔|nbcs|💅|解解|喜翻|命大|赔钱)/;

const seen = new Set();
const quotes = [];
for (const item of mined) {
  const s = item.s.trim();
  if (s.length < 6 || s.length > 44) continue;
  if (JUNK.test(s) || JUNK.test(item.v)) continue;
  if (!LIN.test(s)) continue;
  // 淋语形态必须够明显：至少要有一个句末黏着或核心词，而不是只含一个常见汉字
  const strong = /[惹噜靴]$|本可|婷芷|阴者自阴|素$|素在|命大|赔钱|吸|婆|贵人|铁t|解解|喜翻|珍素|尊素|鼠|熏|nbcs|💅|仙/.test(s);
  if (!strong) continue;
  if (seen.has(s)) continue;
  seen.add(s);
  quotes.push({
    text: s,
    author: '',
    hero: heroFor(item.v),
    src: `《${item.v}》${item.k}`,
    scene: '',
    // 不足 10 字的短句过不了 attest 的「连续 10 字逐字命中」，补一条视频直链做可回源依据
    verify: urlOf(item.v),
  });
}

// 词卡去重
const cardSeen = new Set();
const uniqCards = cards.filter((c) => {
  if (cardSeen.has(c.term)) return false;
  cardSeen.add(c.term);
  return true;
});

const IMG_ASSIGN = (() => {
  const p = path.join(ROOT, 'evidence', 'hero-images-20261025.json');
  if (!fs.existsSync(p)) return {};
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8')).assign || {};
  } catch {
    return {};
  }
})();
for (const h of heroes) h.img = IMG_ASSIGN[h.name] || '';


const out = `'use strict';

// 第八轮内容扩充（2026-10-25）· 跨平台高强度检索 + 弹幕/评论逐字实录
//
// 语料：corpus/corpus-bili-20261024172431.txt（170 个视频 / 1889 条弹幕 / 440 条评论），
//   关键词覆盖 淋语 / 淋神 / 洛克淋国 / 英雄淋盟 / 王者淋耀 / 第五淋格 / 淋明杀鸡 /
//   淋日方舟 / 星淋铁道 / 守望淋锋 / 永劫淋间 / 通讯录英雄 / 地才 等 38 个 tag；
//   逐条出处见 evidence/manifest-20261024172431.json。
// 外部词库：GitHub Aziteee/linyu-translator（王者淋耀 / 淋神 / 街头霸淋 / 瓦罗淋特词库）、
//   萌娘百科「淋语」「淋文化」、NGA 三帖（tid=35415432 / 39308402 / 42400715）、
//   今日悉尼《盘点淋吧部分英雄抽象外号》、微信公众号淋语速成教材。
//
// 本轮新开的分区写法：淋月峡谷 / 淋安京 / 三角淋行动 / 淋角洲行动 / 星奴谷 / β坏 /
// 撅区淋 / 淋潮 / 淋撒的结合 / 街头霸淋 / 瓦罗淋特 / 大淋花。
//
// 质量门与既有各轮一致：
//   1. 名言全部由 scripts/gen-lore8.js 从语料原行搬运，保证 attest.js 的逐字命中；
//   2. 泛用游戏外号一律在 meaning 里标注「泛用/待确认」，不冒充淋语独创；
//   3. 人物传必须有 intro / baike / works / 可访问链接，四者缺一不收。

const cards = ${JSON.stringify(uniqCards, null, 2)};

const quotes = ${JSON.stringify(quotes, null, 2)};

const heroes = ${JSON.stringify(heroes, null, 2)};

const __export = { cards, quotes, heroes };
if (typeof module === 'object' && module.exports) module.exports = __export;
else if (typeof window !== 'undefined') window.LORE_EXTRA8 = __export;
`;

// 配图：由 scripts/fetch-hero-images8b.js 采集后落在这份清单里，
// 生成器读取它把 img 写进人物传，保证数据可复现地重建。
// 取不到的留空（界面上显示占位），绝不拿无关图凑数。
fs.writeFileSync(path.join(ROOT, 'src', 'core', 'lore-extra8.js'), out, 'utf8');
console.log(`cards ${uniqCards.length} / quotes ${quotes.length} / heroes ${heroes.length}`);
console.log(`written src/core/lore-extra8.js ${(out.length / 1024).toFixed(0)} KB`);
const withHero = quotes.filter((q) => q.hero).length;
console.log(`quotes 带人物归属 ${withHero}/${quotes.length}`);
