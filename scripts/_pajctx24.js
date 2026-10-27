'use strict';

// 第二十四轮共用的「淋安京语境」判定。
//
// 与 21 号同源（按视频/网页分块），只把特征词换成平安京区：
//   同一条【视频】/【网页】下面直到下一条之前的【UP】【简介】【标签】【评论】【弹幕】【正文】
//   全部算同一块；只要这一块里有任意一行命中守望特征词，整块都算守望语境。
//
// ⚠️ 两条本轮专属规则：
//   1) 本区与「阴淋师」（《阴阳师》本体）同 IP：块内出现「阴阳师 / 阴淋师」却没有任何
//      平安京特征时，判为本体语境 → 整块排除。
//   2) 特征词一律只用**多字词**：单字的 巫/侍/忍/射/守/祝 会命中「猩红女巫」这类别区内容，
//      以及 出装/下路/MVP/AD 这类通用 MOBA 词，一律不进特征表（第一版踩过这个坑）。
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const OW_STRONG =
  /决战平安京|决战！平安京|平安京|安京|撅战|淋安京|大沙田|扒鸡|Onmyoji Arena|式神|资质赛|魂火|大阴阳师|大嘤嘤师|为崽而战|百鬼奕|逢魔之战|绮乱秘境|蜃气之界|混战狭间|麻将棋|阴阳术|灵咒|复生之酒|澄心值|赏金特典|祈福神龛|人品值|阴阳寮|保释金|石距|地震鲶|蜃气楼|年兽|巫女大蛇|业原火|八岐大蛇|悲鸣之旗|紧那罗|阿织|彼岸花|铃彦姬|妖狐|化鲸|鬼女红叶|鬼使白|千姬|兰兰|天照|不知火|桔梗|青行灯|雪女|神乐|铁鼠|九命猫|妖刀姬|茨木童子|酒吞童子|鬼切|须佐之男|雪童子|络新妇|黑童子|鸦天狗|鬼使黑|判官|金鱼姬|面灵气|清姬|烟烟罗|妖琴师|玉藻前|荒川之主|白童子|追月神|大司命|云外镜|恐山安娜|星熊童子|申屠子夜|帝释天|姑获鸟|骨女|万年竹|跳跳妹妹|杀生丸|山风|小袖之手|白藏主|朽木露琪亚|海忍|纸舞|入内雀|风狸|少羽大天狗|跳跳哥哥|人面树|兵俑|山童|蟹姬|狸猫|座敷童子|食梦貘|凤凰火|吸血姬|海坊主|犬神|般若|镰鼬|小鹿男|青坊主|犬夜叉|傀儡师|两面佛|黑崎一护|泷夜叉姬|久次良|阿修罗|大岳丸|麻仓叶|夜刀神|坂田银时|小松丸|御馔津|百目鬼|鬼童丸|猫掌柜|铃鹿御前|青蛙瓷器|樱花妖|山兔|萤草|辉夜姬|惠比寿|一目连|桃花妖|花鸟卷|日和坊|缘结神|匣中少女|椒图|虫师|天井下|书翁|孟婆/;

// 明确属于别区的句子：块内只要出现这些且没有守望特征，整块排除
const OTHER_STRONG =
  /第五人格|庄园|求生者|监管者|密码机|狂欢之椅|洛克王国|迪莫|英雄联盟|德玛西亚|王者荣耀|王者淋耀|原神|淋神|钟离|雷电将军|永劫|三角洲|鸣潮|绝区零|阴淋师|阴阳师手游|黎明杀机|炉石|星穹铁道|星淋铁道|崩铁|无畏契约|瓦罗兰特|瓦罗淋特|捷风|芮娜|爆能器|漫威|淋威争锋|阿斯加德|瓦坎达|捍卫者|决斗家|策略家|复仇者|绯红女巫|旺达|幻视|阿加莎|守望先锋|守望淋锋|街头霸淋|淋明杀鸡|洛克淋国/;

const clean = (line) =>
  String(line || '')
    .replace(/^【(评论|弹幕|视频|UP|简介|标签|正文|网页)】\s*/, '')
    .replace(/\[[^\]]{1,8}\]/g, '')
    .trim();

/** 读全部语料，返回 { lines: 淋安京语境行, all: 全部行, files } */
function load() {
  const dir = path.join(ROOT, 'corpus');
  const files = fs.readdirSync(dir).filter((f) => /^corpus.*\.txt$/.test(f)).sort();
  const lines = [];
  const all = [];
  for (const f of files) {
    const raw = fs.readFileSync(path.join(dir, f), 'utf8');
    let inPaj = false;
    const isOther = (t) => OTHER_STRONG.test(t) && !OW_STRONG.test(t);
    for (const rawLine of raw.split(/\r?\n/)) {
      const t = rawLine.trim();
      if (!t) continue;
      const kind = (t.match(/^【(视频|UP|简介|标签|评论|弹幕|网页|正文)】/) || [])[1] || '';
      const body = clean(t);
      if (kind === '视频' || kind === '网页') {
        inPaj = OW_STRONG.test(t) && !isOther(t);
        if (inPaj) lines.push(body);
        all.push(body);
        continue;
      }
      if (inPaj) {
        if (!isOther(t)) lines.push(body);
        all.push(body);
        continue;
      }
      if (OW_STRONG.test(t) && !isOther(t)) lines.push(body);
      all.push(body);
    }
  }
  return { lines, all, files };
}

module.exports = { load, clean, OW_STRONG, OTHER_STRONG };
