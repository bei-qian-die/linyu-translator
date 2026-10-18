'use strict';

/*
 * 浏览器 / Capacitor WebView 入口
 *
 * 加载顺序由 index.html 内 <script> 标签保证：本文件应当最后加载（在 lore*.js / db.js 之后）。
 *
 * 关键：渲染层 src/renderer/app.js 在 setup() / onMounted 里同步调 window.api.*，
 * 而本入口走 fetch('seed.json') + initSqlJs() + createDb() 的异步链，
 * 异步完成前 window.api 还是 undefined，会抛 "Cannot read properties of undefined"。
 *
 * 这里在 IIFE 顶部立刻放一个 Proxy 占位 window.api。所有调用先返回一个 pending
 * Promise，等真实 api 装好后再换。调用方 `await call(window.api.foo())` 形态完全兼容。
 *
 * 职责：
 *   1. 立即挂 window.api 占位（避免渲染层先踩到 undefined）
 *   2. 挂上 fsAdapter（capacitor 后端）
 *   3. 挂上 linyuScrypt（scrypt-js 后端）
 *   4. 用 initSqlJs 初始化 SQL，并用 db.js 的 createDb 创建库
 *   5. 用 auth.js 的 createAuth 创建认证
 *   6. 用 api.js 的 createApi 替换占位为真正的 window.api
 *   7. 派 linyu-ready 事件（兼容旧逻辑）
 */

