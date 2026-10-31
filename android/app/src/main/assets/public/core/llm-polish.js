(function () {
'use strict';
// __wrapped by scripts/lib/wrap-iife.mjs
// @ts-check
'use strict';

/**
 * LLM 润色层（Phase 2）
 * ------------------------------------------------------------------
 * 把规则引擎产出的「直译草稿」交给本地大模型做流畅度 / 表达多样性润色，
 * 解决 Phase 1 启发式救不回来的局部生硬（如「塔塔」重复、语序不自然）。
 *
 * 设计原则：
 *  1. 只润色、不翻译 —— 模型必须保留草稿里的全部淋语词根，只能调语序 /
 *     加删语气词 / 用同义淋语说法替换，不得把暗语翻回中文、不得改原意。
 *  2. 与平台无关 —— 本模块不碰 DOM / Electron，只依赖注入或全局的 fetch
 *     （Node 22 与浏览器都有原生 fetch），因此桌面 / Web / 小程序都能复用。
 *  3. 失败安全 —— 模型不可用 / 超时 / 解析失败 / 护栏判定异常，一律回退到
 *     草稿原文，绝不把错误抛到业务层外（翻译器永远有可用输出）。
 *  4. 可验证 —— buildPolishMessages 是纯函数，可单测；createOllamaClient
 *     走标准 Ollama /api/chat，无私有协议。
 */

const LINYU_GLYPHS = '♥惹噜厚';
const CJK_RE = /[一-鿿]/;

// ---- 纯函数：提示词构造 ----

/**
 * 2 条 few-shot 示例：教会模型「淋语是目标语言，只润色不纠错、保留词根」。
 * 这是 Phase 2 早期踩坑后加上的——裸提示词下模型会把淋语草稿当成「错误中文」
 * 直接纠正回中文，护栏只能回退。加上示例后模型才稳定输出淋语。
 */
const SHOT_PAIRS = [
  { u: '原文：他来了。\n草稿：塔来惹。\n润色后：', a: '塔来啦惹。' },
  { u: '原文：他说他喜欢她。\n草稿：塔缩塔喜翻塔厚。\n润色后：', a: '塔塔说塔中意塔塔厚。' },
];

/**
 * 构造发送给大模型的对话消息。
 * @param {{ source?: string, draft?: string }} arg
 * @returns {{ role: 'system'|'user'|'assistant', content: string }[]}
 */
function buildPolishMessages({ source, draft }) {
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

// ---- 纯函数：护栏 ----

/** 防御：某些 Ollama / qwen3 配置仍会吐 <think>...</think>，清掉 */
function stripThink(s) {
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
// 桌面端提示词允许调语序 / 同义替换（缩↔说、喜翻↔中意），所以不能像云端那样逐字查白名单；
// 但「把人称词根改回中文」是硬禁，单独盯这三组，否则模型写「他来了惹」也能靠残留的「惹」蒙混过关。
const SELF_FORMS = ['本可', '本仙女', '本仙子', '本宫', '本座', '本尊', '本娘娘', '本猪妞', '奴家', '小女子', '咱家', '本淋'];

function revertedPronoun(draft, polished) {
  // 第三人称：草稿有「塔」，结果既没「塔」又冒回「他/她」
  if (draft.includes('塔') && !polished.includes('塔') && /[他她]/.test(polished)) return true;
  // 第一人称：草稿有淋语自称，结果一个都没留却写成「我」
  if (SELF_FORMS.some((w) => draft.includes(w)) && !SELF_FORMS.some((w) => polished.includes(w)) && polished.includes('我')) return true;
  // 第二人称：草稿有「小仙女」，结果丢了又写成「你」
  if (draft.includes('小仙女') && !polished.includes('小仙女') && polished.includes('你')) return true;
  return false;
}

function retentionOk(draft, polished, source) {
  if (!polished) return false;
  if (revertedPronoun(String(draft || ''), String(polished || ''))) return false;
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

/**
 * 清掉模型复述出来的提示词骨架。
 * qwen3 经常把「原文：… / 润色后：…」整段学回来，甚至带引号、带 ``` 包裹，
 * 直接塞进结果栏就会出现「润色后：本可不造厚…」这种脏输出（护栏还会判定通过）。
 * @param {string} raw
 * @returns {string}
 */
function cleanPolishOutput(raw) {
  let s = stripThink(raw).replace(/^```[a-z]*\n?|```$/gi, '');
  const marks = [...s.matchAll(/润色后\s*[:：]/g)];
  if (marks.length) {
    const last = marks[marks.length - 1];
    s = s.slice(last.index + last[0].length);
  }
  s = s
    .split(/\r?\n/)
    .map((t) => t.trim())
    .filter((t) => t && !/^(原文|草稿|润色后)\s*[:：]/.test(t))
    .join('\n')
    .trim();
  return s.replace(/^[「『“"']+|[」』”"']+$/g, '').trim();
}

// ---- 模型发现（纯函数 + 探测）----

/**
 * 纯函数：从本机已装模型里挑一个可用的润色模型。
 * 起因：默认写死 `qwen3:8b`，但本机实际装的是 `qwen3:8b-fast`（自定义 Modelfile），
 * 二者名字不等 → /api/chat 返回 404 → polish 静默回退草稿，用户只看到「没润色」。
 * 优先级：用户显式指定 > 同名不带 tag > 同 base 名（qwen3:*) > 任意 qwen3 > 第一个模型。
 * @param {Array<string|{name?:string}>} available /api/tags 返回的模型列表（也接受裸名字数组）
 * @param {string} [wanted] 用户偏好里的模型名
 * @returns {string} 选中的模型名；无可用模型返回 ''
 */
function pickModel(available, wanted) {
  const list = (available || [])
    .map((m) => (typeof m === 'string' ? m : m && m.name))
    .filter(Boolean);
  if (!list.length) return '';
  // 「fast / no_think」这类变体是本机为降低思考链开销自定义的，同等条件下优先：
  // 实测同一张卡上 qwen3:8b 首次响应 ~37s，qwen3:8b-fast 只要 ~10s，选错就等于超时。
  const isFast = (n) => /fast|no[-_]?think/i.test(n);
  const w = String(wanted || '').trim();
  if (w && list.includes(w)) return w; // 用户显式指定就照办
  if (w) {
    const base = w.split(':')[0];
    const same = list.filter((n) => n.split(':')[0] === base);
    if (same.length) return same.find(isFast) || same[0];
  }
  const qwen = list.filter((n) => /^qwen3/i.test(n));
  const hit = qwen.find(isFast) || qwen.find((n) => /8b/i.test(n)) || qwen[0];
  return hit || list[0];
}

/**
 * 读取本机 Ollama 的模型列表（失败返回空数组，不抛）。
 * @param {string} [baseUrl]
 * @param {Function} [fetchImpl]
 * @returns {Promise<string[]>}
 */
async function listOllamaModels(baseUrl, fetchImpl) {
  const f = fetchImpl || (typeof fetch === 'function' ? fetch : null);
  if (!f) return [];
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 4000);
    const r = await f(String(baseUrl || 'http://localhost:11434').replace(/\/$/, '') + '/api/tags', {
      signal: c.signal,
    });
    clearTimeout(t);
    if (!r.ok) return [];
    const data = await r.json();
    const arr = (data && data.models) || [];
    return arr.map((m) => (typeof m === 'string' ? m : m && m.name)).filter(Boolean);
  } catch {
    return [];
  }
}

// ---- Ollama 客户端（transport 无关）----

/**
 * 创建一个 Ollama 客户端（本地 qwen3:8b / qwen3:8b-fast）。
 * @param {{ baseUrl?: string, model?: string, fetchImpl?: Function, timeoutMs?: number, temperature?: number }} opts
 * @returns {{ name: string, isAvailable: () => Promise<boolean>, chat: Function, polish: Function }}
 */
function createOllamaClient(opts) {
  const baseUrl = (opts && opts.baseUrl) || 'http://localhost:11434';
  const model = (opts && opts.model) || 'qwen3:8b';
  const fetchImpl = (opts && opts.fetchImpl) || (typeof fetch === 'function' ? fetch : null);
  // 实测 RTX 4060 笔电上 qwen3:8b Q4_K_M + few-shot 提示：短句约 10s，长草稿 / 冷加载到 25~40s。
  // 原来 30s 会被掐断 → 静默回退草稿，表现就是「勾了润色但没反应」。
  const timeoutMs = (opts && opts.timeoutMs) || 90000;
  const temperature = (opts && opts.temperature) != null ? opts.temperature : 0.45;

  async function isAvailable() {
    if (!fetchImpl) return false;
    try {
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), 4000);
      const r = await fetchImpl(baseUrl.replace(/\/$/, '') + '/api/tags', { signal: c.signal });
      clearTimeout(t);
      return r.ok;
    } catch {
      return false;
    }
  }

  async function chat(messages) {
    if (!fetchImpl) throw new Error('运行环境缺少 fetch');
    const body = {
      model,
      messages,
      stream: false,
      think: false, // qwen3 关闭思考链，直接产出润色结果
      options: { temperature, top_p: 0.9, num_predict: 320 },
    };
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), timeoutMs);
    let res;
    try {
      res = await fetchImpl(baseUrl.replace(/\/$/, '') + '/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: c.signal,
      });
    } finally {
      clearTimeout(t);
    }
    if (!res.ok) throw new Error('Ollama 返回 ' + res.status);
    const data = await res.json();
    const content = data && data.message && data.message.content ? data.message.content : '';
    return stripThink(content);
  }

  // 润色入口：草稿 → 润色后文本（提示词 / 清洗 / 护栏 / 回退都在 wrapPolish 里，
  // 与智谱直连、云端代理共用同一份实现，避免三处各写一遍又走样）。
  return {
    name: 'ollama:' + model,
    model,
    isAvailable,
    chat,
    polish: wrapPolish(chat, { strict: Boolean(opts && opts.strict) }),
  };
}

