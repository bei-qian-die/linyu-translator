// @ts-check
'use strict';

/** @type {{ buildTokenizer: (dictWords: Iterable<string>) => (text: string) => string[] }} */
// @platform: Node 用 require，浏览器/小程序环境从 window 取同步注入的模块
const tokenizerMod = (typeof require === 'function')
  ? require('./tokenizer')
  : (typeof window !== 'undefined' ? (/** @type {any} */ (window).LINYU_TOKENIZER) : { buildTokenizer: () => (/** @type {any} */ (null)) });
const { buildTokenizer } = tokenizerMod;

// 语境选变体模块（slot / sense / rel）。脚本没加载时降级成不开消歧，
// 保证老打包产物不会因为少一个 <script> 直接崩。
// @platform: Node 用 require，浏览器/小程序从 window 取
const variantMod = (typeof require === 'function')
  ? require('./variant')
  : (typeof window !== 'undefined' ? (/** @type {any} */ (window).LINYU_VARIANT) : null);
const { buildVariantIndex, analyzeSource, createContext, chooseVariant } = variantMod || (/** @type {any} */ ({}));

const END_FLAVOR = ['♥', '惹♥', '噜♥', '厚♥'];
const SPLIT_RE = /([。！？!?；;]+)/;
const CJK_RE = /[一-鿿]/;

/**
 * @typedef {Object} Rule
 * @property {string} pattern
 * @property {string} [template]
 * @property {number} [id]
 * @property {string} [note]
 */

/**
 * @typedef {Object} Word
 * @property {string} zh
 * @property {string} linyu
 * @property {string} [alias]
 * @property {string} [slot]
 * @property {string} [sense]
 * @property {string[]} [rel]
 */

// ---- 语境选变体 ----
// 词表编译、风格 / 领域推断、候选打分都在 core/variant.js 里（四端共用同一份）。
// 这里只负责：把 words 编成索引（按内容签名缓存）、逐句喂语境、按选中的译法记 trace。
// 默认路径（disambiguate=false）仍走原来的 Map<zh, linyu>，不付任何额外开销。

// 语境后缀：替代原来的轮询 END_FLAVOR。
// 问句不给后缀（? 本身已带语气），已以语气词结尾的不重复加，陈述句按内容哈希取噜/惹/厚 制造变化。
const PARTICLE_END = /[惹噜厚♥嘛哦吖捏呀]$/;
const QUESTION_HINT = /[吗呢怎么为什么谁什么咋哪儿哪]/;
/**
 * @param {string} content
 * @param {string} delim
 */
function pickFlavor(content, delim) {
  if (PARTICLE_END.test(content)) return '';
  if (delim === '！' || delim === '!') return '♥';
  if (delim === '？' || delim === '?') return '';
  if (QUESTION_HINT.test(content)) return '';
  const flavors = ['噜', '惹', '厚'];
  let h = 0;
  for (const ch of content) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return flavors[h % flavors.length];
}

/**
 * @param {Rule[]} rules
 */
function compileRules(rules) {
  const compiled = [];
  for (const r of rules) {
    let re;
    try {
      re = new RegExp(r.pattern, 'g');
    } catch (err) {
      // 单条句式正则非法不影响整体翻译，跳过该条（C8）
      continue;
    }
    const tpl = r.template || '';
    const parts = [];
    const segRe = /\$(\d+)/g;
    let last = 0;
    let m;
    while ((m = segRe.exec(tpl))) {
      if (m.index > last) parts.push({ lit: tpl.slice(last, m.index) });
      parts.push({ group: Number(m[1]) });
      last = segRe.lastIndex;
    }
    if (last < tpl.length) parts.push({ lit: tpl.slice(last) });
    compiled.push({ re, parts, pattern: r.pattern, id: r.id, note: r.note || '' });
  }
  return compiled;
}

function pushTrace(ctx, entry) {
  if (!ctx.trace || ctx.trace.length >= ctx.traceLimit) return;
  ctx.trace.push(entry);
}

// 词库与句式只在内容变化时重新编译。store.getWords() 每次都返回新数组，
// 引用比较没用，所以按内容算签名；普通用户每次输入不该重复付
// 500 次 Set 构建 + 146 个正则编译的钱。开发者改词后签名变了自然重建。
// 初始 sig 用 null 而不是空串：词库/句式为空时算出来的签名正好是 ''，
// 与初始签名相等就会跳过编译，拿到下面的空实现之外的值（null）去 for...of 直接崩。
// 用 null 当哨兵保证第一次一定走编译分支。
let tokCache = { sig: null, map: new Map(), segment: (text) => [...text] };
let ruleCache = { sig: null, compiled: [] };
// 语境选变体索引缓存（独立于默认 map，避免影响默认路径）
/** @type {{ sig: string|null, table: any }} */
let tableCache = { sig: null, table: null };

