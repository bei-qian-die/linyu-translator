(function () {
'use strict';
// __wrapped by scripts/lib/wrap-iife.mjs
// @ts-check
'use strict';

// 最大正向匹配分词：按首字符分桶 + 桶内按长度降序。
// 原实现每遇到一个字符都要从 maxLen 到 2 逐长度 slice().join('') 再查 Set，
// O(n × maxLen) 次字符串拼接；分桶后每个字符只跟「同首字」的少数候选比对。
/**
 * 词库条目按首字符分桶，桶内按长度降序；返回的分词器做最大正向匹配。
 * @param {Iterable<string>} dictWords 词库的中文侧（words[].zh）
 * @returns {(text: string) => string[]}
 */
function buildTokenizer(dictWords) {
  /** @type {Map<string, Array<{ str: string, cps: string[], len: number }>>} */
  const byFirst = new Map();
  let maxLen = 0;
  for (const w of dictWords) {
    const cps = [...w];
    const len = cps.length;
    if (len > maxLen) maxLen = len;
    if (len < 2) continue; // 单字符词不需要分词命中，走兜底逐字输出，行为与旧版一致
    const bucket = byFirst.get(cps[0]);
    const entry = { str: w, cps, len };
    if (bucket) bucket.push(entry);
    else byFirst.set(cps[0], [entry]);
  }
  for (const bucket of byFirst.values()) {
    bucket.sort((a, b) => b.len - a.len);
  }

  return function segment(text) {
    const chars = [...text];
    const out = [];
    let i = 0;
    while (i < chars.length) {
      const bucket = byFirst.get(chars[i]);
      let matched = null;
      if (bucket) {
        for (const entry of bucket) {
          if (i + entry.len > chars.length) continue;
          let ok = true;
          for (let k = 1; k < entry.len; k++) {
            if (chars[i + k] !== entry.cps[k]) {
              ok = false;
              break;
            }
          }
          if (ok) {
            matched = entry;
            break;
          }
        }
      }
      if (matched) {
        out.push(matched.str);
        i += matched.len;
      } else {
        out.push(chars[i]);
        i += 1;
      }
    }
    return out;
  };
}

// @platform: 双端导出，Node/打包器走 module.exports，浏览器/小程序同步脚本走 window 全局
if (typeof module === 'object' && module.exports) module.exports = { buildTokenizer };
else if (typeof window !== 'undefined') window.LINYU_TOKENIZER = { buildTokenizer };

}).call(window);
