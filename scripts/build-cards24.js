'use strict';

// 第二十四轮词卡生成：从本轮策展词库反推，例句一律从语料里原样摘录。
//
// 纪律（同 19/20/21 号）：
//   - term 必须是真实存在的叫法（来自 curated-linyu24.js 的 linyu）
//   - example 必须是 corpus/*.txt 里逐字存在的一行，不改写、不拼接
//   - meaning 直接取词条的 sense（不另编一套解释）
//   - 例句必须带平安京 / 淋安京上下文，避免拿别区的句子来凑
//
// 用法: node scripts/build-cards24.js [目标条数]
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'scripts', 'curated-cards24.json');
const TARGET = Number(process.argv[2] || 150);

const { WORDS } = require(path.join(ROOT, 'scripts/curated-linyu24.js'));
const { HEROES } = require(path.join(ROOT, 'scripts/curated-heroes24.js'));

const norm = (s) =>
  String(s || '').replace(/[\s，。、！？；："'（）()【】[\]…~～·—\-_/\\|,.:;!?]/g, '').toLowerCase();
const normKey = norm;

// 已有词卡不再重复收录
const EXISTING = new Set();
try {
  // 本轮 extra24 已写入的词卡是「自己的」，重建时要算进来，否则二次运行会把自己裁掉
  const prior = path.join(ROOT, 'src/core/lore-extra24.js');
  const priorTerms = new Set();
  if (fs.existsSync(prior)) {
    try { for (const c of require(prior).cards || []) priorTerms.add(normKey(c.term)); } catch {}
  }
  const lore = require(path.join(ROOT, 'src/core/lore.js'));
  for (const c of lore.flashcards || []) {
    if (!priorTerms.has(normKey(c.term))) EXISTING.add(normKey(c.term));
  }
} catch { /* 读不到就只按本轮去重 */ }

// 例句池：本轮（24 号）新采语料 + 深挖弹幕语料
const CORPUS = path.join(ROOT, 'corpus');
const POOL = new Set();
for (const f of fs.readdirSync(CORPUS).filter((x) => /^corpus.*24.*\.txt$/.test(x)).sort()) {
  for (const line of fs.readFileSync(path.join(CORPUS, f), 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    POOL.add(t.replace(/^【(评论|弹幕|视频|UP|简介|标签|正文|网页|合集)】\s*/, '').trim());
  }
}
const rawLines = [...POOL].filter(Boolean);

// 平安京上下文判定：句子里必须出现这些特征之一，否则不算本区例句
const PAJ_STRONG = /平安京|安京|撅战|大沙田|式神|扒鸡|资质赛|阴阳术|灵咒|巫|侍|忍|射|守|祝|MVP|单排|出装|野怪|防御塔|兵线|紧那罗|阿织|彼岸花|铃彦姬|妖狐|化鲸|鬼女红叶|鬼使白|千姬|兰兰|天照|不知火|桔梗|青行灯|雪女|神乐|铁鼠|九命猫|妖刀姬|茨木|酒吞|鬼切|须佐|西凉|阎魔|白狼|管狐|小松丸|御馔津|百目鬼|鬼童丸|青蛙瓷器|樱花妖|山兔|萤草|辉夜姬|惠比寿|一目连|桃花妖|花鸟卷|日和坊|缘结神|匣中少女|椒图|虫师|天井下|书翁|孟婆|兵俑|山童|蟹姬|狸猫|座敷童子|食梦貘|凤凰火|吸血姬|海坊主|犬神|般若|镰鼬|小鹿男|青坊主|犬夜叉|傀儡师|两面佛|黑崎一护|泷夜叉姬|久次良|阿修罗|大岳丸|麻仓叶|夜刀神|坂田银时|雪童子|络新妇|黑童子|鸦天狗|鬼使黑|判官|金鱼姬|面灵气|清姬|烟烟罗|妖琴师|玉藻前|荒川之主|白童子|追月神|大司命|云外镜|恐山安娜|星熊童子|八岐大蛇|申屠子夜|帝释天|姑获鸟|骨女|夜叉|万年竹|跳跳妹妹|杀生丸|山风|小袖之手|白藏主|朽木露琪亚|海忍|纸舞|入内雀|风狸|少羽大天狗|跳跳哥哥|人面树|灶门|觉|石距|年兽|巫女大蛇|业原火|麒麟|蜃气楼|地震鲶|复生之酒|魂火|段位|大阴阳师|大嘤嘤师|百鬼奕|逢魔之战|绮乱秘境|蜃气之界|混战狭间|麻将棋|禁选|迷雾|澄心值|勾玉|赏金特典|祈福神龛|人品值|阴阳寮|保释金|站街|下饭|红温|混分|卖辅|T3|T0|AD/;

// term → hero 关联（词卡要挂 hero，hero 名须与 heroes 的 name 完全一致）
const HERO_OF = new Map();
for (const h of HEROES) {
  for (const w of h.words || []) if (!HERO_OF.has(w)) HERO_OF.set(w, h.name);
  HERO_OF.set(h.name, h.name);
}
const extraHero = [
  ['紧那罗', '紧那罗'], ['阿织', '阿织'], ['彼岸花', '彼岸花'], ['铃彦姬', '铃彦姬'],
  ['妖狐', '妖狐'], ['化鲸', '化鲸'], ['鬼女红叶', '鬼女红叶'], ['鬼使白', '鬼使白'],
  ['千姬', '千姬'], ['兰兰', '兰兰'], ['天照', '天照'], ['不知火', '不知火'],
  ['桔梗', '桔梗'], ['青行灯', '青行灯（淋安京）'], ['雪女', '雪女'], ['神乐', '神乐'],
  ['鸩', '鸩'], ['铁鼠', '铁鼠'], ['九命猫', '九命猫'], ['妖刀姬', '妖刀姬'],
  ['茨木童子', '茨木童子'], ['酒吞童子', '酒吞童子'], ['鬼切', '鬼切'], ['须佐之男', '须佐之男'],
  ['闻人翊悬', '闻人翊悬'], ['灶门炭治郎', '灶门炭治郎'], ['二口女', '二口女'], ['首无', '首无'],
  ['以津真天', '以津真天'], ['西凉', '西凉'], ['阎魔', '阎魔'], ['白狼', '白狼'],
  ['管狐', '管狐'], ['小松丸', '小松丸'], ['御馔津', '御馔津'], ['百目鬼', '百目鬼'],
  ['鬼童丸', '鬼童丸'], ['青蛙瓷器', '青蛙瓷器'], ['樱花妖', '樱花妖'], ['山兔', '山兔'],
  ['萤草', '萤草'], ['铁T', '铁T成长'], ['撅战', '桐颜灿'], ['大沙田', '八级大蜗牛'],
];
for (const [k, v] of extraHero) if (!HERO_OF.has(k)) HERO_OF.set(k, v);

// 硬标记：直接点名游戏 / 玩法，不靠单字猜测
const PAJ_HARD = /平安京|安京|撅战|大沙田|式神|决战|扒鸡|资质赛|出装|阴阳术|灵咒|段位|魂火|决战平安京/;

const cards = [];
for (const w of WORDS) {
  const key = norm(w.linyu);
  if (!key) continue;

  const hits = rawLines.filter((l) => {
    const n = norm(l);
    if (!n.includes(key)) return false;
    if (n === key) return false;
    if (n.length < key.length + 4) return false;
    if (n.length > 60) return false;
    if (/^@/.test(l)) return false;
    if (!PAJ_STRONG.test(l)) return false;
    // 单字 / 双字词（巫、射、觉、荒…）极易匹配到无关句子（「感觉」「扫射」），
    // 这类词要求例句里出现更硬的分区标记，宁缺毋滥。
    if (key.length <= 2 && !PAJ_HARD.test(l)) return false;
    return true;
  });
  if (!hits.length) continue;

  const fit = (l) => Math.abs(norm(l).length - 30);
  hits.sort((a, b) => fit(a) - fit(b));
  const example = hits[0];

  cards.push({
    term: w.linyu,
    zh: w.zh,
    type: 'slang',
    meaning: w.sense,
    detail: `对应中文原词「${w.zh}」，语义位 ${w.slot}。`,
    example,
    source: w.source,
    verify: w.source,
    hero: HERO_OF.get(w.linyu) || HERO_OF.get(w.zh) || '',
    slot: w.slot,
    aliases: String(w.alias || '').split('、').filter(Boolean),
    _n: hits.length,
  });
}

const seen = new Set();
const uniq = [];
for (const c of cards.sort((a, b) => b._n - a._n)) {
  const k = normKey(c.term);
  if (seen.has(k) || EXISTING.has(k)) continue;
  seen.add(k);
  uniq.push(c);
}

const picked = uniq.slice(0, TARGET).map(({ _n, ...rest }) => rest);
fs.writeFileSync(OUT, JSON.stringify(picked, null, 2) + '\n', 'utf8');
console.error(`[cards24] 候选 ${cards.length} → 去重后 ${uniq.length} → 写出 ${picked.length} 条`);
