// 演示 Web / 小程序端走「云端代理」的润色链路（与浏览器里的代码路径一致）：
//   1) 规则引擎产出 disambiguate 草稿（Phase 1）
//   2) createHttpProxyClient 把 {source, draft} 发到部署好的代理（server/polish-proxy.cjs）
//   3) 代理调大模型润色，客户端用 retentionOk 兜底，失败回退草稿
//
// 用法：
//   先启动代理（本地用本机 Ollama）：
//     LLM_API_KIND=ollama LLM_API_BASE=http://localhost:11434 LLM_API_KEY=ollama LLM_MODEL=qwen3:8b node server/polish-proxy.cjs
//   再跑本演示：
//     node server/demo-web-client.cjs
//     PROXY_URL=https://你的域名/polish node server/demo-web-client.cjs   # 生产代理
'use strict';

const path = require('path');
const ROOT = path.join(__dirname, '..');
const { translateText } = require(path.join(ROOT, 'src/core/translator.js'));
const { createHttpProxyClient } = require(path.join(ROOT, 'src/core/llm-polish.js'));
const seed = require(path.join(ROOT, 'src/core/seed.json'));

const PROXY = process.env.PROXY_URL || 'http://localhost:8787/polish';

const samples = [
  '他来了，他说他喜欢她。',
  '你今天真好看，我喜欢你，你觉得我怎么样？',
  '为什么你还不来吃饭呢',
  '我好想你呀，你什么时候回来',
  '今天天气真好，我们一起去玩吧',
];

(async () => {
  const client = createHttpProxyClient({ baseUrl: PROXY });
  console.log('代理可用性 isAvailable =', await client.isAvailable());
  console.log('代理地址 =', PROXY, '\n');

  for (const src of samples) {
    const draft = translateText(src, { words: seed.words, rules: seed.rules, disambiguate: true });
    const polished = await client.polish(src, draft);
    const changed = polished !== draft;
    console.log('原文  :', src);
    console.log('草稿  :', draft);
    console.log('润色后:', polished, changed ? '  ✅已润色' : '  （回退/无变化）');
    console.log('--------------------------------------------------');
  }
})().catch((e) => {
  console.error('演示失败:', e);
  process.exit(1);
});
