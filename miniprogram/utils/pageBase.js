'use strict';

const { applyChrome } = require('../services/prefs');

// 页面主题 / tabBar 同步样板收敛（B6）：
// 四个 tab 页 onShow 各自重复的主题 + chrome + tabBar 逻辑统一收口到这里。
// custom 导航页（4 个 tab 页）只刷背景色，系统导航色对 navigationStyle:custom 无效（B8）。
function syncChrome(page, tabIndex) {
  const app = getApp();
  const theme = app.globalData.theme;
  page.setData({ theme });
  const isTab = typeof tabIndex === 'number';
  applyChrome(theme, { customNav: isTab });
  if (isTab) {
    const tabBar = page.getTabBar && page.getTabBar();
    if (tabBar) tabBar.setData({ selected: tabIndex, theme });
  }
}

module.exports = { syncChrome };