// ---- 润色入口工厂：任何 chat(messages) 实现都能套上「提示词 + 清洗 + 护栏 + 回退」----

/**
 * 把「发送消息的函数」包成统一的 polish(source, draft)。
 * 默认失败一律回退草稿（翻译永远有输出）；opt.strict 时改为抛出，
 * 桌面端「智谱直连」用它，好让设置页/结果栏把「Key 错 / 超时」真正显示出来。
 * @param {(messages: any[]) => Promise<string>} chat
 * @param {{ strict?: boolean }} [opt]
 */
function wrapPolish(chat, opt) {
  const strict = Boolean(opt && opt.strict);
  return async function polish(source, draft) {
    try {
      const out = await chat(buildPolishMessages({ source, draft }));
      const polished = cleanPolishOutput(out);
      if (!polished) return draft;
      if (!retentionOk(draft, polished, source)) return draft;
      return polished;
    } catch (e) {
      if (strict) throw e;
      return draft;
    }
  };
}

// ---- OpenAI 兼容客户端（智谱 GLM / DeepSeek / 任何 /v1 服务）----

/**
 * 「填个 Key 就能用」的润色客户端，默认指向智谱 open.bigmodel.cn。
 * 桌面端不装 Ollama 时走这条路：同一个提示词、同一套护栏，只是 transport 换成
 * 标准 chat/completions（Key 只存在本机库的偏好里，随请求发往服务端）。
 * @param {{ baseUrl?: string, apiKey?: string, model?: string, fetchImpl?: Function,
 *           timeoutMs?: number, temperature?: number, strict?: boolean }} opts
 */
