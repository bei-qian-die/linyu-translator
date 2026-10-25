'use strict';

// 第八轮词库扩充 · 第三部分：淋语本体词汇 / 教材词 / 分区词
// 来源与 8a/8b 同源，全部是可访问 URL。

const MG = 'https://zh.moegirl.org.cn/%E6%B7%8B%E8%AF%AD';
const MOE = 'https://moegirl.uk/index.php?title=%E6%B7%8B%E6%96%87%E5%8C%96';
const WX =
  'http://mp.weixin.qq.com/s?__biz=MzUyNTEwNjIxMg==&mid=2247483742&idx=3&sn=0c3f25da4446cb840bba1752cf9bb73e';
const GH = 'https://github.com/Aziteee/linyu-translator/blob/main/src/modules/linyu.ts';
const NGA3 = 'https://nga.178.com/read.php?tid=42400715';
const SYD = 'https://www.sydneytoday.com/content-50004642545';

/** @type {Array<object>} */
const words = [
  // —— 淋语本体：蔡依林体系衍生词 ——
  { zh: '特务', linyu: '特务', alias: '特务J、特务阴', slot: '称呼类', sense: '出自《特务J》，形容在背地里陷害别人的人，"被特务阴了"是标准用法。', source: MG, pop: '中', rel: ['蔡依林'] },
  { zh: '芭比娃娃', linyu: '芭比娃娃', alias: '搜集更多芭比娃娃、芭比', slot: '圈层黑话', sense: '淋语里的经典意象，出自"本可买了一套芭比娃娃，好开熏惹"，后衍生出"搜集更多芭比娃娃"句式。', source: MG, pop: '中', rel: ['我'] },
  { zh: '骑士精神', linyu: '骑士精神', alias: '本质骑士精神', slot: '圈层黑话', sense: '淋淋歌曲名，也是"本质骑士"这一自称的出处。', source: MG, pop: '中', rel: ['粉丝'] },
  { zh: '婊气', linyu: '婊气', alias: '婊里婊气、淋气', slot: '情绪', sense: '淋语教学文末对淋语精髓的总结：婊气。习得婊气就掌握了一大半淋文化。', source: WX, pop: '中', rel: ['淋气'] },
  { zh: '黏着语', linyu: '黏着语', alias: '黏着', slot: '构词法', sense: '淋语的语言学定位：通过在词语上粘贴语法成分（惹/噜/素）构成句子，不改变原词含义只表语法功能。', source: MG, pop: '中', rel: ['了'] },
  { zh: '组装词', linyu: '组装词', alias: '组装', slot: '构词法', sense: '淋语的一类构词法：把《甄嬛传》《康熙来了》《美少女战士》等同志会精神代入的影视台词组装进来。', source: WX, pop: '低', rel: ['淋语'] },
  { zh: '可人儿', linyu: '可人儿', alias: '可人、本可人儿', slot: '称呼类', sense: '可爱得让人着迷的人；"本可人儿"缩写成"本可"，是淋语第一人称的来源。', source: MG, pop: '中', rel: ['我', '本可'] },
  { zh: '地才蓝', linyu: '地才蓝', alias: '地才帽', slot: '圈层黑话', sense: '《地才》时期淋淋的标志性蓝色造型与帽子款式，用来代称那段拼命努力的岁月。', source: MG, pop: '中', rel: ['地才'] },
  { zh: '锁定你', linyu: '锁定你', alias: '锁定、你已被锁定、你已被神淋锁定噜', slot: '调侃/戏谑', sense: '出自《美人计》，已成为淋语圈通用恐吓句式，可套进任何语境。', source: MG, pop: '高', rel: ['盯上'] },
  { zh: '闭嘴惊艳', linyu: '闭嘴惊艳', alias: '闭嘴', slot: '调侃/戏谑', sense: '"闭嘴"的淋语说法，把让对方住嘴说成让他被惊艳到说不出话。', source: MG, pop: '中', rel: ['安静', '停止'] },
  { zh: '骚鸡', linyu: '骚鸡', alias: '骚', slot: '称呼类', sense: '"鸡"在淋语里可作通用代词，"骚鸡"甚至偏褒义，是圈内互称的常用词。', source: WX, pop: '低', rel: ['鸡笼'] },

  // —— 教材词：台湾腔谐音体系 ——
  { zh: '样子', linyu: '样柱', alias: '样柱、酱紫、这样柱', slot: '构词法', sense: '"子"的台湾腔读作"柱"，"样子"写成"样柱"；"这样"则写成"酱紫"。', source: MG, pop: '中', rel: ['柱'] },
  { zh: '丑死', linyu: '丑Die', alias: '丑die、丑死了', slot: '情绪', sense: '中英混用：丑 + Die，是"丑死"的淋语标准写法。', source: GH, pop: '中', rel: ['死'] },
  { zh: '美死', linyu: '美cry', alias: '美cry、美哭了', slot: '情绪', sense: '中英混用：美 + cry，与"丑Die"同构。', source: MG, pop: '中', rel: ['哭'] },
  { zh: '蠢死', linyu: '蠢die', alias: '蠢die、蠢die噜', slot: '情绪', sense: '中英混用：蠢 + die。', source: MG, pop: '低', rel: ['死'] },
  { zh: '想死', linyu: '香鼠', alias: '香鼠、想鼠', slot: '情绪', sense: '"想"淋化作"香"（想念=香），"死"淋化作"鼠"，合起来是香鼠。', source: MG, pop: '低', rel: ['想念', '死'] },
  { zh: '怎么办', linyu: '肿么办', alias: '肿么办、怎滴办', slot: '疑问', sense: '"怎么"的两种淋化写法都能接"办"：肿么办 / 怎滴办。', source: MG, pop: '中', rel: ['怎么'] },
  { zh: '怎样', linyu: '肿么样', alias: '肿么样、怎滴样', slot: '疑问', sense: '同上。', source: MG, pop: '低', rel: ['怎么'] },
  { zh: '有没有', linyu: '有木有', alias: '有木有、有冇', slot: '疑问', sense: '"有没有"的淋化写法。', source: MG, pop: '中', rel: ['没有'] },
  { zh: '是不是', linyu: '素不素', alias: '素不素、系不系', slot: '疑问', sense: '"是不是"的淋化写法。', source: MG, pop: '高', rel: ['是'] },
  { zh: '好不好', linyu: '吼不吼', alias: '吼不吼、中不中', slot: '疑问', sense: '"好不好"的淋化写法；万人迷的河南口音版是"中不中"。', source: MG, pop: '中', rel: ['好'] },
  { zh: '尊嘟', linyu: '尊嘟', alias: '尊嘟、真嘟', slot: '认同', sense: '"真的"的单说式，叠字卖萌。', source: MG, pop: '中', rel: ['真的'] },
  { zh: '假嘟', linyu: '假嘟', alias: '假嘟', slot: '认同', sense: '"假的"的叠字式，与尊嘟配套。', source: MG, pop: '中', rel: ['真的假的'] },
  { zh: '厚礼蟹', linyu: '厚礼蟹', alias: '厚礼蟹、好厉害', slot: '情绪', sense: '"好厉害"的淋语谐音写法，是圈内夸人的最高档说法之一。', source: MG, pop: '高', rel: ['厉害'] },
  { zh: '夭寿', linyu: '夭寿', alias: '夭寿、夭寿啦、夭寿惹', slot: '惊讶', sense: '闽南语"折寿"的感叹词，淋语里当"不得了/救命"用。', source: MG, pop: '中', rel: ['救命'] },

  // —— 分区词：本轮新开的分区与角色 ——
  { zh: '淋月峡谷', linyu: '淋月峡谷', alias: '王者淋耀、淋者荣耀', slot: '分区', sense: '王者荣耀在淋语区的三种写法之一，因海月"吸人"系列而得名。', source: 'https://www.bilibili.com/video/BV1zV4y137ya', pop: '低', rel: ['王者荣耀'] },
  { zh: '淋安京', linyu: '淋安京', alias: '撅战！淋安京', slot: '分区', sense: '《决战！平安京》的淋化名。', source: 'https://www.bilibili.com/video/BV16LeEz9EwM', pop: '低', rel: [] },
  { zh: '三角淋行动', linyu: '三角淋行动', alias: '淋角洲行动', slot: '分区', sense: '《三角洲行动》在淋语区的两种写法，2025 年后新开的分区。', source: 'https://www.bilibili.com/video/BV1B6uMz8EhA', pop: '低', rel: [] },
  { zh: '星奴谷', linyu: '星奴谷', alias: '星奴谷淋语', slot: '分区', sense: '《星露谷物语》的淋化名（露→奴），淋语圈把模拟经营类也纳入分区体系。', source: 'https://www.bilibili.com/video/BV1UTjC6LEJt', pop: '低', rel: [] },
  { zh: 'β坏', linyu: 'β坏', alias: '贝塔坏、崩坏', slot: '分区', sense: '《崩坏：星穹铁道》的淋化写法，用代表符号 β（贝塔）替换"崩"字。', source: 'https://www.bilibili.com/video/BV1mAL26DE2e', pop: '低', rel: ['贝塔'] },
  { zh: '撅区淋', linyu: '撅区淋', alias: '撅区', slot: '分区', sense: '淋语圈新开的分区写法，标题习惯把"首谈""概念"等饭圈词与淋语混用。', source: 'https://www.bilibili.com/video/BV1Cc3PztEV2', pop: '低', rel: [] },
  { zh: '淋潮', linyu: '淋潮', alias: '淋潮', slot: '分区', sense: '淋语圈新开的分区写法，沿用中英混用的标题习惯。', source: 'https://www.bilibili.com/video/BV1bdVK6KEiE', pop: '低', rel: [] },
  { zh: '街头霸淋', linyu: '街头霸淋', alias: '街霸', slot: '分区', sense: '《街头霸王》在淋语区的叫法，角色外号见春淋女士、我鬼、我侬、我咪。', source: GH, pop: '低', rel: [] },
  { zh: '瓦罗淋特', linyu: '瓦罗淋特', alias: '瓦罗兰特', slot: '分区', sense: '《无畏契约（VALORANT）》在淋语区的叫法，构词法是"我 + emoji"。', source: GH, pop: '低', rel: [] },
  { zh: '脚刹', linyu: '脚刹', alias: '脚刹、脚杀', slot: '调侃/戏谑', sense: '第五淋格区的固定动作词，把竞技对抗写成用脚踩住对方的羞辱动作。', source: 'https://www.bilibili.com/video/BV1Smpj69E1d', pop: '低', rel: ['婆婆'] },
  { zh: '太阳婆', linyu: '太阳婆', alias: '太阳婆', slot: '英雄淋盟', sense: '按 XX婆 构词法给角色起的绰号，出现在实况解说的弹幕里。', source: 'https://www.bilibili.com/video/BV1dnpM6gE6f', pop: '低', rel: ['婆婆'] },
  { zh: '阎婆', linyu: '阎婆', alias: '阎婆', slot: '英雄淋盟', sense: '同属 XX婆 构词法，弹幕用来调侃角色伤害"比较艺术"。', source: 'https://www.bilibili.com/video/BV1dnpM6gE6f', pop: '低', rel: ['婆婆'] },
  { zh: '仙者自仙', linyu: '仙者自仙', alias: 'X者自X、阴者自阴、赔者自赔', slot: '调侃/戏谑', sense: '"X者自X"句式：清者自清 → 阴者自阴 → 仙者自仙 / 赔者自赔，骨架不变换关键字。', source: 'https://www.bilibili.com/video/BV14UZtBiEB5', pop: '中', rel: ['问心无愧'] },
  { zh: '赔者自赔', linyu: '赔者自赔', alias: '赔者自赔罢噜', slot: '调侃/戏谑', sense: '"X者自X"句式在赔钱梗上的变体。', source: 'https://www.bilibili.com/video/BV1Mu4y1r7uv', pop: '低', rel: ['仙者自仙'] },
  { upd: true, zh: '命大', linyu: '命大', alias: '命大也鼠、命大也鼠了、真素命大', slot: '情绪', sense: '淋语圈的感叹词，指"命真大/居然没事"，常与"鼠了"连成"命大也鼠了"。', source: 'https://www.bilibili.com/video/BV1Mu4y1r7uv', pop: '中', rel: ['吓死'] },
  { zh: '这素在', linyu: '这素在', alias: '素在、这素在？', slot: '疑问', sense: '淋语区的万能疑问句式，等于"这是在？/这是在干嘛？"，几乎每个分区的弹幕里都能刷到。', source: 'https://www.bilibili.com/video/BV1Mu4y1r7uv', pop: '高', rel: ['是'] },
  { zh: '统统闪开', linyu: '统统闪开', alias: '驾到、统统闪开！！', slot: '调侃/戏谑', sense: '宫斗登场套话搬进游戏区的产物，与"驾到"连用。', source: 'https://www.bilibili.com/video/BV1vugxzBEEp', pop: '低', rel: ['顶流'] },
  { zh: '大沙田', linyu: '大沙田', alias: '南宁市大沙田街道', slot: '圈层黑话', sense: '周阴婷住址所在的南宁市良庆区街道名，淋语圈的打卡梗。', source: MOE, pop: '中', rel: ['周阴婷', '仙都'] },
  { zh: '智能语阴', linyu: '智能语阴', alias: '淋性话', slot: '圈层黑话', sense: '"智能语音"的阴字替换写法，出现在周阴婷 AI 语音包相关讨论里。', source: 'https://www.bilibili.com/video/BV1s54y1p7R1', pop: '低', rel: ['阴婷宝'] },
  { zh: '淋言淋语', linyu: '淋言淋语', alias: '满嘴淋言淋语', slot: '圈层黑话', sense: '"疯言疯语"的淋化改写，形容一个人说话全是淋语。', source: 'https://www.bilibili.com/video/BV1pf4y1H7Ne', pop: '低', rel: ['淋语'] },
  { zh: '大汗淋淋', linyu: '大汗淋淋', alias: '大汗淋漓', slot: '构词法', sense: '成语淋化的典型样本：淋漓 → 淋淋。', source: 'https://www.bilibili.com/video/BV1b7411x7Un', pop: '低', rel: ['淋字嵌入'] },
  { zh: '顺淋者昌', linyu: '顺淋者昌逆淋者亡', alias: '逆淋者亡', slot: '调侃/戏谑', sense: '"顺我者昌逆我者亡"的淋化改写。', source: 'https://www.bilibili.com/video/BV1TgWwzZEDf', pop: '低', rel: [] },
  { zh: '知阴', linyu: '知阴', alias: '《知阴》', slot: '构词法', sense: '《知音》杂志名的阴字替换写法，属"杂志名淋化"的一支。', source: 'https://www.bilibili.com/video/BV14W411t7Am', pop: '低', rel: ['阴字替换'] },
  { zh: '图淋盖肉', linyu: '图淋盖肉', alias: '图多盖洛', slot: '构词法', sense: '《猫和老鼠》角色"图多盖洛"的淋化写法，说明淋语已扩散到动画区。', source: 'https://www.bilibili.com/video/BV1S7hyzqEgS', pop: '低', rel: [] },
  { zh: '淋语中字', linyu: '淋语中字', alias: '淋语字幕', slot: '圈层黑话', sense: '字幕组把"淋语字幕"当作一种语言标注，与"中英字幕"并列，是淋语自我语言化的表现。', source: 'https://www.bilibili.com/video/BV1zt421a7nU', pop: '低', rel: ['淋语'] },
  { zh: '淋语13级', linyu: '淋语13级', alias: '淋语八级、淋语130级、淋语专业八级', slot: '圈层黑话', sense: '把淋语当成一门有等级考试的语言，13 / 130 是淋语圈的代表数字。', source: 'https://www.bilibili.com/video/BV1BE411F72F', pop: '低', rel: ['130'] },
  { zh: 'Linbracadabra', linyu: 'Linbracadabra', alias: 'Linguage、Linglish', slot: '圈层黑话', sense: '把淋语写成英文的造词（Lin- + Abracadabra），另有 Linguage / Linglish 两种写法。', source: 'https://www.bilibili.com/video/BV1as4y1R76r', pop: '低', rel: ['淋语'] },
  { zh: '凤淋阴', linyu: '凤淋阴', alias: '淋凤阴、FLY组合', slot: '称呼类', sense: '淋系、凤系（罗玉凤）、阴系（周阴婷）三大淋系艺人的合称，也叫 FLY 组合。', source: MOE, pop: '中', rel: ['罗玉凤', '周阴婷'] },
  { zh: '杀伤力', linyu: '杀伤力', alias: '杀伤力比XX高', slot: '调侃/戏谑', sense: '淋语圈评价淋文化破坏力的说法，常拿去和别的梗比"杀伤力"。', source: 'https://www.bilibili.com/video/BV1dBXHBnEjQ', pop: '低', rel: [] },
  { zh: '生图', linyu: '生图', alias: '精修', slot: '圈层黑话', sense: '泛用/待确认：饭圈词"生图（未修图）"，在淋语圈用来给淋淋维权。', source: 'https://www.bilibili.com/video/BV1as4y1R76r', pop: '低', rel: [] },
  { zh: '外翻', linyu: '外翻', alias: '美到外翻、外翻黑玫瑰', slot: '情绪', sense: '淋语区形容"美到极致"的说法，"美到外翻惹"是典型整句。', source: 'https://www.bilibili.com/video/BV1boDZYmEX5', pop: '低', rel: ['惊艳'] },
  { zh: '圣土化', linyu: '圣土化', alias: '圣土', slot: '淋神', sense: '泛用/待确认：出现在《【淋神】7.2前瞻》标题里的说法，具体所指待确认。', source: 'https://www.bilibili.com/video/BV1djHw6RExx', pop: '低', rel: [] },
  { zh: '大回冬', linyu: '大回冬', alias: '史诗级大回冬', slot: '淋神', sense: '泛用/待确认：把角色"回春/回暖"写成"大回冬"的反义玩法。', source: 'https://www.bilibili.com/video/BV12un16xEi1', pop: '低', rel: [] },
  { zh: '雨季婆', linyu: '雨季婆', alias: '雨季', slot: '淋神', sense: '按 XX婆 构词法给《淋神》视频里的角色起的称呼，UP「晦暗雨季」的名字也被淋化进去。', source: 'https://www.bilibili.com/video/BV12un16xEi1', pop: '低', rel: ['婆婆'] },
  { zh: '满分女', linyu: '满分女', alias: '满分', slot: '淋者荣耀', sense: '淋者荣耀区的人设判词，用"满分"给角色打总体分，后面再接转折。', source: 'https://www.bilibili.com/video/BV1tTpq6kEZ9', pop: '低', rel: [] },
  { zh: '煮饭', linyu: '煮饭', alias: '还是XX煮的饭好吃', slot: '阴雄淋盟', sense: '淋语区"XX煮的饭"句式，用来夸某个角色的产出或某位 UP 的作品。', source: 'https://www.bilibili.com/video/BV1nBp36xETY', pop: '低', rel: [] },
  { zh: '丽人', linyu: '丽人', alias: '一位丽人', slot: '街头霸淋', sense: '街头霸淋区给路过的女角色用的敬称，配"悄然经过"构成标题。', source: 'https://www.bilibili.com/video/BV1UCHQ6nEa8', pop: '低', rel: [] },
  { zh: '阴成啥样了', linyu: '阴成啥样了', alias: '阴成啥样', slot: '构词法', sense: '梗百科类内容对"阴"字的盘点式提问，是阴字替换出圈后的产物。', source: 'https://www.bilibili.com/video/BV1Beo4Y9E3Z', pop: '低', rel: ['阴字替换'] },
  { zh: '黑淋话', linyu: '黑淋话', alias: '黑淋话：β空', slot: '圈层黑话', sense: '淋语圈的一个二创栏目名，"黑淋话"是"黑童话"的淋化写法。', source: 'https://www.bilibili.com/video/BV1TcsjeyEns', pop: '低', rel: [] },
  { zh: '淋系视频', linyu: '淋系视频', alias: '淋系、淋系内容', slot: '圈层黑话', sense: '对使用淋语的二创视频的统称，评论区常用"怎么我洲都会有淋系视频产出"表达扩散程度。', source: 'https://www.bilibili.com/video/BV1vugxzBEEp', pop: '低', rel: ['淋语'] },
  { zh: '通讯录入侵', linyu: '通讯录入侵', alias: '通讯录终于入侵XX了', slot: '圈层黑话', sense: '形容淋语扩散到某个新游戏/新分区的说法，评论区见到新分区时的标准反应。', source: 'https://www.bilibili.com/video/BV1B6uMz8EhA', pop: '低', rel: ['通讯录'] },
  { zh: '通讯录心理学', linyu: '通讯录心理学', alias: '通讯录', slot: '圈层黑话', sense: '把"为什么通讯录爱说淋语"当成一个心理学议题来讨论的内容品类。', source: 'https://www.bilibili.com/video/BV16BX6Y9ELP', pop: '低', rel: ['通讯录'] },
];

module.exports = { words };
