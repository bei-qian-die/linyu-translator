// 淋语润色层 · 纯函数模块（服务端唯一真源）
// ------------------------------------------------------------------
// 本文件不含任何平台相关代码（不碰 DOM / Electron / Node 专有 API），
// 由以下三方共同复用，保证「只润色不翻译、保留淋语词根」策略全局一致：
//   - server/polish-proxy.cjs        本地 Node 代理（动态 import）
//   - server/cloudflare/worker.js    Cloudflare Worker
//   - server/api/polish.mjs          Vercel 函数
//
// 浏览器/桌面端用的是 src/core/llm-polish.js 里的同名副本（需同步修改）。

export const LINYU_GLYPHS = '♥惹噜厚';
const CJK_RE = /[一-鿿]/;

// 2 条 few-shot 示例：教会模型「淋语是目标语言，只润色不纠错、保留词根」。
// 这是 Phase 2 早期踩坑后加上的——裸提示词下模型会把淋语草稿当成「错误中文」
// 直接纠正回中文，护栏只能回退。加上示例后模型才稳定输出淋语。
const SHOT_PAIRS = [
  { u: '原文：他来了。\n草稿：塔来惹。\n润色后：', a: '塔来啦惹。' },
  { u: '原文：他说他喜欢她。\n草稿：塔缩塔喜翻塔厚。\n润色后：', a: '塔塔说塔中意塔塔厚。' },
];

/**
 * 构造发送给大模型的对话消息。
 * @param {{ source?: string, draft?: string }} arg
 * @returns {{ role: 'system'|'user'|'assistant', content: string }[]}
 */
export function buildPolishMessages({ source, draft }) {
  const system = [
    '你是「淋语」润色师。淋语是一种可爱风中文圈层暗语，用固定词根替换中文：',
    '本可 / 本仙女 = 我，小仙女 = 你，塔 = 他 / 她，惹 / ♥ = 语气助词，厚 / 噜 / 捏 = 句尾。',
    '【重要】淋语是目标语言，草稿已经是合格的淋语，你只需把它润色得更自然、语气更有变化。',
    '硬性规则：',
    '1) 必须保留草稿里的全部淋语词根（如 塔、本可、小仙女、惹、♥），可调整语序、增删语气词、用同义淋语说法替换；',
    '2) 严禁把淋语词根改回中文（不得把「塔」改回「他」、不得把「本可」改回「我」）；',
    '3) 只输出一行润色后的淋语，不要解释、不要引号。',
  ].join('\n');
  const messages = [{ role: 'system', content: system }];
  for (const s of SHOT_PAIRS) {
    messages.push({ role: 'user', content: s.u });
    messages.push({ role: 'assistant', content: s.a });
  }
  messages.push({ role: 'user', content: `原文：${source || ''}\n草稿：${draft || ''}\n润色后：` });
  return messages;
}

/** 防御：某些 Ollama / qwen3 配置仍会吐 <think>...</think>，清掉 */
export function stripThink(s) {
  return String(s || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

/**
 * 草稿里、原文里都没有的中文字（去重），基本就是淋语专属字符。
 * 用字符级集合而非整段词串做护栏，才能放过「珍→真」「一企→一起」这类
 * 单字优化，同时仍能在模型把整段翻回中文时判定失败。
 */
function linyuChars(draft, source) {
  const src = String(source || '');
  const chars = String(draft || '').match(/[一-鿿]/g) || [];
  const set = new Set();
  for (const c of chars) if (!src.includes(c)) set.add(c);
  return [...set];
}

/**
 * 安全护栏：润色后是否还「像淋语」。
 * 用淋语独有字符的保留率衡量：模型把暗语整段翻回中文时这些字符几乎归零 → 失败回退；
 * 只做单字/同义微调时仍保留大半 → 放行。阈值 0.5。
 */
export function retentionOk(draft, polished, source) {
  if (!polished) return false;
  const hasGlyph = LINYU_GLYPHS.split('').some((g) => polished.includes(g));
  const chs = linyuChars(draft, source);
  if (!chs.length) return hasGlyph || CJK_RE.test(polished);
  const set = new Set(chs);
  const inPolished = new Set(String(polished).match(/[一-鿿]/g) || []);
  let kept = 0;
  for (const c of set) if (inPolished.has(c)) kept += 1;
  const ratio = kept / set.size;
  return ratio >= 0.5 && (hasGlyph || kept > 0);
}
