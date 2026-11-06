'use strict';

// 音乐板块（小程序端）
//
// 数据来自 miniprogram/data/music.js —— 与桌面/安卓/Web 同一份生成物
// （npm run music:build ← src/core/music-douyin.json），四端条目、计数、链接完全一致。
//
// 小程序不能直接打开站外页面（业务域名限制），所以这里的交互是「复制链接 / 复制搜索词」，
// 微信内长按或去浏览器粘贴即可打开原页。不做 web-view：未备案域名会被拦，反而更糟。
//
// 用户态（收藏 / 最近浏览）存 miniprogram/services/musicFav.js，命名与桌面 / Web 完全一致；
// 收藏 / 最近浏览做成音乐页内部的次级 chip，不动 app.json 的 tabBar（微信上限 5 已满）。

const music = require('../../data/music');
const musicFav = require('../../services/musicFav');
const { copy, chromeMetrics } = require('../../utils/ui');
const { syncChrome } = require('../../utils/pageBase');

const TAG_LABEL = {};
music.groups.forEach((g) => {
  if (g.tag) TAG_LABEL[g.tag] = g.label;
});

const PLAT_CLASS = { douyin: 'dy', bilibili: 'bili', netease: 'netease', qqmusic: 'qq' };
const SEEN_LIMIT = 50;

// 平台内热度归一化：抖音「人在用」/ B 站播放 / 网易云评论 / QQ 播放差几个数量级，不能直接比
function hotRank(list) {
  const maxBy = {};
  list.forEach((it) => {
    const n = Number(it.usageCount);
    if (isFinite(n) && n > 0) maxBy[it.source] = Math.max(maxBy[it.source] || 0, n);
  });
  return list.slice().sort((a, b) => {
    const sa = Number(a.usageCount);
    const sb = Number(b.usageCount);
    const ra = isFinite(sa) && maxBy[a.source] > 0 ? sa / maxBy[a.source] : -1;
    const rb = isFinite(sb) && maxBy[b.source] > 0 ? sb / maxBy[b.source] : -1;
    if (rb !== ra) return rb - ra;
    return String(a.platform).localeCompare(String(b.platform)) || String(a.name).localeCompare(String(b.name));
  });
}

function dayKey() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// 每日一条：日期 + slug 做确定性种子，同一天稳定、跨天自动换
function dailyItem() {
  if (!music.items.length) return null;
  const day = dayKey();
  let best = music.items[0];
  let bestScore = -1;
  for (const it of music.items) {
    const score = hash(day + '|' + it.id);
    if (score > bestScore) {
      bestScore = score;
      best = it;
    }
  }
  return best;
}

