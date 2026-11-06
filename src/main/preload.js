'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  translate: (text, mode) => ipcRenderer.invoke('ly:translate', text, mode),
  // Phase 2：LLM 润色后处理（桌面端按设置选引擎：本机 Ollama / 智谱 GLM 直连）。
  polish: (source, draft) => ipcRenderer.invoke('ly:polish', source, draft),
  // 设置页「测试连接」：用固定样例试跑一次当前引擎，失败会把原因带回来
  probePolish: (opts) => ipcRenderer.invoke('ly:polish:probe', opts),

  authStatus: () => ipcRenderer.invoke('ly:auth:status'),
  login: (user, pass) => ipcRenderer.invoke('ly:auth:login', user, pass),
  logout: () => ipcRenderer.invoke('ly:auth:logout'),
  changePassword: (oldPass, newPass) => ipcRenderer.invoke('ly:auth:changePassword', oldPass, newPass),
  meta: () => ipcRenderer.invoke('ly:meta'),
  syncSeed: () => ipcRenderer.invoke('ly:data:syncSeed'),
  undoDelete: () => ipcRenderer.invoke('ly:undo:delete'),
  undoState: () => ipcRenderer.invoke('ly:undo:state'),
  inspect: () => ipcRenderer.invoke('ly:data:inspect'),
  cleanHeroWords: (list) => ipcRenderer.invoke('ly:data:cleanHeroWords', list),
  exportData: (opts) => ipcRenderer.invoke('ly:data:export', opts),
  pickImport: () => ipcRenderer.invoke('ly:data:pickImport'),
  replanImport: (opts) => ipcRenderer.invoke('ly:data:replan', opts),
  applyImport: (opts) => ipcRenderer.invoke('ly:data:applyImport', opts),
  cancelImport: () => ipcRenderer.invoke('ly:data:cancelImport'),
  listBackups: () => ipcRenderer.invoke('ly:backups:list'),
  restoreBackup: (name) => ipcRenderer.invoke('ly:backups:restore', name),
  restoreBefore: () => ipcRenderer.invoke('ly:backups:restoreBefore'),

  listWords: () => ipcRenderer.invoke('ly:words:list'),
  addWord: (w) => ipcRenderer.invoke('ly:words:add', w),
  updateWord: (id, w) => ipcRenderer.invoke('ly:words:update', id, w),
  deleteWord: (id) => ipcRenderer.invoke('ly:words:delete', id),

  listRules: () => ipcRenderer.invoke('ly:rules:list'),
  addRule: (r) => ipcRenderer.invoke('ly:rules:add', r),
  updateRule: (id, r) => ipcRenderer.invoke('ly:rules:update', id, r),
  deleteRule: (id) => ipcRenderer.invoke('ly:rules:delete', id),

  listCards: () => ipcRenderer.invoke('ly:cards:list'),
  addCard: (c) => ipcRenderer.invoke('ly:cards:add', c),
  updateCard: (id, c) => ipcRenderer.invoke('ly:cards:update', id, c),
  deleteCard: (id) => ipcRenderer.invoke('ly:cards:delete', id),

  listQuotes: () => ipcRenderer.invoke('ly:quotes:list'),
  addQuote: (q) => ipcRenderer.invoke('ly:quotes:add', q),
  updateQuote: (id, q) => ipcRenderer.invoke('ly:quotes:update', id, q),
  deleteQuote: (id) => ipcRenderer.invoke('ly:quotes:delete', id),

  listHeroes: () => ipcRenderer.invoke('ly:heroes:list'),
  addHero: (h) => ipcRenderer.invoke('ly:heroes:add', h),
  updateHero: (id, h) => ipcRenderer.invoke('ly:heroes:update', id, h),
  deleteHero: (id) => ipcRenderer.invoke('ly:heroes:delete', id),

  pickImage: () => ipcRenderer.invoke('ly:media:pick'),
  mediaData: (ref) => ipcRenderer.invoke('ly:media:data', ref),

  listHistory: () => ipcRenderer.invoke('ly:history:list'),
  clearHistory: () => ipcRenderer.invoke('ly:history:clear'),

  getPrefs: () => ipcRenderer.invoke('ly:prefs:get'),
  setPref: (key, value) => ipcRenderer.invoke('ly:prefs:set', key, value),

  // 音乐用户态（收藏 / 最近浏览），与 Web / 小程序端同名同语义
  getMusicFavs: () => ipcRenderer.invoke('ly:music:favs'),
  toggleMusicFav: (id, platform) => ipcRenderer.invoke('ly:music:toggleFav', id, platform),
  getMusicSeen: () => ipcRenderer.invoke('ly:music:seen'),
  markMusicSeen: (id) => ipcRenderer.invoke('ly:music:markSeen', id),

  openLogs: () => ipcRenderer.invoke('ly:logs:open'),

  openExternal: (url) => ipcRenderer.invoke('ly:openExternal', url),

  // 桌面窗口是可调大小的，没有"锁屏幕方向"这回事。保留同名 API 是为了渲染层不用到处判平台。
  orientationState: () => Promise.resolve({ ok: true, data: { supported: false, type: 'portrait', autoRotate: false } }),
  initOrientation: () => Promise.resolve({ ok: true, data: { supported: false, type: 'portrait', autoRotate: false } }),
  setOrientation: () => Promise.resolve({ ok: false, error: '桌面版无需锁定屏幕方向' }),
  setAutoRotate: () => Promise.resolve({ ok: false, error: '桌面版无需锁定屏幕方向' }),
  onOrientationChange: () => () => {},
});
