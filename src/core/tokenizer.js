'use strict';

function buildTokenizer(dictWords) {
  const dict = new Set(dictWords);
  let maxLen = 0;
  for (const w of dictWords) {
    const len = [...w].length;
    if (len > maxLen) maxLen = len;
  }

  return function segment(text) {
    const chars = [...text];
    const out = [];
    let i = 0;
    while (i < chars.length) {
      let matched = null;
      for (let len = Math.min(maxLen, chars.length - i); len >= 2; len--) {
        const cand = chars.slice(i, i + len).join('');
        if (dict.has(cand)) {
          matched = cand;
          break;
        }
      }
      if (matched) {
        out.push(matched);
        i += [...matched].length;
      } else {
        out.push(chars[i]);
        i += 1;
      }
    }
    return out;
  };
}

if (typeof module === 'object' && module.exports) module.exports = { buildTokenizer };
else if (typeof window !== 'undefined') window.LINYU_TOKENIZER = { buildTokenizer };
