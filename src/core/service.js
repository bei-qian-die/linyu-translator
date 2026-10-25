// @ts-check
'use strict';

/*
 * 与平台无关的业务层。
 *
 * 桌面（Electron 主进程，src/main/main.js）与移动端（Capacitor WebView，src/mobile/api.js）
 * 以前各写了一份同样的东西：开发者门禁、登录失败锁定、撤销槽位、导入暂存过期、
 * 五板块 CRUD 的「查错误 → 存撤销」。加一个接口要改两处，还容易只改一边。
 *
 * 现在这些都只写在这一份里，两端只负责自己那半件事：
 *   · 桌面：文件对话框、userData/media 目录、写日志文件、窗口几何、外部链接
 *   · 移动：Capacitor 的文件选择/分享/屏幕方向、内存日志缓冲
 *
 * 约定：成功就返回数据，失败一律 throw。
 * 桌面用 ipcMain 的 wrap 捕获成 { ok:false, error }，移动端用 safe() 捕获成同样形状，
 * 两边的渲染层看到的东西保持一致。
 */

const DEV_GATE = '请先在「设置 → 开发者模式」中登录开发者账号';

// 五板块的方法名映射：db 层是 getWords/addWord/updateWord/deleteWord，
// heroes 是 getHeroes 配 addHero——复数与单数不统一，所以显式列一张表。
const SECTIONS = [
  { key: 'words', get: 'getWords', add: 'addWord', update: 'updateWord', del: 'deleteWord' },
  { key: 'rules', get: 'getRules', add: 'addRule', update: 'updateRule', del: 'deleteRule' },
  { key: 'cards', get: 'getCards', add: 'addCard', update: 'updateCard', del: 'deleteCard' },
  { key: 'quotes', get: 'getQuotes', add: 'addQuote', update: 'updateQuote', del: 'deleteQuote' },
  { key: 'heroes', get: 'getHeroes', add: 'addHero', update: 'updateHero', del: 'deleteHero' },
];

/**
 * @param {Object} deps
 * @param {any} deps.db createDb 出来的库
 * @param {any} deps.auth createAuth 出来的认证
 * @param {any} deps.translator 翻译引擎（{ translateText }）
 * @param {string} deps.version 应用版本号
 * @param {Object} [deps.config] 阈值覆盖
 */
