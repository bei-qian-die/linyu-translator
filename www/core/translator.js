(function () {
'use strict';
// __wrapped by scripts/build-mobile.mjs
'use strict';

const { buildTokenizer } = (typeof require === 'function') ? require('./tokenizer') : (typeof window !== 'undefined' ? window.LINYU_TOKENIZER : { buildTokenizer: () => null });

const END_FLAVOR = ['♥', '惹♥', '噜♥', '厚♥'];
const SPLIT_RE = /([。！？!?；;]+)/;
const CJK_RE = /[一-鿿]/;

function compileRules(rules) {
  const compiled = [];
  for (const r of rules) {
    let re;
    try {
      re = new RegExp(r.pattern, 'g');
    } catch {
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

// 把句子按规则拆成 [{raw} | {parts, groups}] 序列，规则按声明顺序串行套用
function applyRules(text, compiled, ctx) {
  let items = [{ raw: text }];
  for (const rule of compiled) {
    const next = [];
    for (const item of items) {
      if (item.raw == null) {
        next.push(item);
        continue;
      }
      const re = new RegExp(rule.re.source, 'g');
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

function translateText(text, options) {
  const opts = options || {};
  const { words, rules } = opts;
  const ctx = {
    trace: opts.trace || null,
    traceLimit: opts.traceLimit || 240,
    uncovered: opts.uncovered || null,
    unseen: new Set(),
  };
  const input = String(text || '');
  if (!input.trim()) return '';

  const map = new Map(words.map((w) => [w.zh, w.linyu]));
  const segment = buildTokenizer([...map.keys()]);
  const compiled = compileRules(rules);

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

if (typeof module === 'object' && module.exports) module.exports = { translateText };
else if (typeof window !== 'undefined') window.LINYU_TRANSLATOR = { translateText };

}).call(window);