function createOpenAIChatClient(opts) {
  const baseUrl = String((opts && opts.baseUrl) || 'https://open.bigmodel.cn/api/paas/v4').replace(/\/$/, '');
  const apiKey = String((opts && opts.apiKey) || '').trim();
  const model = String((opts && opts.model) || 'glm-4-flash').trim() || 'glm-4-flash';
  const fetchImpl = (opts && opts.fetchImpl) || (typeof fetch === 'function' ? fetch : null);
  // glm-4-flash 正常 2~8s；留 30s 给网络抖动，再长就该报错了
  const timeoutMs = (opts && opts.timeoutMs) || 30000;
  const temperature = (opts && opts.temperature) != null ? opts.temperature : 0.45;

  async function isAvailable() {
    return Boolean(fetchImpl && apiKey);
  }

  async function chat(messages) {
    if (!fetchImpl) throw new Error('运行环境缺少 fetch');
    if (!apiKey) throw new Error('未填写 API Key');
    const body = { model, messages, stream: false, temperature, top_p: 0.9, max_tokens: 320 };
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), timeoutMs);
    let res;
    try {
      res = await fetchImpl(baseUrl + '/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
        body: JSON.stringify(body),
        signal: c.signal,
      });
    } catch (e) {
      const msg = e && e.name === 'AbortError' ? '模型接口超时（' + timeoutMs + 'ms）' : '连不上模型接口：' + (e && e.message);
      throw new Error(msg, { cause: e });
    } finally {
      clearTimeout(t);
    }
    if (!res.ok) {
      let detail = '';
      try {
        detail = String(await res.text()).slice(0, 200);
      } catch {
        /* 响应体读不出来就只报状态码 */
      }
      throw new Error('模型接口返回 ' + res.status + (detail ? '：' + detail : ''));
    }
    const data = await res.json();
    const msg = data && data.choices && data.choices[0] && data.choices[0].message;
    return stripThink(String((msg && msg.content) || ''));
  }

  return {
    name: 'openai:' + model,
    model,
    isAvailable,
    chat,
    polish: wrapPolish(chat, { strict: Boolean(opts && opts.strict) }),
  };
}

