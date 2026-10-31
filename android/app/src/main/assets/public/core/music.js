(function () {
'use strict';
// __wrapped by scripts/lib/wrap-iife.mjs
// @ts-check
'use strict';

// 音乐板块数据（抖音搞怪二创音源 · batch 1）
//
// 生成物：由 `npm run music:build` 从 src/core/music-douyin.json 生成，不要手改这个文件。
// 采集口径与逐条核验记录见 release/1.32.0-notes.md；每条 verifiedAt 是那次打开抖音确认
// 链接落点（音乐页 / 作品页）的日期。play_count 抖音网页端不公开，故数据集里本就没有。
//
// 规模：21 首音乐 / 25 条二创作品（同一 aweme_id 全批唯一）。

const MUSIC_GROUPS = [
  {"key":"all","label":"全部","tag":null,"desc":"野花香 × Gulp 两个梗音源的全部入选条目","count":21},
  {"key":"yhx","label":"野花香","tag":"野花香","desc":"DJ 加速、土味广场舞、Kpop 缝合、嘉菲（Jiafei）抽象系","count":7},
  {"key":"gulp","label":"Gulp","tag":"Gulp","desc":"吞咽音当万能音效：诗朗诵、早读、生日歌、不笑挑战","count":9},
  {"key":"yg","label":"双音源","tag":"野花香+Gulp","desc":"两条梗音源同框混音，童年动画与抒情歌是重灾区","count":5}
];

const MUSIC_ITEMS = [
  {"id":"yhx_wildflower_dj","name":"野花香（DJ何鹏版）","author":"莫斯满/老猫","tag":"野花香","style":["DJ加速","土味","广场舞"],"musicUrl":"https://www.douyin.com/music/6717476084788611843","musicId":"6717476084788611843","searchKeyword":"野花香 DJ","usageCount":"915990","verifiedAt":"2026-11-01","examples":[{"title":"快乐的日子，没有烦恼😜#随性摇摆 #广场舞小鲁班#00后跳广场舞 #泰裤辣 #就是玩儿","author":"可爱小鲁班～Li甜.","videoUrl":"https://www.douyin.com/video/7239176467702238464","awemeId":"7239176467702238464","likeCount":"99340","duration":15,"memePoint":"00 后自称「广场舞小鲁班」，跟着 DJ 加速版甩手摇摆，土味神曲被跳出街舞范儿"},{"title":"#野花香 请你来到我身边，我们一醉到天亮😇#抖音热歌 #dj #跟着节奏嗨起来 #dou来跳舞 #小夕手势舞 @DOU+小助手","author":"小夕💞","videoUrl":"https://www.douyin.com/video/7087517114382224673","awemeId":"7087517114382224673","likeCount":"8455","duration":15,"memePoint":"手势舞卡野花香副歌，一句「一醉到天亮」把土味情话跳到最高点"}]},
  {"id":"yhx_wildflower_donggu","name":"野花香（DJ咚鼓版）","author":"豪大大","tag":"野花香","style":["DJ加速","游戏整活","卡点"],"musicUrl":"https://www.douyin.com/music/6898194366112729101","musicId":"6898194366112729101","searchKeyword":"野花香 咚鼓","usageCount":"47506","verifiedAt":"2026-11-01","examples":[{"title":"玩老头的心都黑#第五人格 #游戏日常 #佣兵 #下饭操作 #整活 ","author":"树枝","videoUrl":"https://www.douyin.com/video/7109481500407581987","awemeId":"7109481500407581987","likeCount":"96200","duration":72,"memePoint":"第五人格佣兵下饭操作，队友倒地那一刻正好砸在咚鼓重拍上，越菜越燃"}]},
  {"id":"yhx_wildflower_yixuan","name":"野花香(DJ翊轩)（副歌）","author":"未知艺人","tag":"野花香","style":["DJ加速","对口型","卡点"],"musicUrl":"https://www.douyin.com/music/7572161777913677850","musicId":"7572161777913677850","searchKeyword":"野花香 DJ翊轩","usageCount":"20110","verifiedAt":"2026-11-01","examples":[{"title":"最后摆拍摄造型的时候，不小心出了点小状况#依伊呀 #爸爸带娃 #亲子互动 #亲子相处趣味时刻 #甜妹","author":"依伊呀","videoUrl":"https://www.douyin.com/video/7651175912247918068","awemeId":"7651175912247918068","likeCount":"49058","duration":10,"memePoint":"爸爸带娃摆拍，副歌一进正好是孩子翻车那一秒，剪辑卡点比带娃还准"}]},
  {"id":"yhx_wildflower_cover_zhengyun","name":"翻唱男声版_野花香","author":"正云","tag":"野花香","style":["翻唱","土味"],"musicUrl":"https://www.douyin.com/music/6722365108558334734","musicId":"6722365108558334734","searchKeyword":"野花香 男声翻唱","usageCount":"56607","verifiedAt":"2026-11-01","examples":[{"title":"正云男声翻唱版《#野花香 》前部分，原唱：@莫斯满🌸野花香🌸天籁之爱🌸 ，大家多多支持和关注原唱","author":"正云","videoUrl":"https://www.douyin.com/video/6722374256728018183","awemeId":"6722374256728018183","likeCount":"57268","duration":46,"memePoint":"男声一本正经深情翻唱土味神曲，越唱得像情歌越离谱"}]},
  {"id":"yhx_thefeels_remix","name":"The野花香完整版勿盗","author":"TDOONG<3","tag":"野花香","style":["remix","Kpop缝合","卡点"],"musicUrl":"https://www.douyin.com/music/7063733763347417887","musicId":"7063733763347417887","searchKeyword":"The野花香","usageCount":"1911","verifiedAt":"2026-11-01","examples":[{"title":"#thefeels x #野花香 remix完整来了 #twice （这次赶上了）","author":"TDOONG<3","videoUrl":"https://www.douyin.com/video/7063733719345024259","awemeId":"7063733719345024259","likeCount":"243287","duration":38,"memePoint":"把 TWICE《The Feels》和野花香缝在同一拍点上，Kpop 编舞配土味旋律，违和感就是笑点"},{"title":"#twice #thefeels #野花香 #jiafei #每次都想装作很倔强 周一哪有不疯的","author":"Sandwich三文君","videoUrl":"https://www.douyin.com/video/7529468565163543862","awemeId":"7529468565163543862","likeCount":"184","duration":38,"memePoint":"同一条 remix 的二次演绎，两首歌当一首跳，动作对得比原曲还齐"}]},
  {"id":"yhx_yuansheng_ait","name":"用原声艾特","author":"⭐️-736.Tuan.言鸩","tag":"野花香","style":["抽象","二次元","魔性翻跳"],"musicUrl":"https://www.douyin.com/music/7061120811919870733","musicId":"7061120811919870733","searchKeyword":"野花香 DJ 原声","usageCount":"7028","verifiedAt":"2026-11-01","examples":[{"title":"#野花香 #野花香dj #ooc致歉 #原神 #行秋 我还是要点脸的戴个口罩","author":"X瑶_o0O","videoUrl":"https://www.douyin.com/video/7065888319380540672","awemeId":"7065888319380540672","likeCount":"79227","duration":11,"memePoint":"原神行秋戴两层口罩跳野花香，标题自带「OOC 致歉」，羞耻感拉满"},{"title":"Ok ok抖音给我的标签是颜值达人好的👌#野花香魔性翻跳","author":"Lisa辰","videoUrl":"https://www.douyin.com/video/7064909651283938600","awemeId":"7064909651283938600","likeCount":"25037","duration":11,"memePoint":"自嘲「抖音给我贴的标签是颜值达人」，用魔性翻跳抗议算法标签"}]},
  {"id":"yhx_badromance","name":"野花香 坏浪漫","author":"SelenaDelgadoLopez","tag":"野花香","style":["抽象","meme","混音"],"musicUrl":"https://www.douyin.com/music/7150210531964357413","musicId":"7150210531964357413","searchKeyword":"野花香 坏浪漫","usageCount":"8968","verifiedAt":"2026-11-01","examples":[{"title":"#jiafei #floptropica #fyp #meme","author":"jiafei🙄💅","videoUrl":"https://www.douyin.com/video/7435068452752166153","awemeId":"7435068452752166153","likeCount":"45430","duration":30,"memePoint":"floptok 迷因号把 Lady Gaga 的 Bad Romance 和野花香混剪，半分钟全是网络黑话"}]},
  {"id":"gulp_bala_voice","name":"@好想放假创作的原声","author":"好想放假","tag":"Gulp","style":["抽象","配音","动画恶搞"],"musicUrl":"https://www.douyin.com/music/7671201139664259883","musicId":"7671201139664259883","searchKeyword":"gulp 杯糕姐","usageCount":"3667","verifiedAt":"2026-11-01","examples":[{"title":"美琪美雪一家由于中了黑魔法药粉，一直在打gulp#杯糕姐 #gulp #配音 #抽象 #搞笑","author":"好想放假","videoUrl":"https://www.douyin.com/video/7671201209537517041","awemeId":"7671201209537517041","likeCount":"511944","duration":28,"memePoint":"《巴啦啦小魔仙》台词全换成 gulp，一家人轮流咽口水，童年回忆当场塌房"}]},
  {"id":"gulp_pet_chant","name":"@翅老母创作的原声","author":"翅老母","tag":"Gulp","style":["抽象","萌宠","配音"],"musicUrl":"https://www.douyin.com/music/7637854252278352667","musicId":"7637854252278352667","searchKeyword":"gulp 萌宠","usageCount":"290","verifiedAt":"2026-11-01","examples":[{"title":"吟唱中。。。#gulp #萌宠 #猎奇 #音乐剧 #土松","author":"翅老母","videoUrl":"https://www.douyin.com/video/7637854289394217939","awemeId":"7637854289394217939","likeCount":"384188","duration":12,"memePoint":"宠物张嘴瞬间卡进 gulp，再配音乐剧式运镜，一只土松秒变女高音"}]},
  {"id":"gulp_poem_recital","name":"@西兰花创作的原声","author":"西兰花","tag":"Gulp","style":["抽象","诗朗诵","谐音梗"],"musicUrl":"https://www.douyin.com/music/7489698746578520871","musicId":"7489698746578520871","searchKeyword":"gulp 诗朗诵","usageCount":"67859","verifiedAt":"2026-11-01","examples":[{"title":"gulp诗朗诵《望江南》 #想一万次不如回家吃一次 #cupcakke #杯糕姐 #英语 #英语口语","author":"洋滇女王（积极向上版）","videoUrl":"https://www.douyin.com/video/7693899290011604453","awemeId":"7693899290011604453","likeCount":"126906","duration":21,"memePoint":"用 gulp 的节奏朗诵温庭筠《望江南》，古典意境被一声咽口水彻底毁掉"}]},
  {"id":"gulp_birthday_song","name":"@宾果系入入创作的原声","author":"宾果系入入","tag":"Gulp","style":["抽象","鬼畜","教学"],"musicUrl":"https://www.douyin.com/music/7582201644104813339","musicId":"7582201644104813339","searchKeyword":"gulp 生日歌","usageCount":"258","verifiedAt":"2026-11-01","examples":[{"title":"让我们一起庆祝即将迎来gulpthday的朋友们！#cupcakke #gulp #生日歌 #教学 #鬼畜","author":"宾果系入入","videoUrl":"https://www.douyin.com/video/7582201606759042363","awemeId":"7582201606759042363","likeCount":"136653","duration":28,"memePoint":"生日快乐歌改成 gulpthday，还出教程教怎么唱，鬼畜和仪式感并存"}]},
  {"id":"gulp_dance_beat","name":"@见不到郑在玹不改名创作的原声","author":"见不到郑在玹不改名","tag":"Gulp","style":["卡点","舞蹈"],"musicUrl":"https://www.douyin.com/music/7655977234477533987","musicId":"7655977234477533987","searchKeyword":"gulp 舞蹈","usageCount":"379","verifiedAt":"2026-11-01","examples":[{"title":"甩gulp 舞 #杯糕姐 #cupcakke","author":"见不到郑在玹不改名","videoUrl":"https://www.douyin.com/video/7655977338942215417","awemeId":"7655977338942215417","likeCount":"118831","duration":21,"memePoint":"每个 gulp 音配一个甩头动作，十几个卡点连打，比的是身体反应速度"}]},
  {"id":"gulp_repeat_loop","name":"@优雅莲创作的原声","author":"优雅莲","tag":"Gulp","style":["抽象","卡点","循环洗脑"],"musicUrl":"https://www.douyin.com/music/7581024546029505343","musicId":"7581024546029505343","searchKeyword":"gulp 搞笑","usageCount":"1602","verifiedAt":"2026-11-01","examples":[{"title":"所有人反复播放#搞笑 #抽象 #gulp #杯糕姐 #cupcakke","author":"优雅莲","videoUrl":"https://www.douyin.com/video/7581024598516665529","awemeId":"7581024598516665529","likeCount":"137674","duration":8,"memePoint":"短短 8 秒直接喊「所有人反复播放」，把扩散这件事交给观众"}]},
  {"id":"gulp_wordbook","name":"@无印创作的原声","author":"无印","tag":"Gulp","style":["谐音梗","英语教学"],"musicUrl":"https://www.douyin.com/music/7601343212608408356","musicId":"7601343212608408356","searchKeyword":"gulp 背单词","usageCount":"50","verifiedAt":"2026-11-01","examples":[{"title":"gulp其实是一个很好的词 谢谢  #gulp #英语 #背单词 #学习 #高考英语 #抖音精选高考应援联盟 #2026高考","author":"无印","videoUrl":"https://www.douyin.com/video/7601343296837685604","awemeId":"7601343296837685604","likeCount":"102835","duration":96,"memePoint":"拿 gulp 讲词根词义，一本正经做高考英语应援，越正经越好笑"}]},
  {"id":"gulp_laugh_challenge","name":"@杰克gulp母创作的原声","author":"杰克gulp母","tag":"Gulp","style":["不笑挑战","抽象"],"musicUrl":"https://www.douyin.com/music/7621530857391622954","musicId":"7621530857391622954","searchKeyword":"gulp 不笑挑战","usageCount":"2487","verifiedAt":"2026-11-01","examples":[{"title":"挑战成功！\n#cupcakke #cupcakkeremix #不笑挑战 #杰克gulp母 #日常","author":"杰克gulp母","videoUrl":"https://www.douyin.com/video/7621530986505291155","awemeId":"7621530986505291155","likeCount":"176262","duration":32,"memePoint":"不笑挑战：主播一本正经播报，gulp 一响自己先崩，全片全是破功瞬间"},{"title":"就多余挑战\n#gulp #杯糕姐 #不笑挑战 @抖音小助手","author":"Rice","videoUrl":"https://www.douyin.com/video/7621884183921363643","awemeId":"7621884183921363643","likeCount":"144587","duration":6,"memePoint":"不到 6 秒就笑场，「就多余挑战」四个字直接把挑战本身的荒谬点破"}]},
  {"id":"gulp_english_class","name":"@Nicki Minaj创作的原声","author":"Nicki Minaj","tag":"Gulp","style":["谐音梗","课堂梗"],"musicUrl":"https://www.douyin.com/music/7650454485304511242","musicId":"7650454485304511242","searchKeyword":"gulp 英语早读","usageCount":"627","verifiedAt":"2026-11-01","examples":[{"title":"英语老师想要的英语早自习：\n#cupcakke #cupcakke杯糕姐 #cupcakke音乐 #杯糕姐 #英语早读","author":"Nicki Minaj","videoUrl":"https://www.douyin.com/video/7650454520665635301","awemeId":"7650454520665635301","likeCount":"97674","duration":16,"memePoint":"把 gulp 剪成英语早读齐诵素材，整段制造「全班一起咽口水」的画面"}]},
  {"id":"yg_fruit_remix","name":"@水溶性薄荷创作的原声","author":"水溶性薄荷","tag":"野花香+Gulp","style":["混音","童年动画","双音源"],"musicUrl":"https://www.douyin.com/music/7450152479737989926","musicId":"7450152479737989926","searchKeyword":"野花香 gulp 果宝特攻","usageCount":"863","verifiedAt":"2026-11-01","examples":[{"title":"【杯糕/jiafei】果宝特攻主题曲 #cupcakke #jiafei #野花香 #果宝特攻 #童年动画","author":"水溶性薄荷","videoUrl":"https://www.douyin.com/video/7450152504869817610","awemeId":"7450152504869817610","likeCount":"15321","duration":80,"memePoint":"童年动画主题曲被杯糕姐嗓子接管，副歌一进来就是熟悉的 gulp 卡点"}]},
  {"id":"yg_qingzang_remix","name":"@水溶性薄荷创作的原声","author":"水溶性薄荷","tag":"野花香+Gulp","style":["混音","缝合","双音源"],"musicUrl":"https://www.douyin.com/music/7484294960603319051","musicId":"7484294960603319051","searchKeyword":"野花香 gulp 青藏","usageCount":"24","verifiedAt":"2026-11-01","examples":[{"title":"【cupcakke/jiafei】青藏gulp原 #cupcakke #野花香 #jiafei #青藏高原 #治愈系","author":"水溶性薄荷","videoUrl":"https://www.douyin.com/video/7484294233155751178","awemeId":"7484294233155751178","likeCount":"7343","duration":136,"memePoint":"野花香 + 青藏高原 + gulp 三合一，136 秒越唱越高，缝合到离谱"}]},
  {"id":"yg_eggparty_remix","name":"@碇信志创作的原声","author":"碇信志","tag":"野花香+Gulp","style":["remix","游戏","双音源"],"musicUrl":"https://www.douyin.com/music/7276819857125985080","musicId":"7276819857125985080","searchKeyword":"野花香 gulp 蛋仔","usageCount":"1535","verifiedAt":"2026-11-01","examples":[{"title":"SWEET JIAFEI x CUPCAKKE #蛋仔派对 #jiafei #cupcakke #野花香 #remix","author":"碇信志","videoUrl":"https://www.douyin.com/video/7276819803539508515","awemeId":"7276819803539508515","likeCount":"6633","duration":34,"memePoint":"蛋仔派对画风配双音源 remix，可爱皮 + 脏 adlib，反差制造荒诞"}]},
  {"id":"yg_cosmic_remix","name":"@郑若曲（耍大牌版）创作的原声","author":"郑若曲（耍大牌版）","tag":"野花香+Gulp","style":["混音","Kpop缝合","双音源"],"musicUrl":"https://www.douyin.com/music/7640866449574660891","musicId":"7640866449574660891","searchKeyword":"野花香 gulp cosmic","usageCount":"292","verifiedAt":"2026-11-01","examples":[{"title":"Jiafei/cupcakKe - cosmic #redvelvet #裴珠泫 #cupcakke #jiafei #野花香","author":"郑若曲（耍大牌版）","videoUrl":"https://www.douyin.com/video/7640866408410393531","awemeId":"7640866408410393531","likeCount":"6386","duration":225,"memePoint":"把 Red Velvet 的 cosmic 拆成两半，一半野花香一半杯糕，整首曲子完成曲风叛变"}]},
  {"id":"yg_love_remix","name":"@WLDFLWR野花唱片创作的原声","author":"WLDFLWR野花唱片","tag":"野花香+Gulp","style":["混音","抒情对撞","双音源"],"musicUrl":"https://www.douyin.com/music/7692655467718855424","musicId":"7692655467718855424","searchKeyword":"野花香 gulp 特别爱你","usageCount":"39","verifiedAt":"2026-11-01","examples":[{"title":"我真的特别爱你-杯糕x野花香remix #音频后期制作 #治愈系氛围感拉满 #杯糕姐 #我真的特别爱你 #野花香","author":"WLDFLWR野花唱片","videoUrl":"https://www.douyin.com/video/7692655513931510513","awemeId":"7692655513931510513","likeCount":"2322","duration":22,"memePoint":"把一首深情的歌和杯糕姐的吞咽音对撞，温柔与猎奇同时出现"}]}
];

const MUSIC_SOURCE = "douyin";
const MUSIC_BATCH = 1;
const MUSIC_COLLECTED_AT = "2026-11-01";

const MUSIC_COUNTS = {"music":21,"videos":25,"groups":{"yhx":7,"gulp":9,"yg":5}};

function musicGroupOf(tag) {
  return MUSIC_GROUPS.find((g) => g.tag === tag) || null;
}

// 大数字统一成「9.2万 / 1234」这种中文习惯写法；非数字原样返回，别把平台展示值改残
function formatMusicCount(raw) {
  if (raw === null || raw === undefined || raw === '') return '';
  const n = Number(raw);
  if (!Number.isFinite(n)) return String(raw);
  if (n >= 100000000) return (n / 100000000).toFixed(1).replace(/\.0$/, '') + '亿';
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '万';
  return String(n);
}

// 秒数 → m:ss（数据集里的 duration 单位就是秒，缺失返回空串让界面自己兜底）
function formatMusicDuration(sec) {
  const n = Number(sec);
  if (!Number.isFinite(n) || n <= 0) return '';
  const m = Math.floor(n / 60);
  const s = Math.round(n % 60);
  return m + ':' + String(s).padStart(2, '0');
}

// 分组 + 关键词（音乐名 / 作者 / 玩法标签 / 示例作者与荒诞点都参与匹配）
function filterMusicItems(groupKey, keyword) {
  const group = MUSIC_GROUPS.find((g) => g.key === groupKey) || MUSIC_GROUPS[0];
  const kw = String(keyword || '').trim().toLowerCase();
  return MUSIC_ITEMS.filter((it) => {
    if (group.tag && it.tag !== group.tag) return false;
    if (!kw) return true;
    const hay = [it.name, it.author, it.searchKeyword, it.tag, it.style.join(' ')]
      .concat(it.examples.map((e) => e.author + ' ' + e.memePoint + ' ' + e.title))
      .join(' ')
      .toLowerCase();
    return hay.includes(kw);
  });
}

const __export = {
  source: MUSIC_SOURCE,
  batch: MUSIC_BATCH,
  collectedAt: MUSIC_COLLECTED_AT,
  counts: MUSIC_COUNTS,
  groups: MUSIC_GROUPS,
  items: MUSIC_ITEMS,
  groupOf: musicGroupOf,
  formatCount: formatMusicCount,
  formatDuration: formatMusicDuration,
  filter: filterMusicItems,
};
// @platform: 双端导出，Node/打包器走 module.exports，浏览器/小程序同步脚本走 window 全局
if (typeof module === 'object' && module.exports) module.exports = __export;
else if (typeof window !== 'undefined') window.MUSIC_DATA = __export;

}).call(window);
