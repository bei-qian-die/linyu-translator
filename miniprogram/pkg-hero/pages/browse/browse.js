'use strict';

// 词卡 / 名言 / 人物浏览页：整体放在 pkg-hero 分包。
// 主包有 2MB 硬上限，把这三块连同 557 张人物图（1070KB）和 570KB 浏览数据一起搬出来，
// 主包才腾得出空间。分包可以 require 主包的 services/content 与 data/_sst，反向不行。
const content = require('../../../services/content');
const { copy } = require('../../../utils/ui');

const PAGE_SIZE = 30;

const TABS = [
  { key: 'cards', label: '词卡' },
  { key: 'quotes', label: '名言' },
  { key: 'heroes', label: '人物' },
];

const TAB_META = {
  cards: {
    placeholder: '搜索词名 / 释义 / 出处…',
    empty: '还没有词卡',
    title: '词卡',
  },
  quotes: {
    placeholder: '搜索名言 / 发言人 / 出处…',
    empty: '还没有名言',
    title: '名言',
  },
  heroes: {
    placeholder: '搜索名字 / 称号 / 标签…',
    empty: '这个分组还没有人物',
    title: '人物',
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
    tab: 'cards',
    keyword: '',
    placeholder: TAB_META.cards.placeholder,
    shown: [],
    matched: 0,
    hasMore: false,
    rest: 0,
    emptyTitle: TAB_META.cards.empty,
    emptySub: '内容会随版本更新',
    ready: false,
    cardFilters: [],
    cardType: 'all',
    heroGroups: [],
    heroGroup: 'real',
    heroZones: [],
    heroZone: '',
  },

  onLoad(options) {
    const tab = TAB_META[options && options.tab] ? options.tab : 'cards';
    this.setData(
      {
        theme: getApp().globalData.theme,
        tab,
        placeholder: TAB_META[tab].placeholder,
        emptyTitle: TAB_META[tab].empty,
      },
      () => this.setTitle(tab)
    );

    // lore（1MB 量级）解析放下一帧，页面骨架先上屏（C10）
    const defer = wx.nextTick ? wx.nextTick.bind(wx) : (fn) => fn();
    defer(() => {
      let lore = null;
      try {
        lore = require('../../services/lore');
      } catch (err) {
        console.error('[linyu] lore 加载失败', err);
        const app = getApp();
        if (app && app.reportError) app.reportError('lore_load_error', err);
      }
      this._lore = lore || {
        heroes: [],
        cards: [],
        quotes: [],
        cardFilters: [],
        heroGroups: [],
        heroZones: [],
      };
      this.setData(
        {
          cardFilters: this._lore.cardFilters,
          heroGroups: this._lore.heroGroups,
          heroZones: this._lore.heroZones,
        },
        () => {
          this.applyFilter(true);
          this.setData({ ready: true });
        }
      );
    });
  },

  onShow() {
    this.setData({ theme: getApp().globalData.theme });
  },

  onUnload() {
    clearTimeout(this._searchTimer);
  },

  setTitle(tab) {
    const meta = TAB_META[tab];
    if (meta) wx.setNavigationBarTitle({ title: meta.title });
  },

  switchTab(e) {
    const key = e.currentTarget.dataset.key;
    if (!TAB_META[key] || key === this.data.tab) return;
    clearTimeout(this._searchTimer);
    this.setData(
      {
        tab: key,
        keyword: '',
        placeholder: TAB_META[key].placeholder,
        cardType: 'all',
        heroZone: '',
      },
      () => {
        this.setTitle(key);
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

  changeCardType(e) {
    const key = e.currentTarget.dataset.key;
    if (!key || key === this.data.cardType) return;
    this.setData({ cardType: key }, () => this.applyFilter(true));
  },

  changeHeroGroup(e) {
    const key = e.currentTarget.dataset.key;
    if (!key || key === this.data.heroGroup) return;
    this.setData({ heroGroup: key, heroZone: '' }, () => this.applyFilter(true));
  },

  changeHeroZone(e) {
    const raw = e.currentTarget.dataset.key;
    const zone = raw === 'all' ? '' : raw || '';
    if (zone === this.data.heroZone) return;
    this.setData({ heroZone: zone }, () => this.applyFilter(true));
  },

  // 视图模型裁剪（B2）：只下发 WXML 真正用到的字段，不下发 searchText；
  // 有关键词时给主要展示字段附带高亮片段（C6）
  toViewModel(tab, item, index, keyword) {
    if (tab === 'cards') {
      return {
        id: item.id,
        typeLabel: item.typeLabel,
        hero: item.hero,
        term: item.term,
        termParts: splitHit(item.term, keyword),
        aliasesText: item.aliasesText,
        meaning: item.meaning,
        meaningParts: splitHit(item.meaning, keyword),
        example: item.example,
        detail: item.detail,
        source: item.source,
      };
    }
    if (tab === 'quotes') {
      return {
        id: item.id,
        text: item.text,
        textParts: splitHit(item.text, keyword),
        author: item.author,
        src: item.src,
      };
    }
    return {
      id: item.id,
      initial: item.initial,
      thumb: item.thumb,
      name: item.name,
      nameParts: splitHit(item.name, keyword),
      rank: item.rank,
      alias: item.alias,
      intro: item.intro,
      introParts: splitHit(item.intro, keyword),
      tags: item.tags,
    };
  },

  applyFilter(reset) {
    const tab = this.data.tab;
    const keyword = this.data.keyword;
    let base;

    if (tab === 'heroes') {
      base = this._lore.heroes.filter((h) => h.group === this.data.heroGroup);
      if (this.data.heroGroup === 'game' && this.data.heroZone) {
        base = base.filter((h) => h.zone === this.data.heroZone);
      }
    } else {
      base = this._lore[tab] || [];
    }

    if (tab === 'cards' && this.data.cardType !== 'all') {
      base = base.filter((c) => c.type === this.data.cardType);
    }

    const filtered = content.filterList(base, keyword);
    this._filtered = filtered;
    const visible = Math.min(PAGE_SIZE, filtered.length);
    this._shownCount = visible;
    const page = filtered.slice(0, visible).map((item, index) => this.toViewModel(tab, item, index, keyword));
    const hasFilter =
      Boolean(keyword.trim()) ||
      (tab === 'cards' && this.data.cardType !== 'all') ||
      (tab === 'heroes' && (Boolean(this.data.heroZone) || this.data.heroGroup !== 'real'));

    let emptyTitle = TAB_META[tab].empty;
    let emptySub = '内容会随版本更新';
    if (keyword.trim()) {
      emptyTitle = '没有匹配的内容';
      emptySub = '换个关键词试试';
    } else if (tab === 'cards' && this.data.cardType !== 'all') {
      emptyTitle = '这个分类还没有词卡';
      emptySub = '换个分类试试';
    } else if (tab === 'heroes' && (this.data.heroZone || this.data.heroGroup !== 'real')) {
      emptyTitle = '这个分组还没有人物';
      emptySub = '换个分组试试';
    } else if (hasFilter) {
      emptySub = '换个筛选条件试试';
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

  openHero(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pkg-hero/pages/hero/hero?id=' + id });
  },

  // 单张缩略图加载失败时撤掉 image，露出底下的首字方块，不影响整列
  onHeroPhotoError(e) {
    const index = Number(e.currentTarget.dataset.index);
    if (!Number.isInteger(index) || index < 0) return;
    this.setData({ ['shown[' + index + '].thumb']: '' });
  },

  copyQuote(e) {
    copy(e.currentTarget.dataset.text, '名言已复制♥');
  },

  onShareAppMessage() {
    const label = TAB_META[this.data.tab].title;
    return {
      title: `淋语${label} · ${content.counts.words} 词条 / ${content.counts.cards} 词卡 / ${content.counts.heroes} 人物`,
      path: '/pkg-hero/pages/browse/browse?tab=' + this.data.tab,
    };
  },

  onShareTimeline() {
    return {
      title: `淋语词库 · ${content.counts.words} 词条 / ${content.counts.cards} 词卡 / ${content.counts.heroes} 人物`,
      query: 'tab=' + this.data.tab,
    };
  },
});
