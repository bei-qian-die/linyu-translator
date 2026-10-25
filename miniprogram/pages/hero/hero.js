'use strict';

const { toast, copy } = require('../../utils/ui');
const { syncChrome } = require('../../utils/pageBase');

Page({
  data: {
    theme: 'white',
    hero: null,
    related: { words: [], rules: [], cards: [], quotes: [] },
    links: [],
    stats: '',
    notFound: false,
  },

  onLoad(options) {
    const lore = require('../../services/lore');
    const hero = lore.getHero(options && options.id);
    this.setData({ theme: getApp().globalData.theme });
    if (!hero) {
      this.setData({
        hero: null,
        related: { words: [], rules: [], cards: [], quotes: [] },
        links: [],
        stats: '',
        notFound: true,
      });
      wx.setNavigationBarTitle({ title: '人物详情' });
      return;
    }
    const related = lore.relatedForHero(hero);
    const stats = [
      related.words.length + ' 词条',
      related.rules.length + ' 句式',
      related.cards.length + ' 词卡',
      related.quotes.length + ' 名言',
    ].join(' · ');
    this.setData({ hero, related, links: hero.links, stats, notFound: false });
    wx.setNavigationBarTitle({ title: hero.name });
  },

  onShow() {
    syncChrome(this);
  },

  copyLink(e) {
    // 数据来源 URL 只允许 http/https，脏数据带入其它 scheme 时拒绝复制（C9）
    const url = String(e.currentTarget.dataset.url || '');
    if (!/^https?:\/\//i.test(url)) {
      toast('链接格式异常，未复制');
      return;
    }
    copy(url, '链接已复制，去浏览器打开');
  },

  copyWord(e) {
    copy(e.currentTarget.dataset.text, '词条已复制♥');
  },

  copyQuote(e) {
    copy(e.currentTarget.dataset.text, '名言已复制♥');
  },

  backToLexicon() {
    wx.switchTab({ url: '/pages/lexicon/lexicon' });
  },

  onShareAppMessage() {
    const hero = this.data.hero;
    if (!hero) {
      return { title: '淋语词库 · 人物志', path: '/pages/lexicon/lexicon' };
    }
    return {
      title: `${hero.name} · ${hero.rank} | 淋语人物`,
      path: `/pages/hero/hero?id=${hero.id}`,
    };
  },

  onShareTimeline() {
    const hero = this.data.hero;
    if (!hero) return { title: '淋语词库 · 人物志', query: '' };
    return {
      title: `${hero.name} · ${hero.rank} | 淋语人物`,
      query: `id=${hero.id}`,
    };
  },
});
