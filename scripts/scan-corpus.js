'use strict';

// scan-corpus.js
// 从 corpus 里抽两个东西：
//   1) 词库候选：高频 2-3 字短语，跟 words-baseline 去重
//   2) 句式候选：高频完整句（4-12 字），跟 rules-baseline 去重
// 输出 evidence/lexicon-candidates.txt 和 evidence/rules-candidates.txt
// 仅做候选，不入库；入库走 apply-curated.js 幂等通道。

const fs = require('fs');
const path = require('path');

const CORPUS = 'corpus-bili-20261011065020.txt';
const WORDS_BASE = 'evidence/words-baseline.txt';
const RULES_BASE = 'evidence/rules-baseline.txt';
const LEX_OUT = 'evidence/lexicon-candidates.txt';
const RULES_OUT = 'evidence/rules-candidates.txt';

const STOPWORDS = new Set([
  // 高频中文虚词/连接词，不进入候选
  '的','了','是','在','和','与','或','就','都','也','很','还','有','没','这','那','我','你','他','她','它','们','吗','呢','啊','吧','哦','哦哦','嗯','呀','哎','哈','哈哈','啊啊啊','啊啊','呜','呜啊','什么','怎么','为什么','因为','所以','但是','如果','那么','可是','然后','不过','一下','一样','一直','一定','一些','一种','一样','一定','不能','可以','可能','应该','需要','已经','可以','现在','这里','那里','这个','那个','这些','那些','如此','那样','这样','所以','因此','而且','虽然','即使','但是','不过','而是','就是','只是','现在','还有','其他','什么','一个','一些','这个','那个','啊哈','呜啊','啦啦','哦哦哦','啦啦啦','呜呜','哈哈哈哈','嘻嘻','吼吼','嘿','嘿咻','嗨害','嘿嘿','嗯嗯','哎哎','哦哟','哇','哇塞','耶','嗯哼','咯咯','啦','噜','惹','叭','咧','哒','嘞','嘛','捏','呣','么','嘶','嗷','唉','诶','哟','咯','呢','呜','哈','呀','哦',
]);

function loadCorpus() {
  return fs.readFileSync(CORPUS, 'utf8');
}

function loadWords() {
  const lines = fs.readFileSync(WORDS_BASE, 'utf8').split('\n');
  const set = new Set();
  for (const line of lines) {
    const zh = line.split(' -> ')[0];
    if (zh) set.add(zh);
  }
  return set;
}

function loadRules() {
  const lines = fs.readFileSync(RULES_BASE, 'utf8').split('\n');
  const set = new Set();
  for (const line of lines) {
    if (!line.trim()) continue;
    // rules 格式: pattern | template
    const pat = line.split(' | ')[0].trim();
    if (pat) set.add(pat);
  }
  return set;
}

function isChinese(s) {
  return /^[\u4e00-\u9fa5]+$/.test(s);
}

function ngram(text, n) {
  const grams = new Map();
  // 用滑动窗口抓连续 n 个汉字（跳过含非汉字字符的窗口）
  const cleaned = text.replace(/[^\u4e00-\u9fa5]/g, '');
  for (let i = 0; i + n <= cleaned.length; i++) {
    const g = cleaned.slice(i, i + n);
    if (g.length !== n) continue;
    // 任一字符在 STOPWORDS 集合里就跳过
    let bad = false;
    for (const ch of g) {
      if (STOPWORDS.has(ch)) { bad = true; break; }
    }
    if (bad) continue;
    grams.set(g, (grams.get(g) || 0) + 1);
  }
  return grams;
}

