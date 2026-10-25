'use strict';

/*
 * 网页端入口
 *
 * 基于 src/mobile/entry.js，改动如下：
 *   1. fsAdapter 选择：IndexedDB > sessionStorage 兜底（而非 Capacitor > sessionStorage）
 *   2. 检测 IndexedDB probe 结果，不可用时显示持久化警告
 *   3. 去除 Capacitor 特有逻辑（横竖屏、原生平台检查）
 *   4. 挂 window.__IS_WEB = true 供渲染层（app.js / index.html）做 Web 特有适配
 *
 * 初始化链与 entry.js 完全一致：
 *   占位 window.api Proxy → fsAdapter 挂载 → linyuScrypt 挂载 →
 *   initSqlJs 初始化 → createDb 建库/补种 → createAuth 认证 →
 *   createApi 替换占位 → 派发 linyu-ready / linyu-db-ready 事件
 */

(function () {
  // ---- 桌面 Electron 守卫（与 entry.js 一致）----
  var __preloadApi = typeof window.api === 'object' && window.api !== null
    && !window.api.__isStub && typeof window.api.then !== 'function';
  if (__preloadApi) return;

  // 标记为 Web 环境
  window.__IS_WEB = true;

  // ---- 0. 占位 window.api（与 entry.js 完全一致）----
  if (!window.api || typeof window.api.then !== 'function') {
    var __resolveReady;
    var __ready = new Promise(function (resolve) { __resolveReady = resolve; });
    window.__linyuApiReady = __ready;
    var __makeStub = function () { return new Proxy({}, {
      get: function (_target, prop) {
        if (typeof prop === 'symbol' || prop === 'then' || prop === 'catch' || prop === 'finally') {
          return undefined;
        }
        if (prop === 'isCapacitor' || prop === '__isStub') {
          // Web 端不是 Capacitor
          if (prop === '__isStub') return true;
          return function () { return false; };
        }
        if (prop === 'appendLog' || prop === 'onIoChange' || prop === 'onUndoChange' ||
            prop === 'onOrientationChange') {
          return function () {};
        }
        // Web 端特有：setPref / getPrefs 直接存 localStorage（不依赖库初始化）
        if (prop === 'setPref') {
          return function (k, v) {
            try { localStorage.setItem('linyu.pref.' + k, v); } catch {}
            return Promise.resolve({ ok: true, data: null });
          };
        }
        if (prop === 'getPrefs') {
          return function () {
            var prefs = {};
            try {
              for (var i = 0; i < localStorage.length; i++) {
                var key = localStorage.key(i);
                if (key && key.startsWith('linyu.pref.')) {
                  prefs[key.slice('linyu.pref.'.length)] = localStorage.getItem(key);
                }
              }
            } catch {}
            return Promise.resolve({ ok: true, data: prefs });
          };
        }
        // Web 端开放外部链接直接在浏览器新标签打开
        if (prop === 'openExternal') {
          return function (url) {
            try { window.open(url, '_blank', 'noopener,noreferrer'); } catch {}
            return Promise.resolve({ ok: true, data: null });
          };
        }
        return function () { return __ready.then(function (real) { return real[prop].apply(real, arguments); }); };
      },
    }); };
    window.api = __makeStub();
    window.__replaceApi = function (realApi) { window.api = realApi; try { __resolveReady(realApi); } catch {} };
  }

  // ---- 1. fsAdapter：IndexedDB 优先，失败降级 sessionStorage ----
  // 注意：entry.js 在这里用 Capacitor 检查，Web 端总是走 else 分支的 sessionStorage 兜底。
  // 现在改走 IndexedDB 探测：probe() 通过 → 用 idbAdapter；失败 → sessionStorage 兜底。

  function bytesToBase64(bytes) {
    var u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
    var s = '';
    for (var i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
    return btoa(s);
  }
  function base64ToBytes(b64) {
    var s = atob(String(b64 || ''));
    var u = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
    return u;
  }

  function makeSessionAdapter() {
    return {
      kind: 'memory',
      dirOf: function (p) { var i = String(p).lastIndexOf('/'); return i < 0 ? '' : p.slice(0, i); },
      basenameOf: function (p) { var i = String(p).lastIndexOf('/'); return i < 0 ? p : p.slice(i + 1); },
      read: async function (p) {
        var s = window.sessionStorage.getItem('linyu.fs.' + p);
        return s ? base64ToBytes(s) : new Uint8Array(0);
      },
      write: async function (p, bytes) {
        window.sessionStorage.setItem('linyu.fs.' + p, bytesToBase64(bytes));
      },
      unlink: async function (p) { window.sessionStorage.removeItem('linyu.fs.' + p); },
      exists: async function (p) { return window.sessionStorage.getItem('linyu.fs.' + p) != null; },
      rename: async function (from, to) {
        var v = window.sessionStorage.getItem('linyu.fs.' + from);
        if (v == null) return;
        window.sessionStorage.setItem('linyu.fs.' + to, v);
        window.sessionStorage.removeItem('linyu.fs.' + from);
      },
      copy: async function (from, to) {
        var v = window.sessionStorage.getItem('linyu.fs.' + from);
        if (v != null) window.sessionStorage.setItem('linyu.fs.' + to, v);
      },
      readdir: async function () { return []; },
      stat: async function (p) {
        var v = window.sessionStorage.getItem('linyu.fs.' + p);
        return { size: v ? (function () { try { return atob(v).length; } catch { return 0; } })() : 0, mtime: new Date().toISOString() };
      },
      mkdirp: async function () {},
    };
  }

  // 同步选择 adapter（初始化完成前就把持久化状态写入全局，渲染层可据此显示提示）
  function selectAdapter() {
    if (!window.linyuIdbAdapter) {
      // linyuIdbAdapter 还没加载（idbAdapter.js 的 <script> 没在 index.html 里？）
      console.warn('[webEntry] linyuIdbAdapter 未加载，降级为 sessionStorage');
      return makeSessionAdapter();
    }
    // 先同步给一个 IndexedDB adapter，probe 稍后在 whenDBReady 里异步验证
    // 如果 probe 失败，会重新降级并提示用户
    window.fsAdapter = window.linyuIdbAdapter;
    return window.linyuIdbAdapter;
  }

  window.fsAdapter = selectAdapter();

  // ---- 2. linyuScrypt：由 src/mobile/scrypt.js 的 UMD 分支挂上 ----

  // ---- 3. 等待 initSqlJs ----
  function whenSqlReady() {
    if (typeof window.initSqlJs === 'function') return Promise.resolve();
    return new Promise(function (resolve) {
      var t = setInterval(function () {
        if (typeof window.initSqlJs === 'function') { clearInterval(t); resolve(); }
      }, 50);
    });
  }

  // ---- 4. 库主入口 ----
  function whenDBReady() {
    if (window.linyuDb) return Promise.resolve(window.linyuDb);
    if (!window.createDb) return Promise.reject(new Error('db.js 未加载（createDb 不在 window 上）'));
    if (typeof window.initSqlJs !== 'function') return Promise.reject(new Error('sql.js 未加载'));
    return whenSqlReady().then(function () {
      var filePath = 'linyu.db';
      var seedData = window.__SEED_DATA;
      var seedPromise = seedData
        ? Promise.resolve(seedData)
        : fetch('seed.json').then(function (r) { return r.text(); }).then(function (t) { return JSON.parse(t); });
      return seedPromise.then(function (sd) {
        seedData = sd;
        return window.createDb({
          filePath: filePath,
          seed: seedData,
          lore: window.LORE_DATA,
          version: window.LINYU_VERSION || 'web-dev',
        });
      }).then(function (db) {
        window.linyuDb = db;

        // 内容迁移（与 entry.js 一致）
        try {
          var hash = window.LINYU_CONTENT_HASH || '';
          if (db.getSetting('content.version') !== db.version || db.getSetting('content.hash') !== hash) {
            var r = db.upgradeSeed();
            db.setSetting('content.version', db.version);
            db.setSetting('content.hash', hash);
            if (r && (r.added || r.removed || r.patched)) console.log('[web:upgrade]', r);
          }
        } catch (err) { console.warn('[web:upgrade] failed', err); }

        // 5. 认证
        window.linyuAuth = window.createAuth({
          getSetting: function (k) { return db.getSetting(k); },
          setSetting: function (k, v) { db.setSetting(k, v); },
        });
        window.linyuAuth.ensureInit();

        // 6. api
        var realApi = window.linyuApi.createApi({
          db: db,
          auth: window.linyuAuth,
          lore: window.LORE_DATA,
          translator: window.LINYU_TRANSLATOR,
          version: window.LINYU_VERSION || 'web-dev',
        });
        if (typeof window.__replaceApi === 'function') {
          window.__replaceApi(realApi);
        } else {
          window.api = realApi;
        }
        window.dispatchEvent(new CustomEvent('linyu-ready'));

        // 日志透传（Web 端只透到 console，不做持久化日志文件）
        var origErr = console.error;
        console.error = function () {
          var args = Array.prototype.slice.call(arguments).map(String).join(' ');
          try { if (window.api && window.api.appendLog) window.api.appendLog('console.error', args); } catch {}
          origErr.apply(console, arguments);
        };
        window.addEventListener('error', function (e) {
          try { if (window.api && window.api.appendLog) window.api.appendLog('window.error', e.message); } catch {}
        });
        window.addEventListener('unhandledrejection', function (e) {
          try { if (window.api && window.api.appendLog) window.api.appendLog('unhandledrejection', String(e.reason)); } catch {}
        });

        return db;
      });
    });
  }

  // ---- 持久化探测：验证 IndexedDB 能否真正读写 ----
  function probePersistence() {
    if (!window.linyuIdbAdapter) return Promise.resolve(false);
    return window.linyuIdbAdapter.probe().then(function (ok) {
      return ok;
    }).catch(function () {
      return false;
    });
  }

  // ---- 启动（带持久化降级处理）----
  var initStarted = false;
  function startInit() {
    if (initStarted) return;
    initStarted = true;

    probePersistence().then(function (ok) {
      if (!ok && window.fsAdapter && window.fsAdapter.kind === 'indexeddb') {
        // IndexedDB probe 失败 → 降级为 sessionStorage
        console.warn('[webEntry] IndexedDB 不可用，降级为 sessionStorage（数据仅在当前会话保留，刷新后丢失）');
        window.fsAdapter = makeSessionAdapter();
        window.__WEB_PERSISTENCE_FAILED = true;
        // 提示在渲染层（index.html 的 <div class="persistence-warning">）
        document.body.classList.add('persistence-fallback');
      }
      return whenDBReady();
    }).then(function () {
      window.dispatchEvent(new CustomEvent('linyu-db-ready'));
    }).catch(function (err) {
      console.error('[webEntry] init failed', err);
      window.__linyuInitError = err && (err.message || String(err));
      window.dispatchEvent(new CustomEvent('linyu-init-error', { detail: window.__linyuInitError }));
      // 尝试把 api 替换掉占位，至少让渲染层拿到错误信息
      if (window.__replaceApi && window.linyuApi && window.linyuAuth && window.linyuDb) {
        var realApi = window.linyuApi.createApi({
          db: window.linyuDb,
          auth: window.linyuAuth,
          lore: window.LORE_DATA,
          translator: window.LINYU_TRANSLATOR,
          version: window.LINYU_VERSION || 'web-dev',
        });
        window.__replaceApi(realApi);
      }
    });
  }

  // Web 端：DOM 加载完成后启动（entry.js 是立即启动，因为 Electron/Capacitor 下
  // preload 已就位。Web 端需要等 <script> 标签按序加载完，所以绑定 DOMContentLoaded）
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startInit);
  } else {
    startInit();
  }

  window.__linyuReady = function () { return whenDBReady(); };
})(typeof window !== 'undefined' ? window : this);