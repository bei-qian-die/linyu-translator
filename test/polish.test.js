'use strict';

// LLM 润色层单测（不联网）：用假 fetch 固定住「请求形状 / 输出清洗 / 护栏 / 失败策略」。
// 重点盯智谱直连：URL 拼错、Key 没进 header、失败静默回退，这三类都是线上才发现的坑。

const assert = require('assert');
const {
  createOpenAIChatClient,
  createOllamaClient,
  cleanPolishOutput,
  pickModel,
} = require('../src/core/llm-polish');

let failed = 0;
let passed = 0;

async function run(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`PASS [${name}]`);
  } catch (e) {
    failed += 1;
    console.log(`FAIL [${name}] ${e.message}`);
  }
}

/** 造一个假 fetch：记录最后一次请求，返回指定响应 */
function fakeFetch(reply) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    if (typeof reply === 'function') return reply(url, init);
    return reply;
  };
  fn.calls = calls;
  return fn;
}

function jsonOk(content) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content } }] }),
    text: async () => '',
  };
}

(async () => {
  await run('智谱直连：请求打到 /chat/completions 且带 Bearer Key', async () => {
    const fetchImpl = fakeFetch(jsonOk('塔来啦惹♥'));
    const c = createOpenAIChatClient({ apiKey: 'k-123', fetchImpl });
    await c.polish('他来了。', '塔来惹。');
    assert.strictEqual(fetchImpl.calls.length, 1);
    const { url, init } = fetchImpl.calls[0];
    assert.strictEqual(url, 'https://open.bigmodel.cn/api/paas/v4/chat/completions');
    assert.strictEqual(init.method, 'POST');
    assert.strictEqual(init.headers.Authorization, 'Bearer k-123');
    assert.strictEqual(init.headers['Content-Type'], 'application/json');
    const body = JSON.parse(init.body);
    assert.strictEqual(body.model, 'glm-4-flash', '默认模型应为 glm-4-flash');
    assert.strictEqual(body.stream, false);
    assert.ok(Array.isArray(body.messages) && body.messages[0].role === 'system', '必须带 system 提示词');
  });

  await run('智谱直连：自定义 base/model 生效且去掉尾斜杠', async () => {
    const fetchImpl = fakeFetch(jsonOk('塔来啦惹♥'));
    const c = createOpenAIChatClient({
      baseUrl: 'https://example.com/v1/',
      apiKey: 'k',
      model: 'glm-4-plus',
      fetchImpl,
    });
    await c.polish('他来了。', '塔来惹。');
    assert.strictEqual(fetchImpl.calls[0].url, 'https://example.com/v1/chat/completions');
    assert.strictEqual(JSON.parse(fetchImpl.calls[0].init.body).model, 'glm-4-plus');
  });

  await run('智谱直连：清掉「润色后：」骨架再返回', async () => {
    const fetchImpl = fakeFetch(jsonOk('原文：他来了。\n润色后：塔来啦惹♥'));
    const c = createOpenAIChatClient({ apiKey: 'k', fetchImpl });
    const out = await c.polish('他来了。', '塔来惹。');
    assert.strictEqual(out, '塔来啦惹♥');
  });

  await run('智谱直连：模型把淋语改回中文 → 回退草稿', async () => {
    const fetchImpl = fakeFetch(jsonOk('他来了惹'));
    const c = createOpenAIChatClient({ apiKey: 'k', fetchImpl });
    const out = await c.polish('他来了。', '塔来惹。');
    assert.strictEqual(out, '塔来惹。');
  });

  await run('智谱直连：strict 模式把 401 抛出（设置页要看到原因）', async () => {
    const fetchImpl = fakeFetch({
      ok: false,
      status: 401,
      text: async () => '{"error":{"message":"invalid api key"}}',
      json: async () => ({}),
    });
    const c = createOpenAIChatClient({ apiKey: 'bad', fetchImpl, strict: true });
    let msg = '';
    try {
      await c.polish('他来了。', '塔来惹。');
    } catch (e) {
      msg = e.message;
    }
    assert.ok(msg.includes('401'), '错误信息应带状态码，实际: ' + msg);
  });

  await run('智谱直连：非 strict 模式 401 静默回退草稿', async () => {
    const fetchImpl = fakeFetch({ ok: false, status: 401, text: async () => '', json: async () => ({}) });
    const c = createOpenAIChatClient({ apiKey: 'bad', fetchImpl });
    assert.strictEqual(await c.polish('他来了。', '塔来惹。'), '塔来惹。');
  });

  await run('智谱直连：没填 Key 直接报错（strict）', async () => {
    const c = createOpenAIChatClient({ apiKey: '', fetchImpl: fakeFetch(jsonOk('x')), strict: true });
    await assert.rejects(() => c.polish('他来了。', '塔来惹。'), /API Key/);
  });

  await run('智谱直连：超时给可读文案而不是 AbortError', async () => {
    const abortErr = new Error('aborted');
    abortErr.name = 'AbortError';
    const fetchImpl = async () => {
      throw abortErr;
    };
    const c = createOpenAIChatClient({ apiKey: 'k', fetchImpl, strict: true });
    await assert.rejects(() => c.polish('他来了。', '塔来惹。'), /超时/);
  });

  await run('Ollama 客户端：同样走 wrapPolish，脏前缀也被清掉', async () => {
    const fetchImpl = fakeFetch({
      ok: true,
      status: 200,
      json: async () => ({ message: { content: '润色后：塔来啦惹♥' } }),
      text: async () => '',
    });
    const c = createOllamaClient({ model: 'qwen3:8b-fast', fetchImpl });
    assert.strictEqual(await c.polish('他来了。', '塔来惹。'), '塔来啦惹♥');
    assert.strictEqual(fetchImpl.calls[0].url, 'http://localhost:11434/api/chat');
  });

  await run('模型挑选：显式偏好优先，其次同族 fast 变体', () => {
    assert.strictEqual(pickModel(['qwen3:8b', 'qwen3:8b-fast'], 'qwen3:8b'), 'qwen3:8b');
    assert.strictEqual(pickModel(['qwen3:8b', 'qwen3:8b-fast'], ''), 'qwen3:8b-fast');
    assert.strictEqual(pickModel([], 'x'), '');
  });

  await run('输出清洗：引号 / 复述行 / 代码块都要剥掉', () => {
    assert.strictEqual(cleanPolishOutput('```\n塔来啦惹♥\n```'), '塔来啦惹♥');
    assert.strictEqual(cleanPolishOutput('原文：他来了。\n润色后：塔来啦惹♥'), '塔来啦惹♥');
    assert.strictEqual(cleanPolishOutput('「塔来啦惹♥」'), '塔来啦惹♥');
  });

  console.log(`\n润色层单测：${passed} 通过${failed ? '，' + failed + ' 失败' : ''}`);
  if (failed) process.exitCode = 1;
})();