// 卡片渲染需要的一切都在 JS 里算好：WXML 里做不了格式化（没有 Number/ toFixed）
function decorate(item, index, favIds) {
  return {
    id: item.id,
    source: item.source,
    no: String(index + 1).padStart(2, '0'),
    name: item.name,
    author: item.author,
    platformLabel: item.platformShort || item.platform,
    platClass: PLAT_CLASS[item.source] || 'dy',
    tagLabel: TAG_LABEL[item.tag] || item.tag,
    usageText: item.usageCount ? music.formatCount(item.usageCount) : '',
    usageUnit: item.usageUnit || '使用量',
    style: item.style,
    exampleCount: item.examples.length,
    musicUrl: item.musicUrl,
    musicActLabel: item.source === 'bilibili' ? '复制作品链接' : '复制音源链接',
    searchKeyword: item.searchKeyword,
    verifiedAt: item.verifiedAt,
    favored: favIds.has(item.id),
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
    view: 'all',
    viewOpts: [
      { key: 'all', label: '全部' },
      { key: 'favs', label: '收藏' },
      { key: 'recent', label: '最近' },
    ],
    sort: 'default',
    sortOpts: [
      { key: 'default', label: '默认' },
      { key: 'hot', label: '热度' },
      { key: 'recent', label: '最近采集' },
    ],
    hotHint: false,
    favCount: 0,
    seenCount: 0,
    daily: null,
    dailyName: '',
    randomName: '',
    emptyTitle: '没匹配到音源',
    emptySub: '换个词，或点「全部」看看',
    list: [],
    total: music.items.length,
    videoTotal: music.counts.videos,
    collectedAt: music.collectedAt,
  },

  onLoad() {
    this.setData(chromeMetrics());
    this.reloadUser();
    this.refresh();
  },

  onShow() {
    // tabBar 第 3 项（翻译 0 / 词库 1 / 音乐 2 / 历史 3 / 关于 4）
    syncChrome(this, 2);
    this.reloadUser();
    this.refresh();
  },

  // 收藏 / 最近浏览：读服务的缓存，同时给每日一条做展示
  reloadUser() {
    const favs = musicFav.getMusicFavs();
    const seen = musicFav.getMusicSeen();
    const daily = dailyItem();
    this.favIds = new Set(favs.map((f) => f.id));
    this.seenRows = seen;
    this.setData({
      favCount: favs.length,
      seenCount: seen.length,
      daily: daily ? { id: daily.id, name: daily.name, author: daily.author, tag: daily.tag } : null,
      dailyName: daily ? daily.name : '',
    });
  },

  refresh() {
    let rows = music.filter(this.data.group, this.data.keyword, this.data.platform);
    if (this.data.view === 'favs') rows = rows.filter((it) => this.favIds && this.favIds.has(it.id));
    else if (this.data.view === 'recent') {
      const order = {};
      (this.seenRows || []).forEach((s, i) => { order[s.id] = i; });
      rows = rows.filter((it) => order[it.id] !== undefined).sort((a, b) => order[a.id] - order[b.id]);
    }
    if (this.data.sort === 'hot') rows = hotRank(rows);
    else if (this.data.sort === 'recent') {
      rows = rows.slice().sort((a, b) => String(b.verifiedAt || '').localeCompare(String(a.verifiedAt || '')));
    }
    const emptyTitle = this.data.view === 'favs' ? '还没有收藏' : this.data.view === 'recent' ? '还没有浏览记录' : '没匹配到音源';
    const emptySub = this.data.view === 'favs'
      ? '点卡片右上角的 ♡ 就能把音源收进来'
      : this.data.view === 'recent'
        ? '复制任意一条音源链接后会记在这里（最多 50 条）'
        : '换个词，或点「全部」看看';
    this.setData({
      list: rows.map((it, i) => decorate(it, i, this.favIds || new Set())),
      emptyTitle,
      emptySub,
      hotHint: this.data.sort === 'hot',
    });
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

  switchView(e) {
    const key = e.currentTarget.dataset.key;
    if (!key || key === this.data.view) return;
    this.setData({ view: key });
    this.refresh();
  },

  setSort(e) {
    const key = e.currentTarget.dataset.key;
    if (!key || key === this.data.sort) return;
    this.setData({ sort: key });
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

  // 收藏切换（服务内部去重 / 幂等，连点两次回到原状态）
  toggleFav(e) {
    const id = e.currentTarget.dataset.id;
    const src = e.currentTarget.dataset.src;
    try {
      const r = musicFav.toggleMusicFav(id, src);
      this.reloadUser();
      this.refresh();
      wx.showToast({ title: r.favored ? '已收藏' : '已取消收藏', icon: 'none' });
    } catch (err) {
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  // 记一条浏览（小程序不能跳站外，复制链接即视为「点开」）
  markSeen(id) {
    try {
      musicFav.markMusicSeen(id);
    } catch (err) {
      /* 浏览记录失败不影响复制 */
    }
  },

  copyMusic(e) {
    const url = e.currentTarget.dataset.url;
    const id = e.currentTarget.dataset.id;
    if (id) this.markSeen(id);
    const isBili = String(url || '').indexOf('bilibili.com') >= 0;
    copy(url, isBili ? '作品链接已复制，去浏览器打开' : '音源链接已复制，去对应平台粘贴打开');
    this.reloadUser();
    if (this.data.view === 'recent') this.refresh();
  },

  copyVideo(e) {
    const url = e.currentTarget.dataset.url;
    const id = e.currentTarget.dataset.id;
    if (id) this.markSeen(id);
    const isBili = String(url || '').indexOf('bilibili.com') >= 0;
    copy(url, isBili ? '作品链接已复制，去浏览器打开' : '视频链接已复制，去抖音打开');
  },

  copyKeyword(e) {
    const kw = e.currentTarget.dataset.kw;
    copy(kw, '搜索词已复制，去对应平台搜');
  },

  // 每日一条 / 随机一条：滚到该条并复制链接
  jumpDaily() {
    const it = dailyItem();
    if (it) this.jumpTo(it);
  },

  jumpRandom() {
    if (!music.items.length) return;
    const it = music.items[Math.floor(Math.random() * music.items.length)];
    this.setData({ randomName: it.name });
    this.jumpTo(it);
  },

  jumpTo(it) {
    const g = music.groups.find((x) => x.tag === it.tag);
    this.setData({
      view: 'all',
      group: g ? g.key : 'all',
      platform: it.source,
      keyword: '',
      sort: 'default',
    });
    this.refresh();
    this.markSeen(it.id);
    copy(it.musicUrl, `已定位「${it.name}」并复制链接`);
    this.reloadUser();
    // 列表重排后滚到对应卡片
    wx.createSelectorQuery()
      .select('#mx-' + it.id)
      .boundingClientRect((rect) => {
        if (rect) wx.pageScrollTo({ scrollTop: Math.max(0, rect.top - 120), duration: 200 });
      })
      .exec();
  },

  // 分享：记录要分享的那条，onShareAppMessage 里拼卡片标题
  prepShare(e) {
    this.shareId = e.currentTarget.dataset.id || '';
  },

  onShareAppMessage() {
    const it = this.shareId ? music.items.find((x) => x.id === this.shareId) : dailyItem();
    if (it) {
      return {
        title: `🎵 ${it.name}｜@${it.author} · ${it.tag} · 淋语音乐板块`,
        path: '/pages/music/music',
      };
    }
    return {
      title: `淋语翻译器 · 四平台搞怪二创音源 ${this.data.total} 条`,
      path: '/pages/music/music',
    };
  },

  onShareTimeline() {
    const it = this.shareId ? music.items.find((x) => x.id === this.shareId) : dailyItem();
    return {
      title: it ? `🎵 ${it.name}｜@${it.author} · ${it.tag}` : `淋语翻译器 · 四平台搞怪二创音源 ${this.data.total} 条`,
      query: '',
    };
  },
});

// 纯逻辑导出：契约测试直接验证「平台内归一化排序」与「每日一条同日稳定」，
// 不需要跑小程序运行时（Page / wx 由测试侧打桩）。
module.exports = { hotRank, dailyItem, dayKey, hash, decorate };
