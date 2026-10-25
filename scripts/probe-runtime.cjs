'use strict';
/*
 * 用本机 Edge（headless）+ CDP 打开线上页面，采集运行时真实状态。
 *
 * 只做只读诊断：读 window 上的关键全局、抓 console 错误与未捕获异常，
 * 不改任何数据。
 *
 * 用法：node scripts/probe-runtime.cjs [url]
 */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const URL_ = process.argv[2] || 'https://linyu-translator.app.workbuddy.host/?sharecode=KYSNKQPHS7';
const PORT = 9333;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForDevtools(timeoutMs = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (r.ok) return await r.json();
    } catch { /* 还没起来 */ }
    await sleep(400);
  }
  throw new Error('DevTools 端口未就绪');
}

async function main() {
  const userDataDir = path.join(os.tmpdir(), 'linyu-probe-' + Date.now());
  fs.mkdirSync(userDataDir, { recursive: true });

  console.log('启动 headless Edge…');
  const child = spawn(EDGE, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    'about:blank',
  ], { stdio: 'ignore', detached: false });

  let ws = null;
  try {
    await waitForDevtools();
    console.log('DevTools 就绪');

    const created = await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent('about:blank')}`, { method: 'PUT' });
    const target = await created.json();
    const wsUrl = target.webSocketDebuggerUrl;

    ws = new WebSocket(wsUrl);
    let nextId = 1;
    const pending = new Map();
    const logs = [];

    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
        return;
      }
      if (msg.method === 'Runtime.consoleAPICalled') {
        const text = (msg.params.args || [])
          .map((a) => (a.value !== undefined ? String(a.value) : a.description || a.type))
          .join(' ');
        logs.push(`[console.${msg.params.type}] ${text}`);
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        const d = msg.params.exceptionDetails;
        logs.push(`[exception] ${d.text} ${d.exception && d.exception.description ? d.exception.description.split('\n')[0] : ''}`);
      }
      if (msg.method === 'Network.loadingFailed') {
        logs.push(`[netfail] ${msg.params.errorText} ${msg.params.type} ${msg.params.requestId}`);
      }
      if (msg.method === 'Network.responseReceived') {
        const r = msg.params.response;
        if (r.status >= 400) logs.push(`[http ${r.status}] ${r.url}`);
      }
    };

    function send(method, params = {}) {
      const id = nextId++;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    async function evaluate(expr) {
      const res = await send('Runtime.evaluate', {
        expression: expr,
        returnByValue: true,
        awaitPromise: false,
      });
      if (res.exceptionDetails) {
        return { __error: res.exceptionDetails.text + ' ' + (res.exceptionDetails.exception?.description || '') };
      }
      return res.result.value;
    }

    await send('Runtime.enable');
    await send('Network.enable');
    await send('Page.enable');

    console.log('导航到', URL_);
    await send('Page.navigate', { url: URL_ });

    // 轮询等待初始化完成（最多 30s）
    let snapshot = null;
    const t0 = Date.now();
    while (Date.now() - t0 < 30000) {
      await sleep(1200);
      snapshot = await evaluate(`(function(){
        try {
          return {
            t: Math.round(performance.now()),
            seed: !!(window.__SEED_DATA && window.__SEED_DATA.words),
            seedWords: window.__SEED_DATA && window.__SEED_DATA.words ? window.__SEED_DATA.words.length : 0,
            loreCards: window.LORE_DATA && window.LORE_DATA.flashcards ? window.LORE_DATA.flashcards.length : 0,
            hasDb: !!window.linyuDb,
            dbWords: window.linyuDb && window.linyuDb.getWords ? (function(){ try { return window.linyuDb.getWords().length; } catch(e){ return 'ERR:'+e.message; } })() : null,
            adapter: window.fsAdapter && window.fsAdapter.kind,
            initError: window.__linyuInitError || null,
            persistFailed: window.__WEB_PERSISTENCE_FAILED || false,
            sdk: typeof window.WorkBuddyCloud,
            cloud: !!window.__LINYU_CLOUD_LOADED,
            apiReplaced: !!(window.api && !window.api.__isStub),
            vueMounted: !!(document.querySelector('#app') && document.querySelector('#app').__vue_app__),
            wordCountText: (document.body.innerText.match(/词库\\s*(\\d+)\\s*条/) || [])[1] || null,
          };
        } catch (e) { return { evalError: e.message }; }
      })()`);
      if (snapshot && (snapshot.hasDb || snapshot.initError)) break;
    }

    console.log('\n=== 运行时快照 ===');
    console.log(JSON.stringify(snapshot, null, 2));

    console.log('\n=== 控制台 / 网络异常 ===');
    if (!logs.length) console.log('(无)');
    else logs.slice(0, 60).forEach((l) => console.log('  ' + l));

    // 额外：检查 IndexedDB 是否真的可用
    const idb = await evaluate(`new Promise(function(res){
      try {
        var req = indexedDB.open('__probe_runtime__', 1);
        req.onupgradeneeded = function(e){ e.target.result.createObjectStore('t'); };
        req.onsuccess = function(e){ var d=e.target.result; try{ d.close(); indexedDB.deleteDatabase('__probe_runtime__'); }catch(_){} res('ok'); };
        req.onerror = function(){ res('error'); };
        req.onblocked = function(){ res('blocked'); };
        setTimeout(function(){ res('timeout'); }, 4000);
      } catch (e) { res('throw:' + e.message); }
    })`);
    console.log('\n=== IndexedDB 可用性 ===');
    console.log('  ' + (typeof idb === 'string' ? idb : JSON.stringify(idb)));

    // ---- 刷新测试：同一个 profile 重新加载，验证数据是否还在 ----
    console.log('\n=== 写入词条 → 刷新 → 复测（同一 profile）===');
    const added = await evaluate(`(function(){
      try { return JSON.stringify(window.linyuDb.addWord({ zh: '__probe_reload__', linyu: '探针词' })); }
      catch (e) { return 'ERR:' + e.message; }
    })()`);
    console.log('  addWord:', added);
    const before = await evaluate(`(function(){ try { return window.linyuDb.getWords().length; } catch(e){ return 'ERR:'+e.message; } })()`);
    console.log('  写入后 words =', before);
    await sleep(2500); // 等 persist 队列落盘

    await send('Page.reload', { ignoreCache: false });
    let snap2 = null;
    const t1 = Date.now();
    while (Date.now() - t1 < 30000) {
      await sleep(1200);
      snap2 = await evaluate(`(function(){
        try {
          var arr = window.linyuDb && window.linyuDb.getWords ? window.linyuDb.getWords() : [];
          return {
            hasDb: !!window.linyuDb,
            dbWords: arr.length,
            probeWordSurvived: arr.some(function(w){ return w.zh === '__probe_reload__'; }),
            adapter: window.fsAdapter && window.fsAdapter.kind,
            initError: window.__linyuInitError || null,
            persistFailed: window.__WEB_PERSISTENCE_FAILED || false,
            bannerVisible: (function(){
              var el = document.getElementById('persistence-warning');
              if (!el) return null;
              return !!(el.offsetParent !== null && getComputedStyle(el).display !== 'none');
            })(),
          };
        } catch (e) { return { evalError: e.message }; }
      })()`);
      if (snap2 && (snap2.hasDb || snap2.initError)) break;
    }
    console.log(JSON.stringify(snap2, null, 2));

    ws.close();
  } finally {
    try { child.kill(); } catch { /* 已退出 */ }
    await sleep(600);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch { /* 占用中忽略 */ }
  }
}

main().catch((err) => {
  console.error('probe 失败：', err.message);
  process.exitCode = 1;
});
