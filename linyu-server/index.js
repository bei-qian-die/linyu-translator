/**
 * 淋语翻译器 Web 端（一体部署）
 *
 * 一个 Node 服务同时干两件事：
 *   1. 托管静态站（public/ ← 由 www-web 构建产物同步而来）
 *   2. POST /polish —— 调智谱 glm-4-flash 做润色
 *
 * 为什么要合在一起：智谱 open.bigmodel.cn 不返回任何 Access-Control-Allow-* 头，
 * 浏览器直连必被 CORS 拦死；把 Key 放前端又等于公开。平台一个工作区只有一个
 * 已发布应用槽位，独立代理会把静态站顶掉，所以同源一体部署是最省事的解法 ——
 * 前端只发 原文 + 草稿，Key 只在这个进程里。
 *
 * 接口：
 *   POST /polish  { source, draft } -> { text, model, ms }
 *   GET  /health                    -> { ok, model, hasKey, calls }
 *
 * 配置：环境变量 ZHIPU_API_KEY（优先）或同目录 .env
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PUBLIC_DIR = path.join(__dirname, 'public');
const PROMPT = JSON.parse(fs.readFileSync(path.join(__dirname, 'prompt.json'), 'utf8'));

// ---- 配置 ----
function readEnvFile() {
  try {
    const raw = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
    const out = {};
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
    return out;
  } catch {
    return {};
  }
}

const FILE_ENV = readEnvFile();
const API_KEY = String(process.env.ZHIPU_API_KEY || FILE_ENV.ZHIPU_API_KEY || '').trim();
const MODEL = String(process.env.ZHIPU_MODEL || FILE_ENV.ZHIPU_MODEL || 'glm-4-flash').trim();
const API_BASE = String(
  process.env.ZHIPU_API_BASE || FILE_ENV.ZHIPU_API_BASE || 'https://open.bigmodel.cn/api/paas/v4'
).replace(/\/$/, '');
const TIMEOUT_MS = Number(process.env.POLISH_TIMEOUT_MS || 25000);
const PORT = Number(process.env.PORT || 3000);

// ---- 限流：保护免费额度，防止被脚本刷 ----
const RL_WINDOW_MS = 60 * 1000;
const RL_MAX_PER_MIN = 30;
const RL_MAX_PER_DAY = 400;
const rl = new Map();

function rateLimited(ip) {
  const now = Date.now();
  let e = rl.get(ip);
  if (!e) {
    e = { min: { start: now, count: 0 }, day: { start: now, count: 0 } };
    rl.set(ip, e);
  }
  if (now - e.min.start >= RL_WINDOW_MS) {
    e.min.start = now;
    e.min.count = 0;
  }
  if (now - e.day.start >= 24 * 3600 * 1000) {
    e.day.start = now;
    e.day.count = 0;
  }
  e.min.count += 1;
  e.day.count += 1;
  if (e.min.count > RL_MAX_PER_MIN) return 'min';
  if (e.day.count > RL_MAX_PER_DAY) return 'day';
  return '';
}

let totalCalls = 0;

// ---- 提示词（与 miniprogram/cloudfunctions/polish 同源，构建时导出成 prompt.json）----
function buildMessages(source, draft) {
  const messages = [{ role: 'system', content: PROMPT.system }];
  for (const s of PROMPT.shots) {
    messages.push({ role: 'user', content: s.u });
    messages.push({ role: 'assistant', content: s.a });
  }
  messages.push({ role: 'user', content: `原文：${source || ''}\n草稿：${draft || ''}\n润色后：` });
  return messages;
}

// 模型爱把「润色后：」骨架和引号一起吐回来，先剥干净
function cleanOutput(raw) {
  let s = String(raw || '').trim();
  if (!s) return '';
  s = s.replace(/^```[a-z]*\s*/i, '').replace(/```$/, '').trim();
  const lines = s.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  const tagged = lines.filter((l) => /^润色后\s*[:：]/.test(l));
  if (tagged.length) s = tagged[tagged.length - 1].replace(/^润色后\s*[:：]\s*/, '');
  else if (lines.length) s = lines[lines.length - 1];
  s = s.replace(/^(原文|草稿)\s*[:：].*$/, '').trim();
  s = s.replace(/^["'“”‘’「」]+|["'“”‘’「」]+$/g, '').trim();
  return s.split(/\r?\n/)[0].trim();
}

// glm-4-flash 偶尔把「塔」写回「他/她」，或丢掉草稿的自称 —— 提示词压不住，这里确定性修补。
const SELF_WORDS = ['本可', '本可人儿', '本仙女', '本仙子', '本宫', '本座', '本尊', '本娘娘', '本猪妞', '奴家', '小女子', '咱家', '本淋'];

function fixPronouns(draft, out) {
  let s = out;
  const dr = String(draft || '');

  // 草稿的第三人称一律是「塔」，输出里冒出他/她 就换回来。
  // 不能加「输出里没有塔」这个前提：模型常只把第二个塔写成她，第一个还在，条件不成立就漏修。
  if (dr.includes('塔') && /[他她]/.test(s)) {
    s = s.replace(/[他她]/g, '塔');
  }

  const used = SELF_WORDS.find((w) => dr.includes(w));
  if (used && !SELF_WORDS.some((w) => s.includes(w)) && s.includes('我')) {
    s = s.replace(/我/g, used);
  }
  return s;
}

async function callZhipu(source, draft) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify({
        model: MODEL,
        messages: buildMessages(source, draft),
        temperature: 0.45,
        top_p: 0.9,
        max_tokens: 320,
        stream: false,
      }),
      signal: ctl.signal,
    });
    const text = await res.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
    if (!res.ok) {
      const msg = (data && data.error && data.error.message) || text.slice(0, 160) || `HTTP ${res.status}`;
      const err = new Error(`智谱返回 ${res.status}：${msg}`);
      err.status = res.status;
      throw err;
    }
    const content =
      data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    return fixPronouns(draft, cleanOutput(content));
  } finally {
    clearTimeout(timer);
  }
}

// ---- 静态文件 ----
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

function safeJoin(root, reqPath) {
  const decoded = decodeURIComponent(reqPath.split('?')[0]);
  const target = path.normalize(path.join(root, decoded));
  // 防目录穿越
  if (!target.startsWith(path.normalize(root))) return null;
  return target;
}

function serveStatic(req, res, pathname) {
  let filePath = safeJoin(PUBLIC_DIR, pathname);
  if (!filePath) {
    res.writeHead(403);
    res.end('forbidden');
    return;
  }
  if (pathname === '/' || pathname === '') filePath = path.join(PUBLIC_DIR, 'index.html');

  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) {
      // 目录 / 未命中 → 回 index.html（单页应用行为）
      const fallback = path.join(PUBLIC_DIR, 'index.html');
      fs.readFile(fallback, (e2, buf) => {
        if (e2) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-cache' });
        res.end(buf);
      });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    // 图片等长缓存，html/js/css 不缓存（发版即生效）
    const cache =
      ext === '.html' || ext === '.js' || ext === '.css' || ext === '.json'
        ? 'no-cache'
        : 'public, max-age=86400';
    res.writeHead(200, {
      'Content-Type': type,
      'Content-Length': st.size,
      'Cache-Control': cache,
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

// ---- 工具 ----
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

function json(res, code, body) {
  res.writeHead(code, Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, CORS));
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > 64 * 1024) {
        reject(new Error('请求体过大'));
        req.destroy();
        return;
      }
      raw += c;
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('请求体不是合法 JSON'));
      }
    });
    req.on('error', reject);
  });
}

function clientIp(req) {
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return fwd || req.socket.remoteAddress || 'unknown';
}

// ---- 服务 ----
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;

  if (pathname === '/health') {
    json(res, 200, { ok: true, model: MODEL, hasKey: Boolean(API_KEY), calls: totalCalls });
    return;
  }

  if (pathname === '/polish') {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, CORS);
      res.end();
      return;
    }
    if (req.method !== 'POST') {
      json(res, 405, { error: 'use POST' });
      return;
    }
    if (!API_KEY) {
      json(res, 500, { error: '服务端未配置 ZHIPU_API_KEY' });
      return;
    }
    const limited = rateLimited(clientIp(req));
    if (limited) {
      json(res, 429, {
        error: limited === 'min' ? '请求太频繁，歇一下再试' : '今天的润色次数用完了，明天再来',
      });
      return;
    }
    let body;
    try {
      body = await readBody(req);
    } catch (e) {
      json(res, 400, { error: e.message });
      return;
    }
    const source = String(body.source || '').slice(0, 500);
    const draft = String(body.draft || '').slice(0, 500);
    if (!source || !draft) {
      json(res, 400, { error: '需要 source 和 draft' });
      return;
    }
    const t0 = Date.now();
    try {
      const text = await callZhipu(source, draft);
      totalCalls += 1;
      if (!text) {
        json(res, 502, { error: '模型没有返回内容' });
        return;
      }
      json(res, 200, { text, model: MODEL, ms: Date.now() - t0 });
    } catch (e) {
      const aborted = e && e.name === 'AbortError';
      console.error('[polish] 失败:', aborted ? '超时' : (e && e.message));
      json(res, aborted ? 504 : 502, {
        error: aborted ? `模型超时（${TIMEOUT_MS}ms）` : String((e && e.message) || e).slice(0, 200),
      });
    }
    return;
  }

  if (req.method === 'GET' || req.method === 'HEAD') {
    serveStatic(req, res, pathname);
    return;
  }

  res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('method not allowed');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[linyu-server] listening on ${PORT}, model=${MODEL}, key=${API_KEY ? 'ok' : 'MISSING'}`);
});