// 把句子按规则拆成 [{raw} | {parts, groups}] 序列，规则按声明顺序串行套用。
// re 直接复用 compileRules 编译好的实例（循环里显式清零 lastIndex）——
// 旧写法每条规则 × 每个片段都 new RegExp，一次翻译要编译几千次正则。
function applyRules(text, compiled, ctx) {
  let items = [{ raw: text }];
  for (const rule of compiled) {
    const re = rule.re;
    re.lastIndex = 0;
    const next = [];
    for (const item of items) {
      if (item.raw == null) {
        next.push(item);
        continue;
      }
      re.lastIndex = 0;
      let last = 0;
      let m;
      while ((m = re.exec(item.raw))) {
        if (m[0].length === 0) {
          re.lastIndex += 1;
          continue;
        }
        if (m.index > last) next.push({ raw: item.raw.slice(last, m.index) });
        pushTrace(ctx, { kind: 'rule', id: rule.id, pattern: rule.pattern, note: rule.note, from: m[0] });
        next.push({ parts: rule.parts, groups: m });
        last = re.lastIndex;
      }
      if (last < item.raw.length) next.push({ raw: item.raw.slice(last) });
    }
    items = next;
  }
  return items;
}

// 词库里查不到的连续片段就是"该补的词"，去掉标点后凑够两个字才提示，避免碎片刷屏
function collectUncovered(ctx, run) {
  if (!ctx.uncovered) return;
  const clean = run.replace(/[^一-鿿]/g, '');
  if (clean.length < 2 || !CJK_RE.test(clean)) return;
  if (ctx.unseen.has(clean)) return;
  ctx.unseen.add(clean);
  if (ctx.uncovered.length < 40) ctx.uncovered.push(clean);
}

/**
 * @param {any[]} items
 * @param {(text:string)=>string[]} segment
 * @param {Map<string,any>} lookup 默认路径是 Map<zh,linyu>，消歧路径是 Map<zh, entry>
 * @param {any} ctx
 * @param {boolean} disambiguate
 * @param {any} [vctx] 消歧路径的语境状态（core/variant.js 的 VariantCtx）
 */
function wordPass(items, segment, lookup, ctx, disambiguate, vctx) {
  const replace = (s) => {
    const tokens = segment(s);
    let out = '';
    let run = '';
    for (const t of tokens) {
      let hit = null;
      let why = '';
      if (disambiguate) {
        const entry = lookup.get(t);
        if (entry) {
          const picked = chooseVariant(entry, vctx);
          hit = picked.text;
          why = picked.why;
        }
      } else {
        const plain = lookup.get(t);
        hit = plain === undefined ? null : plain;
      }
      if (hit == null) {
        run += t;
        out += t;
        continue;
      }
      if (run) {
        collectUncovered(ctx, run);
        run = '';
      }
      if (disambiguate) pushTrace(ctx, { kind: 'word', from: t, to: hit, why });
      else pushTrace(ctx, { kind: 'word', from: t, to: hit });
      out += hit;
    }
    if (run) collectUncovered(ctx, run);
    return out;
  };
  return items
    .map((item) => {
      if (item.raw != null) return replace(item.raw);
      return item.parts
        .map((p) => (p.lit != null ? p.lit : replace(item.groups[p.group] || '')))
        .join('');
    })
    .join('');
}

/**
 * @param {string} text
 * @param {{ words: Word[], rules: Rule[], trace?: any[]|null, uncovered?: string[]|null, traceLimit?: number, disambiguate?: boolean }} options
 * @returns {string}
 */
