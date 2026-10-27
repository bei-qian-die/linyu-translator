'use strict';

// 第二十一轮共用的「守望淋锋语境」判定。
//
// 与 20 号同源（按视频/网页分块），只把特征词换成守望区：
//   同一条【视频】/【网页】下面直到下一条之前的【UP】【简介】【标签】【评论】【弹幕】【正文】
//   全部算同一块；只要这一块里有任意一行命中守望特征词，整块都算守望语境。
//
// ⚠️ 关键差异：20 号把「守望先锋」列进 OTHER_STRONG（别区排除词），
//    本轮守望才是本区，必须把它从排除词里拿掉，并把漫威/瓦罗等本轮无关区列为排除词。
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const OW_STRONG =
  /守望|Overwatch|overwatch|OW|ow|辛梅塔|阿三|摩西|秩序之光|我光|我莫|我辛|你摩|你花|钻地婆|血律|雾子|探奇|骇灾|毛加|渣客女王|拉玛刹|鲑鱼大帝|莱因哈特|查莉娅|布丽吉塔|路霸|温斯顿|奥丽莎|破坏球|西格玛|D\.?Va|DVA|末日铁拳|半藏|堡垒|法老之鹰|法鸡|黑百合|卡西迪|麦克雷|狂鼠|猎空|托比昂|死神|源氏|黑影|艾什|回声|索杰恩|天使|卢西奥|禅雅塔|安娜|莫伊拉|巴蒂斯特|雾子|生命之梭|伊拉锐|朱诺|无漾|飞天猫|瑞稀|斩仇|安燃|埃姆雷|西拉|死怨|弗蕾娅|金驭|士兵:?76|漓江塔|努巴尼|国王大道|沃斯卡娅|伊利奥斯|尼泊尔|66号公路|暴雪世界|花村|釜山|绿洲城|阿努比斯|直布罗陀|多拉多|哈瓦那|渣客镇|里阿尔托|好莱坞|艾兴瓦尔德|重装|神准|奇袭|侦察|铁壁|先锋|斗士|战术|医疗|生存|哨戒炮|摄像头|睡针|禁疗瓶|锁血|黑球|黄球|奶棒|信标|传送门|哨兵炮|角斗领域|威能|黑爪|智械/;

// 明确属于别区的句子：块内只要出现这些且没有守望特征，整块排除
const OTHER_STRONG =
  /第五人格|庄园|求生者|监管者|密码机|狂欢之椅|洛克王国|迪莫|英雄联盟|德玛西亚|王者荣耀|原神|钟离|雷电将军|永劫|三角洲|鸣潮|绝区零|阴阳师|黎明杀机|炉石|星穹铁道|崩铁|无畏契约|瓦罗兰特|捷风|芮娜|爆能器|漫威|争锋|阿斯加德|瓦坎达|捍卫者|决斗家|策略家|复仇者|绯红女巫|旺达|幻视|阿加莎/;

const clean = (line) =>
  String(line || '')
    .replace(/^【(评论|弹幕|视频|UP|简介|标签|正文|网页)】\s*/, '')
    .replace(/\[[^\]]{1,8}\]/g, '')
    .trim();

/** 读全部语料，返回 { lines: 守望语境行, all: 全部行, files } */
function load() {
  const dir = path.join(ROOT, 'corpus');
  const files = fs.readdirSync(dir).filter((f) => /^corpus.*\.txt$/.test(f)).sort();
  const lines = [];
  const all = [];
  for (const f of files) {
    const raw = fs.readFileSync(path.join(dir, f), 'utf8');
    let inOw = false;
    const isOther = (t) => OTHER_STRONG.test(t) && !OW_STRONG.test(t);
    for (const rawLine of raw.split(/\r?\n/)) {
      const t = rawLine.trim();
      if (!t) continue;
      const kind = (t.match(/^【(视频|UP|简介|标签|评论|弹幕|网页|正文)】/) || [])[1] || '';
      const body = clean(t);
      if (kind === '视频' || kind === '网页') {
        inOw = OW_STRONG.test(t) && !isOther(t);
        if (inOw) lines.push(body);
        all.push(body);
        continue;
      }
      if (inOw) {
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