function phrase(text, min, max) {
  // 抽取"完整句"候选：含淋语标记词（惹/噜/靴靴/惹人讨厌/已被锁定/全体起立/美cry...）的句子
  const sentences = text.split(/[\n。！？!?]+/);
  const counts = new Map();
  const MARKERS = ['惹','噜','靴靴','锁定','全体','起立','美cry','本可','本宫','仙女','吸入','给力','降淋','淋明','淋神','淋语','淋日','淋王','淋盟','淋耀','淋格','通讯录','本质','地才','造孽','鸡冻','厚礼','关你','造谣','宇宙','之母','退下','退下噜','大赦','辛者','辛者库','辛者库噜','辛者库没','辛者库没出来','辛者库没出来惹','砸','置顶','吸吸','包被','懂','淋雨','淋雨一直','鸡笼','维纳斯','空气','海贵人','袄','嗨害','丫的','哼','哼唧','呵呵','哭哭','宝子','家人们','家人萌','宝子萌','霉霉','尊嘟','假嘟','嚯','嚯嚯','嚯嚯嚯','宝','宝子','宝宝','包包','婊','婊贝','霉','霉霉','哒','哒姐','鸭','鸭子','噜噜','噜噜噜','啾','啾咪','珍','珍素','真素','尊素','素','素素','叭','叭叭','叭叭叭','咕咕','咕咕day','嘚','嘚嘚','嘎','嘎嘎','咯','咯咯','咯咯哒','咧','咧咧','哒','哒哒','嗖','嗖嗖','咔','咔咔','嗖','嗖嗖','嗖嗖嗖','嗖嗖嗖嗖','嗖嗖嗖嗖嗖','嘚','嘚嘚','嘚嘚嘚','咯','咯咯','咯咯咯','咯咯咯咯','咯咯哒','咯哒','叮','叮叮','叮咚','叮咚叮咚','呦','呦呦','呦呦呦','呜','呜呜','呜呜呜','呜呜呜呜','呦','呦呦','呦呦呦','呦呦呦呦','嘀','嘀嗒','嘀嗒嘀嗒','噗','噗噗','噗噗噗','噗噗噗噗','啦','啦啦','啦啦啦','啦啦啦啦','呀','呀呀','呀呀呀','呀呀呀呀','喔','喔喔','喔喔喔','喔喔喔喔','嘻','嘻嘻','嘻嘻嘻','嘻嘻嘻嘻','呦','呦呦','呦呦呦','呦呦呦呦','咯','咯咯','咯咯咯','咯咯咯咯','嗨','嗨害','嗨害嗨','嗨嗨','嗨嗨害','嗨害嗨害','嘻','嘻嘻','嘻嘻嘻','嘻嘻嘻嘻','哼','哼哼','哼哼哼','哼哼哼哼','哼唧','哼唧哼唧','哼唧哼唧哼唧','咚','咚咚','咚咚咚','咚咚咚咚','哼','哼哼','哼哼哼','哼哼哼哼','咔','咔咔','咔咔咔','咔咔咔咔','哒','哒哒','哒哒哒','哒哒哒哒','叮','叮叮','叮叮叮','叮叮叮叮','咣','咣咣','咣咣咣','咣咣咣咣','嘶','嘶嘶','嘶嘶嘶','嘶嘶嘶嘶','啪','啪啪','啪啪啪','啪啪啪啪','咚','咚咚','咚咚咚','咚咚咚咚','嗒','嗒嗒','嗒嗒嗒','嗒嗒嗒嗒','哗','哗哗','哗哗哗','哗哗哗哗','咚','咚咚','咚咚咚','咚咚咚咚','咔','咔咔','咔咔咔','咔咔咔咔','咚','咚咚','咚咚咚','咚咚咚咚','咩','咩咩','咩咩咩','咩咩咩咩','呀','呀呀','呀呀呀','呀呀呀呀','呦','呦呦','呦呦呦','呦呦呦呦','咯','咯咯','咯咯咯','咯咯咯咯','哼','哼哼','哼哼哼','哼哼哼哼','嘻','嘻嘻','嘻嘻嘻','嘻嘻嘻嘻','哇','哇哇','哇哇哇','哇哇哇哇','噗','噗噗','噗噗噗','噗噗噗噗','嘶','嘶嘶','嘶嘶嘶','嘶嘶嘶嘶','哟','哟哟','哟哟哟','哟哟哟哟','呦','呦呦','呦呦呦','呦呦呦呦','嘿','嘿嘿','嘿嘿嘿','嘿嘿嘿嘿','嘻','嘻嘻','嘻嘻嘻','嘻嘻嘻嘻','嗨','嗨嗨','嗨嗨嗨','嗨嗨嗨嗨','呦','呦呦','呦呦呦','呦呦呦呦','哟','哟哟','哟哟哟','哟哟哟哟','哼','哼哼','哼哼哼','哼哼哼哼','咚','咚咚','咚咚咚','咚咚咚咚','咣','咣咣','咣咣咣','咣咣咣咣','咚','咚咚','咚咚咚','咚咚咚咚','呦','呦呦','呦呦呦','呦呦呦呦','咚','咚咚','咚咚咚','咚咚咚咚','哼','哼哼','哼哼哼','哼哼哼哼','嘻','嘻嘻','嘻嘻嘻','嘻嘻嘻嘻','哼','哼哼','哼哼哼','哼哼哼哼','咚','咚咚','咚咚咚','咚咚咚咚','咚','咚咚','咚咚咚','咚咚咚咚','嘀','嘀嗒','嘀嗒嘀嗒','嘀嘀','嘀嘀嗒','嘀嘀嗒嗒','嘀嘀嘀','嘀嘀嘀嗒','嘀嘀嘀嘀','嘀嘀嘀嘀嘀','哒','哒哒','哒哒哒','哒哒哒哒','哒','哒哒','哒哒哒','哒哒哒哒','哒','哒哒','哒哒哒','哒哒哒哒','哒','哒哒','哒哒哒','哒哒哒哒','哒','哒哒','哒哒哒','哒哒哒哒','哒','哒哒','哒哒哒','哒哒哒哒','哒','哒哒','哒哒哒','哒哒哒哒','哒','哒哒','哒哒哒','哒哒哒哒'];
  for (const sent of sentences) {
    const s = sent.trim();
    if (s.length < min || s.length > max) continue;
    let marker = false;
    for (const m of MARKERS) {
      if (s.includes(m)) { marker = true; break; }
    }
    if (!marker) continue;
    counts.set(s, (counts.get(s) || 0) + 1);
  }
  return counts;
}

