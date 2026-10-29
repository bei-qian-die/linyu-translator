(function () {
'use strict';
// __wrapped by scripts/lib/wrap-iife.mjs
// @ts-check
'use strict';

// ============================================================================
// 语境选变体（variant chooser）
//
// 词库里一个中文词往往挂了十几个甚至上百个淋语说法（「我」有 100+ 个 alias），
// 但具体该用哪一个，取决于这句在说什么。本模块把词库的三个富字段变成可计算的
// 语境信号，纯本地、零网络请求、零延迟，桌面 / 安卓 / Web / 小程序四端共用：
//
//   slot  → 语义位 + 领域。slot 用「/」分段，首段若是游戏名（淋安京 / 瓦罗淋特 /
//           守望淋锋 …）就当作领域，用来做「同一场对局里说法要一致」；
//           首段若是「第一人称自称 / 群体自称」这类人称位，则配合 sense 判风格。
//   sense → 释义原文。用 /([汉字]{1,4})系/ 挖出「本可系 / 本仙女系」这种家族名，
//           再读家族名后面紧跟的十几个字（「最中性」「卖萌」「自嘲」「清宫位分」）
//           给家族打风格标签 —— 风格归属来自词库自己写的释义，不用另维护关键词表。
//   rel   → 同义 / 相关词。同句里「姐妹」已经译成「集美」，「我们」的候选里带
//           「集美」的就该优先，避免一句里三个人称各玩各的风格。
//
// 三条硬规则（都是为了防止「有变体就乱选」）：
//   1. 没有语境证据时，一律回基准译法（primary），不为了变化而变化；
//   2. 「我 X / 你 X」这类挂角色名的形态，只有源句真的提到该角色才启用；
//   3. 装饰越长惩罚越重，挡掉「本猪猪本可」这种堆叠形态。
// ============================================================================

/**
 * @typedef {Object} Word
 * @property {string} zh
 * @property {string} linyu
 * @property {string} [alias]
 * @property {string} [slot]
 * @property {string} [sense]
 * @property {string[]} [rel]
 */

/**
 * @typedef {Object} Cand
 * @property {string} text   候选译法
 * @property {string} family 家族名（本可 / 本仙女 / 我莫 …）
 * @property {string} style  风格：meng | zi | qing | neutral
 * @property {string} domain 领域名，'' 表示通用
 * @property {string} hook   代词后挂的角色字（我莫 → 莫），'' 表示没有
 * @property {number} deco   装饰度惩罚，越长越花越高
 * @property {boolean} primary 是否是词条基准译法
 */

/**
 * @typedef {Object} Entry
 * @property {string} zh
 * @property {string} primary
 * @property {Cand[]} cands
 * @property {string[]} rel
 */

/**
 * @typedef {Object} VariantIndex
 * @property {Map<string, Entry>} entries
 * @property {Map<string, string>} lexemeDomain 词面 → 领域（用别的词条的 linyu 反查）
 * @property {Map<string, string[]>} hookIndex   首字 → 以该字开头的领域词
 */

/**
 * @typedef {Object} VariantCtx
 * @property {string} domain 当前语境领域，'' 为通用
 * @property {string|null} style 当前语境风格
 * @property {string} source 当前句原文（判断 hook 是否命中共现角色）
 * @property {Map<string, string[]>} hookIndex
 * @property {Map<string, string>} chosen 中文 → 本段已选译法（rel 共现用）
 * @property {Map<string, string>} last   中文 → 上一次选的译法（防重复）
 */

// 打分权重。改动前先想清楚「没有语境证据时 primary 必须赢」：
// primary 2.2 > styleHit 2.6 只有在明确风格语境下才会被压过，这是故意的。
const W = {
  primary: 2.2,
  styleHit: 2.9,
  styleMiss: -1.2,
  domainHit: 1.8,
  domainMiss: -1.4,
  relHit: 2.4,
  hookHit: 6,
  hookMiss: -1.4,
  repeat: -1,
};

// 「我 X / 你 X / 他 X / 塔 X」的头部。塔是他/她的淋语写法。
const HOOK_HEADS = new Set(['我', '你', '他', '她', '塔']);
// 家族兜底切分：本可儿 → 本可、我莫 → 我莫
const FAMILY_HEADS = new Set(['本', '我', '你', '他', '她', '塔', '俺', '咱', '奴']);

// sense 里家族名后面紧跟的描述词 → 风格。顺序即优先级：
// 「中性 / 卖萌 / 自嘲 / 清宫」这类明确说法先判，单字提示（猪、宫、仙）兜底。
const STYLE_HINTS = [
  ['neutral', /中性|通用|基准|日常/],
  ['meng', /卖萌|撒娇|可爱/],
  ['zi', /自嘲|卖惨/],
  ['qing', /清宫|宫斗|位分|娘娘/],
  ['zi', /猪|妞/],
  ['qing', /宫|妃|座/],
  ['meng', /仙|宝|萌|喵/],
];

// 形态兜底：家族名拿不到描述词时按字面判（本宫 → qing、本猪妞 → zi、本仙女 → meng）
const STYLE_MARKERS = [
  ['qing', ['本宫', '本座', '宫', '座', '妃', '娘娘', '娘子', '答应', '常在', '本尊', '奴家', '小女子', '咱家', '臣妾', '太后', '小主', '贵人', '嫔']],
  ['zi', ['猪', '妞', '村']],
  ['meng', ['仙女', '仙子', '仙', '宝', '喵', '萌', '可人儿', '酱', '哒', '啾', '咪', '宝宝']],
];

// 用户写标准游戏名时也能认出来（词库里存的是淋语化游戏名，两种写法都要吃）
const GAME_ALIAS = [
  ['决战平安京', '淋安京'],
  ['平安京', '淋安京'],
  ['阴阳师', '淋安京'],
  ['瓦罗兰特', '瓦罗淋特'],
  ['无畏契约', '瓦罗淋特'],
  ['瓦罗淋特', '瓦罗淋特'],
  ['守望先锋', '守望淋锋'],
  ['守望淋锋', '守望淋锋'],
  ['第五人格', '第五淋格'],
  ['漫威争锋', '淋威争锋'],
  ['英雄联盟', '英雄淋盟'],
  ['王者荣耀', '王者淋耀'],
  ['洛克王国', '洛克淋国'],
  ['原神', '淋神'],
];

// 源文里的风格线索：用户在输入里已经露了口风，就顺着他的口风选
const STYLE_CUES = [
  ['qing', /本宫|臣妾|娘娘|小主|皇上|太后|嫔妃|哀家/],
  ['zi', /猪|妞|村姑/],
  ['meng', /嘤|啾|喵|宝宝|人家|萌|可爱|亲亲|抱抱|小可爱|仙女/],
];

/**
 * slot 首段即领域。游戏领域名一律带「淋」字（淋安京 / 瓦罗淋特 / 守望淋锋 / 淋神 …），
 * 语义位名（第一人称自称 / 圈层黑话 / 情绪）不带，所以这条判据不用维护白名单。
 * @param {string} slot
 * @returns {string}
 */
function domainOf(slot) {
  const first = String(slot || '').split('/')[0].trim();
  return first && first.includes('淋') ? first : '';
}

/**
 * 从释义里挖「X 系」家族名，并读家族名后面的描述词判断风格。
 * 例：「本可系最中性、本仙女系卖萌、本猪妞/本猪猪女孩自嘲、本宫/本座走清宫位分体」
 *      → 本可=neutral、本仙女=meng（本猪妞 / 本宫 没写「系」，交给形态兜底）
 * @param {string} sense
 * @returns {Array<{ family: string, style: string }>}
 */
function mineFamilies(sense) {
  const text = String(sense || '').replace(/["'「」『』《》]/g, '');
  const out = [];
  const re = /([\u4e00-\u9fff]{1,4})系/g;
  let m;
  while ((m = re.exec(text))) {
    const family = m[1];
    const after = text.slice(re.lastIndex, re.lastIndex + 6);
    let style = '';
    for (const [name, hint] of STYLE_HINTS) {
      if (hint.test(after)) {
        style = name;
        break;
      }
    }
    out.push({ family, style });
  }
  return out;
}

/**
 * 形态兜底判风格：取命中最长标记的组。
 * @param {string} text
 * @returns {string}
 */
function markerStyle(text) {
  let best = '';
  let bestLen = 0;
  for (const [style, marks] of STYLE_MARKERS) {
    for (const mk of marks) {
      if (mk.length > bestLen && text.includes(mk)) {
        best = style;
        bestLen = mk.length;
      }
    }
  }
  return best || 'neutral';
}

/**
 * 家族归属：优先用 sense 挖出来的家族名做前缀匹配（取最长），否则按「本 / 我 / 你…」切两字。
 * @param {string} text
 * @param {string[]} familyNames 按长度降序
 * @returns {string}
 */
function familyOf(text, familyNames) {
  for (const f of familyNames) {
    if (text.startsWith(f)) return f;
  }
  const cps = [...text];
  if (cps.length >= 2 && FAMILY_HEADS.has(cps[0])) return cps.slice(0, 2).join('');
  return '';
}

/**
 * 装饰度：比基准译法长的部分算 0.55/字，超过 4 字再额外 0.9/字。
 * 本可(0) < 本可儿(0.55) < 本可人儿(1.1) < 本猪猪本可(2.55)
 * @param {string} text
 * @param {number} baseLen
 * @returns {number}
 */
function decoOf(text, baseLen) {
  const len = [...text].length;
  let deco = Math.max(0, len - Math.max(2, baseLen)) * 0.55;
  if (len > 4) deco += (len - 4) * 0.9;
  return deco;
}

/**
 * 把 [{zh, linyu, alias, slot, sense, rel}] 编译成语境选变体索引。
 * 同 zh 的多条记录合并 alias / rel（保留首个 primary 与 slot / sense）。
 * @param {Word[]} words
 * @returns {VariantIndex}
 */
function buildVariantIndex(words) {
  /** @type {Map<string, { zh: string, primary: string, aliases: string[], slot: string, sense: string, rel: string[], primaryLen: number }>} */
  const merged = new Map();
  /** @type {Map<string, string>} */
  const lexemeDomain = new Map();
  /** @type {Map<string, string[]>} */
  const hookIndex = new Map();

  for (const w of words) {
    const zh = String(w.zh || '').trim();
    if (!zh) continue;
    const aliases = String(w.alias || '')
      .split(/[、,，]/)
      .map((a) => a.trim())
      .filter(Boolean);
    const rel = Array.isArray(w.rel) ? w.rel.map((r) => String(r).trim()).filter(Boolean) : [];
    const existing = merged.get(zh);
    if (existing) {
      for (const a of aliases) if (!existing.aliases.includes(a)) existing.aliases.push(a);
      for (const r of rel) if (!existing.rel.includes(r)) existing.rel.push(r);
      continue;
    }
    merged.set(zh, {
      zh,
      primary: String(w.linyu || zh).trim() || zh,
      aliases,
      slot: String(w.slot || ''),
      sense: String(w.sense || ''),
      rel,
      primaryLen: [...String(w.linyu || zh).trim()].length,
    });

    // 领域词表：中文词面、淋语词面、常见别名都算领域信号；单字太容易误伤，丢掉。
    // 同一个词面被多个领域登记时保留先出现的（种子数据里几乎不冲突）。
    const domain = domainOf(w.slot);
    if (domain) {
      const surfaces = [zh, String(w.linyu || '').trim(), ...aliases.filter((a) => [...a].length <= 4)];
      for (const s of surfaces) {
        if ([...s].length < 2 || lexemeDomain.has(s)) continue;
        lexemeDomain.set(s, domain);
      }
      // hook 只认中文词条首字和末字：我莫 ← 莫伊拉（首字）、我狸 ← 阿狸（末字）
      const cps = [...zh];
      if (cps.length >= 2) {
        for (const head of new Set([cps[0], cps[cps.length - 1]])) {
          const list = hookIndex.get(head);
          if (list) list.push(zh);
          else hookIndex.set(head, [zh]);
        }
      }
    }
  }

  /** @type {Map<string, Entry>} */
  const entries = new Map();
  for (const m of merged.values()) {
    const familyStyle = new Map();
    for (const f of mineFamilies(m.sense)) {
      if (f.style && !familyStyle.has(f.family)) familyStyle.set(f.family, f.style);
    }
    const familyNames = [...familyStyle.keys()].filter((f) => f.length >= 2).sort((a, b) => b.length - a.length);

    /** @type {Cand[]} */
    const cands = [];
    const seen = new Set();
    const push = (raw, primary) => {
      const text = String(raw || '').trim();
      if (!text || seen.has(text)) return;
      seen.add(text);
      const cps = [...text];
      const family = familyOf(text, familyNames);
      let hook = '';
      if (cps.length >= 2 && cps.length <= 4 && HOOK_HEADS.has(cps[0])) hook = cps.slice(1).join('');
      cands.push({
        text,
        family,
        style: familyStyle.get(family) || markerStyle(text),
        domain: lexemeDomain.get(text) || '',
        hook,
        deco: primary ? 0 : decoOf(text, m.primaryLen),
        primary,
      });
    };
    push(m.primary, true);
    for (const a of m.aliases) push(a, false);

    entries.set(m.zh, { zh: m.zh, primary: m.primary, cands, rel: m.rel });
  }

  return { entries, lexemeDomain, hookIndex };
}

/**
 * 扫一遍文本里的领域词，返回命中字数最多的领域（长词权重更高，避免「天使」压过「莫伊拉」）。
 * @param {string} text
 * @param {VariantIndex} index
 * @returns {string}
 */
function scanDomain(text, index) {
  const score = new Map();
  for (const [alias, domain] of GAME_ALIAS) {
    if (text.includes(alias)) score.set(domain, (score.get(domain) || 0) + alias.length);
  }
  const chars = [...text];
  const lex = index.lexemeDomain;
  for (let i = 0; i < chars.length; i++) {
    for (let len = 2; len <= 6 && i + len <= chars.length; len++) {
      const probe = chars.slice(i, i + len).join('');
      const domain = lex.get(probe);
      if (domain) score.set(domain, (score.get(domain) || 0) + len);
    }
  }
  let best = '';
  let bestScore = 0;
  for (const [domain, s] of score) {
    if (s > bestScore) {
      best = domain;
      bestScore = s;
    }
  }
  return best;
}

/**
 * 源文里的风格线索（用户自己写了「人家」「本宫」「嘤」就跟着走）。
 * @param {string} text
 * @returns {string|null}
 */
function scanStyle(text) {
  for (const [style, re] of STYLE_CUES) {
    if (re.test(text)) return style;
  }
  return null;
}

/**
 * @param {string} text
 * @param {VariantIndex} index
 * @returns {{ domain: string, style: string|null }}
 */
function analyzeSource(text, index) {
  const src = String(text || '');
  return { domain: scanDomain(src, index), style: scanStyle(src) };
}

/**
 * 建一次会话级的语境状态（一段输入一个）。
 * @param {VariantIndex} index
 * @returns {VariantCtx}
 */
function createContext(index) {
  return {
    domain: '',
    style: null,
    source: '',
    hookIndex: index.hookIndex,
    chosen: new Map(),
    last: new Map(),
  };
}

/**
 * 在词的候选里按语境打分选一个。
 * @param {Entry} entry
 * @param {VariantCtx} ctx
 * @returns {{ text: string, why: string }}
 */
function chooseVariant(entry, ctx) {
  const cands = entry.cands;
  if (!cands.length) return { text: entry.primary, why: '空词条' };
  if (cands.length === 1) {
    ctx.chosen.set(entry.zh, cands[0].text);
    ctx.last.set(entry.zh, cands[0].text);
    return { text: cands[0].text, why: '唯一译法' };
  }

  const lastPick = ctx.last.get(entry.zh) || '';
  // rel 共现：把「姐妹」已经译成的「集美」找出来。
  // rel 里写的是词条名，实际命中的可能是它的延伸（姐妹 → 姐妹们），所以允许互相包含。
  const sibs = [];
  for (const r of entry.rel) {
    if (r === entry.zh || [...r].length < 2) continue;
    let sib = ctx.chosen.get(r) || '';
    if (!sib) {
      for (const [k, v] of ctx.chosen) {
        if (k !== entry.zh && [...k].length >= 2 && (k.includes(r) || r.includes(k))) {
          sib = v;
          break;
        }
      }
    }
    if (sib && [...sib].length >= 2) sibs.push(sib);
  }

  let best = cands[0];
  let bestScore = -Infinity;
  let bestWhy = '';

  for (const c of cands) {
    let score = 0;
    const why = [];
    if (c.primary) {
      score += W.primary;
      why.push('基准');
    }
    score -= c.deco;

    if (c.style && c.style !== 'neutral' && ctx.style) {
      if (c.style === ctx.style) {
        score += W.styleHit;
        why.push('风格' + c.style);
      } else {
        score += W.styleMiss;
      }
    }

    if (c.domain && !c.primary) {
      if (ctx.domain) {
        if (c.domain === ctx.domain) {
          score += W.domainHit;
          why.push('领域' + c.domain);
        } else {
          score += W.domainMiss;
        }
      } else {
        score += W.domainMiss;
      }
    }

    // hook 只用来「放行」带角色名的花式形态，基准译法本身不用被点名才敢用
    if (c.hook && !c.primary) {
      const heads = ctx.hookIndex.get(c.hook) || [];
      const hit = heads.find((z) => z.length > 1 && ctx.source.includes(z));
      if (hit) {
        score += W.hookHit;
        why.push('点名' + hit);
      } else {
        score += W.hookMiss;
      }
    }

    for (const sib of sibs) {
      if (sib !== c.text && c.text.includes(sib)) {
        score += W.relHit;
        why.push('呼应' + sib);
        break;
      }
    }

    if (lastPick && lastPick === c.text) score += W.repeat;

    // 同分时挑装饰更少的；仍同分则保持词库顺序（primary 在前）
    if (score > bestScore + 1e-9 || (Math.abs(score - bestScore) < 1e-9 && c.deco < best.deco)) {
      best = c;
      bestScore = score;
      bestWhy = why.join('·') || '无信号';
    }
  }

  ctx.chosen.set(entry.zh, best.text);
  ctx.last.set(entry.zh, best.text);
  // 只有「非基准 + 带风格」的译法才把整句风格带跑，避免基准词把语境锁死
  if (!best.primary && best.style && best.style !== 'neutral' && !ctx.style) ctx.style = best.style;
  return { text: best.text, why: bestWhy };
}

// @platform: 双端导出，Node/打包器走 module.exports，浏览器/小程序同步脚本走 window 全局
if (typeof module === 'object' && module.exports) {
  module.exports = { buildVariantIndex, analyzeSource, createContext, chooseVariant, domainOf, mineFamilies };
} else if (typeof window !== 'undefined') {
  window.LINYU_VARIANT = { buildVariantIndex, analyzeSource, createContext, chooseVariant, domainOf, mineFamilies };
}

}).call(window);
