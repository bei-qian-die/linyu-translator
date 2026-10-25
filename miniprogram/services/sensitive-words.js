'use strict';

// 内容安全本地兜底词表（A3）。
// 微信的 msgSecCheck 是服务端接口，小程序端没有可用的 wx.msgSecCheck；
// 为保持「零网络」承诺，这里用本地多字词表拦下明确违法 / 高风险内容。
// 词表刻意保持保守：只收多字、歧义低的词，避免误伤正常淋语翻译。
const BLOCK = {
  porn: [
    '色情',
    '做爱',
    '性交',
    '口交',
    '肛交',
    '淫秽',
    '裸聊',
    '约炮',
    '卖淫',
    '嫖娼',
    '强奸',
    '轮奸',
    '恋童',
    '儿童色情',
    '性奴',
  ],
  gambling: ['赌博', '博彩', '赌场', '洗钱', '刷单返利', '代开发票', '办假证'],
  drugs: ['毒品', '吸毒', '贩毒', '冰毒', '吸大麻', '摇头丸', '海洛因', '可卡因', '麻古'],
  violence: ['杀人', '砍死', '枪杀', '恐怖袭击', '自制炸弹', '枪支弹药', '炸药配方'],
  selfHarm: ['自杀', '自残', '割腕', '跳楼自杀', '服毒'],
  illegal: ['迷药', '枪支', '假币', '伪造身份证', '买卖器官'],
};

// 词库自身高频、语义明确的良性搭配：命中这些片段后不算违规
const ALLOW_CONTEXT = {
  杀人: ['杀人书', '杀人诛心'],
};

const CATEGORY_LABELS = {
  porn: '色情低俗',
  gambling: '赌博诈骗',
  drugs: '毒品违禁',
  violence: '暴力恐怖',
  selfHarm: '自伤自杀',
  illegal: '违法交易',
};

// 去掉空白与常见分隔符，防止「赌 博」「赌-博」这类简单变形绕过
const SEPARATORS = /[\s\u200b-\u200f\u2028\u2029\-_.·•*~～|/\\]+/g;

function normalize(value) {
  const raw = value === null || value === undefined ? '' : value;
  return String(raw)
    .toLowerCase()
    .replace(SEPARATORS, '');
}

const ENTRIES = [];
for (const category of Object.keys(BLOCK)) {
  for (const term of BLOCK[category]) {
    ENTRIES.push({ term, key: normalize(term), category, label: CATEGORY_LABELS[category] });
  }
}
// 长词优先：先命中「儿童色情」再命中「色情」，返回的类别更准确
ENTRIES.sort((a, b) => b.key.length - a.key.length);

function findBlocked(value) {
  const text = normalize(value);
  if (!text) return null;
  for (const entry of ENTRIES) {
    if (text.indexOf(entry.key) < 0) continue;
    const allowed = ALLOW_CONTEXT[entry.term];
    if (allowed) {
      let probe = text;
      for (const phrase of allowed) probe = probe.split(normalize(phrase)).join('');
      if (probe.indexOf(entry.key) < 0) continue;
    }
    return { term: entry.term, category: entry.category, label: entry.label };
  }
  return null;
}

module.exports = { BLOCK, ALLOW_CONTEXT, CATEGORY_LABELS, normalize, findBlocked };
