'use strict';

const PREFS_KEY = 'linyu.prefs.v1';
const HISTORY_LIMITS = [100, 200, 500, 1000];

const THEMES = [
  { key: 'white', label: '白', en: 'PAPER', full: '白色 · PAPER', desc: '纸感留白 · 墨黑强调' },
  { key: 'black', label: '黑', en: 'INK', full: '黑色 · INK', desc: '夜间墨底 · 玫粉点睛' },
  { key: 'rose', label: '玫', en: 'ROSE', full: '玫粉 · ROSE', desc: '粉白纸面 · 深玫压色' },
];

const DEFAULT_PREFS = { theme: 'white', live: true, polish: false, disambiguate: false, historyLimit: 200 };

const CHROME = {
  white: {
    navBg: '#f7f5f1',
    navFront: '#000000',
    tabBg: '#f7f5f1',
    tabColor: '#6d6861',
    tabSelected: '#141414',
    tabBorder: 'black',
    pageBg: '#f7f5f1',
  },
  black: {
    navBg: '#111112',
    navFront: '#ffffff',
    tabBg: '#111112',
    tabColor: '#99948b',
    tabSelected: '#ff6f9c',
    tabBorder: 'black',
    pageBg: '#111112',
  },
  rose: {
    navBg: '#fbf2f3',
    navFront: '#000000',
    tabBg: '#fbf2f3',
    tabColor: '#7e5c66',
    tabSelected: '#c2185b',
    tabBorder: 'black',
    pageBg: '#fbf2f3',
  },
};

const ACCENTS = { white: '#141414', black: '#ff6f9c', rose: '#c2185b' };
const DANGERS = { white: '#a33232', black: '#ff8b8b', rose: '#a3183f' };

function accentFor(theme) {
  return ACCENTS[theme] || ACCENTS.white;
}

function dangerFor(theme) {
  return DANGERS[theme] || DANGERS.white;
}

function isHistoryLimit(n) {
  return HISTORY_LIMITS.indexOf(Number(n)) >= 0;
}

function normalize(raw) {
  const prefs = Object.assign({}, DEFAULT_PREFS, raw && typeof raw === 'object' ? raw : {});
  if (prefs.theme === 'pink') prefs.theme = 'rose';
  if (!CHROME[prefs.theme]) prefs.theme = DEFAULT_PREFS.theme;
  prefs.live = prefs.live !== false;
  prefs.polish = prefs.polish === true;
  const limit = Number(prefs.historyLimit);
  prefs.historyLimit = isHistoryLimit(limit) ? limit : DEFAULT_PREFS.historyLimit;
  return prefs;
}

function getPrefs() {
  try {
    return normalize(wx.getStorageSync(PREFS_KEY));
  } catch (err) {
    return normalize(null);
  }
}

function setPref(key, value) {
  const prefs = getPrefs();
  prefs[key] = value;
  const next = normalize(prefs);
  try {
    wx.setStorageSync(PREFS_KEY, next);
  } catch (err) {
    // 存储写不进去也不能影响当前会话，下次启动会回落到默认值
  }
  return next;
}

function resetPrefs() {
  try {
    wx.removeStorageSync(PREFS_KEY);
  } catch (err) {
    // ignore
  }
  return normalize(null);
}

function applyChrome(theme, options) {
  const c = CHROME[theme] || CHROME.white;
  const opts = options || {};
  try {
    // navigationStyle: custom 的页面没有系统导航条，setNavigationBarColor 无效（B8）
    if (!opts.customNav) {
      wx.setNavigationBarColor({
        frontColor: c.navFront,
        backgroundColor: c.navBg,
        animation: { duration: 180, timingFunc: 'easeIn' },
      });
    }
    wx.setBackgroundColor({
      backgroundColor: c.pageBg,
      backgroundColorTop: c.pageBg,
      backgroundColorBottom: c.pageBg,
    });
  } catch (err) {
    // 某些基础库或页面栈时机下这些接口不可用，页面自身主题仍然生效
  }
}

module.exports = {
  PREFS_KEY,
  HISTORY_LIMITS,
  THEMES,
  DEFAULT_PREFS,
  accentFor,
  dangerFor,
  getPrefs,
  setPref,
  resetPrefs,
  applyChrome,
};
