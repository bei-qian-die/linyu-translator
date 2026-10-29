'use strict';

const { getPrefs, setPref, resetPrefs, applyChrome } = require('./services/prefs');
const { HISTORY_KEY, flush: flushHistory } = require('./services/history');
// 静态计数：不再为 5 个数字 require 整个 content/lore。App 启动只加载 counts；
// 翻译页按需加载 seed（v1.18 约 390KB），lore（约 1.23MB）延后到词库/人物页（A4）
const counts = require('./data/counts');
const version = require('./data/version');

// 云开发环境 ID：在「微信开发者工具 → 云开发」开通环境后，把环境 ID 填到这里
// （形如 'linyu-3g8xxxxx'）。留空则不初始化云开发，小程序仍可纯本地翻译。
const CLOUD_ENV = 'cloud1-d2g2xfwdo0d1c6f60';

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
    polish: false,
    disambiguate: false,
    cloudReady: false,
    historyLimit: 200,
    pendingInput: '',
    counts,
  },

  onLaunch() {
    const prefs = getPrefs();
    this.globalData.theme = prefs.theme;
    this.globalData.live = prefs.live;
    this.globalData.polish = prefs.polish;
    this.globalData.disambiguate = prefs.disambiguate;
    this.globalData.historyLimit = prefs.historyLimit;
    applyChrome(prefs.theme, { customNav: true });
    this.initCloud();
    this.setupPrivacy();
  },

  // 初始化云开发（用于云端润色）。未配置 CLOUD_ENV 或基础库不支持时静默跳过，
  // 小程序退回纯本地翻译，不影响现有功能。
  initCloud() {
    if (!CLOUD_ENV || typeof wx.cloud === 'undefined') return;
    try {
      wx.cloud.init({ env: CLOUD_ENV, traceUser: true });
      this.globalData.cloudReady = true;
    } catch (err) {
      this.reportError('cloud_init', err);
    }
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

  setPolish(on) {
    const prefs = setPref('polish', Boolean(on));
    this.globalData.polish = prefs.polish;
    return prefs.polish;
  },

  setDisambiguate(on) {
    const prefs = setPref('disambiguate', Boolean(on));
    this.globalData.disambiguate = prefs.disambiguate;
    return prefs.disambiguate;
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
    this.globalData.disambiguate = prefs.disambiguate;
    this.globalData.historyLimit = prefs.historyLimit;
    this.globalData.pendingInput = '';
    applyChrome(prefs.theme, { customNav: true });
    return prefs;
  },
});