(function () {
  // ---- 0. 占位 window.api ----
  // db 真正准备好之前渲染层就会同步调 api，先给个 Proxy 让所有调用排队
  if (!window.api || typeof window.api.then !== 'function') {
    let __resolveReady;
    const __ready = new Promise((resolve) => { __resolveReady = resolve; });
    window.__linyuApiReady = __ready;
    const __makeStub = () => new Proxy({}, {
      get(_target, prop) {
        // 让 'then' / 'catch' 等元属性穿透，不要被当成方法
        if (typeof prop === 'symbol' || prop === 'then' || prop === 'catch' || prop === 'finally') {
          return undefined;
        }
        if (prop === 'isCapacitor' || prop === '__isStub') {
          if (prop === '__isStub') return true;
          return function () { return !!window.Capacitor && !!window.Capacitor.isNativePlatform; };
        }
        if (prop === 'appendLog' || prop === 'onIoChange' || prop === 'onUndoChange') {
          // 这些回调注册类调用要直接返回函数（让渲染层点 .onIoChange(cb)→ 拿到函数再点），不能用 pending promise
          return () => {};
        }
        return function () { return __ready.then((real) => real[prop].apply(real, arguments)); };
      },
    });
    window.api = __makeStub();
    window.__replaceApi = (realApi) => { window.api = realApi; try { __resolveReady(realApi); } catch {} };
  }

  function isCapacitor() {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  }

  // ---- 1. fsAdapter：根据平台选择后端。本文件被同时承担 Electron WebView 与 Capacitor WebView。
  // style.css 里所有横竖屏/触屏规则都挂在 body[data-mobile] 上，只有确实是原生 WebView 才打这个标记，
  // 桌面 exe 加载同一份 CSS 也不会变样。
  if (isCapacitor()) document.body.dataset.mobile = '1';

  if (!window.fsAdapter) {
    if (isCapacitor()) {
      window.fsAdapter = linyuFsAdapter.makeCapacitor();
    } else {
      // 跑在桌面 Chromium / 调试时的兜底：用内存 + sessionStorage，只能撑单个会话
      window.fsAdapter = {
        kind: 'memory',
        dirOf: (p) => { const i = String(p).lastIndexOf('/'); return i < 0 ? '' : p.slice(0, i); },
        basenameOf: (p) => { const i = String(p).lastIndexOf('/'); return i < 0 ? p : p.slice(i + 1); },
        read: async (p) => {
          const s = window.sessionStorage.getItem('linyu.fs.' + p);
          return s ? base64ToBytes(s) : new Uint8Array(0);
        },
        write: async (p, bytes) => {
          window.sessionStorage.setItem('linyu.fs.' + p, bytesToBase64(bytes));
        },
        unlink: async (p) => { window.sessionStorage.removeItem('linyu.fs.' + p); },
        exists: async (p) => { return window.sessionStorage.getItem('linyu.fs.' + p) != null; },
        rename: async (from, to) => {
          const v = window.sessionStorage.getItem('linyu.fs.' + from);
          if (v == null) return;
          window.sessionStorage.setItem('linyu.fs.' + to, v);
          window.sessionStorage.removeItem('linyu.fs.' + from);
        },
        copy: async (from, to) => {
          const v = window.sessionStorage.getItem('linyu.fs.' + from);
          if (v != null) window.sessionStorage.setItem('linyu.fs.' + to, v);
        },
        readdir: async () => [],
        stat: async (p) => {
          const v = window.sessionStorage.getItem('linyu.fs.' + p);
          return { size: v ? (() => { try { return atob(v).length; } catch { return 0; } })() : 0, mtime: new Date().toISOString() };
        },
        mkdirp: async () => {},
      };
    }
  }
  function bytesToBase64(bytes) {
    const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
    let s = '';
    for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
    return btoa(s);
  }
  function base64ToBytes(b64) {
    const s = atob(String(b64 || ''));
    const u = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
    return u;
  }

  // ---- 2. linyuScrypt：由 src/mobile/scrypt.js 的 UMD 分支挂上（浏览器走 scrypt-js）----

  // ---- 3. 等待 initSqlJs（sql-wasm.js 加载完）----
  function whenSqlReady() {
    if (typeof window.initSqlJs === 'function') return Promise.resolve();
    return new Promise((resolve) => {
      const t = setInterval(() => {
        if (typeof window.initSqlJs === 'function') { clearInterval(t); resolve(); }
      }, 50);
    });
  }

  // ---- 4. 库主入口：把 createDb 包成 promise ----
  function whenDBReady() {
    if (window.linyuDb) return Promise.resolve(window.linyuDb);
    if (!window.createDb) return Promise.reject(new Error('db.js 未加载（createDb 不在 window 上）'));
    if (typeof window.initSqlJs !== 'function') return Promise.reject(new Error('sql.js 未加载'));
    return whenSqlReady().then(() => {
      const filePath = 'linyu.db';
      // 优先级：内联的 seed-data.js（同步、可靠） > fetch('seed.json')（调试时偶发被模拟器 WebView 拦）
      let seedData = window.__SEED_DATA;
      const seedPromise = seedData
        ? Promise.resolve(seedData)
        : fetch('seed.json').then((r) => r.text()).then((t) => JSON.parse(t));
      return seedPromise.then((sd) => {
        seedData = sd;
        return window.createDb({
          filePath,
          seed: seedData,
          lore: window.LORE_DATA,
          version: window.LINYU_VERSION || 'mobile-dev',
        });
      }).then((db) => {
        window.linyuDb = db;
        // 单次内容迁移：APK 版本变了、或同版本下内置内容变了（seed/lore 指纹）都要补种。
        // 只比版本号不行：老设备存的是上一个构建写死的版本串，之后加多少词条都进不来。
        try {
          const hash = window.LINYU_CONTENT_HASH || '';
          if (db.getSetting('content.version') !== db.version || db.getSetting('content.hash') !== hash) {
            const r = db.upgradeSeed();
            db.setSetting('content.version', db.version);
            db.setSetting('content.hash', hash);
            if (r && (r.added || r.removed || r.patched)) console.log('[upgrade]', r);
          }
        } catch (err) { console.warn('upgrade failed', err); }

        // 5. 认证
        window.linyuAuth = window.createAuth({
          getSetting: (k) => db.getSetting(k),
          setSetting: (k, v) => db.setSetting(k, v),
        });
        window.linyuAuth.ensureInit();

        // 6. api
        const realApi = window.linyuApi.createApi({
          db,
          auth: window.linyuAuth,
          lore: window.LORE_DATA,
          translator: window.LINYU_TRANSLATOR,
          version: window.LINYU_VERSION || '1.13.0-mobile',
        });
        // 替换占位 window.api，并 resolve 所有已排队的方法调用
        if (typeof window.__replaceApi === 'function') {
          window.__replaceApi(realApi);
        } else {
          window.api = realApi;
        }
        window.dispatchEvent(new CustomEvent('linyu-ready'));

        // 把 console.error 透到 openLogs 返回的尾部，方便用户复盘
        const origErr = console.error;
        const origWarn = console.warn;
        window.console.error = function (...args) { if (window.api && window.api.appendLog) window.api.appendLog('console.error', args.map(String).join(' ')); origErr.apply(console, args); };
        window.console.warn = function (...args) { if (window.api && window.api.appendLog) window.api.appendLog('console.warn', args.map(String).join(' ')); origWarn.apply(console, args); };
        window.addEventListener('error', (e) => { if (window.api && window.api.appendLog) window.api.appendLog('window.error', e.message); });
        window.addEventListener('unhandledrejection', (e) => { if (window.api && window.api.appendLog) window.api.appendLog('unhandledrejection', String(e.reason)); });
        return db;
      });
    });
  }

  // 启动
  whenDBReady().then(() => {
    // 触发 renderer 的初始 reload（renderer 通常在 DOMContentLoaded 里就尝试拉数据，
    // 这里再发一个事件保证 race-safe）
    window.dispatchEvent(new CustomEvent('linyu-db-ready'));
  }).catch((err) => {
    // 启动失败时也要尽量设上 api，否则 renderer 永远等不到响应
    console.error('[entry] init failed', err);
    window.__linyuInitError = err && (err.message || String(err));
    window.dispatchEvent(new CustomEvent('linyu-init-error', { detail: window.__linyuInitError }));
  });

  // 暴露 helper 供调试
  window.__linyuReady = () => whenDBReady();
})(typeof window !== 'undefined' ? window : this);
