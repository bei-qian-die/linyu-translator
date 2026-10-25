'use strict';

// tabBar 页面清单唯一来源是 app.json 的 tabBar.list，这里只做展示与跳转映射：
// 改动 tabBar 时先改 app.json，再同步这里的 TABS（test/weapp.test.js 会校验两者一致）
const TABS = [
  { path: '/pages/index/index', label: '翻译', icon: 'translate' },
  { path: '/pages/lexicon/lexicon', label: '词库', icon: 'book' },
  { path: '/pages/history/history', label: '历史', icon: 'clock' },
  { path: '/pages/about/about', label: '关于', icon: 'info' },
];

Component({
  data: {
    tabs: TABS,
    selected: 0,
    theme: 'white',
  },

  methods: {
    onTabTap(e) {
      const path = e.currentTarget.dataset.path;
      if (!path) return;
      wx.switchTab({ url: path });
    },
  },
});
