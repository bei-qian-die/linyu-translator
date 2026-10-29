'use strict';

// 淋语翻译器 · 云开发润色函数
// ------------------------------------------------------------------
// 一个云函数同时服务两端：
//   · 小程序：wx.cloud.callFunction('polish', { source, draft }) → { text }
//   · Web   ：云开发「HTTP 访问服务」→ POST /polish，body={source,draft} → {text}
//
// 提示词与护栏与 server/prompt.mjs 逐字一致（「只润色不翻译、保留淋语词根」）。
// API Key 只存在云函数环境变量里（云开发控制台 → 云函数 → polish → 配置 → 环境变量），
// 永不下发到前端。
//
// 环境变量：
//   LLM_API_BASE   OpenAI 兼容 base，含 /v1，例如 https://api.deepseek.com/v1
//   LLM_API_KEY    对应服务的 API Key
//   LLM_MODEL      模型名，例如 deepseek-chat
//   LLM_TIMEOUT_MS 单次超时，默认 25000
//
// 说明：这里用原生 https 模块发请求，不引 node-fetch，避免云函数 Node 版本差异带来的依赖问题。

// wx-server-sdk 只在需要云数据库 / OPENID 时才用得上；本函数只做「出网调大模型」，
// 因此把它做成可选：即使依赖没装、或云端安装依赖失败，函数依然能跑。
// （这也是本函数能做到「零依赖、秒部署」的原因）
let cloud = null;
try {
  cloud = require('wx-server-sdk');
  cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
} catch (e) {
  cloud = null;
}

const http = require('http');
const https = require('https');

const LINYU_GLYPHS = '♥惹噜厚';
const CJK_RE = /[\u4e00-\u9fff]/;

// 2 条 few-shot：教会模型「淋语是目标语言，只做最小改动、保留词根」。
// 裸提示词下模型会把淋语草稿当「错误中文」纠正回中文，示例只做句尾微调才镇得住。
const SHOT_PAIRS = [
  { u: '原文：他来了。\n草稿：塔来惹。\n润色后：', a: '塔来啦惹♥' },
  { u: '原文：他喜欢她。\n草稿：塔喜翻塔厚。\n润色后：', a: '塔喜翻塔噜♥' },
];

function buildPolishMessages({ source, draft }) {
  const system = [
    '你是「淋语」润色师。淋语是可爱风中文圈层暗语，用固定词根替换日常词：',
    '本可 / 本可人儿 / 本仙女 = 我；小仙女 = 你；塔 = 他 / 她；喜翻 = 喜欢；呲 = 吃；丸 = 玩；珍 = 真；惹 / 噜 / 厚 / 捏 / ♥ = 语气词。',
    '【任务】输入是一句已经翻好的淋语草稿。你要做的是「最小改动润色」：只让句尾语气更自然，其余一律不动。',
    '允许的改动（只有这三类）：',
    '1) 句末语气词（惹 / 噜 / 厚 / 捏 / ♥）可增、可删、可换；',
    '2) 句末可再加一个助词（呀 / 啦 / 哦）；',
    '3) 全角标点可互换。',
    '另外，下面这些同义淋语之间可以互换：缩 / 说、喜翻 / 中意、本可 / 本可人儿。除此之外不得替换任何词。',
    '严禁（违反任一条即不合格）：',
    '1) 不得把淋语词根写回中文（「喜翻」不可写成「喜欢」，「珍」不可写成「真」，「塔」不可写成「他 / 她」，「本可」不可写成「我」，「小仙女」不可写成「你」）；',
    '2) 不得新增、删除、替换任何其它实词；',
    '3) 不得改写句式、不得调整语序；',
    '4) 不得输出解释、引号、换行。',
    '只输出一行润色后的淋语，其余什么都不要。',
  ].join('\n');
  const messages = [{ role: 'system', content: system }];
  for (const s of SHOT_PAIRS) {
    messages.push({ role: 'user', content: s.u });
    messages.push({ role: 'assistant', content: s.a });
  }
  messages.push({ role: 'user', content: `原文：${source || ''}\n草稿：${draft || ''}\n润色后：` });
  return messages;
}

