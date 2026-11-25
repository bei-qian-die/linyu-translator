'use strict';

const { toast } = require('../../../utils/ui');
const { attachCopySheet } = require('../../../utils/copySheet');
const { syncChrome } = require('../../../utils/pageBase');
const { heroImage } = require('../../config/assets');

Page({
  data: {
    theme: 'white',
    hero: null,
    photo: '',
    related: { words: [], rules: [], cards: [], quotes: [] },
    links: [],
    stats: '',
    notFound: false,
    loadError: false,
  },

  onLoad(options) {
    attachCopySheet(this);
    this._heroId = (options && options.id) || '';
    this.setData({ theme: getApp().globalData.theme });
    // 数据加载失败不再让整个 onLoad 抛错（那样页面只剩骨架＝白屏），
    // 而是降级成「加载失败，点重试」，把原因写进实时日志。
    let lore = null;
    try {
      lore = require('../../services/lore');
    } catch (err) {
      console.error('[linyu] 人物数据加载失败', err);
      const app = getApp();
      if (app && app.reportError) app.reportError('hero_lore_load_error', err);
    }
    const hero = lore ? lore.getHero(this._heroId) : null;
    if (!hero) {
      this.setData({
        hero: null,
        photo: '',
        related: { words: [], rules: [], cards: [], quotes: [] },
        links: [],
        stats: '',
        notFound: true,
        loadError: !lore,
      });
      wx.setNavigationBarTitle({ title: lore ? '人物详情' : '加载失败' });
      return;
    }
    const related = lore.relatedForHero(hero);
    const stats = [
      related.words.length + ' 词条',
      related.rules.length + ' 句式',
      related.cards.length + ' 词卡',
      related.quotes.length + ' 名言',
    ].join(' · ');
    // 详情图走远程 URL（图片已从代码包排除），与列表共用同一套地址
    const photo = heroImage(hero.img);
    this.setData({ hero, photo, related, links: hero.links, stats, notFound: false });
    wx.setNavigationBarTitle({ title: hero.name });
  },

  onShow() {
    syncChrome(this);
  },

  copyLink(e) {    // 数据来源 URL 只允许 http/https，脏数据带入其它 scheme 时拒绝复制（C9）
    const url = String(e.currentTarget.dataset.url || '');
    if (!/^https?:\/\//i.test(url)) {
      toast('链接格式异常，未复制');
      return;
    }
    this.copyText(url, '链接已复制，去浏览器打开');
  },

  copyWord(e) {
    this.copyText(e.currentTarget.dataset.text, '词条已复制♥');
  },

  copyQuote(e) {
    this.copyText(e.currentTarget.dataset.text, '名言已复制♥');
  },

  backToLexicon() {
    wx.switchTab({ url: '/pages/lexicon/lexicon' });
  },

  // 空状态主按钮：加载失败时重试，正常「没找到」时回词库
  onEmptyPrimary() {
    if (this.data.loadError) {
      const id = this._heroId || '';
      wx.redirectTo({ url: '/pkg-hero/pages/hero/hero?id=' + encodeURIComponent(id) });
      return;
    }
    this.backToLexicon();
  },

  // 图片加载失败（未配合法域名、离线、资源缺失）时撤掉 image，露出底下的首字方块
  onPhotoError() {
    this.setData({ photo: '' });
  },

  onShareAppMessage() {
    const hero = this.data.hero;
    if (!hero) {
      return { title: '淋语词库 · 人物志', path: '/pages/lexicon/lexicon' };
    }
    return {
      title: `${hero.name} · ${hero.rank} | 淋语人物`,
      path: `/pkg-hero/pages/hero/hero?id=${hero.id}`,
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
