'use strict';

/*
 * 渲染层 IPC shim：与 src/main/preload.js 一一对位。
 *
 * 桌面 Electron 的 preload 是把 ipcRenderer.invoke 包成 window.api.*；
 * 在 Capacitor WebView 里没有 ipc，所以这里用本地 db.js / auth.js 的方法
 * 直接同步出同名方法。需要异步文件系统返回的操作（导出、备份、媒体、导入、打开外链）
 * 通过 @capacitor/filesystem / @capacitor/share / @capacitor/browser 走原生。
 *
 * 全部调用统一返回 { ok: true, data } 或 { ok: false, error }，与桌面 IPC 形状一致。
 * 调用方式保持同步：渲染层只 await window.api.xxx(...)。
 */

(function (root) {
  // ---- 平台能力（来自 capacitor globals 或浏览器内置 API） ----
  function isCapacitor() {
    return !!(root.Capacitor && root.Capacitor.isNativePlatform && root.Capacitor.isNativePlatform());
  }
  function capPlugin(name) {
    return (root.Capacitor && root.Capacitor.Plugins && root.Capacitor.Plugins[name]) || null;
  }
  function fsCap() { return capPlugin('Filesystem'); }
  function shareCap() { return capPlugin('Share'); }
  function browserCap() { return capPlugin('Browser'); }
  function appCap() { return capPlugin('App'); }
  function orientCap() { return capPlugin('ScreenOrientation'); }

  // @capacitor/screen-orientation 返回 'portrait-primary' / 'landscape-secondary' 这类细分值，
  // UI 只关心竖还是横
  function normOrient(type) {
    return String(type || '').startsWith('landscape') ? 'landscape' : 'portrait';
  }

  // ---- 通用错误包装：让所有 channel 的形状都是 {ok,data} / {ok,error} ----
  async function safe(fn) {
    try {
      const data = await fn();
      return { ok: true, data };
    } catch (err) {
      const e = err || {};
      return { ok: false, error: e.message || String(e) };
    }
  }

  // ---- WebView 端专用的"选文件"对话框：用隐藏的 <input type="file"> ----
  function pickFile({ accept, multiple } = {}) {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      if (accept) input.accept = accept;
      if (multiple) input.multiple = true;
      input.style.position = 'fixed';
      input.style.left = '-10000px';
      input.style.top = '-10000px';
      document.body.appendChild(input);
      let resolved = false;
      const onChange = () => {
        if (resolved) return;
        resolved = true;
        const files = input.files ? Array.from(input.files) : [];
        document.body.removeChild(input);
        resolve({ canceled: false, files });
      };
      const onCancel = () => {
        if (resolved) return;
        resolved = true;
        document.body.removeChild(input);
        resolve({ canceled: true, files: [] });
      };
      input.addEventListener('change', onChange, { once: true });
      // 用户取消（多次 pick 后第二次未选）兼容：Android WebView 不会触发 cancel，但桌面浏览器会
      input.addEventListener('cancel', onCancel, { once: true });
      input.click();
      // WebView 在 30s 内没选就自动取消兜底
      setTimeout(onCancel, 30000);
    });
  }
  function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(new Error('读取文件失败'));
      r.readAsArrayBuffer(file);
    });
  }
  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(new Error('读取文件失败'));
      r.readAsDataURL(file);
    });
  }
  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(new Error('读取文件失败'));
      r.readAsText(file, 'utf-8');
    });
  }
  function dataUrlToUint8Array(dataUrl) {
    const s = String(dataUrl || '');
    const comma = s.indexOf(',');
    if (comma < 0) return new Uint8Array(0);
    const b64 = s.slice(comma + 1);
    const bin = atob(b64);
    const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }
  function extFromMime(mime) {
    if (!mime) return '.bin';
    if (mime === 'image/png') return '.png';
    if (mime === 'image/jpeg') return '.jpg';
    if (mime === 'image/gif') return '.gif';
    if (mime === 'image/webp') return '.webp';
    if (mime === 'application/json') return '.json';
    return '.bin';
  }

  function randomName(len = 16) {
    const u = new Uint8Array(len / 2);
    (root.crypto || root.msCrypto).getRandomValues(u);
    let s = '';
    for (let i = 0; i < u.length; i++) s += (u[i] < 16 ? '0' : '') + u[i].toString(16);
    return s;
  }

  function debounce(fn, ms) {
    let t = null;
    const wrapped = (...args) => {
      if (t) clearTimeout(t);
      t = setTimeout(() => { t = null; fn(...args); }, ms);
    };
    return wrapped;
  }

  // ---- 真正的工厂：在 entry.js 里调用，传入 db / auth / translator / lore ----
  function createApi({ db, auth, lore, translator, version, TRACE_LIMIT, IMPORT_STALE_MS, ATTEMPT_LIMIT, LOCK_MS }) {
    // 业务规则（开发者门禁 / 撤销槽位 / 导入暂存过期 / 登录失败锁定）统一走
    // src/core/service.js —— 与桌面主进程是同一份，加接口不用再改两处。
    // 这个文件只留 Capacitor 相关的部分：文件选择、分享、媒体、屏幕方向、日志缓冲。
    const serviceMod = root.LINYU_SERVICE || {};

    // Phase 2（Web / 小程序端）：没有本地模型，润色走「云端代理」。
    // 代理地址存在偏好 polishProxyUrl 里；未配置时 polish 闭包直接回退草稿，
    // svc.polishDraft 也就安全返回原稿（polished:false），不影响主翻译。
    function makeProxyPolish() {
      return async (source, draft) => {
        const prefs = (db && typeof db.getPrefs === 'function') ? db.getPrefs() : {};
        const url = prefs['polishProxyUrl'];
        if (!url) return draft;
        const mod = root.LINYU_POLISH;
        if (!mod || !mod.createHttpProxyClient) return draft;
        const client = mod.createHttpProxyClient({ baseUrl: String(url) });
        return client.polish(source, draft);
      };
    }

    const svc = serviceMod.createService({
      db,
      auth,
      translator,
      version,
      config: {
        traceLimit: TRACE_LIMIT || 240,
        importStaleMs: IMPORT_STALE_MS || 10 * 60 * 1000,
        attemptLimit: ATTEMPT_LIMIT || 5,
        lockMs: LOCK_MS || 30000,
      },
      // Web / 小程序端注入云端代理润色；桌面端走 preload→主进程 Ollama，不走这里。
      polish: makeProxyPolish(),
    });

    let ioListeners = [];
    let orientListeners = [];
    let orientHandle = null;

    function readPref(key, fallback) {
      return svc.readPref(key, fallback);
    }
    function writePref(key, value) {
      // 返回 db 的结果：PREF_KEYS 白名单外的键会被拒掉，设置项必须能知道自己没写进去
      return svc.writePref(key, value);
    }

    // 导入暂存：payload 交给 service 管过期，媒体还原是本端的事
    function replanImport(strategy) {
      const r = svc.replanImport(strategy);
      return { canceled: false, file: r.file, ...r.plan };
    }
    function applyImport(strategy) {
      const slot = svc.peekImport();
      const r = svc.applyImport(strategy);
      // 落库后把 media/<file> 还原到 DATA/media/（与桌面同格式）
      if (slot && Array.isArray(slot.payload.media)) {
        const fs = fsCap();
        if (fs) {
          (async () => {
            try { await fs.mkdir({ path: 'media', directory: 'DATA', recursive: true }); } catch {}
            for (const m of slot.payload.media) {
              if (!m || typeof m !== 'object') continue;
              const name = String(m.name || '');
              if (!name) continue;
              try {
                await fs.writeFile({ path: `media/${name}`, directory: 'DATA', data: String(m.base64 || '') });
              } catch { /* 写不进去就忽略 */ }
            }
          })();
        }
      }
      return { ...r.result, file: r.file };
    }

    async function pickImage() {
      const r = await pickFile({ accept: 'image/*' });
      if (r.canceled || !r.files.length) return { canceled: true };
      const file = r.files[0];
      if (file.size > 8 * 1024 * 1024) throw new Error('图片请控制在 8MB 以内');
      const ext = extFromMime(file.type) || '.' + (file.name.split('.').pop() || 'png').toLowerCase();
      const dataUrl = await readFileAsDataURL(file);
      const bytes = dataUrlToUint8Array(dataUrl);
      const name = randomName() + ext;
      const path = `media/${name}`;
      const fs = fsCap();
      if (!fs) throw new Error('@capacitor/filesystem 不可用');
      await fs.mkdir({ path: 'media', directory: 'DATA', recursive: true }).catch(() => {});
      const b64 = dataUrl.split(',')[1];
      await fs.writeFile({ path, directory: 'DATA', data: b64 });
      return { canceled: false, ref: 'media:' + name };
    }
    async function mediaData(ref) {
      const name = String(ref || '').replace(/^media:/, '');
      const ext = extFromMime(name.endsWith('.png') ? 'image/png' : name.endsWith('.gif') ? 'image/gif' : name.endsWith('.webp') ? 'image/webp' : 'image/jpeg');
      const path = `media/${name}`;
      const fs = fsCap();
      if (!fs) throw new Error('@capacitor/filesystem 不可用');
      const r = await fs.readFile({ path, directory: 'DATA' });
      let b64 = r.data;
      if (b64 && b64.startsWith('data:')) b64 = b64.split(',')[1];
      return 'data:' + ext + ';base64,' + b64;
    }

    // ---- 导入导出：导出先写到 Cache（系统级分享目录），再通过 Share 选择 App；导入通过 <input type="file"> ----
    async function exportData({ includeMedia } = {}) {
      const payload = db.exportAll();
      if (includeMedia) {
        // 收集 media/<file>，转 base64 包进 payload.media；与桌面格式一致
        const fs = fsCap();
        if (!fs) throw new Error('@capacitor/filesystem 不可用');
        let mediaNames = [];
        try {
          const r = await fs.readdir({ path: 'media', directory: 'DATA' });
          mediaNames = (r.files || []).map((f) => (typeof f === 'string' ? f : f.name));
        } catch { /* 没创建过 media 目录 */ }
        const list = [];
        for (const n of mediaNames) {
          try {
            const rr = await fs.readFile({ path: `media/${n}`, directory: 'DATA' });
            let b64 = rr.data;
            if (b64 && b64.startsWith('data:')) b64 = b64.split(',')[1];
            list.push({ name: n, base64: b64 });
          } catch { /* 读不出来就跳过 */ }
        }
        payload.media = list;
      }
      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const fileName = `淋语数据-${stamp}.json`;
      const json = JSON.stringify(payload, null, 2);
      // 先写到 Cache 目录；Android 应用 Cache 不需要权限，原生 Share 拿到这个路径就能转发
      const fs = fsCap();
      const tmpDir = (root.Capacitor && root.Capacitor.platform === 'android') ? 'CACHE' : 'DATA';
      const tmpPath = `exports/${fileName}`;
      if (fs) {
        try { await fs.mkdir({ path: 'exports', directory: tmpDir, recursive: true }); } catch {}
        const b64 = btoa(unescape(encodeURIComponent(json)));
        await fs.writeFile({ path: tmpPath, directory: tmpDir, data: b64 });
      }
      const sh = shareCap();
      if (sh) {
        try {
          const fileUri = await fs.getUri({ path: tmpPath, directory: tmpDir });
          await sh.share({
            title: fileName,
            text: '淋语翻译器数据导出',
            url: fileUri.uri,
            dialogTitle: '保存或分享导出的 JSON',
          });
          return { canceled: false, file: tmpPath, counts: payload.counts, media: (payload.media || []).length };
        } catch { /* 分享失败也仍把文件放着了 */ }
      }
      // 没有 Share 插件：把 JSON 直接塞进剪贴板并返回
      try { await navigator.clipboard.writeText(json); } catch {}
      return { canceled: false, file: tmpPath, counts: payload.counts, media: (payload.media || []).length, copied: true };
    }

    async function pickImport() {
      const r = await pickFile({ accept: 'application/json,.json' });
      if (r.canceled || !r.files.length) return { canceled: true };
      const file = r.files[0];
      const text = await readFileAsText(file);
      let payload;
      try { payload = JSON.parse(text); }
      catch { throw new Error('文件不是有效的 JSON'); }
      const plan = svc.planImport(payload, 'merge');
      svc.stashImport(payload, file.name);
      ioListeners.forEach((cb) => cb());
      return { canceled: false, file: file.name, ...plan };
    }
    // ---- 备份与恢复：直接调底层 db.listBackups / restore ----
    const api = {
      isCapacitor: isCapacitor(),

      translate: (text, mode) => safe(() => Promise.resolve(svc.translate(text, mode))),

      // Phase 2（Web / 小程序端）：LLM 润色后处理。代理不可达时返回草稿原样（polished:false）。
      polish: (source, draft) => safe(() => Promise.resolve(svc.polishDraft(source, draft))),

      // ---- 认证：门禁与失败锁定都在 service 里 ----
      authStatus: () => safe(() => Promise.resolve(svc.authStatus())),
      login: (user, pass) => safe(() => Promise.resolve(svc.login(user, pass))),
      logout: () => safe(() => Promise.resolve(svc.logout())),
      changePassword: (oldPass, newPass) => safe(() => Promise.resolve(svc.changePassword(oldPass, newPass))),
      meta: () => safe(() => Promise.resolve(svc.meta())),

      // ---- 数据 / 撤销 ----
      syncSeed: () => safe(() => Promise.resolve(svc.syncSeed())),
      undoDelete: () => safe(() => Promise.resolve(svc.undoDelete())),
      undoState: () => ({ ok: true, data: svc.undoState() }),
      onUndoChange: (cb) => svc.onUndoChange(cb),
      onIoChange(cb) {
        ioListeners.push(cb);
        return () => { ioListeners = ioListeners.filter((x) => x !== cb); };
      },

      // ---- 五板块 CRUD：与桌面共用 service，这里只做转发 ----
      listWords: () => safe(() => Promise.resolve(svc.crud.words.list())),
      addWord: (w) => safe(() => Promise.resolve(svc.crud.words.add(w))),
      updateWord: (id, w) => safe(() => Promise.resolve(svc.crud.words.update(id, w))),
      deleteWord: (id) => safe(() => Promise.resolve(svc.crud.words.remove(id))),

      listRules: () => safe(() => Promise.resolve(svc.crud.rules.list())),
      addRule: (r) => safe(() => Promise.resolve(svc.crud.rules.add(r))),
      updateRule: (id, r) => safe(() => Promise.resolve(svc.crud.rules.update(id, r))),
      deleteRule: (id) => safe(() => Promise.resolve(svc.crud.rules.remove(id))),

      listCards: () => safe(() => Promise.resolve(svc.crud.cards.list())),
      addCard: (c) => safe(() => Promise.resolve(svc.crud.cards.add(c))),
      updateCard: (id, c) => safe(() => Promise.resolve(svc.crud.cards.update(id, c))),
      deleteCard: (id) => safe(() => Promise.resolve(svc.crud.cards.remove(id))),

      listQuotes: () => safe(() => Promise.resolve(svc.crud.quotes.list())),
      addQuote: (q) => safe(() => Promise.resolve(svc.crud.quotes.add(q))),
      updateQuote: (id, q) => safe(() => Promise.resolve(svc.crud.quotes.update(id, q))),
      deleteQuote: (id) => safe(() => Promise.resolve(svc.crud.quotes.remove(id))),

      listHeroes: () => safe(() => Promise.resolve(svc.crud.heroes.list())),
      addHero: (h) => safe(() => Promise.resolve(svc.crud.heroes.add(h))),
      updateHero: (id, h) => safe(() => Promise.resolve(svc.crud.heroes.update(id, h))),
      deleteHero: (id) => safe(() => Promise.resolve(svc.crud.heroes.remove(id))),

      // ---- 媒体：Capacitor 自己的目录，桌面走 userData/media ----
      pickImage: () => safe(() => pickImage()),
      mediaData: (ref) => safe(() => mediaData(ref)),

      // ---- 导入导出：选文件 / 分享是本端的事，暂存与落库规则在 service ----
      exportData: (opts) => safe(() => exportData(opts || {})),
      pickImport: () => safe(() => pickImport()),
      replanImport: (opts) => safe(() => Promise.resolve(replanImport(opts && opts.strategy))),
      applyImport: (opts) => safe(() => Promise.resolve(applyImport(opts && opts.strategy))),
      cancelImport: () => safe(() => Promise.resolve(svc.cancelImport())),

      // ---- 备份 / 体检 ----
      listBackups: () => safe(() => svc.listBackups()),
      restoreBackup: (name) => safe(() => svc.restoreBackup(name)),
      restoreBefore: () => safe(() => svc.restoreBefore()),
      inspect: () => safe(() => Promise.resolve(svc.inspect())),
      cleanHeroWords: (list) => safe(() => Promise.resolve(svc.cleanHeroWords(list))),

      // ---- 历史 / 偏好 ----
      listHistory: () => safe(() => Promise.resolve(svc.listHistory())),
      clearHistory: () => safe(() => Promise.resolve(svc.clearHistory())),
      getPrefs: () => safe(() => Promise.resolve(svc.getPrefs())),
      // 渲染层会写 window.api.setPref(...).catch(() => {})，必须返回 Promise 才与桌面
      // preload 的 ipc invoke 同形；同步返回对象会让 .catch 直接 TypeError。
      setPref: (key, value) => safe(() => Promise.resolve(svc.setPref(String(key), value))),

      // ---- 日志 / 外部链接 ----
      // 移动端没有"打开日志目录"的概念：返回近 60 行 + 让用户在设置里复制
      openLogs: () => safe(() => {
        const lines = (root.__linyuLogBuffer || []).slice(-60).join('\n');
        return { dir: 'App-data 内置，复制以下内容给开发者：', tail: lines };
      }),
      appendLog: (scope, msg) => {
        if (!root.__linyuLogBuffer) root.__linyuLogBuffer = [];
        root.__linyuLogBuffer.push(`[${new Date().toISOString()}] ${scope}: ${msg}`);
        if (root.__linyuLogBuffer.length > 1000) root.__linyuLogBuffer.shift();
        // 同时打到控制台 / Logcat
        try { console.log('[linyu]', scope, msg); } catch {}
      },
      async openExternal(url) {
        const raw = String(url || '');
        let u;
        try { u = new URL(raw); }
        catch { return { ok: false, error: '非法链接' }; }
        if (u.protocol !== 'http:' && u.protocol !== 'https:') return { ok: false, error: '仅允许打开 http/https 链接' };
        const b = browserCap();
        if (b) {
          try { await b.open({ url: raw }); return { ok: true, data: true }; }
          catch (err) { /* 退回到 window.open */ }
        }
        try { window.open(raw, '_blank'); return { ok: true, data: true }; }
        catch (err) { return { ok: false, error: err.message || String(err) }; }
      },

      // ---- 屏幕方向 ----
      // 只有原生平台能锁朝向；桌面是可调大小的窗口，一律回 supported:false，界面就不画这个按钮。
      async orientationState() {
        const so = orientCap();
        const autoRotate = readPref('ui.autoRotate', false) === true;
        if (!so) return { ok: true, data: { supported: false, type: 'portrait', autoRotate: false } };
        let type = 'portrait';
        try { type = normOrient((await so.orientation()).type); } catch { /* 读不到就按竖屏算 */ }
        return { ok: true, data: { supported: true, type, autoRotate } };
      },
      // 启动时调用：默认锁竖屏，只有用户在设置里开过"跟随设备旋转"才放开
      async initOrientation() {
        const so = orientCap();
        if (!so) return { ok: true, data: { supported: false, type: 'portrait', autoRotate: false } };
        const autoRotate = readPref('ui.autoRotate', false) === true;
        try {
          if (autoRotate) await so.unlock();
          else await so.lock({ orientation: 'portrait' });
        } catch (err) { return { ok: false, error: err.message || String(err) }; }
        let type = 'portrait';
        try { type = normOrient((await so.orientation()).type); } catch {}
        return { ok: true, data: { supported: true, type, autoRotate } };
      },
      async setOrientation(target) {
        const so = orientCap();
        if (!so) return { ok: false, error: '当前平台不支持屏幕方向控制' };
        const want = target === 'landscape' ? 'landscape' : 'portrait';
        // 手动切一次就松开"跟随设备旋转"：不然用户下一次转身又把方向抢回去了
        writePref('ui.autoRotate', false);
        try { await so.lock({ orientation: want }); }
        catch (err) { return { ok: false, error: err.message || String(err) }; }
        return { ok: true, data: { supported: true, type: want, autoRotate: false } };
      },
      async setAutoRotate(on) {
        const so = orientCap();
        if (!so) return { ok: false, error: '当前平台不支持屏幕方向控制' };
        const enable = on === true || on === 'true';
        const w = writePref('ui.autoRotate', enable);
        if (w && w.error) return { ok: false, error: '偏好存不下去：' + w.error };
        try {
          if (enable) await so.unlock();
          else await so.lock({ orientation: normOrient((await so.orientation()).type) });
        } catch (err) { return { ok: false, error: err.message || String(err) }; }
        return { ok: true, data: { supported: true, autoRotate: enable } };
      },
      onOrientationChange(cb) {
        orientListeners.push(cb);
        const so = orientCap();
        if (so && !orientHandle) {
          so.addListener('screenOrientationChange', (r) => {
            const type = normOrient(r && r.type);
            orientListeners.forEach((fn) => fn({ type }));
          }).then((h) => { orientHandle = h; }).catch(() => {});
        }
        return () => { orientListeners = orientListeners.filter((x) => x !== cb); };
      },
    };
    return api;
  }

  if (typeof module === 'object' && module.exports) {
    module.exports = { createApi };
  } else {
    root.linyuApi = { createApi };
  }
}(typeof self !== 'undefined' ? self : this));