function createService({ db, auth, translator, version, config }) {
  const cfg = config || {};
  const TRACE_LIMIT = cfg.traceLimit || 240;
  const UNDO_WINDOW_MS = cfg.undoWindowMs || 60000;
  const IMPORT_STALE_MS = cfg.importStaleMs || 10 * 60 * 1000;
  const ATTEMPT_LIMIT = cfg.attemptLimit || 5;
  const LOCK_MS = cfg.lockMs || 30000;

  let devUnlocked = false;
  let fails = 0;
  let lockUntil = 0;
  let pendingUndo = null;
  let pendingImport = null;
  /** @type {Array<(s: any) => void>} */
  let undoListeners = [];
  /** @type {Array<() => void>} */
  let ioListeners = [];

  // ---- 撤销槽位 ----
  function emitUndo() {
    const state = undoState();
    undoListeners.forEach((cb) => cb(state));
  }
  function setUndoSlot(undo) {
    pendingUndo = { undo, at: Date.now() };
    emitUndo();
  }
  function clearUndoSlot() {
    pendingUndo = null;
    emitUndo();
  }
  function undoState() {
    return {
      available: Boolean(pendingUndo && devUnlocked && Date.now() - pendingUndo.at <= UNDO_WINDOW_MS),
      label: pendingUndo ? pendingUndo.undo.label : '',
    };
  }

  // ---- 开发者门禁 ----
  function devOnly() {
    if (!devUnlocked) throw new Error(DEV_GATE);
  }
  /** db 层用 { error } 表示失败，这里统一成抛异常 */
  function ok(result) {
    if (result && result.error) throw new Error(result.error);
    return result;
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

  function login(username, password) {
    if (Date.now() < lockUntil) {
      throw new Error(`尝试过于频繁，请 ${Math.ceil((lockUntil - Date.now()) / 1000)} 秒后再试`);
    }
    if (!auth.verify(username, password)) {
      fails += 1;
      if (fails >= ATTEMPT_LIMIT) {
        lockUntil = Date.now() + LOCK_MS;
        fails = 0;
        throw new Error(`账号或密码错误，已锁定 ${LOCK_MS / 1000} 秒`);
      }
      throw new Error(`账号或密码错误（还可尝试 ${ATTEMPT_LIMIT - fails} 次）`);
    }
    fails = 0;
    lockUntil = 0;
    devUnlocked = true;
    return authStatus();
  }

  function logout() {
    devUnlocked = false;
    clearUndoSlot();
    return authStatus();
  }

  // 桌面关窗、移动端退到后台时把开发者模式锁回去
  function lockDev() {
    devUnlocked = false;
    clearUndoSlot();
  }

  function changePassword(oldPassword, newPassword) {
    devOnly();
    return ok(auth.changePassword(oldPassword, newPassword));
  }

  function meta() {
    return {
      defaultUser: auth.DEFAULT_USER,
      defaultPassword: auth.usesDefaultPassword() ? auth.DEFAULT_PASSWORD : '',
      version,
      historyLimit: db.historyLimit(),
    };
  }

  // ---- 翻译 ----
  function translate(text, mode) {
    const src = String(text || '').slice(0, 5000);
    const preview = mode === 'preview';
    // 命中链路只在开发者模式下回传，普通使用时不占 IPC 体积
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

  // ---- 五板块 CRUD ----
  /** @type {Record<string, any>} */
  const crud = {};
  for (const s of SECTIONS) {
    crud[s.key] = {
      list: () => db[s.get](),
      add: (row) => {
        devOnly();
        return ok(db[s.add](row));
      },
      update: (id, row) => {
        devOnly();
        return ok(db[s.update](id, row));
      },
      remove: (id) => {
        devOnly();
        const r = ok(db[s.del](id));
        if (r && r.undo) setUndoSlot(r.undo);
        return r;
      },
    };
  }

  function undoDelete() {
    devOnly();
    if (!pendingUndo) throw new Error('没有可撤销的操作了');
    if (Date.now() - pendingUndo.at > UNDO_WINDOW_MS) {
      clearUndoSlot();
      throw new Error('撤销时间已过，请重新添加内容');
    }
    const slot = pendingUndo;
    clearUndoSlot();
    return ok(db.undoDelete(slot));
  }

  // ---- 导入导出：落盘 / 选文件由各端做，这里只管 payload 与暂存 ----
  function exportPayload(opts) {
    const payload = db.exportAll();
    if (opts && opts.includeMedia && typeof opts.collectMedia === 'function') {
      payload.media = opts.collectMedia();
    }
    return payload;
  }

  function stashImport(payload, file) {
    pendingImport = { payload, file: file || '', at: Date.now() };
    ioListeners.forEach((cb) => cb());
    return pendingImport;
  }
  function currentImport() {
    if (!pendingImport) throw new Error('请先重新选择导入文件');
    if (Date.now() - pendingImport.at > IMPORT_STALE_MS) {
      pendingImport = null;
      throw new Error('请先重新选择导入文件');
    }
    return pendingImport;
  }
  function planImport(payload, strategy) {
    return ok(db.planImport(payload, strategy || 'merge'));
  }
  // 桌面端要在落库前先把 payload.media 写回 userData/media，得先看到暂存内容；
  // 移动端不需要，它整个过程都在内存里。
  function peekImport() {
    if (!pendingImport || Date.now() - pendingImport.at > IMPORT_STALE_MS) return null;
    return pendingImport;
  }
  function replanImport(strategy) {
    const slot = currentImport();
    return { file: slot.file, plan: planImport(slot.payload, strategy) };
  }
  function applyImport(strategy) {
    devOnly();
    const slot = currentImport();
    pendingImport = null;
    ioListeners.forEach((cb) => cb());
    return { file: slot.file, result: ok(db.applyImport(slot.payload, strategy)) };
  }
  function cancelImport() {
    pendingImport = null;
    ioListeners.forEach((cb) => cb());
    return { ok: true };
  }

  // ---- 偏好：桌面与移动都靠 db.getPrefs/setPref 落库 ----
  function readPref(key, fallback) {
    const raw = db.getPrefs()[key];
    if (raw == null || raw === '') return fallback;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  function writePref(key, value) {
    // 返回 db 的结果：PREF_KEYS 白名单外的键会被拒掉，设置项必须能知道自己没写进去
    return db.setPref(key, JSON.stringify(value));
  }

  return {
    // 状态
    isDevUnlocked: () => devUnlocked,
    lockDev,
    authStatus,
    meta,

    // 认证
    login,
    logout,
    changePassword,

    // 翻译
    translate,

    // 五板块
    crud,

    // 撤销
    undoDelete,
    undoState,
    rememberUndo: setUndoSlot,
    clearUndo: clearUndoSlot,
    onUndoChange(cb) {
      undoListeners.push(cb);
      return () => {
        undoListeners = undoListeners.filter((x) => x !== cb);
      };
    },

    // 数据维护
    syncSeed() {
      devOnly();
      return ok(db.syncFromSeed());
    },
    inspect: () => db.inspect(),
    cleanHeroWords(list) {
      devOnly();
      return ok(db.cleanHeroWords(list));
    },
    listBackups: () => db.listBackups(),
    restoreBackup(name) {
      devOnly();
      return ok(db.restoreBackup(name));
    },
    restoreBefore() {
      devOnly();
      return ok(db.restoreBefore());
    },

    // 导入导出
    exportPayload,
    stashImport,
    peekImport,
    planImport,
    replanImport,
    applyImport,
    cancelImport,
    onIoChange(cb) {
      ioListeners.push(cb);
      return () => {
        ioListeners = ioListeners.filter((x) => x !== cb);
      };
    },

    // 历史与偏好
    listHistory: () => db.getHistory(),
    clearHistory() {
      devOnly();
      const r = ok(db.clearHistory());
      if (r && r.undo) setUndoSlot(r.undo);
      return r;
    },
    getPrefs: () => db.getPrefs(),
    setPref(key, value) {
      return ok(db.setPref(String(key), value));
    },
    readPref,
    writePref,
  };
}

if (typeof module === 'object' && module.exports) {
  module.exports = { createService, DEV_GATE, SECTIONS };
} else if (typeof window !== 'undefined') {
  window.LINYU_SERVICE = { createService };
}
