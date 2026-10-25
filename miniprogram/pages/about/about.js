'use strict';

const counts = require('../../data/counts');
const { translateStats } = require('../../services/content');
const { THEMES, accentFor, dangerFor } = require('../../services/prefs');
const { readHistory } = require('../../services/history');
const { confirm, toast, chromeMetrics } = require('../../utils/ui');
const { syncChrome } = require('../../utils/pageBase');

Page({
  data: {
    theme: 'white',
    version: '1.13.0',
    switchColor: accentFor('white'),
    counts,
    stats: [
      { num: counts.words, label: '词条' },
      { num: counts.rules, label: '句式' },
      { num: counts.cards, label: '词卡' },
      { num: counts.quotes, label: '名言' },
      { num: counts.heroes, label: '人物' },
    ],
    themes: THEMES,
    live: true,
    historyLimit: 200,
    historyCount: 0,
    statusBar: 20,
    navBarH: 64,
    navTop: 82,
  },

  onLoad() {
    this.setData(chromeMetrics());
    this.sync();
  },

  onShow() {
    this.sync();
  },

  sync() {
    const app = getApp();
    const theme = app.globalData.theme;
    this.setData({
      theme,
      switchColor: accentFor(theme),
      version: app.globalData.version,
      live: app.globalData.live,
      historyLimit: app.globalData.historyLimit,
      historyCount: readHistory().length,
      perf: translateStats(),
    });
    syncChrome(this, 3);
  },

  chooseTheme(e) {
    const key = e.currentTarget.dataset.key;
    if (!key || key === this.data.theme) return;
    const app = getApp();
    const theme = app.applyTheme(key);
    const picked = THEMES.find((t) => t.key === theme);
    this.setData({ theme, switchColor: accentFor(theme) });
    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar) tabBar.setData({ theme });
    toast(picked ? `已切换为${picked.full}` : '主题已切换');
  },

  onLiveChange(e) {
    const on = Boolean(e.detail.value);
    getApp().setLive(on);
    this.setData({ live: on });
    toast(on ? '实时预览已开启' : '实时预览已关闭');
  },

  async clearAll() {
    const ok = await confirm({
      title: '清除本地数据',
      content: '将删除本机全部翻译历史，并把主题、实时预览恢复为默认设置。该操作不可撤销。',
      confirmText: '清除',
      confirmColor: dangerFor(this.data.theme),
    });
    if (!ok) return;
    const prefs = getApp().resetLocalData();
    this.setData({
      theme: prefs.theme,
      switchColor: accentFor(prefs.theme),
      live: prefs.live,
      historyLimit: prefs.historyLimit,
      historyCount: 0,
    });
    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar) tabBar.setData({ theme: prefs.theme });
    toast('本地数据已清除');
  },

  onShareAppMessage() {
    return {
      title: '淋语翻译器 · 本地离线，把普通话翻译成淋语',
      path: '/pages/index/index',
    };
  },

  onShareTimeline() {
    return {
      title: '淋语翻译器 · 本地离线，把普通话翻译成淋语',
      query: '',
    };
  },
});
