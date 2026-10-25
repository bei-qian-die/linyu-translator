'use strict';

const content = require('../../services/content');
const { copy, chromeMetrics } = require('../../utils/ui');
const { syncChrome } = require('../../utils/pageBase');

const PAGE_SIZE = 30;

const TABS = [
  { key: 'words', label: '词库' },
  { key: 'rules', label: '句式' },
  { key: 'cards', label: '词卡' },
  { key: 'quotes', label: '名言' },
  { key: 'heroes', label: '人物' },
];

const TAB_META = {
  words: {
    placeholder: '搜索中文 / 淋语 / 解释…',
    empty: '还没有词条',
  },
  rules: {
    placeholder: '搜索正则 / 模板 / 场景…',
    empty: '还没有句式',
  },
  cards: {
    placeholder: '搜索词名 / 释义 / 出处…',
    empty: '还没有词卡',
  },
  quotes: {
    placeholder: '搜索名言 / 发言人 / 出处…',
    empty: '还没有名言',
  },
  heroes: {
    placeholder: '搜索名字 / 称号 / 标签…',
    empty: '这个分组还没有人物',
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
    cardFilters: [],
    cardType: 'all',
    heroGroups: [],
    heroGroup: 'real',
    heroZones: [],
    heroZone: '',
    statusBar: 20,
    navBarH: 64,
    navTop: 82,
  },

  onLoad() {
    // 先铺主题与骨架屏，lore（v1.18 约 1.23MB）解析放到下一帧，页面先上屏不白屏（C10）
    this.setData(
      Object.assign({ theme: getApp().globalData.theme }, chromeMetrics()),
      () => {
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
            heroes: [], cards: [], quotes: [],
            cardFilters: [], heroGroups: [], heroZones: [],
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
    if (tab === 'rules') {
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
    }
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
    // heroes
    return {
      id: item.id,
      initial: item.initial,
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
    } else if (tab === 'words' || tab === 'rules') {
      base = content[tab] || [];
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
    wx.navigateTo({ url: '/pages/hero/hero?id=' + id });
  },

  copyQuote(e) {
    copy(e.currentTarget.dataset.text, '名言已复制♥');
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
