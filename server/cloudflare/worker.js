// 淋语翻译器 · 云端润色代理（Cloudflare Worker 版本）
// ------------------------------------------------------------------
// 一键部署：在 server/cloudflare/ 目录执行 `wrangler deploy`。
// wrangler 会把本文件与 ../prompt.mjs 一并打包，API Key 只存在 Worker 环境变量里，
// 永不下发前端。Web / 微信小程序把 polishProxyUrl 指向本 Worker 的 /polish 即可。
//
// 环境变量（wrangler.toml 的 [vars] 放非敏感项，wrangler secret put 放密钥）：
//   LLM_API_KIND   'openai'（默认，OpenAI 兼容 /v1/chat/completions）或 'ollama'（/api/chat）
//   LLM_API_BASE   大模型 base。openai 模式填到 /v1；ollama 模式填到根，脚本自动拼 /api/chat
//   LLM_API_KEY    API Key（secret）
//   LLM_MODEL      模型名
//   LLM_TIMEOUT_MS 单次超时，默认 30000

import { buildPolishMessages, retentionOk, stripThink } from '../prompt.mjs';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(status, obj, extra = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS, ...extra },
  });
}

async function callLLM(messages, env) {
  const kind = (env.LLM_API_KIND || 'openai').toLowerCase();
  const base = (env.LLM_API_BASE || '').replace(/\/$/, '');
  const model = env.LLM_MODEL || 'qwen3:8b';
  const key = env.LLM_API_KEY || 'ollama';
  const timeoutMs = Number(env.LLM_TIMEOUT_MS || 30000);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let url, body;
  if (kind === 'ollama') {
    url = base.replace(/\/v1$/, '') + '/api/chat';
    body = {
      model,
      messages,
      stream: false,
      think: false, // qwen3 关闭思考链，直接产出润色结果
      options: { temperature: 0.45, top_p: 0.9, num_predict: 320 },
    };
  } else {
    url = base + '/chat/completions';
    body = {
      model,
      messages,
      stream: false,
      temperature: 0.45,
      top_p: 0.9,
      max_tokens: 320,
      enable_thinking: false, // 润色不需要推理链，提速并避免 qwen3/R1 把额度耗在思考上
    };
  }
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!resp.ok) throw new Error('LLM 返回 ' + resp.status);
    const data = await resp.json();
    const content = kind === 'ollama'
      ? (data && data.message && data.message.content)
      : (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content);
    return content ? String(content) : '';
  } finally {
    clearTimeout(timer);
  }
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/healthz') {
      return json(200, { ok: true, model: env.LLM_MODEL || '' });
    }

    if (request.method === 'POST' && url.pathname === '/polish') {
      let payload;
      try {
        payload = await request.json();
      } catch {
        return json(400, { error: 'JSON 解析失败' });
      }
      const draft = String((payload && payload.draft) || '');
      const source = String((payload && payload.source) || '');
      if (!draft) return json(200, { text: '' });

      try {
        const messages = buildPolishMessages({ source, draft });
        const out = stripThink(await callLLM(messages, env));
        // 护栏：润色后若不再像淋语（模型把暗语翻回中文），直接回退草稿
        const final = retentionOk(draft, out, source) ? out : draft;
        return json(200, { text: final });
      } catch {
        // 模型不可用 / 超时 / 解析失败 → 回退草稿，保证翻译器永远有可用输出
        return json(200, { text: draft });
      }
    }

    return json(404, { error: 'not found' });
  },
};
