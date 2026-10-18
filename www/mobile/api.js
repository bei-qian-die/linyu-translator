(function () {
'use strict';
// __wrapped by scripts/build-mobile.mjs
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
    TRACE_LIMIT = TRACE_LIMIT || 240;
    IMPORT_STALE_MS = IMPORT_STALE_MS || 10 * 60 * 1000;
    ATTEMPT_LIMIT = ATTEMPT_LIMIT || 5;
    LOCK_MS = LOCK_MS || 30000;

    let devUnlocked = false;
    let fails = 0;
    let lockUntil = 0;
    let pendingUndo = null;
    let pendingImport = null;
    let undoListeners = [];
    let ioListeners = [];
    let orientListeners = [];
    let orientHandle = null;

    function readPref(key, fallback) {
      const raw = db.getPrefs()[key];
      if (raw == null || raw === '') return fallback;
      try { return JSON.parse(raw); }
      catch { return raw; }
    }
    function writePref(key, value) {
      // 返回 db 的结果：PREF_KEYS 白名单外的键会被拒掉，设置项必须能知道自己没写进去
      return db.setPref(key, JSON.stringify(value));
    }

    function authStatus() {
      const s = auth.status();
      return {
        unlocked: devUnlocked,
        user: s.user,
        needsSetup: !s.initialized,
        defaultPass: auth.usesDefaultPassword(),
        lockLeft: Math.max(0, Math.ceil((lockUntil - Date.now()) / 1000)),
      };
    }
    function clearUndo() {
      pendingUndo = null;
      undoListeners.forEach((cb) => cb({ available: false, label: '' }));
    }
    function setUndo(slot) {
      pendingUndo = slot;
      undoListeners.forEach((cb) => cb({ available: true, label: slot.undo && slot.undo.label }));
    }

    function translate(text, mode) {
      const src = String(text || '').slice(0, 5000);
      const preview = mode === 'preview';
      const wantTrace = devUnlocked;
      const trace = wantTrace ? [] : null;
      const uncovered = wantTrace ? [] : null;
      const dst = translator.translateText(src, {
        words: db.getWords(),
        rules: db.getRules(),
        trace,
        uncovered,
        traceLimit: TRACE_LIMIT,
      });
      if (src.trim() && !preview) db.addHistory(src, dst);
      return { dst, preview, trace: wantTrace ? trace : null, uncovered: wantTrace ? uncovered : null };
    }

    // ---- 媒体：本地路径会被持久化为 'media:<name>'，渲染层拿到 ref 后通过 mediaData 拿回 data:URL ----
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
      const plan = db.planImport(payload, 'merge');
      pendingImport = { payload, file: file.name, at: Date.now() };
      ioListeners.forEach((cb) => cb());
      return { canceled: false, file: file.name, ...plan };
    }
    function replanImport({ strategy } = {}) {
      if (!pendingImport || Date.now() - pendingImport.at > IMPORT_STALE_MS) throw new Error('请先重新选择导入文件');
      const plan = db.planImport(pendingImport.payload, strategy);
      return { canceled: false, file: pendingImport.file, ...plan };
    }
    function applyImport({ strategy } = {}) {
      if (!pendingImport || Date.now() - pendingImport.at > IMPORT_STALE_MS) throw new Error('请先重新选择导入文件');
      const slot = pendingImport;
      pendingImport = null;
      ioListeners.forEach((cb) => cb());
      const result = db.applyImport(slot.payload, strategy);
      // 落库后把 media/<file> 还原到 DATA/media/（仅在 require=true 模式 + payload.media 存在时）
      if (Array.isArray(slot.payload.media)) {
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
      return { ...result, file: slot.file };
    }
    function cancelImport() {
      pendingImport = null;
      ioListeners.forEach((cb) => cb());
      return { ok: true };
    }

    // ---- 备份与恢复：直接调底层 db.listBackups / restore ----
    const api = {
      isCapacitor: isCapacitor(),

      translate: (text, mode) => safe(() => Promise.resolve(translate(text, mode))),

      // ---- 认证 ----
      authStatus: () => safe(() => Promise.resolve(authStatus())),
      async login(user, pass) {
        if (Date.now() < lockUntil) {
          return { ok: false, error: `尝试过于频繁，请 ${Math.ceil((lockUntil - Date.now()) / 1000)} 秒后再试` };
        }
        if (!auth.verify(user, pass)) {
          fails += 1;
          if (fails >= ATTEMPT_LIMIT) {
            lockUntil = Date.now() + LOCK_MS;
            fails = 0;
            return { ok: false, error: `账号或密码错误，已锁定 ${LOCK_MS / 1000} 秒` };
          }
          return { ok: false, error: `账号或密码错误（还可尝试 ${ATTEMPT_LIMIT - fails} 次）` };
        }
        fails = 0;
        lockUntil = 0;
        devUnlocked = true;
        return { ok: true, data: authStatus() };
      },
      logout: () => {
        devUnlocked = false;
        clearUndo();
        return { ok: true, data: authStatus() };
      },
      async changePassword(oldPass, newPass) {
        if (!devUnlocked) return { ok: false, error: '请先在「设置 → 开发者模式」中登录开发者账号' };
        const r = auth.changePassword(oldPass, newPass);
        if (r.error) return { ok: false, error: r.error };
        return { ok: true, data: { ok: true } };
      },
      async meta() {
        return { ok: true, data: {
          defaultUser: auth.DEFAULT_USER,
          defaultPassword: auth.usesDefaultPassword() ? auth.DEFAULT_PASSWORD : '',
          version,
          historyLimit: db.historyLimit(),
        } };
      },

      // ---- 数据 / 撤销 ----
      async syncSeed() {
        if (!devUnlocked) return { ok: false, error: '请先在「设置 → 开发者模式」中登录' };
        const r = db.syncFromSeed();
        return { ok: true, data: r };
      },
      async undoDelete() {
        if (!devUnlocked) return { ok: false, error: '请先在「设置 → 开发者模式」中登录' };
        if (!pendingUndo) throw new Error('没有可撤销的操作了');
        if (Date.now() - pendingUndo.at > 60000) {
          clearUndo();
          throw new Error('撤销时间已过，请重新添加内容');
        }
        const slot = pendingUndo;
        clearUndo();
        const r = db.undoDelete(slot);
        return { ok: true, data: r };
      },
      undoState: () => ({ ok: true, data: { available: Boolean(pendingUndo && devUnlocked && Date.now() - pendingUndo.at <= 60000), label: pendingUndo ? pendingUndo.undo.label : '' } }),
      onUndoChange(cb) {
        undoListeners.push(cb);
        return () => { undoListeners = undoListeners.filter((x) => x !== cb); };
      },
      onIoChange(cb) {
        ioListeners.push(cb);
        return () => { ioListeners = ioListeners.filter((x) => x !== cb); };
      },

      // ---- 五大板块 CRUD ----
      listWords: () => safe(() => Promise.resolve(db.getWords())),
      addWord: (w) => {
        if (!devUnlocked) return { ok: false, error: '请先在「设置 → 开发者模式」中登录' };
        return (() => {
          const r = db.addWord(w);
          if (r.error) return { ok: false, error: r.error };
          return { ok: true, data: r };
        })();
      },
      updateWord: (id, w) => {
        if (!devUnlocked) return { ok: false, error: '请先在「设置 → 开发者模式」中登录' };
        const r = db.updateWord(id, w);
        if (r.error) return { ok: false, error: r.error };
        setUndo({ undo: { kind: 'word', rows: [db.getWords().find((x) => x.id === id)].filter(Boolean), label: '词条' }, at: Date.now() });
        return { ok: true, data: r };
      },
      deleteWord: (id) => {
        if (!devUnlocked) return { ok: false, error: '请先在「设置 → 开发者模式」中登录' };
        const r = db.deleteWord(id);
        if (r.error) return { ok: false, error: r.error };
        if (r.undo) setUndo({ undo: r.undo, at: Date.now() });
        return { ok: true, data: r };
      },

      listRules: () => safe(() => Promise.resolve(db.getRules())),
      addRule: (r) => {
        if (!devUnlocked) return { ok: false, error: '请先在「设置 → 开发者模式」中登录' };
        const out = db.addRule(r);
        return out.error ? { ok: false, error: out.error } : { ok: true, data: out };
      },
      updateRule: (id, r) => {
        if (!devUnlocked) return { ok: false, error: '请先在「设置 → 开发者模式」中登录' };
        const out = db.updateRule(id, r);
        return out.error ? { ok: false, error: out.error } : { ok: true, data: out };
      },
      deleteRule: (id) => {
        if (!devUnlocked) return { ok: false, error: '请先在「设置 → 开发者模式」中登录' };
        const r = db.deleteRule(id);
        if (r.error) return { ok: false, error: r.error };
        if (r.undo) setUndo({ undo: r.undo, at: Date.now() });
        return { ok: true, data: r };
      },

      listCards: () => safe(() => Promise.resolve(db.getCards())),
      addCard: (c) => {
        if (!devUnlocked) return { ok: false, error: '请先在「设置 → 开发者模式」中登录' };
        const out = db.addCard(c);
        return out.error ? { ok: false, error: out.error } : { ok: true, data: out };
      },
      updateCard: (id, c) => {
        if (!devUnlocked) return { ok: false, error: '请先在「设置 → 开发者模式」中登录' };
        const out = db.updateCard(id, c);
        return out.error ? { ok: false, error: out.error } : { ok: true, data: out };
      },
      deleteCard: (id) => {
        if (!devUnlocked) return { ok: false, error: '请先在「设置 → 开发者模式」中登录' };
        const r = db.deleteCard(id);
        if (r.error) return { ok: false, error: r.error };
        if (r.undo) setUndo({ undo: r.undo, at: Date.now() });
        return { ok: true, data: r };
      },

      listQuotes: () => safe(() => Promise.resolve(db.getQuotes())),
      addQuote: (q) => {
        if (!devUnlocked) return { ok: false, error: '请先在「设置 → 开发者模式」中登录' };
        const out = db.addQuote(q);
        return out.error ? { ok: false, error: out.error } : { ok: true, data: out };
      },
      updateQuote: (id, q) => {
        if (!devUnlocked) return { ok: false, error: '请先在「设置 → 开发者模式」中登录' };
        const out = db.updateQuote(id, q);
        return out.error ? { ok: false, error: out.error } : { ok: true, data: out };
      },
      deleteQuote: (id) => {
        if (!devUnlocked) return { ok: false, error: '请先在「设置 → 开发者模式」中登录' };
        const r = db.deleteQuote(id);
        if (r.error) return { ok: false, error: r.error };
        if (r.undo) setUndo({ undo: r.undo, at: Date.now() });
        return { ok: true, data: r };
      },

      listHeroes: () => safe(() => Promise.resolve(db.getHeroes())),
      addHero: (h) => {
        if (!devUnlocked) return { ok: false, error: '请先在「设置 → 开发者模式」中登录' };
        const out = db.addHero(h);
        return out.error ? { ok: false, error: out.error } : { ok: true, data: out };
      },
      updateHero: (id, h) => {
        if (!devUnlocked) return { ok: false, error: '请先在「设置 → 开发者模式」中登录' };
        const out = db.updateHero(id, h);
        return out.error ? { ok: false, error: out.error } : { ok: true, data: out };
      },
      deleteHero: (id) => {
        if (!devUnlocked) return { ok: false, error: '请先在「设置 → 开发者模式」中登录' };
        const r = db.deleteHero(id);
        if (r.error) return { ok: false, error: r.error };
        if (r.undo) setUndo({ undo: r.undo, at: Date.now() });
        return { ok: true, data: r };
      },

      // ---- 媒体 ----
      pickImage: () => safe(() => pickImage()),
      mediaData: (ref) => safe(() => mediaData(ref)),

      // ---- 导入导出 ----
      exportData: (opts) => safe(() => exportData(opts || {})),
      pickImport: () => safe(() => pickImport()),
      replanImport: (opts) => safe(() => Promise.resolve(replanImport(opts || {}))),
      applyImport: (opts) => safe(() => Promise.resolve(applyImport(opts || {}))),
      cancelImport: () => safe(() => Promise.resolve(cancelImport())),

      // ---- 备份 / 体检 ----
      listBackups: () => safe(() => db.listBackups()),
      async restoreBackup(name) {
        if (!devUnlocked) return { ok: false, error: '请先在「设置 → 开发者模式」中登录' };
        const r = await db.restoreBackup(name);
        return r.error ? { ok: false, error: r.error } : { ok: true, data: r };
      },
      async restoreBefore() {
        if (!devUnlocked) return { ok: false, error: '请先在「设置 → 开发者模式」中登录' };
        const r = await db.restoreBefore();
        return r.error ? { ok: false, error: r.error } : { ok: true, data: r };
      },
      inspect: () => safe(() => Promise.resolve(db.inspect())),
      async cleanHeroWords(list) {
        if (!devUnlocked) return { ok: false, error: '请先在「设置 → 开发者模式」中登录' };
        return { ok: true, data: db.cleanHeroWords(list) };
      },

      // ---- 历史 / 偏好 ----
      listHistory: () => safe(() => Promise.resolve(db.getHistory())),
      async clearHistory() {
        if (!devUnlocked) return { ok: false, error: '请先在「设置 → 开发者模式」中登录' };
        const r = db.clearHistory();
        if (r.undo) setUndo({ undo: r.undo, at: Date.now() });
        return { ok: true, data: r };
      },
      getPrefs: () => safe(() => Promise.resolve(db.getPrefs())),
      // 渲染层会写 window.api.setPref(...).catch(() => {})，必须返回 Promise 才与桌面
      // preload 的 ipc invoke 同形；同步返回对象会让 .catch 直接 TypeError。
      async setPref(key, value) {
        const r = db.setPref(String(key), value);
        return r.error ? { ok: false, error: r.error } : { ok: true, data: r };
      },

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

}).call(window);