// ---- HTTP 云端代理客户端（transport 无关）----
// Web / 小程序端没有本地模型，润色请求发到一个「部署好的云端代理」：
//   POST {baseUrl}  body: { source, draft }  response: { text }
// 代理服务端复用同一份 buildPolishMessages + retentionOk（API Key 留在服务端，绝不下发前端）。
// 本客户端只负责发请求 + 用 retentionOk 兜底：万一代理返回的不再是淋语，直接回退草稿。

/**
 * 创建远端代理润色客户端。
 * @param {{ baseUrl?: string, fetchImpl?: Function, timeoutMs?: number }} opts
 * @returns {{ name: string, isAvailable: () => Promise<boolean>, chat: Function, polish: Function }}
 */
function createHttpProxyClient(opts) {
  const baseUrl = (opts && opts.baseUrl) || '';
  const fetchImpl = (opts && opts.fetchImpl) || (typeof fetch === 'function' ? fetch : null);
  const timeoutMs = (opts && opts.timeoutMs) || 30000;

  async function isAvailable() {
    if (!baseUrl) return false;
    if (!fetchImpl) return false;
    try {
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), 4000);
      const r = await fetchImpl(baseUrl, { method: 'OPTIONS', signal: c.signal });
      clearTimeout(t);
      return r.ok || r.status === 404 || r.status === 405;
    } catch {
      return false;
    }
  }

  async function chat() {
    throw new Error('HTTP 代理客户端不直接调用 chat：请求已封装在 polish 里发往云端代理');
  }

  /**
   * 润色入口：草稿 → 润色后文本。
   * 发往代理，拿到 { text } 后用 retentionOk 兜底；任何异常 / 无地址 / 护栏失败都回退草稿。
   */
  async function polish(source, draft) {
    if (!baseUrl || !fetchImpl) return draft;
    try {
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), timeoutMs);
      const res = await fetchImpl(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: String(source || ''), draft: String(draft || '') }),
        signal: c.signal,
      });
      clearTimeout(t);
      if (!res.ok) return draft;
      const data = await res.json();
      const text = data && data.text;
      if (!text) return draft;
      const out = String(text);
      // 双重护栏：客户端再判一次，确保永远输出淋语
      if (!retentionOk(draft, out, source)) return draft;
      return out;
    } catch {
      return draft; // 代理不可达 / 超时 / 解析失败 → 原样返回草稿
    }
  }

  return { name: 'proxy:' + (baseUrl || 'unset'), isAvailable, chat, polish };
}

// @platform: 双端导出，Node/打包器走 module.exports，浏览器/小程序同步脚本走 window 全局
if (typeof module === 'object' && module.exports) {
  module.exports = { buildPolishMessages, createOllamaClient, createOpenAIChatClient, createHttpProxyClient, linyuChars, pickModel, listOllamaModels, cleanPolishOutput, retentionOk, stripThink, wrapPolish };
} else if (typeof window !== 'undefined') {
  window.LINYU_POLISH = { buildPolishMessages, createOllamaClient, createOpenAIChatClient, createHttpProxyClient, linyuChars, pickModel, listOllamaModels, cleanPolishOutput, retentionOk, stripThink, wrapPolish };
}

}).call(window);
