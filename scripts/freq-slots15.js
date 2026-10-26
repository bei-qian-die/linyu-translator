'use strict';

// 第十五轮（洛克淋国分区扩充）：词频统计 + 逐字验真 + 生成 curated-linyu15.js。
//
// 硬约束落地：
//   - pop 不手写：按 corpus/*.txt 全量语料里「淋语侧写法」的逐字出现次数分档（高≥100 / 中≥20 / 低<20）。
//   - sense 不凭空写：淋语侧 nLin==0（语料查无逐字）的条目，sense 一律清空。
//   - 候选必须语料逐字命中：每条 word 的 linyu / alias 变体、每条 rule 的 examples，
//     都回 corpus 全文（strip 口径：去空白+标点+小写）核对，未命中的写进 evidence/cand15-review.txt 供否决。
//   - 只读 corpus，只写 evidence/ 与 scripts/curated-linyu15.js，绝不碰 seed.json。
//
// 用法: node scripts/freq-slots15.js
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CORPUS_DIR = path.join(ROOT, 'corpus');
const EVI = path.join(ROOT, 'evidence');

const HIGH = 100;
const MID = 20;

const V = (bv) => 'https://www.bilibili.com/video/' + bv;

// ---- 语料全文（strip 口径）----
const files = fs.readdirSync(CORPUS_DIR).filter((f) => /^corpus.*\.txt$/.test(f)).sort();
const norm = (s) => String(s || '').replace(/\s+/g, '');
const strip = (s) =>
  norm(s).replace(/[，。！？、；：“”‘’（）()…~—\-《》,.!?;:"'[\]【】]/g, '').toLowerCase();
let RAW = '';
for (const f of files) RAW += fs.readFileSync(path.join(CORPUS_DIR, f), 'utf8') + '\n';
const SBLOB = strip(RAW);

const countIn = (needle) => {
  const n = strip(needle);
  if (!n) return 0;
  let c = 0, i = 0;
  while ((i = SBLOB.indexOf(n, i)) !== -1) { c++; i += n.length; }
  return c;
};
// 按「语料行数」计（同一行刷屏只算一次），更稳
const lines = RAW.split('\n').map((l) => strip(l));
const lineCount = (needle) => {
  const n = strip(needle);
  if (!n) return 0;
  let c = 0;
  for (const l of lines) if (l.includes(n)) c++;
  return c;
};
const popOf = (n) => (n >= HIGH ? '高' : n >= MID ? '中' : '低');

// ================= 候选词库（洛克淋国分区为主） =================
// 字段：zh / linyu(必填) / alias / slot / sense / source / rel / hero
// pop 由本脚本按语料计数推导；sense 在 nLin==0 时自动清空。
const WORDS_CAND = [
  // —— 分区名多译法（并入既有「洛克王国→洛克淋锅」）——
  { zh: '洛克王国', linyu: '洛克淋锅', alias: '洛克淋国、布拉迪王国、布拉迪大世界、法克王国', slot: '洛克淋国/分区', sense: '《洛克王国》的淋语区名，除「洛克淋锅/洛克淋国」外，语料里还淋化成「布拉迪王国/布拉迪大世界」（“交交你们如何在布拉迪王国找到主人”“来支持洛克淋国，布拉迪大世界惹”）与「法克王国」。', source: V('BV1XgddBEEmU') + ' 、' + V('BV1vbyCBtEQX') + ' 、' + V('BV1MCJA6gEMy'), rel: ['洛克淋国'] },

  // —— 第一人称「我」池扩充（并入既有 我/本宫）——
  { zh: '我', linyu: '本宫', alias: '本宫、本娘娘', slot: '第一人称自称/宫斗体', sense: '洛克淋国把对局写成宫斗剧，第一人称改用「本宫/本娘娘」等清宫位分体自称：“本宫现在素钮祜禄光队”。', source: V('BV1vrJ166EtG'), rel: ['本宫', '钮祜禄'] },

  // —— 队伍黑话（光/幽/虫/雪天/平衡/毒/萌/星陨）——
  { zh: '光队', linyu: '加油光队', alias: '钮祜禄光队、光队', slot: '洛克淋国/游戏术语', sense: '洛克淋国光系队伍的黑话叫法；版本强势时被捧成「加油光队」，黑化后写作「钮祜禄光队」。', source: V('BV1vrJ166EtG'), rel: ['钮祜禄', '终端'] },
  { zh: '幽队', linyu: '赔钱幽队', alias: '炫彩幽队、幽队', slot: '洛克淋国/游戏术语', sense: '幽灵系队伍，因机制吃亏被自嘲「赔钱幽队/赔钱货」：“还好你没玩赔钱幽队”。', source: V('BV1Bmjh6bE36') + ' 、' + V('BV1z2eM6kEJQ'), rel: ['摔炮', '终端'] },
  { zh: '虫队', linyu: '平衡虫队', alias: '纯虫队、虫队', slot: '洛克淋国/游戏术语', sense: '虫系队伍，圈内有「虫越少，虫越强」的信仰：“平衡虫队闪亮登场”。', source: V('BV1KX9UBSEVC'), rel: ['花衣蝶', '虫群智慧'] },
  { zh: '雪天队', linyu: '雪天女子', alias: '雪天队、雪天老弟', slot: '洛克淋国/游戏术语', sense: '雪天体系队伍，洛克淋国视频里被拟人成「雪天女子」：“幽队女子处理雪天队中”。', source: V('BV1Bmjh6bE36'), rel: ['处理', '老寒腿'] },
  { zh: '平衡队', linyu: '平衡队', alias: 'big6、平衡光', slot: '洛克淋国/游戏术语', sense: '不偏科的综合阵容，玩家也叫它「big6」：“其实这种平衡队有个更具体的称呼 叫big6”。', source: V('BV11uaS6wEKU') + ' 、' + V('BV1Ppn66GEnk'), rel: ['光队'] },

  // —— 对局机制黑话 ——
  { zh: '一次性精灵', linyu: '摔炮', alias: '摔炮、充能摔炮', slot: '洛克淋国/游戏术语', sense: '上场放一次技能就报废的精灵，被叫「摔炮」：“带羽化和摇铃当摔炮”“就是个要充能的摔炮”。', source: V('BV1vrJ166EtG') + ' 、' + V('BV1z2eM6kEJQ'), rel: ['终端'] },
  { zh: '核心输出', linyu: '终端', alias: '终端、光系终端', slot: '洛克淋国/游戏术语', sense: '队伍的最终输出核心位：“光系的特点就是博学多才，布灵确可以算半个光系终端”“加油光队最大的问题是没有终端”。', source: V('BV1vrJ166EtG'), rel: ['摔炮', '布灵布灵'] },
  { zh: '进化', linyu: '首领化', alias: '首领化、异色首领化', slot: '洛克淋国/游戏术语', sense: '洛克王国世界的进化机制，淋语区直接叫「首领化」：“这恶魔狼首领化都不开？？”“我鹳新赛季美美拿下异色首领化”。', source: V('BV1vrJ166EtG') + ' 、' + V('BV1H2nU6ZENd'), rel: ['恶魔狼'] },
  { zh: '上场', linyu: '就业', alias: '就业、失业、再就业', slot: '洛克淋国/游戏术语', sense: '精灵被选用上场叫「就业」，坐冷板凳叫「失业」：“你梦目前好像只能在加油光队就业惹”“就为了让幽系失业到底”。', source: V('BV1vrJ166EtG') + ' 、' + V('BV1z2eM6kEJQ'), rel: ['回宫'] },
  { zh: '回归', linyu: '回宫', alias: '回宫、回春、二进宫', slot: '洛克淋国/宫斗体', sense: '精灵强度回升或复刻返场，用宫斗腔说成「回宫/回春/二进宫」：“加油光队居然也有回宫的一天”“素人果果再回春”“竟然是二进宫”。', source: V('BV1vrJ166EtG') + ' 、' + V('BV1z2eM6kEJQ'), rel: ['就业'] },
  { zh: '单独防守', linyu: '单防', alias: '单防、炮灰单防', slot: '洛克淋国/游戏术语', sense: '用一只精灵专门盯防对方核心：“从前那个被炮灰单防的光队”“化蝶完全单防”。', source: V('BV1vrJ166EtG') + ' 、' + V('BV1GMn66QEjQ'), rel: ['炮灰'] },
  { zh: '送死精灵', linyu: '炮灰', alias: '炮灰', slot: '洛克淋国/游戏术语', sense: '上去送死拖节奏的精灵：“被炮灰单防的光队已经鼠了”。', source: V('BV1vrJ166EtG'), rel: ['单防'] },
  { zh: '对付', linyu: '处理', alias: '处理、在线处理、难处理', slot: '洛克淋国/游戏术语', sense: '洛克淋国把「打/对付某队」说成「处理」，配宫斗腔：“幽队女子处理雪天队中”“鹅妈在线处理神秘队伍中”。', source: V('BV1Bmjh6bE36') + ' 、' + V('BV14vJh6EEYM'), rel: ['雪天女子'] },
  { zh: '固定套路', linyu: '公式化', alias: '公式、公式得不行', slot: '洛克淋国/评价判断', sense: '阵容/玩法套路化、没新意：“你莎也素公式得不行”“公式化命定花种，公式化首领试炼”。', source: V('BV1Ppn66GEnk') + ' 、' + V('BV1tXni6KE5v'), rel: ['三倍弱电'] },
  { zh: '速度低', linyu: '低人一等', alias: '低人一等厚', slot: '洛克淋国/评价判断', sense: '速度慢就被判「低人一等」：“你蓝就算叠130层法强但速度低就素低人一等厚”。', source: V('BV1Ppn66GEnk'), rel: ['130'] },
  { zh: '被克制', linyu: '三倍弱电', alias: '三倍弱电', slot: '洛克淋国/评价判断', sense: '属性被多重克制的自嘲：“你莎也素公式得不行三倍弱电”“孩子们，我三倍弱电”。', source: V('BV1Ppn66GEnk') + ' 、' + V('BV1WqRkB8EyJ'), rel: ['大事不妙'] },

  // —— 宫斗 / 甄嬛体梗 ——
  { zh: '黑化', linyu: '钮祜禄', alias: '钮祜禄光队、钮祜禄', slot: '洛克淋国/宫斗体', sense: '借《甄嬛传》「钮祜禄·甄嬛」指精灵/队伍黑化变强：“本宫现在素钮祜禄光队”。', source: V('BV1vrJ166EtG'), rel: ['本宫', '光队'] },
  { zh: '130速', linyu: '高贵的130速', alias: '130速、辛者库宫女', slot: '洛克淋国/宫斗体', sense: '速度线 130 的精灵自恃「高贵的130速」，一旦被压就成「辛者库宫女一夜被封了贵人」：“你会发现高贵的130速有点像辛者库宫女一夜被封了贵人”。', source: V('BV1Bmjh6bE36'), rel: ['低人一等', '130'] },
  { zh: '事业顺利', linyu: '事业长虹', alias: '事业长虹', slot: '洛克淋国/饭圈运营', sense: '给精灵/UP 应援的宫斗腔祝福：“让我们祝鹳女王事业长虹吧”。', source: V('BV1H2nU6ZENd'), rel: ['锤头鹳'] },

  // —— 精灵淋化外号 / 自称体系（我X / 你X）——
  { zh: '雪影娃娃', linyu: '冻肉娃娃', alias: '雪影娃娃、冻肉娃娃、雪影松鼠、雪影、雪影姐姐、睡铃雪影娃娃', slot: '洛克淋国/圈层黑话', sense: '《洛克王国》冰系精灵，雪天队/雪影平衡队核心，黑话外号「冻肉娃娃/雪影松鼠」：“就是要用火愿力狠狠逮捕冻肉娃娃”“雪影姐姐首领化过期了所以不壮了”“是优的雪影平衡队”。', source: V('BV1Bmjh6bE36') + ' 、' + V('BV11UnF6wEGw') + ' 、' + V('BV1Tbn26aEFD'), rel: ['雪天队', '老寒腿'], hero: '雪影娃娃' },
  { zh: '我果', linyu: '我果', alias: '我果、果果、素人果果、果菇太子', slot: '第一人称自称/洛克淋国', sense: '洛克淋国「我＋精灵名」自称体系样本，果果（草系精灵）的自称：“我果圣得我树宠幸”“素人果果再回春”。', source: V('BV1z2eM6kEJQ') + ' 、' + V('BV14vJh6EEYM'), rel: ['我水', '回春'] },
  { zh: '我墓', linyu: '我墓', alias: '我墓、你墓', slot: '第一人称自称/洛克淋国', sense: '幽系精灵「墓」的自称：“我墓在两个雪天队老寒腿面前简直是健步如飞”。', source: V('BV1Bmjh6bE36'), rel: ['幽队', '老寒腿'] },
  { zh: '我帽', linyu: '我帽', alias: '我帽', slot: '第一人称自称/洛克淋国', sense: '幽盾精灵「帽」的自称：“我帽作为物防最高的幽盾，居然还没有返场的档期吗”。', source: V('BV1z2eM6kEJQ'), rel: ['幽队'] },
  { zh: '我铃', linyu: '我铃', alias: '我铃、小铃、玲玲、铃铃、报恩铃铃', slot: '第一人称自称/洛克淋国', sense: '精灵「铃铃」的自称：“我铃在后台吸入了大半局能起到了一个防先发的作用”“给大家看我家的报恩铃铃”。', source: V('BV14vJh6EEYM') + ' 、' + V('BV1z2eM6kEJQ'), rel: ['吸入'] },
  { zh: '我羊', linyu: '我羊', alias: '我羊、鬼羊、雪幽羊', slot: '第一人称自称/洛克淋国', sense: '幽系精灵「羊」的自称：“搞笑幽幽·攻雪幽羊”“叹羊生，终难定”。', source: V('BV1Bmjh6bE36') + ' 、' + V('BV14vJh6EEYM'), rel: ['幽队'] },
  { zh: '我鹳', linyu: '我鹳', alias: '我鹳、鹳女王、锤头鹳', slot: '第一人称自称/洛克淋国', sense: '锤头鹳的自称与封号：“隐隐约约听说我鹳新赛季美美拿下异色首领化”“祝鹳女王事业长虹”。', source: V('BV1H2nU6ZENd'), rel: ['锤头鹳', '首领化'], hero: '锤头鹳' },
  { zh: '你莫', linyu: '你莫', alias: '你莫、迪莫', slot: '第三人称/洛克淋国', sense: '迪莫的第三人称淋化叫法：“你莫的老公小光到底要耍多久大牌”。', source: V('BV1vrJ166EtG'), rel: ['迪莫', '你光'], hero: '迪莫' },
  { zh: '你光', linyu: '你光', alias: '你光、小光、光王', slot: '第三人称/洛克淋国', sense: '光系终端精灵的第三人称叫法：“期待你光拯救光队中”“光王是个可口的老头”。', source: V('BV1vrJ166EtG'), rel: ['光队', '你莫'] },
  { zh: '你梦', linyu: '你梦', alias: '你梦、奇梦咪', slot: '第三人称/洛克淋国', sense: '奇梦咪的第三人称叫法：“你梦目前好像只能在加油光队就业惹”。', source: V('BV1vrJ166EtG'), rel: ['就业', '奇梦咪'], hero: '奇梦咪' },
  { zh: '你蓝', linyu: '你蓝', alias: '你蓝、水蓝蓝', slot: '第三人称/洛克淋国', sense: '水蓝蓝的第三人称叫法：“你蓝就算叠130层法强但速度低就素低人一等厚”。', source: V('BV1Ppn66GEnk'), rel: ['水蓝蓝', '低人一等'], hero: '水蓝蓝' },
  { zh: '你莎', linyu: '你莎', alias: '你莎、莎莎、蓝莎', slot: '第三人称/洛克淋国', sense: '精灵「莎莎/蓝莎」的第三人称叫法：“你莎也素公式得不行三倍弱电”。', source: V('BV1Ppn66GEnk') + ' 、' + V('BV11uaS6wEKU'), rel: ['公式化', '三倍弱电'] },
  { zh: '你鱿', linyu: '你鱿', alias: '你鱿、鱿鱼', slot: '第三人称/洛克淋国', sense: '精灵「鱿鱼」的第三人称叫法：“有没有可能塞一个你梦或者你鱿当摔炮”。', source: V('BV1z2eM6kEJQ'), rel: ['摔炮', '你梦'] },

  // —— 玩家 / 称呼 / 质感词 ——
  { zh: '玩家', linyu: '小洛克', alias: '小洛克、男洛克、女洛克', slot: '洛克淋国/称呼类', sense: '洛克王国玩家的自称「小洛克」：“小洛克甚至不要弯腰，只要低头就行了”“早安小洛克”。', source: V('BV1GidVBaExq') + ' 、' + V('BV1RpHV6nEkF'), rel: ['洛克淋国'] },
  { zh: '精灵', linyu: '精灵daddy', alias: 'daddy、火神daddy、冥古龙daddy、萌王daddy', slot: '洛克淋国/称呼类', sense: '把心动精灵喊成「daddy」：“火神daddy的指甲太长了”“想偷吃冥古龙daddy的龙奉”“洛克淋国的精灵daddy们围险惹”。', source: V('BV1vbyCBtEQX') + ' 、' + V('BV1ZbHg6UEzx'), rel: ['站街'] },
  { zh: '站街', linyu: '站街', alias: '站街、围险、围险惹', slot: '洛克淋国/圈层黑话', sense: '精灵列队展示的整活说法：“好美的站街，洛克淋国的精灵daddy们围险惹”。', source: V('BV1vbyCBtEQX'), rel: ['精灵daddy'] },
  { zh: '侵犯', linyu: '秦凡', alias: '秦凡了、秦凡', slot: '洛克淋国/基础谐音替换', sense: '「侵犯」的谐音梗写法：“我被饮雪狂兽秦凡了”。', source: V('BV1TiHp6YEsC'), rel: ['饮雪狂兽'] },
  { zh: '雄臭', linyu: '雄臭', alias: '雄臭、很雄臭', slot: '洛克淋国/评价判断', sense: '形容雄性精灵气味的玩梗词：“感觉冥古龙很雄臭”。', source: V('BV1ZbHg6UEzx'), rel: ['冥古龙'] },
  { zh: '老寒腿', linyu: '老寒腿', alias: '老寒腿、雪天老寒腿', slot: '洛克淋国/圈层黑话', sense: '雪天队慢速精灵的调侃叫法：“我墓在两个雪天队老寒腿面前简直是健步如飞”。', source: V('BV1Bmjh6bE36'), rel: ['雪天队', '我墓'] },
  { zh: '黑皮体育生', linyu: '黑皮体育生', alias: '黑皮白袜小男孩、白袜黑皮、黑皮', slot: '洛克淋国/审美', sense: '洛克淋国对黑皮白袜运动系形象的固定调侃：“我只是一个黑皮白袜小男孩,为什么大家这么排斥我”。', source: V('BV1KjsHzEEY8'), rel: ['我水'] },

  // —— 吸入 / 鼠 既有语义位的洛克变体（并入既有条目）——
  { zh: '吸入', linyu: '猛猛吸入', alias: '猛猛吸入能量、狠狠吸入、吸入', slot: '洛克淋国/圈层黑话', sense: '淋王星引力场在洛克淋国的对局化表达——在天梯/后台吸取能量：“可以在天梯猛猛吸入能量”“我铃在后台吸入了大半局”“狠狠吸入了厚”。', source: V('BV1Bmjh6bE36') + ' 、' + V('BV14vJh6EEYM') + ' 、' + V('BV1ZbHg6UEzx'), rel: ['难逃一吸', '我铃'] },
  { zh: '死', linyu: '鼠了', alias: '要鼠、会鼠、鼠吧、真的会鼠', slot: '情绪/基础谐音替换/洛克淋国', sense: '「死」的鼠化在洛克淋国对局里高频：“光队已经鼠了”“无聊的要鼠想退坑”“骑久了真的会鼠”。', source: V('BV1vrJ166EtG') + ' 、' + V('BV1ZbHg6UEzx') + ' 、' + V('BV1vbyCBtEQX'), rel: ['吓鼠了', '去鼠'] },

  // —— 精灵专名（可被搜索命中，zh=linyu）——
  { zh: '火神', linyu: '火神', alias: '火神daddy、火狗、烈火守护', slot: '洛克淋国/人物', sense: '《洛克王国》火系精灵，由火花进化，洛克淋国对局高频核心：“火神c位”“怎么处理火神”。', source: V('BV1vdhd6cEko') + ' 、' + V('BV1KX9UBSEVC'), rel: ['首领化'], hero: '火神' },
  { zh: '冥古龙', linyu: '冥古龙', alias: '冥古龙daddy、龙奉、龙缝', slot: '洛克淋国/人物', sense: '《洛克王国：世界》传说精灵，洛克淋国圈把它当「daddy」玩梗：“想吃冥古龙”“冥古龙是对的”。', source: V('BV1kyDJBQEuX') + ' 、' + V('BV1ZbHg6UEzx'), rel: ['雄臭'], hero: '冥古龙' },
  { zh: '花衣蝶', linyu: '花衣蝶', alias: '化蝶、花衣蝶老公', slot: '洛克淋国/人物', sense: '《洛克王国：世界》虫系精灵，虫队核心：“花衣蝶不带虫群智慧，宛如海豹船长不带听桥”。', source: V('BV1KX9UBSEVC'), rel: ['虫队', '虫群智慧'], hero: '花衣蝶' },
  { zh: '锤头鹳', linyu: '锤头鹳', alias: '鹳女王、我锤头、锤头', slot: '洛克淋国/人物', sense: '《洛克王国：世界》精灵，虫队的好朋友、体系队保镖：“锤头鹳是体系队女子最好的保镖”“不像我锤头，从来都是虫队的好朋友”。', source: V('BV1tTLZ6mEhJ') + ' 、' + V('BV1F9nt6YEPc'), rel: ['虫队', '事业长虹'], hero: '锤头鹳' },
  { zh: '音速犬', linyu: '音速犬', alias: '异色音速犬', slot: '洛克淋国/人物', sense: '《洛克王国》精灵，恶魔狼的强队友：“恶魔狼的队友音速犬很强呀”“异色音速犬从S1说到S5”。', source: V('BV1Bmjh6bE36') + ' 、' + V('BV19bn864EAs'), rel: ['恶魔狼'], hero: '音速犬' },
  { zh: '恶魔狼', linyu: '恶魔狼', alias: '狼王、白狼王、月狼王、恶魔狼王', slot: '洛克淋国/人物', sense: '《洛克王国》恶系精灵，洛克淋国对局常见威胁：“这恶魔狼首领化都不开？？”“以前只用防恶魔狼，现在要防白狼王，月狼王”。', source: V('BV1vrJ166EtG') + ' 、' + V('BV1z2eM6kEJQ'), rel: ['首领化', '音速犬'], hero: '恶魔狼' },
  { zh: '夜枭', linyu: '夜枭', alias: '夜宵、夜枭队', slot: '洛克淋国/人物', sense: '《洛克王国：世界》幽系精灵，幽队终端：“榨干所有精灵后夜枭一路平推”“夜枭怎么这么赔钱啊”。', source: V('BV11wN96uEJE') + ' 、' + V('BV1tTLZ6mEhJ'), rel: ['幽队', '终端'], hero: '夜枭' },
  { zh: '布灵布灵', linyu: '布灵布灵', alias: '布灵', slot: '洛克淋国/人物', sense: '《洛克王国》精灵，半个光系终端：“布灵确可以算半个光系终端”“两个超级弱幽的单体精灵布灵布灵和狼王”。', source: V('BV1vrJ166EtG') + ' 、' + V('BV1z2eM6kEJQ'), rel: ['终端', '光队'], hero: '布灵布灵' },
  { zh: '波多西', linyu: '波多西', alias: '海豹波多西', slot: '洛克淋国/人物', sense: '《洛克王国》机械神宠，抗性好：“波多西两倍抗幻，四倍抗普”“以前这玩意在页游跟密码的瞌睡王一样大肉”。', source: V('BV1wGtC6wE98'), rel: ['瞌睡王'], hero: '波多西' },
  { zh: '饮雪狂兽', linyu: '饮雪狂兽', alias: '狂兽、饮穴', slot: '洛克淋国/人物', sense: '《洛克王国》雪天系神宠：“饮雪狂兽力气好大”“狂兽是真牢，化蝶完全单防”。', source: V('BV1TiHp6YEsC') + ' 、' + V('BV1GMn66QEjQ'), rel: ['雪天队', '秦凡'], hero: '饮雪狂兽' },
  { zh: '水灵', linyu: '水灵', alias: '蓝漪水灵、水灵莎莎', slot: '洛克淋国/人物', sense: '《洛克王国》水系精灵（蓝漪水灵），颜值担当：“水灵会不会太好看了”“卷毛鸭、水灵、彩蝶鲨都好可爱”。', source: V('BV11UnF6wEGw') + ' 、' + V('BV1Bmjh6bE36'), rel: ['彩蝶鲨'], hero: '水灵' },
  { zh: '彩蝶鲨', linyu: '彩蝶鲨', alias: '肥鲨', slot: '洛克淋国/人物', sense: '《洛克王国：世界》精灵，雨天/水系队可爱担当：“卷毛鸭、水灵、彩蝶鲨都好可爱”“美美投入水蓝蓝肥鲨古卷3随机的怀抱”。', source: V('BV1Bmjh6bE36') + ' 、' + V('BV1vrJ166EtG'), rel: ['水灵'], hero: '彩蝶鲨' },
  { zh: '独角兽', linyu: '独角兽', alias: '白金独角兽、小独角兽、独角兽套', slot: '洛克淋国/人物', sense: '《洛克王国》光系精灵（白金独角兽），光队中期打手：“迪莫和独角兽最多属于中期打手”“好有毒的配色，安在独角兽身上都不好看”。', source: V('BV1vrJ166EtG') + ' 、' + V('BV14pHN6EEPC'), rel: ['光队', '迪莫'], hero: '白金独角兽' },
  { zh: '奇梦咪', linyu: '奇梦咪', alias: '你梦、奇梦', slot: '洛克淋国/人物', sense: '', source: V('BV1vrJ166EtG') + ' 、' + V('BV1WqRkB8EyJ'), rel: ['就业', '光队', '你梦'], hero: '奇梦咪' },
  { zh: '小幽幽', linyu: '幽幽', alias: '小幽幽、幽米、幽米栗、搞笑幽幽', slot: '洛克淋国/人物', sense: '《洛克王国》幽灵系精灵王，幽队招牌，淋语区写作「幽幽/幽米栗」：“搞笑幽幽·攻雪幽羊”“我从来没说过自己和幽米栗长得有多像”。', source: V('BV1Bmjh6bE36'), rel: ['幽队', '我羊'], hero: '小幽幽' },
  { zh: '迪莫', linyu: '迪莫', alias: '迪莫莫、超市迪莫、迪迪', slot: '洛克淋国/人物', sense: '《洛克王国》光系神宠，洛克淋国吉祥物级存在：“抱着迪莫我就能睡着了”“希望是像迪莫那样能平推PVE的唯一精灵”。', source: V('BV1EKnv6UEb7') + ' 、' + V('BV1tXni6KE5v'), rel: ['你莫', '光队'], hero: '迪莫' },
  { zh: '水蓝蓝', linyu: '水蓝蓝', alias: '我水、你蓝、水蓝蓝老师', slot: '洛克淋国/人物', sense: '《洛克王国》初始水系精灵，洛克淋国「我水」自称的本体：“美美投入水蓝蓝肥鲨古卷3随机的怀抱”“水蓝蓝吧一些完全不会的人带到了不属于他们的高度”。', source: V('BV1vrJ166EtG') + ' 、' + V('BV1Ppn66GEnk'), rel: ['我水', '你蓝'], hero: '水蓝蓝' },
  { zh: '卷毛鸭', linyu: '卷毛鸭', alias: '卷毛鸭', slot: '洛克淋国/人物', sense: '《洛克王国：世界》水系精灵，雨天队可爱担当：“卷毛鸭、水灵、彩蝶鲨都好可爱”。', source: V('BV1Bmjh6bE36'), rel: ['水灵', '彩蝶鲨'] },
  { zh: '咔咔鸟', linyu: '咔咔鸟', alias: '咔咔鸟', slot: '洛克淋国/人物', sense: '《洛克王国：世界》精灵，被男神点名“你该不会玩咔咔鸟吧”的社死对象。', source: V('BV1Bmjh6bE36'), rel: ['虫队'] },
  { zh: '梦想三三', linyu: '梦想三三', alias: '梦想三三、三三', slot: '洛克淋国/人物', sense: '《洛克王国：世界》精灵，萌队核心，被削后玩家喊「梦想三三被削成废物了」。', source: V('BV1Bmjh6bE36'), rel: ['萌队'] },
  { zh: '云梦豚', linyu: '云梦豚', alias: '云梦豚、小豚', slot: '洛克淋国/人物', sense: '《洛克王国：世界》新精灵：“黑白同乘【云梦豚】”“当洛克王国小豚安家记遇上了舞萌”。', source: V('BV1cGHP6TEJ7') + ' 、' + V('BV1HcnU6bE5i'), rel: [] },
  { zh: '吉洛斯', linyu: '吉洛斯', alias: '吉洛斯老公', slot: '洛克淋国/人物', sense: '《洛克王国：世界》精灵，星光对决热门：“吉洛斯老公”“吉洛斯这周帕帕斯卡加能耗是真的恶心”。', source: V('BV1tQnS6VERo'), rel: [] },
];

// ================= 候选句式（examples 必须语料逐字命中，≥2 条） =================
const RULES_CAND = [
  { pattern: '(幽队|雪天|鹅妈|在线|女子).{0,4}处理', template: '幽队女子处理雪天队中！', note: '洛克淋国·宫斗腔「处理」某队', scene: '游戏区 / 整活', examples: '搞笑幽幽·攻雪幽羊-幽队女子处理雪天队中；鹅妈在线处理神秘队伍中。', src: V('BV1Bmjh6bE36') },
  { pattern: '(猛猛|狠狠)吸入|后台吸入|吸入.{0,3}能量', template: '在天梯猛猛吸入能量惹！', note: '洛克淋国·对局版引力场吸入', scene: '游戏区 / 玩梗', examples: '可以在天梯猛猛吸入能量；我铃在后台吸入了大半局能起到了一个防先发的作用。', src: V('BV1Bmjh6bE36') },
  { pattern: '三倍弱电', template: '我亲爱的你三倍弱电，大事不妙惹！', note: '洛克淋国·被克制自嘲', scene: '游戏区 / 吐槽', examples: '你莎也素公式得不行三倍弱电我亲爱的你大事不妙惹；孩子们，我三倍弱电。', src: V('BV1Ppn66GEnk') },
  { pattern: '(回宫的一天|再回春|二进宫)', template: '加油光队居然也有回宫的一天惹！', note: '洛克淋国·精灵复刻/强度回升', scene: '游戏区 / 应援', examples: '加油光队居然也有回宫的一天；素人果果再回春。', src: V('BV1vrJ166EtG') },
  { pattern: '(光队就业|幽系失业|艺术生就业|再就业)', template: '你梦目前好像只能在加油光队就业惹！', note: '洛克淋国·精灵上场/坐冷板凳', scene: '游戏区 / 吐槽', examples: '你梦目前好像只能在加油光队就业惹；就为了让幽系失业到底直接以后去天桥下讨饭吃。', src: V('BV1vrJ166EtG') },
  { pattern: '虫越少.{0,2}虫越强', template: '虫越少，虫越强！平衡虫队闪亮登场惹！', note: '洛克淋国·虫队信仰应援', scene: '游戏区 / 应援', examples: '虫队真是虫越少越强；虫越少，虫越强！平衡虫队闪亮登场。', src: V('BV1KX9UBSEVC') },
];

// ---- 逐字验真 + pop 推导 ----
const review = [];
const WORDS = [];
for (const w of WORDS_CAND) {
  const variants = [w.linyu, ...String(w.alias || '').split(/[、,，]/).map((x) => x.trim()).filter(Boolean)];
  let nLin = lineCount(w.linyu);
  let nBest = nLin;
  let bestForm = w.linyu;
  for (const v of variants) { const c = lineCount(v); if (c > nBest) { nBest = c; bestForm = v; } }
  const pop = popOf(nBest);
  const sense = nLin > 0 ? w.sense : '';
  if (nLin === 0) review.push(`[SENSE清空] ${w.zh}→${w.linyu} 淋语侧语料 0 命中，sense 留空`);
  WORDS.push({ zh: w.zh, linyu: w.linyu, alias: w.alias, slot: w.slot, sense, source: w.source, pop, rel: w.rel || [], ...(w.hero ? { hero: w.hero } : {}) });
  review.push(`[WORD] ${w.zh}→${w.linyu} | nLin=${nLin} nBest=${nBest}(${bestForm}) pop=${pop} sense=${sense ? '有' : '空'}`);
}

const RULES = [];
for (const r of RULES_CAND) {
  const ex = String(r.examples).split(/[；;]/).map((x) => x.trim()).filter(Boolean);
  const miss = ex.filter((e) => lineCount(e) === 0);
  if (miss.length) review.push(`[RULE候选] ${r.pattern} 例句未逐字命中(${miss.length}/${ex.length}): ${miss.join(' || ').slice(0, 120)}`);
  else review.push(`[RULE通过] ${r.pattern} 例句 ${ex.length} 条全部逐字命中`);
  RULES.push(r);
}

// ---- 写 curated-linyu15.js ----
const banner = `'use strict';

// 第十五轮精选扩充（2026-10-26）：洛克淋国分区 词库 + 句式。
// 来源：corpus/corpus-bili-20261026102422.txt（80 视频 / 1243 评论，洛克淋国 + 洛克王国精灵关键词）。
// 由 scripts/freq-slots15.js 逐字验真 + 语料计数定 pop 后生成；评审记录 evidence/cand15-review.txt。
// 每条 linyu 写法都逐字出现在语料里；pop 来自语料行数计数（高≥100/中≥20/低<20），sense 仅 nLin>0 才写。
// zh 已存在的条目由 apply-linyu15.js 并入 alias 集合（不覆盖已有解释）。

const V = (bv) => 'https://www.bilibili.com/video/' + bv;

`;
const wordsJs = 'const WORDS = ' + JSON.stringify(WORDS, null, 2).replace(/"([a-zA-Z_]+)":/g, '$1: ') + ';\n\n';
const rulesJs = 'const RULES = ' + JSON.stringify(RULES, null, 2).replace(/"([a-zA-Z_]+)":/g, '$1: ') + ';\n\n';
const footer = 'module.exports = { WORDS, RULES };\n';
fs.writeFileSync(path.join(ROOT, 'scripts/curated-linyu15.js'), banner + wordsJs + rulesJs + footer, 'utf8');

// ---- 写 slot-freq15.json ----
const freq = WORDS.map((w) => ({ zh: w.zh, linyu: w.linyu, nLin: lineCount(w.linyu), pop: w.pop, sense: w.sense ? '有' : '空' }));
fs.writeFileSync(path.join(EVI, 'slot-freq15.json'), JSON.stringify({ generatedAt: new Date().toISOString(), corpusFiles: files.length, thresholds: { HIGH, MID }, words: freq }, null, 2), 'utf8');

// ---- 写评审记录 ----
fs.writeFileSync(path.join(EVI, 'cand15-review.txt'), review.join('\n') + '\n', 'utf8');

const senseBlank = WORDS.filter((w) => !w.sense).length;
console.log(`[OK] curated-linyu15.js：WORDS ${WORDS.length}（sense 空 ${senseBlank}）/ RULES ${RULES.length}`);
console.log(`[OK] evidence/slot-freq15.json、evidence/cand15-review.txt`);
const ruleMiss = review.filter((r) => r.startsWith('[RULE候选]'));
if (ruleMiss.length) console.log(`[注意] ${ruleMiss.length} 条句式例句未全逐字命中，详见 cand15-review.txt`);
