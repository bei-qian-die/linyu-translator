'use strict';

// 第二十轮挖矿辅助：找出「漫威争锋语境」的语料行，统计高频词/淋语标记，
// 供 scripts/curated-linyu20.js 挑词条。只读脚本，不改数据。
//
// 用法: node scripts/mine-linyu20.js [--top=200]
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CORPUS_DIR = path.join(ROOT, 'corpus');
const TOPN = Number((process.argv.find((a) => a.startsWith('--top=')) || '').split('=')[1] || 200);

const files = fs.readdirSync(CORPUS_DIR).filter((f) => /^corpus.*\.txt$/.test(f)).sort();
let blob = '';
for (const f of files) blob += fs.readFileSync(path.join(CORPUS_DIR, f), 'utf8') + '\n';

const MR_STRONG =
  /漫威争锋|漫威|漫威争|Marvel Rivals|MarvelRivals|马维尔|争锋|网之易|伊戈斯加德|阿斯加德|九头蛇|瓦坎达|昆仑|神盾局|泰坦|X战警|复仇者|捍卫者|决斗家|策略家|连携|占点|运货|灭霸|死侍|钢铁侠|蜘蛛侠|猩红女巫|冰月花雪|冰月花|冰月|洛基|毒液|杰夫|格鲁特|浩克|绿巨人|美队|美国队长|黑寡妇|黑豹|鹰眼|海拉|铁拳|魔剑客|月光骑士|纳摩|灵蝶|松鼠女|星爵|暴风女|惩罚者|冬兵|金刚狼|霹雳火|凤凰女|刀锋战士|夜魔侠|艾尔莎|黑猫|雷光眼|屠神者|格尔|牌皇|白狐|隐形女|曼蒂斯|火箭浣熊|亚当术士|万磁王|奇异博士|索尔|Thor|石头人|白皇后|安吉拉|小淘气|恶魔恐龙|红兜帽|奥创|斗篷与匕首|百光花火|神奇先生| mk /;

const OTHER_STRONG =
  /第五人格|庄园|求生者|监管者|密码机|狂欢之椅|洛克王国|迪莫|英雄联盟|德玛西亚|王者荣耀|原神|钟离|雷电将军|永劫|三角洲|鸣潮|绝区零|阴阳师|黎明杀机|守望先锋|炉石|星穹铁道|崩铁|无畏契约|瓦罗兰特|捷风|芮娜|爆能器/;

const lines = [];
for (const line of blob.split(/\r?\n/)) {
  const t = line.replace(/^【(评论|弹幕|视频|UP|简介)】\s*/, '').replace(/\[[^\]]{1,8}\]/g, '').trim();
  if (t.length < 4 || t.length > 300) continue;
  if (!MR_STRONG.test(t)) continue;
  // 明确属于别区的句子剔除，避免串味（除非同时点名漫威）
  if (OTHER_STRONG.test(t) && !/漫威|Marvel|争锋|阿斯加德|瓦坎达|X战警|复仇者|灭霸/.test(t)) continue;
  lines.push(t);
}

console.error(`[语境] 漫威争锋语境行 ${lines.length} 条`);

// ---- 高频 2~5 字 ----
const counter = new Map();
for (const l of lines) {
  const s = l.replace(/[^一-龥A-Za-z0-9]/g, '');
  for (let n = 2; n <= 5; n++) {
    for (let i = 0; i + n <= s.length; i++) {
      const g = s.slice(i, i + n);
      counter.set(g, (counter.get(g) || 0) + 1);
    }
  }
}
const arr = [...counter.entries()].filter(([g, c]) => c >= 3);
// 去掉完全被更长高频串包含且同频的
const bigrams = arr
  .sort((a, b) => b[1] - a[1])
  .slice(0, TOPN * 4)
  .map(([g, c]) => ({ g, c }));
const filtered = [];
for (const item of bigrams) {
  const dominated = bigrams.some((o) => o !== item && o.g.includes(item.g) && o.c >= item.c * 0.95 && o.g !== item.g);
  if (!dominated) filtered.push(item);
}

const out = filtered.slice(0, TOPN).map((x) => `${x.c}\t${x.g}`);
fs.writeFileSync(path.join(ROOT, 'evidence/slot-freq20-raw.txt'), out.join('\n') + '\n', 'utf8');
console.error(`[高频] 写入 evidence/slot-freq20-raw.txt 共 ${Math.min(TOPN, filtered.length)} 条`);

// ---- 含淋语标记的样本行 ----
const MARK = /(噜|惹|靴靴|本可|可人儿|素|厚|啾咪|吸吸|笑鼠|哼哼|天啦噜|doge|集美|姐姐|妹妹|仙女|dia|地才|淋|基|妈咪|女王|老婆|老公|宝宝|阿姨|奶奶|哥哥)/;
const marked = lines.filter((l) => MARK.test(l));
console.error(`[淋语味] 带淋语/姐系标记的行 ${marked.length} 条`);
fs.writeFileSync(path.join(ROOT, 'evidence/mr-lines20.txt'), lines.join('\n'), 'utf8');
fs.writeFileSync(path.join(ROOT, 'evidence/mr-linyu-lines20.txt'), marked.slice(0, 3000).join('\n'), 'utf8');
console.error('[落盘] evidence/mr-lines20.txt（全部语境行）、evidence/mr-linyu-lines20.txt（淋语味样本）');