function stripThink(s) {
  return String(s || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

function linyuChars(draft, source) {
  const src = String(source || '');
  const chars = String(draft || '').match(/[\u4e00-\u9fff]/g) || [];
  const set = new Set();
  for (const c of chars) if (!src.includes(c)) set.add(c);
  return [...set];
}

// 淋语词根对应的「原中文」：如果它在润色结果里又冒出来，说明模型把词根改回中文了。
const REVERT_WORDS = ['我', '你', '他', '她', '它', '喜欢', '真', '吃', '玩', '怎么', '什么', '这个'];

/** 最长公共子序列覆盖率：衡量「润色后和草稿差多少」，用来拦住大改写。 */
function lcsRatio(a, b) {
  const s = String(a || '');
  const t = String(b || '');
  if (!s.length || !t.length) return 0;
  const n = s.length;
  const m = t.length;
  if (n * m > 60000) return 1; // 超长句子不值得算，直接放行
  let prev = new Array(m + 1).fill(0);
  let cur = new Array(m + 1).fill(0);
  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      cur[j] = s[i - 1] === t[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    }
    const swap = prev;
    prev = cur;
    cur = swap;
    cur.fill(0);
  }
  return prev[m] / n;
}

// 三层护栏：只放行「与草稿高度相似、没有中文回退、仍带淋语气质」的结果。
function retentionOk(draft, polished, source) {
  if (!polished) return false;
  const src = String(source || '');
  const dr = String(draft || '');
  const po = String(polished || '');

  // ① 中文回退：原文有、草稿已替换掉、润色又冒出来 → 模型把词根改回中文了
  for (const w of REVERT_WORDS) {
    if (src.includes(w) && !dr.includes(w) && po.includes(w)) return false;
  }

  // ② 字面保真度：与草稿公共子序列覆盖 < 0.7 → 属于大改写 / 语义漂移
  if (lcsRatio(dr, po) < 0.7) return false;

  // ③ 仍须带淋语气质
  const hasGlyph = LINYU_GLYPHS.split('').some((g) => po.includes(g));
  const chs = linyuChars(dr, src);
  const inPo = new Set(po.match(/[\u4e00-\u9fff]/g) || []);
  const kept = chs.filter((c) => inPo.has(c)).length;
  if (chs.length && kept === 0 && !hasGlyph) return false;

  return true;
}

// 原生 POST JSON（不依赖 fetch，兼容云函数 Node16/18）
function postJson(urlStr, payload, headers, timeoutMs) {
  return new Promise((resolve, reject) => {
    let u;
    try {
      u = new URL(urlStr);
    } catch (e) {
      return reject(e);
    }
    const data = Buffer.from(JSON.stringify(payload));
    const lib = u.protocol === 'http:' ? http : https;
    const req = lib.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || (u.protocol === 'http:' ? 80 : 443),
        path: u.pathname + u.search,
        method: 'POST',
        headers: Object.assign(
          { 'Content-Type': 'application/json', 'Content-Length': data.length },
          headers || {}
        ),
      },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (c) => {
          raw += c;
        });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(raw));
            } catch (e) {
              reject(new Error('返回非 JSON'));
            }
          } else {
            // 带上响应体前 200 字，否则 400 时完全看不出是「模型名错」还是「参数不认」
            reject(new Error('LLM 返回 ' + res.statusCode + (raw ? '：' + raw.slice(0, 200) : '')));
          }
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(Number(timeoutMs) || 25000, () => {
      req.destroy(new Error('LLM 超时'));
    });
    req.write(data);
    req.end();
  });
}

async function callLLM(messages) {
  const base = (process.env.LLM_API_BASE || '').replace(/\/$/, '');
  const key = process.env.LLM_API_KEY || '';
  const model = process.env.LLM_MODEL || 'glm-4-flash';
  if (!base || !key) throw new Error('未配置 LLM_API_BASE / LLM_API_KEY');

  const url = base + '/chat/completions';
  const headers = { Authorization: 'Bearer ' + key };
  const payload = {
    model,
    messages,
    stream: false,
    temperature: 0.45,
    top_p: 0.9,
    max_tokens: 320,
  };

  // 先带 enable_thinking:false（关掉 Qwen3 之类模型的思考链，否则 content 会是空的）。
  // 少数 OpenAI 兼容服务（如智谱）不认这个字段会返回 400/422，此时去掉它重试一次。
  let data;
  try {
    data = await postJson(
      url,
      Object.assign({}, payload, { enable_thinking: false }),
      headers,
      process.env.LLM_TIMEOUT_MS
    );
  } catch (e) {
    if (!/\b4(00|22)\b/.test(e.message)) throw e;
    data = await postJson(url, payload, headers, process.env.LLM_TIMEOUT_MS);
  }

  const content =
    data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  return content ? String(content) : '';
}

async function polish({ source, draft }) {
  if (!draft) return '';
  try {
    const out = stripThink(await callLLM(buildPolishMessages({ source, draft })));
    return retentionOk(draft, out, source) ? out : draft;
  } catch (e) {
    // 失败安全回退：模型不可用 / 超时 / 未配置 → 原样返回草稿，保证翻译器永远有可用输出
    return draft;
  }
}

exports.main = async (event) => {
  // 区分两种调用：HTTP 访问服务带 httpMethod；小程序 callFunction 不带
  const isHttp = Boolean(event && (event.httpMethod || event.requestContext));

  let payload = event || {};
  if (event && event.body !== undefined) {
    try {
      payload = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    } catch (e) {
      payload = {};
    }
  }

  const source = String((payload && payload.source) || '');
  const draft = String((payload && payload.draft) || '');

  // 自检入口：{ ping: true } → 直接回报配置状态，不调用大模型、不花钱。
  // 部署完用它确认「函数通了 / Key 配了 / 模型名对了」。
  if (payload && payload.ping) {
    const info = {
      ok: true,
      model: process.env.LLM_MODEL || 'deepseek-chat',
      hasBase: Boolean(process.env.LLM_API_BASE),
      hasKey: Boolean(process.env.LLM_API_KEY),
      sdk: Boolean(cloud),
    };
    if (isHttp) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
        body: JSON.stringify(info),
      };
    }
    return info;
  }

  const text = await polish({ source, draft });

  if (isHttp) {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: JSON.stringify({ text }),
    };
  }
  return { text };
};

// 便于本地单测：导出纯函数（云函数部署时忽略多导出的属性）
exports._internal = { buildPolishMessages, stripThink, retentionOk, lcsRatio, polish };
