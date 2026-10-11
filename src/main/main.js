'use strict';

const { app, BrowserWindow, ipcMain, shell, dialog, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { createDb } = require('../core/db');
const { translateText } = require('../core/translator');
const { createAuth, DEFAULT_USER, DEFAULT_PASSWORD } = require('../core/auth');
const lore = require('../core/lore');

let store = null;
let auth = null;
let devUnlocked = false;
let fails = 0;
let lockUntil = 0;
let pendingUndo = null;
let pendingImport = null;

const ATTEMPT_LIMIT = 5;
const LOCK_MS = 30000;
const UNDO_WINDOW_MS = 60000;
const IMPORT_STALE_MS = 10 * 60000;
const IMG_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);
const TRACE_LIMIT = 240;
const LOG_MAX_BYTES = 512 * 1024;

// ---- 日志：出问题时用户能把文件发过来，不用靠复现 ----
let logDir = null;

function logLine(scope, msg) {
  if (!logDir) return;
  try {
    fs.mkdirSync(logDir, { recursive: true });
    const file = path.join(logDir, 'app.log');
    if (fs.existsSync(file) && fs.statSync(file).size > LOG_MAX_BYTES) fs.renameSync(file, file + '.1');
    fs.appendFileSync(file, `[${new Date().toISOString()}] ${scope}: ${msg}\n`, 'utf8');
  } catch {
    /* 写日志自己失败时不能再抛出去 */
  }
}

function logError(scope, err) {
  logLine(scope, (err && (err.stack || err.message)) || String(err));
}

function onPersistError(scope, err) {
  logError(scope + ':persist', err);
}

function mediaDir() {
  return path.join(app.getPath('userData'), 'media');
}

function initStore() {
  logDir = path.join(app.getPath('userData'), 'logs');
  const seed = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'core', 'seed.json'), 'utf8'));
  const filePath = path.join(app.getPath('userData'), 'linyu.db');
  return createDb({ filePath, seed, lore, onPersistError }).then((s) => {
    store = s;
    auth = createAuth({ getSetting: (k) => s.getSetting(k), setSetting: (k, v) => s.setSetting(k, v) });
    auth.ensureInit();
    upgradeContent(s);
    return s;
  });
}

// 覆盖安装的老库不会凭空长出新版内容，也不会在升级时被清掉剔除的梗与名言，
// 所以每个版本第一次启动时做一次内容迁移（只加缺失的、只删名单里的，用户改过的行不动）。
function upgradeContent(s) {
  try {
    const ver = app.getVersion();
    if (s.getSetting('content.version') === ver) return;
    const r = s.upgradeSeed();
    s.setSetting('content.version', ver);
    if (r.removed || r.added || r.patched) logLine('content', `随 ${ver} 迁移内置内容：补入 ${r.added} 条，清理 ${r.removed} 条，回填配图 ${r.patched || 0} 张`);
  } catch (err) {
    logError('content', err);
  }
}

function wrap(fn) {
  return async (event, ...args) => {
    try {
      return { ok: true, data: await fn(...args) };
    } catch (err) {
      logError('ipc', err);
      return { ok: false, error: err.message };
    }
  };
}

// 所有写操作都必须先通过设置里的开发者账号；渲染层隐藏按钮只是体验，真正的门禁在这里。
function wrapDev(fn) {
  return async (event, ...args) => {
    try {
      if (!devUnlocked) throw new Error('请先在「设置 → 开发者模式」中登录开发者账号');
      const data = await fn(...args);
      if (data && data.undo) pendingUndo = { undo: data.undo, at: Date.now() };
      return { ok: true, data };
    } catch (err) {
      logError('ipc:dev', err);
      return { ok: false, error: err.message };
    }
  };
}

