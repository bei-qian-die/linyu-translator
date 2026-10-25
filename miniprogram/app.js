'use strict';

const { getPrefs, setPref, resetPrefs, applyChrome } = require('./services/prefs');
const { HISTORY_KEY, flush: flushHistory } = require('./services/history');
// 静态计数：不再为 5 个数字 require 整个 content/lore。App 启动只加载 counts；
// 翻译页按需加载 seed（v1.18 约 390KB），lore（约 1.23MB）延后到词库/人物页（A4）
const counts = require('./data/counts');
const version = require('./data/version');

function realtimeLog() {
  try {
    if (typeof wx.getRealtimeLogManager === 'function') return wx.getRealtimeLogManager();
  } catch (err) {
    // ignore
  }
  return null;
}

App({
  globalData: {
    version,
    theme: 'white',
    live: true,
    historyLimit: 200,
    pendingInput: '',
    counts,
  },

  onLaunch() {
    const prefs = getPrefs();
    this.globalData.theme = prefs.theme;
    this.globalData.live = prefs.live;
    this.globalData.historyLimit = prefs.historyLimit;
    applyChrome(prefs.theme, { customNav: true });
    this.setupPrivacy();
  },

  // 剪贴板属微信隐私接口：后台声明「读取你的剪切板」+ app.json 开 __usePrivacyCheck__ 后，
  // 首次复制/粘贴会触发此回调，向用户说明用途并取得同意（A1）。
  setupPrivacy() {
    if (typeof wx.onNeedPrivacyAuthorization !== 'function') return;
    wx.onNeedPrivacyAuthorization((resolve) => {
      wx.showModal({
        title: '剪贴板使用说明',
        content: '仅在您主动点击「复制 / 粘贴」时读写本机剪贴板，内容不会上传服务器。',
        confirmText: '同意',
        cancelText: '拒绝',
        success: (res) => resolve({ event: res.confirm ? 'agree' : 'disagree' }),
        fail: () => resolve({ event: 'disagree' }),
      });
    });
  },

  // 全局错误兜底：线上异常至少能落到控制台与实时日志，便于定位（A5）
  reportError(kind, err) {
    console.error('[linyu] ' + kind, err);
    const log = realtimeLog();
    if (log && log.error) log.error(kind, String(err).slice(0, 300));
  },

  onError(err) {
    this.reportError('onError', err);
  },

  onUnhandledRejection(res) {
    this.reportError('onUnhandledRejection', res && res.reason ? res.reason : res);
  },

  // 历史写入是节流异步的，进后台时强制落盘，避免被杀进程丢数据（B4）
  onHide() {
    flushHistory();
  },

  applyTheme(theme) {
    const prefs = setPref('theme', theme);
    this.globalData.theme = prefs.theme;
    applyChrome(prefs.theme, { customNav: true });
    return prefs.theme;
  },

  setLive(on) {
    const prefs = setPref('live', Boolean(on));
    this.globalData.live = prefs.live;
    return prefs.live;
  },

  setHistoryLimit(limit) {
    this.globalData.historyLimit = Number(limit) || 200;
  },

  resetLocalData() {
    try {
      wx.removeStorageSync(HISTORY_KEY);
    } catch (err) {
      // ignore
    }
    const prefs = resetPrefs();
    this.globalData.theme = prefs.theme;
    this.globalData.live = prefs.live;
    this.globalData.historyLimit = prefs.historyLimit;
    this.globalData.pendingInput = '';
    applyChrome(prefs.theme, { customNav: true });
    return prefs;
  },
});
