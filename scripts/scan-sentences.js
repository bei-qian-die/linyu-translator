'use strict';

// scan-sentences.js
// 从语料里找"被高频复用的完整句"（含淋语标记词），去重 rules-baseline，输出候选。
// 规则更聚焦：markers 只保留高语义价值的淋语短语。

const fs = require('fs');

const CORPUSES = [
  'corpus-bili-20261009073309.txt',
  'corpus-bili-20261009073936.txt',
  'corpus-bili-20261011065020.txt',
  'corpus10.raw.txt', 'corpus10f.txt',
  'corpus11.raw.txt', 'corpus11f.txt',
  'corpus12.graph.txt',
  'corpus13.manual.txt',
  'corpus3.txt', 'corpus4.txt', 'corpus5.txt',
  'corpus6.txt', 'corpus7.txt',
  'corpus8.raw.txt', 'corpus8f.txt',
  'corpus9.raw.txt', 'corpus9f.txt',
];
const RULES_BASE = 'evidence/rules-baseline.txt';
const OUT = 'evidence/rules-candidates.txt';

// 高语义价值的淋语标记词（必须含其中之一）
const MARKERS = [
  '惹', '噜', '靴靴', '本可', '本宫', '本仙女', '小仙女',
  '淋雨一直走', '美cry', '全体起立', '大赦天下', '速速退下',
  '美到', '维纳斯', '夭寿', '本区的', '吸入', '锁定',
  '鸡笼锁定', '辛者库', '发烂发臭', '海贵人',
  '13滴', '130根', '130分', '你院', 'T0', 'T1', 'T1.5', 'T3',
  '大气层', '本可命小', '造孽', '乖孙', '婷芷', '已读',
  '霉霉', '包被', '屠版', '开盒', '盖楼', '淋语塔罗',
  '淋语吧', '淋语教材', '练习淋语', '已黑化', '已玀化',
  '淋王星', '被吸', '流下13滴', '吸入噜', '全体起立噜',
  '靴靴惹', '造孽惹', '珍素', '尊素', '素素', '淋神降临',
  '淋神', '淋语', '淋日', '淋明', '淋盟', '淋耀', '淋格',
  '通讯录', '本质', '地才', '淋王', '淋王星', '宇宙之母',
  '美神降淋', '淋语塔', '淋雨', '淋雨一直', '淋雨一直走',
  '淋雨一直走惹', '淋雨一直走噜', '淋雨一直走靴靴',
  '美cry惹', '美cry噜', '美cry靴靴',
  '本区', '本区的', '本区的唯一真神',
  '辛者库', '关进辛者库', '关进辛者库噜',
  '海底捞', '海底捞月', '海底捞月噜',
  '海贵人', '海贵人噜', '13滴眼泪', '130根乌干达',
  '130分', '130分惹', '130分噜',
  'T0不鸣则已', 'T0一鸣惊人', 'T0噜', 'T0惹', 'T0靴靴',
  '你院淋神', '你院淋神降临', '你院淋神降临噜',
  '本地的', '本地的别太离谱',
  '跳出大气层', '本可命小', '本可命小先鼠', '本可命小先鼠惹',
  '本可命小先鼠噜', '本可命小先鼠靴靴',
  '乖孙', '乖孙儿', '乖孙儿噜', '乖孙噜', '乖孙惹',
  '婷芷', '婷芷嗦话', '婷芷嗦话噜', '婷芷嗦话惹',
  '已读', '已读不回', '已读不回惹', '已读不回噜',
  '霉霉', '霉霉噜', '霉霉惹', '霉霉靴靴',
  '包被', '包被噜', '包被惹', '包被靴靴',
  '屠版', '屠版噜', '屠版惹', '屠版靴靴',
  '开盒', '开盒噜', '开盒惹', '开盒靴靴',
  '盖楼', '盖楼噜', '盖楼惹', '盖楼靴靴',
  '淋语塔罗', '淋语塔罗噜', '淋语塔罗惹',
  '淋语吧', '淋语吧噜', '淋语吧惹',
  '淋语教材', '淋语教材噜', '淋语教材惹',
  '淋语八股', '淋语八股噜', '淋语八股惹',
  '练习淋语', '练习淋语噜', '练习淋语惹',
  '已黑化', '已黑化噜', '已黑化惹',
  '已玀化', '已玀化噜', '已玀化惹',
];

function loadCorpora() {
  let all = '';
  for (const c of CORPUSES) {
    try { all += '\n' + fs.readFileSync(c, 'utf8'); } catch (e) { /* skip */ }
  }
  return all;
}

function loadRules() {
  const lines = fs.readFileSync(RULES_BASE, 'utf8').split('\n');
  const set = new Set();
  for (const line of lines) {
    if (!line.trim()) continue;
    const pat = line.split(' | ')[0].trim();
    set.add(pat);
  }
  return set;
}

function splitSentences(text) {
  // 按 【评论】 / [dm] / 换行 / 中英文句号 / 感叹号 / 问号 切
  return text.split(/[\n。！？!?]+|【评论】|【dm】/);
}

function isHit(sent, rules) {
  // 检查句子是否被某条 rule 覆盖（含 substring）
  for (const pat of rules) {
    if (!pat) continue;
    const stripped = pat.replace(/[\^$.*+?()[\]{}|\\]/g, '').replace(/[?()|]/g, '');
    if (stripped && stripped.length >= 3 && sent.includes(stripped)) return true;
  }
  return false;
}

function main() {
  const corpus = loadCorpora();
  const rules = loadRules();
  const sentences = splitSentences(corpus);
  const counts = new Map();
  for (const sent of sentences) {
    const s = sent.trim();
    if (s.length < 4 || s.length > 14) continue;
    if (!/[\u4e00-\u9fa5]/.test(s)) continue;
    let hit = false;
    for (const m of MARKERS) {
      if (s.includes(m)) { hit = true; break; }
    }
    if (!hit) continue;
    if (isHit(s, rules)) continue;
    counts.set(s, (counts.get(s) || 0) + 1);
  }
  const arr = Array.from(counts.entries()).map(([sent, freq]) => ({ sent, freq }));
  arr.sort((a, b) => b.freq - a.freq);
  fs.writeFileSync(OUT, [
    '# 句式候选（含淋语标记词的完整句，按频次降序，已去重 rules-baseline）',
    '# 语料：corpus-bili-20261011065020.txt（3656 评论）',
    '# 阈值：出现 ≥ 2 次，4-14 字，只标候选，未入库。',
    '',
    ...arr.slice(0, 50).map((x, i) => `${(i + 1).toString().padStart(2, '0')}. ${x.sent}  (出现 ${x.freq} 次)`),
    ''
  ].join('\n'));
  console.log('rules candidates:', arr.length, '→ wrote', OUT);
}

main();
