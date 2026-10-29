'use strict';

const { app, BrowserWindow, ipcMain, shell, dialog, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { createDb } = require('../core/db');
const { translateText } = require('../core/translator');
const { createAuth, DEFAULT_USER, DEFAULT_PASSWORD } = require('../core/auth');
const { createService } = require('../core/service');
const { createOllamaClient, listOllamaModels, pickModel } = require('../core/llm-polish');
const lore = require('../core/lore');

let store = null;
let auth = null;
let svc = null;
let pendingImport = null;

const IMG_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);
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
    // 业务规则统一走 src/core/service.js：门禁、撤销槽位、导入暂存过期、登录锁定
    // 都只在那一份里，主进程只留下平台相关的部分（对话框、media 目录、日志、窗口）。
    svc = createService({
      db: s,
      auth,
      translator: { translateText },
      version: app.getVersion(),
      // Phase 2：把本地 Ollama（qwen3:8b）作为润色后处理层。polish 是个闭包，
      // 运行时按偏好（ollamaBaseUrl / ollamaModel）现建客户端，模型不可用则回退草稿。
      polish: makePolish(),
    });
    return s;
  });
}

// 构造润色函数：读库里的偏好决定连哪个本地模型，调用 Ollama /api/chat 做淋语润色。
// 用户没显式指定模型时，按本机 /api/tags 实际装了谁自动挑（60s 内复用结果），
// 否则写死的默认名一旦和本机 tag 不一致（qwen3:8b vs qwen3:8b-fast）就会永远静默回退草稿。
const modelCache = { at: 0, baseUrl: '', model: '' };

function makePolish() {
  return async (source, draft) => {
    const prefs = store ? store.getPrefs() : {};
    const raw = (k, d) => {
      const v = prefs[k];
      if (v == null || v === '') return d;
      try {
        return JSON.parse(v);
      } catch {
        return v;
      }
    };
    const baseUrl = raw('ollamaBaseUrl', 'http://localhost:11434');
    let model = String(raw('ollamaModel', '') || '').trim();
    if (!model) {
      const fresh = modelCache.baseUrl === baseUrl && Date.now() - modelCache.at < 60000;
      model = fresh && modelCache.model ? modelCache.model : '';
      if (!model) {
        model = pickModel(await listOllamaModels(baseUrl), '');
        modelCache.at = Date.now();
        modelCache.baseUrl = baseUrl;
        modelCache.model = model;
      }
    }
    if (!model) {
      throw new Error('本机 Ollama 里没有可用模型（' + baseUrl + '），或 Ollama 未启动');
    }
    const client = createOllamaClient({ baseUrl, model });
    return client.polish(source, draft);
  };
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

// 写操作的门禁在 src/core/service.js 里（未登录就抛错），这里只负责把异常转成 IPC 返回值。
// 以前主进程与移动端各写一份同样的门禁逻辑，加接口要改两处，现在都收敛到 service。

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
  ipcMain.handle('ly:translate', wrap((text, mode) => svc.translate(text, mode)));
  // Phase 2：LLM 润色后处理。桌面主进程跑本地 Ollama，模型不可达时 polishDraft 回退草稿。
  ipcMain.handle('ly:polish', wrap(async (source, draft) => svc.polishDraft(source, draft)));

  ipcMain.handle('ly:auth:status', wrap(() => svc.authStatus()));
  ipcMain.handle('ly:auth:login', wrap((username, password) => {
    const r = svc.login(username, password);
    logLine('auth', '开发者模式已开启');
    return r;
  }));
  ipcMain.handle('ly:auth:logout', wrap(() => svc.logout()));
  ipcMain.handle('ly:auth:changePassword', wrap((oldPassword, newPassword) => svc.changePassword(oldPassword, newPassword)));

  // 五板块 CRUD：业务规则（门禁 / 撤销槽位）在 service 里，这里只做转发
  const CRUD = [
    ['words', 'ly:words'],
    ['rules', 'ly:rules'],
    ['cards', 'ly:cards'],
    ['quotes', 'ly:quotes'],
    ['heroes', 'ly:heroes'],
  ];
  for (const [key, channel] of CRUD) {
    const api = svc.crud[key];
    ipcMain.handle(channel + ':list', wrap(() => api.list()));
    ipcMain.handle(channel + ':add', wrap((row) => api.add(row)));
    ipcMain.handle(channel + ':update', wrap((id, row) => api.update(id, row)));
    ipcMain.handle(channel + ':delete', wrap((id) => api.remove(id)));
  }

  ipcMain.handle('ly:undo:delete', wrap(() => svc.undoDelete()));
  ipcMain.handle('ly:undo:state', wrap(() => svc.undoState()));

  ipcMain.handle('ly:data:syncSeed', wrap(() => svc.syncSeed()));
  ipcMain.handle('ly:data:inspect', wrap(() => svc.inspect()));
  ipcMain.handle('ly:data:cleanHeroWords', wrap((list) => svc.cleanHeroWords(list)));

  ipcMain.handle('ly:data:export', wrap(async ({ includeMedia } = {}) => {
    const payload = svc.exportPayload({ includeMedia, collectMedia });
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
    const plan = svc.planImport(payload, 'merge');
    svc.stashImport(payload, file);
    return { canceled: false, file, ...plan };
  }));

  ipcMain.handle('ly:data:replan', wrap(({ strategy } = {}) => {
    const r = svc.replanImport(strategy);
    return { canceled: false, file: r.file, ...r.plan };
  }));

  ipcMain.handle('ly:data:applyImport', wrap(({ strategy } = {}) => {
    // 落库前先把图片写回 userData/media：库里只记 media:<name>，文件得先存在
    const slot = svc.peekImport();
    if (slot && Array.isArray(slot.payload.media)) restoreMedia(slot.payload.media);
    const r = svc.applyImport(strategy);
    logLine('data', `从 ${r.file} 导入：新增 ${r.result.add} / 更新 ${r.result.update} / 跳过 ${r.result.skip}`);
    return { ...r.result, file: r.file };
  }));

  ipcMain.handle('ly:data:cancelImport', wrap(() => svc.cancelImport()));

  ipcMain.handle('ly:backups:list', wrap(() => svc.listBackups()));
  ipcMain.handle('ly:backups:restore', wrap((name) => {
    const r = svc.restoreBackup(name);
    logLine('backup', `已从 ${name} 恢复数据库`);
    return r;
  }));
  ipcMain.handle('ly:backups:restoreBefore', wrap(() => svc.restoreBefore()));

  ipcMain.handle('ly:history:list', wrap(() => svc.listHistory()));
  ipcMain.handle('ly:history:clear', wrap(() => svc.clearHistory()));

  ipcMain.handle('ly:prefs:get', wrap(() => svc.getPrefs()));
  ipcMain.handle('ly:prefs:set', wrap((key, value) => svc.setPref(String(key), value)));

  ipcMain.handle('ly:meta', wrap(() => svc.meta()));

  // ---- 以下是桌面独有的：图片目录、日志目录、外部链接 ----
  ipcMain.handle('ly:media:pick', wrap(async () => {
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
  const b = svc.readPref('win.bounds', null);
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
      svc.writePref('win.bounds', win.getBounds());
      svc.writePref('win.maximized', win.isMaximized());
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
  if (svc.readPref('win.maximized', false) === true) win.maximize();
  win.on('close', () => {
    // 开发者模式只在本次窗口会话内有效，关窗即锁
    svc.lockDev();
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
