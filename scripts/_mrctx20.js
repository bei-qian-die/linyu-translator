'use strict';

// 第二十轮共用的「淋威争锋语境」判定。
//
// 为什么不用「逐行判定」：本区最有淋语的句子往往一个游戏字都不带
// （「淋威人太少找不到人」「减少点游戏术语，多点淋语」），逐行判会把它们全漏掉；
// 反过来只看关键词，又会把别的游戏区的同名词全捞进来。
//
// 沿用第十三轮 mine-quotes19 的「按视频分块」口径：
//   同一条【视频】下面直到下一条【视频】之前的【UP】【简介】【标签】【评论】【弹幕】
//   全部算同一块；只要这一块里有任意一行命中淋威特征词，整块都算淋威语境。
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const MR_STRONG =
  /漫威|Marvel|marvel|争锋|淋威|阿斯加德|仙宫|世界树|瓦坎达|昆仑|九头蛇|克林塔|东京2099|蜘蛛岛|底比斯|时代广场|地狱火晚宴|神盾局|捍卫者|决斗家|策略家|全能英雄|连携|占点|推车|运货|灭霸|格尔|超级英雄|复仇者|X战警|银河护卫|时间流纠缠|多元宇宙|死侍|钢铁侠|蜘蛛侠|猩红女巫|冰月花雪|冰月|洛基|毒液|杰夫|格鲁特|浩克|绿巨人|美国队长|黑寡妇|黑豹|鹰眼|海拉|铁拳|魔剑客|月光骑士|纳摩|灵蝶|松鼠女|星爵|暴风女|惩罚者|冬兵|金刚狼|霹雳火|凤凰女|刀锋战士|夜魔侠|艾尔莎|黑猫|雷光眼|隐形女|苏珊|牌皇|白狐|曼蒂斯|火箭浣熊|亚当术士|万磁王|奇异博士|索尔|石头人|白皇后|安吉拉|小淘气|恶魔恐龙|红兜帽|奥创|斗篷与匕首|百光花火|神奇先生|林烈/;

// 明确属于别区的句子：块内只要出现这些且没有漫威特征，整块排除
const OTHER_STRONG =
  /第五人格|庄园|求生者|监管者|密码机|狂欢之椅|洛克王国|迪莫|英雄联盟|德玛西亚|王者荣耀|原神|钟离|雷电将军|永劫|三角洲|鸣潮|绝区零|阴阳师|黎明杀机|守望先锋|炉石|星穹铁道|崩铁|无畏契约|瓦罗兰特|捷风|芮娜|爆能器/;

const clean = (line) =>
  String(line || '')
    .replace(/^【(评论|弹幕|视频|UP|简介|标签)】\s*/, '')
    .replace(/\[[^\]]{1,8}\]/g, '')
    .trim();

/** 读全部语料，返回 { lines: 淋威语境行, all: 全部行, files } */
function load() {
  const dir = path.join(ROOT, 'corpus');
  const files = fs.readdirSync(dir).filter((f) => /^corpus.*\.txt$/.test(f)).sort();
  const lines = [];
  const all = [];
  for (const f of files) {
    const raw = fs.readFileSync(path.join(dir, f), 'utf8');
    let inMr = false;
    // 单行是否算「别区内容」：命中别区词且没有漫威特征
    const isOther = (t) => OTHER_STRONG.test(t) && !MR_STRONG.test(t);
    for (const rawLine of raw.split(/\r?\n/)) {
      const t = rawLine.trim();
      if (!t) continue;
      const kind = (t.match(/^【(视频|UP|简介|标签|评论|弹幕)】/) || [])[1] || '';
      const body = clean(t);
      if (kind === '视频') {
        // 开新块：标题命中淋威特征 → 整块入列；否则整块只在后续行命中时才补入
        inMr = MR_STRONG.test(t) && !isOther(t);
        if (inMr) lines.push(body);
        all.push(body);
        continue;
      }
      if (inMr) {
        // 块内正文：先剔除明显串到别区的句子，再入列
        if (!isOther(t)) lines.push(body);
        all.push(body);
        continue;
      }
      // 块不在语境里：这一行自己命中淋威特征就单独入列（官方/百科语料是逐行独立的小块）
      if (MR_STRONG.test(t) && !isOther(t)) lines.push(body);
      all.push(body);
    }
  }
  return { lines, all, files };
}

module.exports = { load, clean, MR_STRONG, OTHER_STRONG };
