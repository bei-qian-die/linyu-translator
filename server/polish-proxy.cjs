#!/usr/bin/env node
'use strict';

/*
 * 淋语翻译器 · 云端润色代理（Phase 2 参考实现，零依赖本地版）
 * ------------------------------------------------------------------
 * Web / 小程序端没有本地模型，翻译器把「规则引擎草稿」发到这个代理，
 * 由代理调用一个大模型做流畅度润色，再回传 { text }。
 *
 * 设计要点：
 *  1. API Key 只存在服务端（环境变量），永不下发前端；
 *  2. 提示词与护栏来自 server/prompt.mjs（服务端唯一真源），与 Cloudflare
 *     Worker、Vercel 函数共用同一份代码，保证「只润色不翻译、保留淋语词根」
 *     的策略两端一致；
 *  3. 零运行时依赖：用 Node 18+ 内置 http + 全局 fetch。
 *
 * 环境变量：
 *   PORT            监听端口，默认 8787
 *   LLM_API_KIND   后端类型：'openai'（默认，OpenAI 兼容 /v1/chat/completions）或 'ollama'（本机 /api/chat）
 *   LLM_API_BASE   大模型 base。openai 模式填到 /v1（如 http://localhost:11434/v1）；
 *                   ollama 模式填到根（如 http://localhost:11434），脚本会自动拼 /api/chat
 *   LLM_API_KEY    大模型 API Key（Ollama 本地可不填，默认 'ollama'）
 *   LLM_MODEL      模型名，默认 qwen3:8b
 *   LLM_TIMEOUT_MS 单次超时，默认 30000
 *
 * 本地自测：LLM_API_KIND=ollama LLM_API_BASE=http://localhost:11434 LLM_MODEL=qwen3:8b
 *           （ollama 模式走原生 /api/chat 并关闭思考链，避免 qwen3 把额度耗在 reasoning 上）
 * 生产部署：LLM_API_KIND=openai LLM_API_BASE=https://<你的提供商>/v1 LLM_API_KEY=<key> LLM_MODEL=<模型>
 *           Web / 微信小程序需把本服务域名加进合法请求域名（HTTPS）。
 *
 * 接口：
 *   POST /polish      body { source, draft }  →  { text }
 *   GET  /healthz     →  { ok: true }
 */

const http = require('http');

const PORT = Number(process.env.PORT || 8787);
const TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS || 30000);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

let PF = null; // 动态 import 加载的 server/prompt.mjs

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...CORS });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 1_000_000) {
        reject(new Error('请求体过大'));
        req.destroy();
        return;
      }
      data += chunk;
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

async function callLLM(messages) {
  const kind = (process.env.LLM_API_KIND || 'openai').toLowerCase();
  const base = (process.env.LLM_API_BASE || 'http://localhost:11434/v1').replace(/\/$/, '');
  const model = process.env.LLM_MODEL || 'qwen3:8b';
  const key = process.env.LLM_API_KEY || 'ollama';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
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
      enable_thinking: false, // 关闭推理链：提速并避免 qwen3/R1 把额度耗在思考上
    };
  }
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify(body),
      signal: controller.signal,
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

async function handlePolish(req, res) {
  let raw;
  try {
    raw = await readBody(req);
  } catch (e) {
    return sendJson(res, 400, { error: '无法读取请求体：' + e.message });
  }
  let payload;
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    return sendJson(res, 400, { error: 'JSON 解析失败' });
  }
  const draft = String(payload.draft || '');
  const source = String(payload.source || '');
  if (!draft) return sendJson(res, 200, { text: '' });

  try {
    const messages = PF.buildPolishMessages({ source, draft });
    const out = PF.stripThink(await callLLM(messages));
    // 护栏：润色后若不再像淋语（模型把暗语翻回中文），直接回退草稿
    const final = PF.retentionOk(draft, out, source) ? out : draft;
    return sendJson(res, 200, { text: final });
  } catch (e) {
    // 模型不可用 / 超时 / 解析失败 → 回退草稿，保证翻译器永远有可用输出
    return sendJson(res, 200, { text: draft });
  }
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    res.end();
    return;
  }
  if (req.method === 'GET' && req.url === '/healthz') {
    return sendJson(res, 200, { ok: true, model: process.env.LLM_MODEL || '' });
  }
  if (req.method === 'POST' && req.url === '/polish') {
    return handlePolish(req, res);
  }
  // 根路径给个简单说明，方便确认服务活着
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    return sendJson(res, 200, {
      service: 'linyu-polish-proxy',
      usage: 'POST /polish  body: { source, draft }  →  { text }',
      model: process.env.LLM_MODEL || '',
    });
  }
  sendJson(res, 404, { error: 'not found' });
});

// 提示词 / 护栏的服务端唯一真源在 server/prompt.mjs（与 Cloudflare Worker、Vercel 函数共用）。
// CJS 无法直接 require ESM，这里用动态 import 加载，加载完成后再启动监听。
import('./prompt.mjs')
  .then((m) => {
    PF = m;
    server.listen(PORT, () => {
      console.log(`[linyu-polish-proxy] 已启动：http://localhost:${PORT}/polish`);
      console.log(`[linyu-polish-proxy] 后端 = ${(process.env.LLM_API_KIND || 'openai')}  ·  模型 = ${process.env.LLM_MODEL || 'qwen3:8b'}  ·  LLM_API_BASE = ${process.env.LLM_API_BASE || 'http://localhost:11434/v1'}`);
    });
  })
  .catch((e) => {
    console.error('加载 server/prompt.mjs 失败：', e);
    process.exit(1);
  });
