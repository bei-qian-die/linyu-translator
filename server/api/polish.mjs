// 淋语翻译器 · 云端润色代理（Vercel 函数版本 / Node 运行时）
// ------------------------------------------------------------------
// 一键部署：把本 server/ 目录作为 Vercel 项目根（Root Directory = server/），
// Vercel 会自动识别 api/polish.mjs 为 Serverless Function，路由即 /api/polish。
// 打包时 ../prompt.mjs 会被一起打包；API Key 只存在 Vercel 环境变量里，永不下发前端。
//
// 环境变量（Vercel 后台 Project → Environment Variables 配置）：
//   LLM_API_KIND   'openai'（默认）或 'ollama'
//   LLM_API_BASE   大模型 base（openai 模式填到 /v1；ollama 模式填到根）
//   LLM_API_KEY    API Key（敏感，建议用 Vercel 加密变量）
//   LLM_MODEL      模型名
//   LLM_TIMEOUT_MS 单次超时，默认 30000

import { buildPolishMessages, retentionOk, stripThink } from '../prompt.mjs';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function sendJson(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...CORS });
  res.end(JSON.stringify(obj));
}

// 兜底读取请求体：Vercel 会自动把 JSON 解析进 req.body，
// 但其他运行时（自建 Node / 本地调试）可能不会，这里直接读原始流。
function readRawBody(req) {
  return new Promise((resolve, reject) => {
    if (typeof req.on !== 'function') return resolve('');
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => resolve(raw));
    req.on('error', reject);
  });
}

async function callLLM(messages) {
  const kind = (process.env.LLM_API_KIND || 'openai').toLowerCase();
  const base = (process.env.LLM_API_BASE || '').replace(/\/$/, '');
  const model = process.env.LLM_MODEL || 'qwen3:8b';
  const key = process.env.LLM_API_KEY || 'ollama';
  const timeoutMs = Number(process.env.LLM_TIMEOUT_MS || 30000);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let url, body;
  if (kind === 'ollama') {
    url = base.replace(/\/v1$/, '') + '/api/chat';
    body = {
      model,
      messages,
      stream: false,
      think: false,
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
      enable_thinking: false,
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

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    return res.end();
  }
  if (req.method === 'GET') {
    return sendJson(res, 200, { ok: true, model: process.env.LLM_MODEL || '' });
  }
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'method not allowed' });
  }

  let payload = req.body;
  if (payload === undefined || payload === null || payload === '') {
    try {
      payload = await readRawBody(req);
    } catch {
      return sendJson(res, 400, { error: '读取请求体失败' });
    }
  }
  try {
    if (Buffer.isBuffer(payload)) payload = payload.toString('utf8');
    if (typeof payload === 'string') payload = JSON.parse(payload || '{}');
  } catch {
    return sendJson(res, 400, { error: 'JSON 解析失败' });
  }

  const draft = String((payload && payload.draft) || '');
  const source = String((payload && payload.source) || '');
  if (!draft) return sendJson(res, 200, { text: '' });

  try {
    const messages = buildPolishMessages({ source, draft });
    const out = stripThink(await callLLM(messages));
    // 护栏：润色后若不再像淋语（模型把暗语翻回中文），直接回退草稿
    const final = retentionOk(draft, out, source) ? out : draft;
    return sendJson(res, 200, { text: final });
  } catch {
    // 模型不可用 / 超时 / 解析失败 → 回退草稿，保证翻译器永远有可用输出
    return sendJson(res, 200, { text: draft });
  }
}