function main() {
  const corpus = loadCorpus();
  const words = loadWords();
  const rules = loadRules();

  // 1) 词库候选：2 字 / 3 字高频短语，过滤已有
  const all = new Map();
  for (const g of [ngram(corpus, 2), ngram(corpus, 3), ngram(corpus, 4)]) {
    for (const [k, v] of g) all.set(k, (all.get(k) || 0) + v);
  }
  const lexCandidates = [];
  for (const [k, v] of all) {
    if (v < 5) continue; // 至少出现 5 次
    if (words.has(k)) continue;
    if (!isChinese(k)) continue;
    lexCandidates.push({ word: k, freq: v, len: k.length });
  }
  lexCandidates.sort((a, b) => b.freq - a.freq);
  fs.writeFileSync(LEX_OUT, ['# 词库候选（按频次降序，已去重 words-baseline，仅候选未入库）', ...lexCandidates.slice(0, 80).map((x, i) => `${(i + 1).toString().padStart(2, '0')}. ${x.word}  (${x.len}字, 出现 ${x.freq} 次)`)].join('\n') + '\n');
  console.log('lex candidates:', lexCandidates.length, '→ wrote', LEX_OUT);

  // 2) 句式候选：含淋语标记词的完整句，过滤已有 rules
  const sentCounts = phrase(corpus, 4, 12);
  const ruleCandidates = [];
  for (const [s, c] of sentCounts) {
    if (c < 2) continue; // 至少出现 2 次
    // 过滤已有：rules 里 pattern 去掉正则字符后做包含检查
    let hit = false;
    for (const pat of rules) {
      const stripped = pat.replace(/[\^$.*+?()[\]{}|\\]/g, '').replace(/[?:()]/g, '');
      if (stripped && (s.includes(stripped) || stripped.includes(s))) { hit = true; break; }
    }
    if (hit) continue;
    ruleCandidates.push({ sent: s, freq: c });
  }
  ruleCandidates.sort((a, b) => b.freq - a.freq);
  fs.writeFileSync(RULES_OUT, ['# 句式候选（按频次降序，已去重 rules-baseline，仅候选未入库）', ...ruleCandidates.slice(0, 60).map((x, i) => `${(i + 1).toString().padStart(2, '0')}. ${x.sent}  (出现 ${x.freq} 次)`)].join('\n') + '\n');
  console.log('rules candidates:', ruleCandidates.length, '→ wrote', RULES_OUT);
}

main();
