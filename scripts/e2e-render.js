'use strict';

// 渲染层冒烟测试：真实启动 Electron（独立 user-data-dir + CDP），在渲染层确认——
//   1. vendor/vue.global.prod.js 加载成功（Vue 存在）
//   2. Vue 已挂载 #app（1.12.4~1.16.0 因渲染层资源 404，Vue 从未挂载，窗口显示未渲染的 {{ }} 模板）
//   3. 页面文本里没有裸 {{ }} 插值残留
//   4. window.api 是 preload 的 IPC 真身（entry.js 的桌面守卫生效，没有被本地 sql.js 版 api 覆盖）
//   5. 词库页数据经 IPC 可读（listWords 返回非空）
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const PORT = 9347;
const PROFILE = path.join(os.tmpdir(), 'ly-render-smoke');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  fs.rmSync(PROFILE, { recursive: true, force: true });
  const appDir = path.join(__dirname, '..');
  const child = spawn(
    path.join(appDir, 'node_modules', 'electron', 'dist', 'electron.exe'),
    ['.', `--user-data-dir=${PROFILE}`, `--remote-debugging-port=${PORT}`, '--no-sandbox'],
    {
      cwd: appDir,
      stdio: 'ignore',
      // 宿主终端可能带着 ELECTRON_RUN_AS_NODE=1 / NODE_OPTIONS（WorkBuddy 等），
      // 不清掉 electron.exe 会退化成纯 Node 跑 main.js，直接 TypeError
      env: Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== 'ELECTRON_RUN_AS_NODE' && k !== 'NODE_OPTIONS')),
    }
  );

  const fail = async (msg) => {
    child.kill();
    console.error('FAIL:', msg);
    process.exit(1);
  };

  try {
    let page = null;
    for (let i = 0; i < 60 && !page; i++) {
      await sleep(500);
      try {
        const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
        const list = await res.json();
        page = list.find((t) => t.type === 'page' && t.url.includes('index.html'));
      } catch { /* 调试端口还没起来 */ }
    }
    if (!page) await fail('没能连上 Electron 调试端口');

    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((r, j) => { ws.addEventListener('open', r, { once: true }); ws.addEventListener('error', j); });
    let mid = 0;
    const pending = new Map();
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    });
    function call(method, params) {
      return new Promise((r) => { const id = ++mid; pending.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
    }
    async function expr(js) {
      const r = await call('Runtime.evaluate', { expression: js, returnByValue: true, awaitPromise: true });
      if (r.result && r.result.exceptionDetails) throw new Error('渲染层异常: ' + JSON.stringify(r.result.exceptionDetails.exception));
      return r.result.result.value;
    }
    await call('Runtime.enable');

    await sleep(1500); // 等首轮 IPC / 渲染

    const vueLoaded = await expr('typeof Vue !== "undefined" && typeof Vue.createApp === "function"');
    if (!vueLoaded) await fail('Vue 未加载（vendor 404？）');

    const mounted = await expr('!!document.querySelector("#app") && !!document.querySelector("#app").__vue_app__');
    if (!mounted) await fail('Vue 未挂载 #app');

    const bareMustache = await expr('(document.body.innerText.match(/\\{\\{[^}]*\\}\\}/g) || []).length');
    if (bareMustache > 0) await fail(`页面有 ${bareMustache} 处未渲染的 {{ }} 模板`);

    const apiKind = await expr('(function(){ if (typeof window.api !== "object" || !window.api) return "missing"; if (window.api.__isStub) return "stub"; return "preload"; })()');
    if (apiKind !== 'preload') await fail(`window.api 应为 preload IPC 真身，实际: ${apiKind}`);

    // IPC handler 由 main.js 的 wrap() 包成 { ok, data }（app.js 的 call() 负责拆包），这里同样拆包断言
    const unwrap = '({ ok: r.ok, err: r.error, rows: Array.isArray(r.data) ? r.data : [] })';
    const words = await expr(`window.api.listWords().then(r => { const u = ${unwrap}; return u.err ? -1 : u.rows.length; })`);
    if (words < 0) await fail('IPC listWords 返回 ok=false');
    if (!(words > 0)) await fail(`IPC listWords 返回 ${words} 条，应非空`);

    const heroes = await expr(`window.api.listHeroes().then(r => { const u = ${unwrap}; return u.err ? -1 : u.rows.length; })`);
    if (!(heroes > 0)) await fail(`IPC listHeroes 返回 ${heroes} 条，应非空`);

    console.log(`OK: Vue 挂载正常，无裸模板；api=preload(IPC)，词库 ${words} 条 / 人物 ${heroes} 条`);
    child.kill();
    process.exit(0);
  } catch (err) {
    await fail(err && err.message);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