function translateText(text, options) {
  // options 在测试里会被省略，运行时走默认空对象；类型上按完整形状收，避免后面每处判空
  const opts = options || (/** @type {any} */ ({}));
  const { words, rules } = opts;
  // 语境选变体依赖 variant 模块；模块缺失时降级为不开消歧，而不是崩掉
  const disambiguate = Boolean(opts.disambiguate) && typeof chooseVariant === 'function';
  const ctx = {
    trace: opts.trace || null,
    traceLimit: opts.traceLimit || 240,
    uncovered: opts.uncovered || null,
    unseen: new Set(),
  };
  const input = String(text || '');
  if (!input.trim()) return '';

  // 签名要覆盖选变体用到的全部字段（linyu / alias / slot / sense）：只按 zh 算签名的话，
  // 开发者改完译文或候选、别名，索引还是旧的。长度和已经足够便宜地探测这类改动。
  const sig = words.map((w) => w.zh).join('\u0001');
  let detail = 0;
  for (const w of words) {
    detail += (w.linyu ? w.linyu.length : 0) + (w.alias ? w.alias.length : 0)
      + (w.slot ? w.slot.length : 0) + (w.sense ? w.sense.length : 0);
  }
  const vsig = sig + '#' + words.length + '#' + detail;

  if (tokCache.sig !== vsig) {
    const map = new Map(words.map((w) => [w.zh, w.linyu]));
    tokCache = { sig: vsig, map, segment: buildTokenizer(words.map((w) => w.zh)) };
  }
  const map = tokCache.map;
  const segment = tokCache.segment;

  /** @type {Map<string,any>|null} */
  let table = null;
  /** @type {any} */
  let vctx = null;
  if (disambiguate) {
    if (!tableCache.sig || tableCache.sig !== vsig) {
      tableCache = { sig: vsig, table: buildVariantIndex(words) };
    }
    const index = tableCache.table;
    table = index.entries;
    // 文档级语境先扫一遍：整段在说守望还是王者，比逐句猜测稳
    vctx = createContext(index);
    const doc = analyzeSource(input, index);
    vctx.domain = doc.domain;
    vctx.style = doc.style;
  }

  const rsig = rules.map((r) => r.pattern + '\u0000' + (r.template || '')).join('\u0001');
  if (ruleCache.sig !== rsig) {
    ruleCache = { sig: rsig, compiled: compileRules(rules) };
  }
  const compiled = ruleCache.compiled;

  let flavorCount = 0;
  const lines = input.split('\n');

  return lines
    .map((line) => {
      if (!line.trim()) return line;
      const pieces = line.split(SPLIT_RE);
      let out = '';
      for (let i = 0; i < pieces.length; i += 2) {
        const content = pieces[i];
        let delim = pieces[i + 1] || '';
        if (!content) {
          out += delim;
          continue;
        }
        if (disambiguate && vctx) {
          // 逐句把原文喂给语境：hook（我莫 的 莫）要在本句里找到角色名，
          // 句内出现更明确的领域 / 风格线索时覆盖文档级判断。
          vctx.source = content;
          const local = analyzeSource(content, tableCache.table);
          if (local.domain) vctx.domain = local.domain;
          if (local.style) vctx.style = local.style;
        }
        let s = wordPass(applyRules(content, compiled, ctx), segment, disambiguate ? table : map, ctx, disambiguate, vctx);
        if (disambiguate) {
          // 语境后缀：问句/已带语气词不给后缀，陈述句按内容哈希取噜/惹/厚 制造自然变化
          if (!/[♥]$/.test(s)) {
            if (delim === '。' || delim === '' || delim === '；' || delim === ';') {
              if (!/[嘛哦吖惹捏呀]$/.test(s) && delim !== '；' && delim !== ';') {
                const fl = pickFlavor(s, delim);
                if (fl) s += fl;
              }
            } else if (delim === '！' || delim === '!') {
              s += '♥';
            }
          }
        } else {
          // 原逻辑：轮询 END_FLAVOR（保持默认行为不变，现有测试依赖它）
          if (!/[♥]$/.test(s)) {
            if (delim === '。' || delim === '' || delim === '；' || delim === ';') {
              if (!/[嘛哦吖惹捏]$/.test(s) && delim !== '；' && delim !== ';') {
                s += END_FLAVOR[flavorCount % END_FLAVOR.length];
                flavorCount += 1;
                if (delim === '。') delim = '';
              }
            } else if (delim === '！' || delim === '!') {
              s += '♥';
            }
          }
        }
        out += s + delim;
      }
      return out;
    })
    .join('\n');
}

// @platform: 双端导出，Node/打包器走 module.exports，浏览器/小程序同步脚本走 window 全局
if (typeof module === 'object' && module.exports) module.exports = { translateText };
else if (typeof window !== 'undefined') window.LINYU_TRANSLATOR = { translateText };
