// @ts-check
'use strict';

/** @type {{ buildTokenizer: (dictWords: Iterable<string>) => (text: string) => string[] }} */
// @platform: Node 用 require，浏览器/小程序环境从 window 取同步注入的模块
const tokenizerMod = (typeof require === 'function')
  ? require('./tokenizer')
  : (typeof window !== 'undefined' ? (/** @type {any} */ (window).LINYU_TOKENIZER) : { buildTokenizer: () => (/** @type {any} */ (null)) });
const { buildTokenizer } = tokenizerMod;

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
 */

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

function wordPass(items, segment, map, ctx) {
  const replace = (s) => {
    let out = '';
    let run = '';
    for (const t of segment(s)) {
      const hit = map.get(t);
      if (hit == null) {
        run += t;
        out += t;
        continue;
      }
      if (run) {
        collectUncovered(ctx, run);
        run = '';
      }
      pushTrace(ctx, { kind: 'word', from: t, to: hit });
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
 * @param {{ words: Word[], rules: Rule[], trace?: any[]|null, uncovered?: string[]|null, traceLimit?: number }} options
 * @returns {string}
 */
function translateText(text, options) {
  // options 在测试里会被省略，运行时走默认空对象；类型上按完整形状收，避免后面每处判空
  const opts = options || (/** @type {any} */ ({}));
  const { words, rules } = opts;
  const ctx = {
    trace: opts.trace || null,
    traceLimit: opts.traceLimit || 240,
    uncovered: opts.uncovered || null,
    unseen: new Set(),
  };
  const input = String(text || '');
  if (!input.trim()) return '';

  const sig = words.map((w) => w.zh).join('\u0001');
  if (tokCache.sig !== sig) {
    const map = new Map(words.map((w) => [w.zh, w.linyu]));
    tokCache = { sig, map, segment: buildTokenizer(words.map((w) => w.zh)) };
  }
  const rsig = rules.map((r) => r.pattern + '\u0000' + (r.template || '')).join('\u0001');
  if (ruleCache.sig !== rsig) {
    ruleCache = { sig: rsig, compiled: compileRules(rules) };
  }
  const map = tokCache.map;
  const segment = tokCache.segment;
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
        let s = wordPass(applyRules(content, compiled, ctx), segment, map, ctx);
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
        out += s + delim;
      }
      return out;
    })
    .join('\n');
}

// @platform: 双端导出，Node/打包器走 module.exports，浏览器/小程序同步脚本走 window 全局
if (typeof module === 'object' && module.exports) module.exports = { translateText };
else if (typeof window !== 'undefined') window.LINYU_TRANSLATOR = { translateText };
