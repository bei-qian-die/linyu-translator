'use strict';

const content = require('../../services/content');
const { chromeMetrics } = require('../../utils/ui');
const { syncChrome } = require('../../utils/pageBase');

const PAGE_SIZE = 30;

// 主包只保留纯文本检索（词库 / 句式）。词卡 / 名言 / 人物连同 557 张人物图和 570KB 数据
// 一起在 pkg-hero 分包 —— 主包有 2MB 硬上限，这些内容放在主包会直接把包撑爆。
// tab 栏仍然显示 5 个（带计数，让用户知道有多少内容），后三个点击跳分包。
const TABS = [
  { key: 'words', label: '词库' },
  { key: 'rules', label: '句式' },
  { key: 'cards', label: '词卡' },
  { key: 'quotes', label: '名言' },
  { key: 'heroes', label: '人物' },
];

const REMOTE_TABS = {
  cards: '/pkg-hero/pages/browse/browse?tab=cards',
  quotes: '/pkg-hero/pages/browse/browse?tab=quotes',
  heroes: '/pkg-hero/pages/browse/browse?tab=heroes',
};

const TAB_META = {
  words: {
    placeholder: '搜索中文 / 淋语 / 解释…',
    empty: '还没有词条',
  },
  rules: {
    placeholder: '搜索正则 / 模板 / 场景…',
    empty: '还没有句式',
  },
};

// 搜索命中高亮（C6）：把命中片段切成 { t, h, k }；无关键词或无命中返回 null，走原文渲染
function splitHit(text, keyword) {
  const q = String(keyword || '').trim().toLowerCase();
  const value = text === null || text === undefined ? '' : String(text);
  if (!q || !value) return null;
  const lower = value.toLowerCase();
  const parts = [];
  let idx = 0;
  let at = lower.indexOf(q);
  while (at >= 0) {
    if (at > idx) parts.push({ t: value.slice(idx, at), h: false, k: parts.length });
    parts.push({ t: value.slice(at, at + q.length), h: true, k: parts.length });
    idx = at + q.length;
    at = lower.indexOf(q, idx);
  }
  if (idx < value.length) parts.push({ t: value.slice(idx), h: false, k: parts.length });
  return parts.length ? parts : null;
}

Page({
  data: {
    theme: 'white',
    counts: content.counts,
    tabs: TABS.map((tab) => ({ key: tab.key, label: tab.label, count: content.counts[tab.key] })),
    tab: 'words',
    keyword: '',
    placeholder: TAB_META.words.placeholder,
    shown: [],
    matched: 0,
    hasMore: false,
    rest: 0,
    emptyTitle: TAB_META.words.empty,
    emptySub: '内容会随版本更新',
    ready: false,
    statusBar: 20,
    navBarH: 64,
    navTop: 82,
  },

  onLoad() {
    this.setData(
      Object.assign({ theme: getApp().globalData.theme }, chromeMetrics()),
      () => {
        this.applyFilter(true);
        this.setData({ ready: true });
      }
    );
  },

  onShow() {
    syncChrome(this, 1);
  },

  onUnload() {
    clearTimeout(this._searchTimer);
  },

  switchTab(e) {
    const key = e.currentTarget.dataset.key;
    // 词卡 / 名言 / 人物在分包，直接跳过去，本页 tab 状态不变
    if (REMOTE_TABS[key]) {
      wx.navigateTo({ url: REMOTE_TABS[key] });
      return;
    }
    if (!TAB_META[key] || key === this.data.tab) return;
    clearTimeout(this._searchTimer);
    this.setData(
      {
        tab: key,
        keyword: '',
        placeholder: TAB_META[key].placeholder,
      },
      () => {
        this.applyFilter(true);
        wx.pageScrollTo({ scrollTop: 0, duration: 0 });
      }
    );
  },

  onSearch(e) {
    this.setData({ keyword: e.detail.value });
    clearTimeout(this._searchTimer);
    this._searchTimer = setTimeout(() => {
      this.applyFilter(true);
      wx.pageScrollTo({ scrollTop: 0, duration: 0 });
    }, 150);
  },

  clearSearch() {
    clearTimeout(this._searchTimer);
    this.setData({ keyword: '' }, () => this.applyFilter(true));
  },

  // 视图模型裁剪（B2）：只下发 WXML 真正用到的字段，不下发 searchText；
  // 有关键词时给主要展示字段附带高亮片段（C6）
  toViewModel(tab, item, index, keyword) {
    if (tab === 'words') {
      return {
        no: String(index + 1).padStart(2, '0'),
        zh: item.zh,
        zhParts: splitHit(item.zh, keyword),
        linyu: item.linyu,
        lyParts: splitHit(item.linyu, keyword),
        alias: item.alias,
        sense: item.sense,
        pop: item.pop,
        source: item.source,
      };
    }
    return {
      id: item.id,
      note: item.note,
      scene: item.scene,
      pattern: item.pattern,
      patternParts: splitHit(item.pattern, keyword),
      template: item.template,
      templateParts: splitHit(item.template, keyword),
      examples: item.examples,
      src: item.src,
    };
  },

  applyFilter(reset) {
    const tab = this.data.tab;
    const keyword = this.data.keyword;
    const base = content[tab] || [];

    const filtered = content.filterList(base, keyword);
    this._filtered = filtered;
    const visible = Math.min(PAGE_SIZE, filtered.length);
    this._shownCount = visible;
    const page = filtered.slice(0, visible).map((item, index) => this.toViewModel(tab, item, index, keyword));

    let emptyTitle = TAB_META[tab].empty;
    let emptySub = '内容会随版本更新';
    if (keyword.trim()) {
      emptyTitle = '没有匹配的内容';
      emptySub = '换个关键词试试';
    }

    this.setData({
      shown: page,
      matched: filtered.length,
      hasMore: filtered.length > visible,
      rest: Math.max(0, filtered.length - visible),
      emptyTitle,
      emptySub,
    });
  },

  // 增量 setData（B3）：只追加新条目路径，不再全量重建 shown
  loadMore() {
    if (!this.data.hasMore) return;
    const tab = this.data.tab;
    const filtered = this._filtered || [];
    const from = this._shownCount;
    const to = Math.min(from + PAGE_SIZE, filtered.length);
    if (to <= from) return;

    const patch = {};
    for (let i = from; i < to; i++) {
      patch['shown[' + i + ']'] = this.toViewModel(tab, filtered[i], i, this.data.keyword);
    }
    patch.hasMore = filtered.length > to;
    patch.rest = Math.max(0, filtered.length - to);
    this._shownCount = to;
    this.setData(patch);
  },

  onReachBottom() {
    this.loadMore();
  },

  onShareAppMessage() {
    return {
      title: `淋语词库 · ${content.counts.words} 词条 / ${content.counts.cards} 词卡 / ${content.counts.heroes} 人物`,
      path: '/pages/lexicon/lexicon',
    };
  },

  onShareTimeline() {
    return {
      title: `淋语词库 · ${content.counts.words} 词条 / ${content.counts.cards} 词卡 / ${content.counts.heroes} 人物`,
      query: '',
    };
  },
});
