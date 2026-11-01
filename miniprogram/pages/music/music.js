'use strict';

// 音乐板块（小程序端）
//
// 数据来自 miniprogram/data/music.js —— 与桌面/安卓/Web 同一份生成物
// （npm run music:build ← src/core/music-douyin.json），四端条目、计数、链接完全一致。
//
// 小程序不能直接打开站外页面（业务域名限制），所以这里的交互是「复制链接 / 复制搜索词」，
// 微信内长按或去浏览器粘贴即可打开抖音原页。不做 web-view：未备案域名会被拦，反而更糟。

const music = require('../../data/music');
const { copy, chromeMetrics } = require('../../utils/ui');
const { syncChrome } = require('../../utils/pageBase');

const TAG_LABEL = {};
music.groups.forEach((g) => {
  if (g.tag) TAG_LABEL[g.tag] = g.label;
});

// 卡片渲染需要的一切都在 JS 里算好：WXML 里做不了格式化（没有 Number/ toFixed）
function decorate(item, index) {
  // 两平台的差别只落在「词」和「落点」上：抖音是音乐页 + 人在用，B 站是作品页 + 播放量
  const isBili = item.source === 'bilibili';
  return {
    id: item.id,
    no: String(index + 1).padStart(2, '0'),
    name: item.name,
    author: item.author,
    platformLabel: isBili ? 'B 站' : '抖音',
    platClass: isBili ? 'bili' : 'dy',
    tagLabel: TAG_LABEL[item.tag] || item.tag,
    usageText: item.usageCount ? music.formatCount(item.usageCount) : '',
    usageUnit: isBili ? '播放' : '人在用',
    style: item.style,
    exampleCount: item.examples.length,
    musicUrl: item.musicUrl,
    musicActLabel: isBili ? '复制作品链接' : '复制音乐链接',
    copyVideoTip: isBili ? '作品链接已复制，去浏览器打开' : '视频链接已复制，去抖音打开',
    searchKeyword: item.searchKeyword,
    verifiedAt: item.verifiedAt,
    examples: item.examples.map((ex) => ({
      awemeId: ex.awemeId,
      author: ex.author,
      videoUrl: ex.videoUrl,
      memePoint: ex.memePoint,
      likeText: ex.likeCount ? music.formatCount(ex.likeCount) : '',
      playText: !ex.likeCount && ex.playCount ? music.formatCount(ex.playCount) + ' 播放' : '',
      durText: ex.duration ? music.formatDuration(ex.duration) : '',
    })),
  };
}

Page({
  data: {
    theme: 'white',
    statusBar: 20,
    navBarH: 64,
    navTop: 82,
    groups: music.groups,
    group: 'all',
    platforms: music.platformFilters || [{ key: 'all', label: '全部平台' }],
    platform: 'all',
    keyword: '',
    list: [],
    total: music.items.length,
    videoTotal: music.counts.videos,
    collectedAt: music.collectedAt,
  },

  onLoad() {
    this.setData(chromeMetrics());
    this.refresh();
  },

  onShow() {
    // tabBar 第 3 项（翻译 0 / 词库 1 / 音乐 2 / 历史 3 / 关于 4）
    syncChrome(this, 2);
  },

  refresh() {
    const rows = music
      .filter(this.data.group, this.data.keyword, this.data.platform)
      .map(decorate);
    this.setData({ list: rows });
  },

  switchGroup(e) {
    const key = e.currentTarget.dataset.key;
    if (!key || key === this.data.group) return;
    this.setData({ group: key });
    this.refresh();
    wx.pageScrollTo({ scrollTop: 0, duration: 180 });
  },

  switchPlatform(e) {
    const key = e.currentTarget.dataset.key;
    if (!key || key === this.data.platform) return;
    this.setData({ platform: key });
    this.refresh();
  },

  onSearch(e) {
    this.setData({ keyword: e.detail.value });
    this.refresh();
  },

  clearSearch() {
    this.setData({ keyword: '' });
    this.refresh();
  },

  copyMusic(e) {
    const url = e.currentTarget.dataset.url;
    const isBili = String(url || '').indexOf('bilibili.com') >= 0;
    copy(url, isBili ? '作品链接已复制，去浏览器打开' : '音乐页链接已复制');
  },

  copyVideo(e) {
    const url = e.currentTarget.dataset.url;
    const isBili = String(url || '').indexOf('bilibili.com') >= 0;
    copy(url, isBili ? '作品链接已复制，去浏览器打开' : '视频链接已复制，去抖音打开');
  },

  copyKeyword(e) {
    const kw = e.currentTarget.dataset.kw;
    copy(kw, '搜索词已复制，去对应平台搜');
  },

  onShareAppMessage() {
    return {
      title: `淋语翻译器 · 抖音 × B 站搞怪二创音源 ${this.data.total} 条`,
      path: '/pages/music/music',
    };
  },

  onShareTimeline() {
    return {
      title: `淋语翻译器 · 抖音 × B 站搞怪二创音源 ${this.data.total} 条`,
      query: '',
    };
  },
});
