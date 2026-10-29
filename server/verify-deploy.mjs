// 验证两个 serverless 入口的逻辑正确性（直接 import 模块，用真实 Ollama 后端）。
// 不依赖部署，仅确认：提示词/护栏、CF Worker fetch、Vercel handler 三条路径都能跑通。
import assert from 'node:assert';
import { buildPolishMessages, retentionOk } from './prompt.mjs';
import worker from './cloudflare/worker.js';
import polishHandler from './api/polish.mjs';

async function main() {
  // 1) 提示词 + 护栏单元断言
  const msgs = buildPolishMessages({ source: '他来了', draft: '塔来惹' });
  assert(msgs.length >= 5, '提示词应含 system + 2 few-shot + user');
  assert.strictEqual(retentionOk('塔来惹', '塔来啦惹', '他来了'), true, '合格润色应放行');
  assert.strictEqual(retentionOk('塔来惹', '他来了', '他来了'), false, '翻回中文应回退');
  console.log('✅ prompt.mjs 单元断言通过');

  const env = {
    LLM_API_KIND: 'ollama',
    LLM_API_BASE: 'http://localhost:11434',
    LLM_API_KEY: 'ollama',
    LLM_MODEL: 'qwen3:8b',
  };
  const draft = '塔来惹，塔塔缩塔喜翻塔塔厚。';
  const source = '他来了，他说他喜欢她。';

  // 2) Cloudflare Worker：用全局 Request/Response 模拟一次 /polish 调用
  const cfReq = new Request('https://x.example/polish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source, draft }),
  });
  const cfRes = await worker.fetch(cfReq, env);
  const cfJson = await cfRes.json();
  console.log('✅ Cloudflare Worker =>', cfJson.text);
  assert(typeof cfJson.text === 'string' && cfJson.text.length > 0, 'CF Worker 应返回 text');

  // 3) Vercel 函数：用极简 mock req/res 模拟 Node 风格 handler
  //    Vercel 入口读 process.env，这里注入与 CF 相同的大模型后端
  process.env.LLM_API_KIND = env.LLM_API_KIND;
  process.env.LLM_API_BASE = env.LLM_API_BASE;
  process.env.LLM_API_KEY = env.LLM_API_KEY;
  process.env.LLM_MODEL = env.LLM_MODEL;
  const res = {
    statusCode: 0,
    headers: {},
    body: '',
    writeHead(s, h) { this.statusCode = s; this.headers = h || {}; return this; },
    end(b) { this.body = b; return this; },
  };
  const req = { method: 'POST', url: '/api/polish', body: { source, draft } };
  await polishHandler(req, res);
  const vJson = JSON.parse(res.body);
  console.log('✅ Vercel Function =>', vJson.text);
  assert(typeof vJson.text === 'string' && vJson.text.length > 0, 'Vercel 应返回 text');

  console.log('\n🎉 三条路径（本地代理 / CF Worker / Vercel 函数）逻辑均验证通过');
}

main().catch((e) => { console.error('验证失败:', e); process.exit(1); });
