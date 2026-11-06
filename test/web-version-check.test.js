'use strict';

/*
 * 版本自检（src/web/versionCheck.js）的行为门禁。
 *
 * 背景：覆盖发布后手机浏览器缓存旧 HTML/JS，用户看不到新内容。修复靠两件事：
 *   1. 资源 URL 带 ?v=<buildTag>（build-web.mjs）
 *   2. 页面发现 HTML 的 data-build 与 version.json 的 build 不一致时，自动带 _v 参数重载一次
 * 第 2 条一旦写错就会无限刷新，所以这里把四条分支都锁住。
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const CODE = fs.readFileSync(path.join(__dirname, '..', 'src', 'web', 'versionCheck.js'), 'utf8');
const HREF = 'https://linyu-translator.app.workbuddy.host/?sharecode=KYSNKQPHS7';

function run({ pageBuild, serverInfo, stored = {}, fetchFails = false }) {
  const calls = { replace: [], store: Object.assign({}, stored) };
  const win = {
    fetch: fetchFails
      ? () => Promise.reject(new Error('offline'))
      : () => Promise.resolve({ ok: true, json: () => Promise.resolve(serverInfo) }),
    location: { search: '?sharecode=KYSNKQPHS7', href: HREF, hash: '', replace: (u) => calls.replace.push(u) },
    sessionStorage: {
      getItem: (k) => (Object.prototype.hasOwnProperty.call(calls.store, k) ? calls.store[k] : null),
      setItem: (k, v) => { calls.store[k] = v; },
    },
  };
  const sandbox = {
    window: win,
    document: { documentElement: { getAttribute: (name) => (name === 'data-build' ? pageBuild : null) } },
    Date,
    console,
  };
  vm.createContext(sandbox);
  vm.runInContext(CODE, sandbox, { filename: 'versionCheck.js' });
  return calls;
}

async function settle() {
  // fetch + json + then 三层微任务
  for (let i = 0; i < 6; i += 1) await new Promise((r) => setImmediate(r));
}

let n = 0;
function check(name, fn) {
  Promise.resolve()
    .then(fn)
    .then(() => { n += 1; console.log('PASS', name); })
    .catch((e) => { console.error('FAIL', name, e.message); process.exitCode = 1; });
}

check('版本一致时不刷新', async () => {
  const c = run({ pageBuild: '1.38.0-abc12345', serverInfo: { version: '1.38.0', build: '1.38.0-abc12345' } });
  await settle();
  assert.strictEqual(c.replace.length, 0, '一致却触发了重载');
});

check('版本不一致时自动重载且 URL 带 _v', async () => {
  const c = run({ pageBuild: '1.38.0-OLD00000', serverInfo: { version: '1.38.0', build: '1.38.0-NEW00000' } });
  await settle();
  assert.strictEqual(c.replace.length, 1, '应且只应重载一次');
  assert(c.replace[0].startsWith(HREF + '&_v=1.38.0-NEW00000'), '重载 URL 缺少 _v 参数：' + c.replace[0]);
  assert.strictEqual(c.store['linyu.build.reload.1.38.0-NEW00000'], '1', '应写入去重标记');
});

check('同一会话已重载过则不再循环', async () => {
  const c = run({
    pageBuild: '1.38.0-OLD00000',
    serverInfo: { version: '1.38.0', build: '1.38.0-NEW00000' },
    stored: { 'linyu.build.reload.1.38.0-NEW00000': '1' },
  });
  await settle();
  assert.strictEqual(c.replace.length, 0, '去重标记没生效，会来回刷新');
});

check('兼容旧版 version.json（只有 version 无 build）', async () => {
  const c = run({ pageBuild: '1.38.0-abc12345', serverInfo: { version: '1.38.0' } });
  await settle();
  assert.strictEqual(c.replace.length, 0, '旧版 version.json 被误判成版本不一致');
});

check('版本探测失败时不影响页面', async () => {
  const c = run({ pageBuild: '1.38.0-abc12345', serverInfo: null, fetchFails: true });
  await settle();
  assert.strictEqual(c.replace.length, 0, '网络失败却触发了重载');
});

process.on('beforeExit', () => {
  if (process.exitCode) console.error(`版本自检：${n} 通过，有失败`);
  else console.log(`版本自检：${n}/5 全部通过`);
});
