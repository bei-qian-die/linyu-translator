'use strict';

// 第二十轮词卡生成：把 curated-linyu20.js 里已验真的词条转成词卡，
// example 一律取 corpus 里的**真实原句**（不是把 sense 抄一遍），保证 attest 能过。
//
// 与 19 轮的关键差别：本轮多了「漫威指涉闸门」——例句必须真在淋威争锋语境里出现，
// 否则词卡会挂上别的游戏的同名词（比如「皮肤」「大招」在所有分区都叫这个）。
//
// 用法：node scripts/build-cards20.js [目标张数，默认 140]
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TARGET = Number(process.argv[2] || 140);

const norm = (s) =>
  String(s || '')
    .replace(/[\s，。、！？；：""''（）()【】[\]…~～·—\-_/\\|,.:;!?"']/g, '')
    .toLowerCase();

// 语料按句切分（保留原句用于落库）
let blob = '';
for (const f of fs.readdirSync(path.join(ROOT, 'corpus')).filter((x) => x.endsWith('.txt') && !/21/.test(x)).sort()) {
  blob += fs.readFileSync(path.join(ROOT, 'corpus', f), 'utf8') + '\n';
}
const lines = [
  ...new Set(
    blob
      .split(/\r?\n/)
      .map((l) => l.replace(/^【(评论|弹幕|视频|UP|简介|标签)】\s*/, '').replace(/\[[^\]]{1,24}\]/g, '').trim())
      .filter((t) => t.length >= 8 && t.length <= 70)
  ),
];
const NL = lines.map((t) => ({ raw: t, n: norm(t) }));

// 漫威指涉词：例句里必须带上，否则不算本区的句子
const MR =
  /漫威|Marvel|marvel|争锋|复仇者|复联|X战警|银河护卫队|灭霸|阿斯加德|仙宫|瓦坎达|昆仑|九头蛇|克林塔|东京2099|神盾局|捍卫者|决斗家|策略家|连携|占点|推车|运货|时间流纠缠|美队|美国队长|钢铁侠|铁皮人|铁人|铁男|蜘蛛侠|小蜘蛛|猩红女巫|洛基|冰月花雪|毒液|冬兵|暴风女|万磁王|纳摩|黑寡妇|寡姐|黑豹|鹰眼|海拉|铁拳|月光骑士|灵蝶|松鼠女|星爵|惩罚者|金刚狼|霹雳火|凤凰女|刀锋战士|夜魔侠|黑猫|雷光眼|格尔|亚当术士|斗篷与匕首|隐形女|苏珊|杰夫|鲨鲨|鲨狗|曼蒂斯|火箭浣熊|奥创|牌皇|白狐|百光花火|死侍|格鲁特|树人|浩克|绿巨人|索尔|雷神|石头人|白皇后|安吉拉|小淘气|恶魔恐龙|红兜帽|神奇先生|橡皮人|魔剑客|潘妮|西景镇|地狱火晚宴|淋威/;

// 别区指涉词：出现就排除这句
const OTHER =
  /第五人格|庄园|求生者|监管者|密码机|修机|狂欢之椅|洛克王国|迪莫|英雄联盟|德玛西亚|王者荣耀|原神|钟离|雷电将军|永劫|三角洲|鸣潮|绝区零|阴阳师|黎明杀机|守望先锋|炉石|星穹铁道|崩铁|无畏契约|瓦罗兰特|捷风|芮娜|爆能器|甄嬛|曹琴默/;

// 短词（2 字）在中文里极易子串误命中（「我基」会命中「基本」、「鹰眼」会命中洛克宠物），
// 所以短词额外要求同句里还出现一个「强漫威指涉」词，否则这句不算本区句子。
const MR_STRONG =
  /漫威|Marvel|marvel|争锋|复仇者|复联|X战警|银河护卫队|灭霸|阿斯加德|仙宫|瓦坎达|九头蛇|克林塔|东京2099|神盾局|捍卫者|决斗家|策略家|连携|时间流纠缠|美国队长|钢铁侠|蜘蛛侠|猩红女巫|洛基|冰月花雪|毒液|冬兵|暴风女|万磁王|黑寡妇|黑豹|海拉|铁拳|月光骑士|灵蝶|松鼠女|星爵|惩罚者|金刚狼|霹雳火|凤凰女|刀锋战士|夜魔侠|格尔|亚当术士|斗篷与匕首|隐形女|杰夫|鲨鲨|鲨狗|曼蒂斯|火箭浣熊|奥创|牌皇|白狐|百光花火|死侍|格鲁特|浩克|索尔|石头人|白皇后|安吉拉|小淘气|恶魔恐龙|红兜帽|神奇先生|魔剑客|潘妮|西景镇|地狱火晚宴|淋威/;

/** 找一句包含 kid 的原文：必须落在漫威语境里，其次挑长度接近 24 字的 */
const findExample = (kids) => {
  const cands = [];
  for (const k of kids) {
    const nk = norm(k);
    if (!nk) continue;
    const short = nk.length <= 2;
    for (const item of NL) {
      if (!item.n.includes(nk)) continue;
      // 必须在漫威语境里；短词还要求有强指涉词同现
      if (!MR.test(item.raw)) continue;
      if (short && !MR_STRONG.test(item.raw)) continue;
      if (OTHER.test(item.raw)) continue;
      cands.push(item.raw);
      if (cands.length > 120) break;
    }
    if (cands.length) break;
  }
  if (!cands.length) return '';
  const pool = cands;
  pool.sort((a, b) => {
    const sa = (MR_STRONG.test(a) ? 4 : 0) + (a.length <= 40 ? 2 : 0) - Math.abs(a.length - 24) / 40;
    const sb = (MR_STRONG.test(b) ? 4 : 0) + (b.length <= 40 ? 2 : 0) - Math.abs(b.length - 24) / 40;
    return sb - sa;
  });
  return pool[0];
};

const { WORDS } = require(path.join(ROOT, 'scripts/curated-linyu20.js'));

// term 类型判定
const PARTICLE = /(惹|噜|厚|靴靴|素|啾咪|again)$/;
const MEME =
  /daddy|母亲|赔钱货|鲨狗|铁皮人|美队|寡姐|树人|橡皮人|哈哈男|鲨鲨|泳装|脚臭|手铐|蹂躏|缝纫机|通讯录|冰书|母亲组/;
const LYRIC = /^$.^/; // 本轮词库里没有「句式」类词条，lyric 只留给名言，不误判

const typeOf = (w) => {
  const s = w.zh + w.linyu + (w.sense || '');
  if (PARTICLE.test(w.linyu)) return 'particle';
  if (LYRIC.test(s)) return 'lyric';
  if (MEME.test(w.zh) || MEME.test(w.linyu)) return 'meme';
  return 'slang';
};

// 语境不成立、又找不到贴题例句的词：不出卡（词条本身保留在词库里）
const BLOCK = new Set(['女王', '本可', '姐姐', '母亲', 'daddy', '皮肤', '大招']);

// 个别词在语料里有更贴题的句子，直接指定（避免被通用句挤掉）
const OVERRIDE = {
  美国彪子: '淋威争锋美国彪子啊不是宝子，向你致敬',
  我冰: '淋威争锋我冰艺术大过天',
  我匕: '淋威争锋9.5赛季，我匕是唯一T0谢谢',
  你苏珊: '淋威争锋你苏珊为这个家付出的太多了',
  神嗣苏生: '神嗣苏生把亚当术士拉起来噜',
};

const out = [];
const seenTerm = new Set();

// 先按 slot 轮转，避免某一类把额度吃满
const groups = new Map();
for (const w of WORDS) {
  const key = String(w.slot || '').split('/')[1] || '-';
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(w);
}

// 排序权重：带英雄关联价值的（自称/英雄位分/整活）优先，纯系统术语靠后
const WEIGHT = {
  淋威自称体系: 10,
  淋威英雄位分: 9,
  淋威整活梗: 9,
  淋威地图舞台: 7,
  淋威连携组合: 7,
  淋威模式玩法: 6,
  淋威赛事圈: 5,
  淋威皮肤潮流: 5,
  淋威剧情线: 4,
  分区: 3,
};

const keys = [...groups.keys()].sort((a, b) => (WEIGHT[b] || 0) - (WEIGHT[a] || 0));
let round = 0;
while (out.length < TARGET) {
  let added = 0;
  for (const k of keys) {
    const arr = groups.get(k);
    const w = arr[round];
    if (!w) continue;
    const term = w.linyu;
    if (BLOCK.has(term)) continue;
    if (seenTerm.has(term)) continue;
    const ex = OVERRIDE[term] || findExample([w.linyu, w.zh]);
    if (!ex) continue;
    seenTerm.add(term);
    out.push({
      term,
      zh: w.zh,
      type: typeOf(w),
      meaning: w.sense,
      example: ex,
      source: w.source,
      slot: w.slot,
      score: (WEIGHT[k] || 0) + (ex.length <= 40 ? 1 : 0),
    });
    added += 1;
    if (out.length >= TARGET) break;
  }
  round += 1;
  if (!added) break;
}

fs.writeFileSync(path.join(ROOT, 'scripts/curated-cards20.json'), JSON.stringify(out, null, 2) + '\n');

const byType = {};
for (const c of out) byType[c.type] = (byType[c.type] || 0) + 1;
console.log(`[build-cards20] 生成词卡 ${out.length} 张（目标 ${TARGET}）`);
console.log('[build-cards20] 类型分布：' + Object.entries(byType).map(([k, v]) => `${k}:${v}`).join('  '));
console.log('[build-cards20] 无例句跳过 ' + (WORDS.length - out.length) + ' 条');
