'use strict';

/*
 * 浏览器 / Capacitor WebView 入口
 *
 * 加载顺序由 index.html 内 <script> 标签保证：本文件应当最后加载（在 lore*.js / db.js 之后）。
 * 加载时若不可用的依赖则延后到 initSqlJs().then 再拉起。
 *
 * 职责：
 *   1. 挂上 fsAdapter（capacitor 后端）
 *   2. 挂上 linyuScrypt（scrypt-js 后端）
 *   3. 用 initSqlJs 初始化 SQL，并用 db.js 的 createDb 创建库
 *   4. 用 auth.js 的 createAuth 创建认证
 *   5. 用 api.js 的 createApi 暴露 window.api
 */

(function () {
  function isCapacitor() {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  }

  // ---- 1. fsAdapter：根据平台选择后端。本文件被同时承担 Electron WebView 与 Capacitor WebView。
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

  // ---- 2. linyuScrypt：用 scrypt-js 的浏览器 UMD 入口 ----
  // 实际由 src/mobile/scrypt.js UMD 自动挂上。这里保留兜底以兼容旧版挂载方式。
  if (!window.linyuScrypt && window.scrypt && window.scrypt.syncScrypt) {
    window.linyuScrypt = {
      hashPassword(password, salt) {
        const u8 = window.scrypt.syncScrypt(String(password), String(salt), 16384, 8, 1, 64);
        let s = '';
        for (let i = 0; i < u8.length; i++) s += (u8[i] < 16 ? '0' : '') + u8[i].toString(16);
        return s;
      },
    };
  }

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
      const filePath = isCapacitor() ? 'linyu.db' : 'linyu.db';
      // seed.json 的内容在 entry.js 内联：fetch 它作为 SEED_DATA
      return fetch('seed.json').then((r) => r.text()).then((text) => {
        const seedData = JSON.parse(text);
        return window.createDb({
          filePath,
          seed: seedData,
          lore: window.LORE_DATA,
          version: window.LINYU_VERSION || '1.13.0-mobile',
        });
      }).then((db) => {
        window.linyuDb = db;
        // 单次内容迁移：版本号已变就走 upgradeSeed
        try {
          const cur = db.getSetting('content.version');
          if (cur !== db.version) {
            const r = db.upgradeSeed();
            db.setSetting('content.version', db.version);
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
        window.api = window.linyuApi.createApi({
          db,
          auth: window.linyuAuth,
          lore: window.LORE_DATA,
          translator: window.LINYU_TRANSLATOR,
          version: window.LINYU_VERSION || '1.13.0-mobile',
        });
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