function mustOk(result) {
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

function clearUndo() {
  pendingUndo = null;
}

function translate(text, mode) {
  const src = String(text || '').slice(0, 5000);
  const preview = mode === 'preview';
  // 命中链路只在开发者模式下回传，普通使用时不占 IPC 体积
  const wantTrace = devUnlocked;
  const trace = wantTrace ? [] : null;
  const uncovered = wantTrace ? [] : null;
  const dst = translateText(src, {
    words: store.getWords(),
    rules: store.getRules(),
    trace,
    uncovered,
    traceLimit: TRACE_LIMIT,
  });
  if (src.trim() && !preview) store.addHistory(src, dst);
  return { dst, preview, trace: wantTrace ? trace : null, uncovered: wantTrace ? uncovered : null };
}

function readPref(key, fallback) {
  const raw = store.getPrefs()[key];
  if (raw == null || raw === '') return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function writePref(key, value) {
  store.setPref(key, JSON.stringify(value));
}

// ---- 图片：开发者上传的图存在 userData/media，库里只记 media:<name> ----
function collectMedia() {
  if (!fs.existsSync(mediaDir())) return [];
  return fs
    .readdirSync(mediaDir())
    .filter((n) => IMG_EXT.has(path.extname(n).toLowerCase()))
    .map((n) => ({ name: n, base64: fs.readFileSync(path.join(mediaDir(), n)).toString('base64') }));
}

function restoreMedia(list) {
  if (!Array.isArray(list) || !list.length) return 0;
  fs.mkdirSync(mediaDir(), { recursive: true });
  let n = 0;
  for (const m of list) {
    if (!m || typeof m !== 'object') continue;
    const name = path.basename(String(m.name || ''));
    if (!IMG_EXT.has(path.extname(name).toLowerCase())) continue;
    const buf = Buffer.from(String(m.base64 || ''), 'base64');
    if (!buf.length || buf.length > 8 * 1024 * 1024) continue;
    fs.writeFileSync(path.join(mediaDir(), name), buf);
    n++;
  }
  return n;
}

function registerIpc() {
  ipcMain.handle('ly:translate', wrap((text, mode) => translate(text, mode)));

  ipcMain.handle('ly:auth:status', wrap(() => authStatus()));
  ipcMain.handle(
    'ly:auth:login',
    wrap((username, password) => {
      if (Date.now() < lockUntil) throw new Error(`尝试过于频繁，请 ${Math.ceil((lockUntil - Date.now()) / 1000)} 秒后再试`);
      if (!auth.verify(username, password)) {
        fails += 1;
        if (fails >= ATTEMPT_LIMIT) {
          lockUntil = Date.now() + LOCK_MS;
          fails = 0;
          logLine('auth', `开发者登录连续失败 ${ATTEMPT_LIMIT} 次，锁定 ${LOCK_MS / 1000} 秒`);
          throw new Error(`账号或密码错误，已锁定 ${LOCK_MS / 1000} 秒`);
        }
        throw new Error(`账号或密码错误（还可尝试 ${ATTEMPT_LIMIT - fails} 次）`);
      }
      fails = 0;
      lockUntil = 0;
      devUnlocked = true;
      logLine('auth', '开发者模式已开启');
      return authStatus();
    })
  );
  ipcMain.handle('ly:auth:logout', wrap(() => {
    devUnlocked = false;
    clearUndo();
    return authStatus();
  }));
  ipcMain.handle('ly:auth:changePassword', wrapDev((oldPassword, newPassword) => {
    mustOk(auth.changePassword(oldPassword, newPassword));
    return { ok: true };
  }));

  ipcMain.handle('ly:words:list', wrap(() => store.getWords()));
  ipcMain.handle('ly:words:add', wrapDev((w) => mustOk(store.addWord(w))));
  ipcMain.handle('ly:words:update', wrapDev((id, w) => mustOk(store.updateWord(id, w))));
  ipcMain.handle('ly:words:delete', wrapDev((id) => mustOk(store.deleteWord(id))));

  ipcMain.handle('ly:rules:list', wrap(() => store.getRules()));
  ipcMain.handle('ly:rules:add', wrapDev((r) => mustOk(store.addRule(r))));
  ipcMain.handle('ly:rules:update', wrapDev((id, r) => mustOk(store.updateRule(id, r))));
  ipcMain.handle('ly:rules:delete', wrapDev((id) => mustOk(store.deleteRule(id))));

  ipcMain.handle('ly:cards:list', wrap(() => store.getCards()));
  ipcMain.handle('ly:cards:add', wrapDev((c) => mustOk(store.addCard(c))));
  ipcMain.handle('ly:cards:update', wrapDev((id, c) => mustOk(store.updateCard(id, c))));
  ipcMain.handle('ly:cards:delete', wrapDev((id) => mustOk(store.deleteCard(id))));

  ipcMain.handle('ly:quotes:list', wrap(() => store.getQuotes()));
  ipcMain.handle('ly:quotes:add', wrapDev((q) => mustOk(store.addQuote(q))));
  ipcMain.handle('ly:quotes:update', wrapDev((id, q) => mustOk(store.updateQuote(id, q))));
  ipcMain.handle('ly:quotes:delete', wrapDev((id) => mustOk(store.deleteQuote(id))));

  ipcMain.handle('ly:heroes:list', wrap(() => store.getHeroes()));
  ipcMain.handle('ly:heroes:add', wrapDev((h) => mustOk(store.addHero(h))));
  ipcMain.handle('ly:heroes:update', wrapDev((id, h) => mustOk(store.updateHero(id, h))));
  ipcMain.handle('ly:heroes:delete', wrapDev((id) => mustOk(store.deleteHero(id))));

  // 撤销只针对"上一步删除/清空"，主进程只留一个槽位，取用即失效
  ipcMain.handle('ly:undo:delete', wrapDev(() => {
    if (!pendingUndo) throw new Error('没有可撤销的操作了');
    if (Date.now() - pendingUndo.at > UNDO_WINDOW_MS) {
      clearUndo();
      throw new Error('撤销时间已过，请重新添加内容');
    }
    const slot = pendingUndo;
    clearUndo();
    return mustOk(store.undoDelete(slot));
  }));
  ipcMain.handle('ly:undo:state', wrap(() => ({
    available: Boolean(pendingUndo && devUnlocked && Date.now() - pendingUndo.at <= UNDO_WINDOW_MS),
    label: pendingUndo ? pendingUndo.undo.label : '',
  })));

  ipcMain.handle('ly:data:syncSeed', wrapDev(() => mustOk(store.syncFromSeed())));
  ipcMain.handle('ly:data:inspect', wrap(() => store.inspect()));
  ipcMain.handle('ly:data:cleanHeroWords', wrapDev((list) => mustOk(store.cleanHeroWords(list))));

  ipcMain.handle('ly:data:export', wrap(async ({ includeMedia } = {}) => {
    const payload = store.exportAll();
    if (includeMedia) payload.media = collectMedia();
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const r = await dialog.showSaveDialog({
      title: '导出淋语数据',
      defaultPath: `淋语数据-${stamp}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (r.canceled || !r.filePath) return { canceled: true };
    fs.writeFileSync(r.filePath, JSON.stringify(payload, null, 2), 'utf8');
    logLine('data', `已导出 ${r.filePath}（${JSON.stringify(payload.counts)}）`);
    return { canceled: false, file: r.filePath, counts: payload.counts, media: (payload.media || []).length };
  }));

  ipcMain.handle('ly:data:pickImport', wrap(async () => {
    const r = await dialog.showOpenDialog({
      title: '选择要导入的数据文件',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (r.canceled || !r.filePaths.length) return { canceled: true };
    const file = r.filePaths[0];
    let payload;
    try {
      payload = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      throw new Error('文件不是有效的 JSON');
    }
    const plan = mustOk(store.planImport(payload, 'merge'));
    pendingImport = { payload, file, at: Date.now() };
    return { canceled: false, file, ...plan };
  }));

  ipcMain.handle('ly:data:replan', wrap(({ strategy } = {}) => {
    if (!pendingImport || Date.now() - pendingImport.at > IMPORT_STALE_MS) throw new Error('请先重新选择导入文件');
    const plan = mustOk(store.planImport(pendingImport.payload, strategy));
    return { canceled: false, file: pendingImport.file, ...plan };
  }));

  ipcMain.handle('ly:data:applyImport', wrapDev(({ strategy } = {}) => {
    if (!pendingImport || Date.now() - pendingImport.at > IMPORT_STALE_MS) {
      throw new Error('请先重新选择导入文件');
    }
    const slot = pendingImport;
    pendingImport = null;
    if (Array.isArray(slot.payload.media)) restoreMedia(slot.payload.media);
    const result = mustOk(store.applyImport(slot.payload, strategy));
    logLine('data', `从 ${slot.file} 导入：新增 ${result.add} / 更新 ${result.update} / 跳过 ${result.skip}`);
    return { ...result, file: slot.file };
  }));

  ipcMain.handle('ly:data:cancelImport', wrap(() => {
    pendingImport = null;
    return { ok: true };
  }));

  ipcMain.handle('ly:backups:list', wrap(() => store.listBackups()));
  ipcMain.handle('ly:backups:restore', wrapDev((name) => {
    const r = mustOk(store.restoreBackup(name));
    logLine('backup', `已从 ${name} 恢复数据库`);
    return r;
  }));
  ipcMain.handle('ly:backups:restoreBefore', wrapDev(() => mustOk(store.restoreBefore())));

  ipcMain.handle('ly:media:pick', wrapDev(async () => {
    const r = await dialog.showOpenDialog({
      title: '选择英雄图片',
      properties: ['openFile'],
      filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }],
    });
    if (r.canceled || !r.filePaths.length) return { canceled: true };
    const from = r.filePaths[0];
    const ext = path.extname(from).toLowerCase();
    if (!IMG_EXT.has(ext)) throw new Error('仅支持 png/jpg/jpeg/gif/webp');
    const stat = fs.statSync(from);
    if (stat.size > 8 * 1024 * 1024) throw new Error('图片请控制在 8MB 以内');
    const name = crypto.randomBytes(8).toString('hex') + ext;
    fs.mkdirSync(mediaDir(), { recursive: true });
    fs.copyFileSync(from, path.join(mediaDir(), name));
    return { ref: 'media:' + name };
  }));

  ipcMain.handle('ly:media:data', wrap((ref) => {
    const name = path.basename(String(ref || '').replace(/^media:/, ''));
    const ext = path.extname(name).toLowerCase();
    if (!IMG_EXT.has(ext)) throw new Error('不支持的图片格式');
    const file = path.join(mediaDir(), name);
    if (!fs.existsSync(file)) throw new Error('图片文件不存在');
    const b64 = fs.readFileSync(file).toString('base64');
    const mime = ext === '.png' ? 'image/png' : ext === '.gif' ? 'image/gif' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
    return 'data:' + mime + ';base64,' + b64;
  }));

  ipcMain.handle('ly:history:list', wrap(() => store.getHistory()));
  ipcMain.handle('ly:history:clear', wrapDev(() => mustOk(store.clearHistory())));

  ipcMain.handle('ly:prefs:get', wrap(() => store.getPrefs()));
  ipcMain.handle('ly:prefs:set', wrap((key, value) => mustOk(store.setPref(String(key), value))));

  ipcMain.handle('ly:logs:open', wrap(() => {
    if (!logDir) throw new Error('日志目录还没建好');
    fs.mkdirSync(logDir, { recursive: true });
    // 顺手把最近错误摘出来，方便用户直接复制
    const tail = fs.existsSync(path.join(logDir, 'app.log'))
      ? fs.readFileSync(path.join(logDir, 'app.log'), 'utf8').split('\n').slice(-20).join('\n')
      : '';
    shell.openPath(logDir);
    return { dir: logDir, tail };
  }));

  ipcMain.handle('ly:meta', wrap(() => ({
    defaultUser: DEFAULT_USER,
    defaultPassword: auth.usesDefaultPassword() ? DEFAULT_PASSWORD : '',
    version: app.getVersion(),
    historyLimit: store.historyLimit(),
  })));

  ipcMain.handle('ly:openExternal', wrap(async (url) => {
    const raw = String(url || '');
    let u;
    try {
      u = new URL(raw);
    } catch {
      throw new Error('非法链接');
    }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      throw new Error('仅允许打开 http/https 链接');
    }
    await shell.openExternal(raw);
    return true;
  }));
}

function savedBounds() {
  const b = readPref('win.bounds', null);
  if (!b || typeof b !== 'object') return null;
  const n = (v) => (Number.isFinite(v) ? Math.round(v) : null);
  const width = n(b.width);
  const height = n(b.height);
  if (!width || !height) return null;
  // 显示器拔掉/分辨率变了，存的位置可能已经在屏幕外，那就只保留尺寸
  const x = n(b.x);
  const y = n(b.y);
  if (x == null || y == null) return { width, height };
  const onScreen = screen.getAllDisplays().some((d) => {
    const a = d.workArea;
    return x < a.x + a.width - 60 && x + 60 > a.x && y < a.y + a.height - 60 && y + 60 > a.y;
  });
  return onScreen ? { width, height, x, y } : { width, height };
}

function createWindow() {
  const bounds = savedBounds();
  const win = new BrowserWindow({
    width: bounds ? bounds.width : 1120,
    height: bounds ? bounds.height : 760,
    x: bounds ? bounds.x : undefined,
    y: bounds ? bounds.y : undefined,
    minWidth: 920,
    minHeight: 620,
    title: '淋语翻译器',
    icon: path.join(__dirname, '..', '..', 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.setMenuBarVisibility(false);

  // 尺寸即时（防抖）落盘，别只指望 close 事件：强杀、崩溃、渲染层自己调 window.close() 都不会走到那里
  let boundsTimer = null;
  function saveGeometry() {
    clearTimeout(boundsTimer);
    boundsTimer = null;
    try {
      writePref('win.bounds', win.getBounds());
      writePref('win.maximized', win.isMaximized());
    } catch (err) {
      logError('win:bounds', err);
    }
  }
  function rememberGeometry() {
    clearTimeout(boundsTimer);
    boundsTimer = setTimeout(saveGeometry, 800);
  }
  win.on('resize', rememberGeometry);
  win.on('move', rememberGeometry);
  if (readPref('win.maximized', false) === true) win.maximize();
  win.on('close', () => {
    // 开发者模式只在本次窗口会话内有效，关窗即锁
    devUnlocked = false;
    clearUndo();
    saveGeometry();
  });
  win.webContents.on('will-navigate', (event, target) => {
    if (target !== win.webContents.getURL()) event.preventDefault();
  });
  win.webContents.on('render-process-gone', (event, details) => {
    logLine('win', 'render-process-gone ' + JSON.stringify(details));
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const u = new URL(url);
      if (u.protocol === 'http:' || u.protocol === 'https:') shell.openExternal(url);
    } catch {
      /* 忽略非法链接 */
    }
    return { action: 'deny' };
  });
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
}

// 双开会让两个进程各持一份内存库互相整文件覆盖，后写的把先写的静默冲掉，所以只允许单实例
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });

  app.whenReady().then(async () => {
    await initStore();
    logLine('app', `启动 v${app.getVersion()}（Electron ${process.versions.electron}），库目录 ${app.getPath('userData')}`);
    // 忘了改过的开发者密码时用 exe --reset-dev-password 恢复成默认账号（只重置密码，不动词库数据）
    if (process.argv.includes('--reset-dev-password')) {
      auth.resetToDefault();
      logLine('auth', '开发者密码已通过 --reset-dev-password 重置为默认值');
      dialog.showMessageBoxSync({ type: 'info', title: '淋语翻译器', message: `开发者账号已重置：${DEFAULT_USER} / ${DEFAULT_PASSWORD}\n词库数据没有改动。`, buttons: ['好'] });
      app.quit();
      return;
    }
    registerIpc();
    createWindow();
    const rec = store.recoveryInfo();
    if (rec) {
      dialog.showMessageBox({
        type: 'warning',
        title: '淋语翻译器',
        message: rec.fromBackup
          ? `词库文件读不通，已自动改用备份 ${rec.fromBackup} 继续。\n坏掉的文件留在了用户目录里的 ${rec.quarantine}，需要的话可以手动取回。`
          : `词库文件读不通，而且没有可用的备份，已经重建了一个空库。\n坏掉的文件留在了用户目录里的 ${rec.quarantine}。`,
        buttons: ['知道了'],
      });
    }
  });

  app.on('window-all-closed', () => {
    if (store) store.close();
    app.quit();
  });
}
