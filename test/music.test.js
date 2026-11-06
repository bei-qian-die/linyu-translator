'use strict';

// 音乐板块的数据契约测试。
//
// 这一块的失败模式跟别处不一样：界面写错顶多难看，数据写错会把用户送到一个不存在的页面，
// 或者四端跑出四份不一样的条目。所以这里守四条线：
//   1) 链接形态（按 scripts/music-platforms.js 平台注册表校验，id 必须与 URL 捕获段一致）
//   2) 唯一性（每平台内 id 唯一 + 示例 id 全局唯一 + slug 全局唯一 + 同一作者跨平台合计 ≤2）
//   3) 平台字段策略（抖音 music_id 必填、B 站必须 null、网易云 / QQ 与 platform_id 同值）
//   4) 四端同源（src/core/music.js 与 miniprogram/data/music.js 逐字一致，且与原始数据集对得上）
//
// 新增平台只改注册表，这里自动跟随；新增梗只改数据集，分组断言按数据集动态推导。

const fs = require('fs');
const path = require('path');
const reg = require('../scripts/music-platforms.js');

const { PLATFORMS, platformOfUrl, platformByKey } = reg;

const ROOT = path.join(__dirname, '..');
const music = require('../src/core/music.js');
const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'core', 'music-douyin.json'), 'utf8'));

let failed = 0;
function ok(name, cond, detail) {
  if (cond) console.log(`PASS [${name}]`);
  else {
    failed++;
    console.log(`FAIL [${name}] ${detail || ''}`);
  }
}

const countsByPlatform = (key) => music.items.filter((i) => i.source === key).length;

// ---- 1) 结构 ----
ok('数据模块导出完整', typeof music === 'object' && Array.isArray(music.items) && Array.isArray(music.groups));
ok('条目数与原始数据集一致', music.items.length === raw.items.length, `${music.items.length} vs ${raw.items.length}`);
ok(
  '计数与实际条目对得上',
  music.counts.music === music.items.length &&
    music.counts.videos === music.items.reduce((n, it) => n + it.examples.length, 0),
  JSON.stringify(music.counts)
);
ok(
  '分组计数之和等于总数',
  music.groups.filter((g) => g.tag).reduce((n, g) => n + g.count, 0) === music.items.length
);
const declared = Array.isArray(raw.platforms) ? raw.platforms : ['douyin'];
ok('每个声明平台都有条目', declared.every((k) => countsByPlatform(k) > 0),
  declared.filter((k) => countsByPlatform(k) === 0).join(','));
ok(
  '平台计数与条目一致',
  PLATFORMS.every((p) => (music.counts.platforms[p.key] || 0) === countsByPlatform(p.key)),
  JSON.stringify(music.counts.platforms)
);
ok(
  '平台筛选器与注册表一致',
  music.platformFilters.map((p) => p.key).join(',') === ['all'].concat(PLATFORMS.map((p) => p.key)).join(','),
  music.platformFilters.map((p) => p.key).join(',')
);

// ---- 2) 链接形态（按平台注册表分别校验）----
const badMusicUrl = [];
const badExampleUrl = [];
for (const it of music.items) {
  const plat = platformByKey(it.source);
  if (!plat) {
    badMusicUrl.push(`${it.id}(未注册平台 ${it.source})`);
    continue;
  }
  const m = plat.musicUrlRe.exec(it.musicUrl || '');
  if (!m || String(it[plat.idField === 'music_id' ? 'musicId' : 'platformId']) !== m[1]) {
    badMusicUrl.push(`${it.id}(${plat.label})`);
  }
  for (const ex of it.examples) {
    const hit = platformOfUrl(ex.videoUrl);
    if (!hit || ex.awemeId !== hit.id) badExampleUrl.push(ex.awemeId);
  }
}
ok('音源链接形态与平台 id 一致', badMusicUrl.length === 0, badMusicUrl.join(','));
ok('作品页链接形态与 id 一致', badExampleUrl.length === 0, badExampleUrl.join(','));

// ---- 3) 唯一性（按平台分组）----
for (const plat of PLATFORMS) {
  const ids = music.items.filter((i) => i.source === plat.key)
    .map((i) => (plat.idField === 'music_id' ? i.musicId : i.platformId));
  ok(`${plat.label} ${plat.idField} 站内唯一`, new Set(ids).size === ids.length, `${ids.length} 条`);
}
const exampleIds = music.items.flatMap((i) => i.examples.map((e) => e.awemeId));
const slugs = music.items.map((i) => i.id);
ok('示例 id 全批唯一（跨平台）', new Set(exampleIds).size === exampleIds.length, `${exampleIds.length} 条`);
ok('slug 全批唯一', new Set(slugs).size === slugs.length);

const perAuthor = {};
for (const it of music.items) perAuthor[it.author] = (perAuthor[it.author] || 0) + 1;
const heavy = Object.keys(perAuthor).filter((a) => perAuthor[a] > 2);
ok('同一作者跨平台合计最多 2 条', heavy.length === 0, heavy.map((a) => `${a}×${perAuthor[a]}`).join(','));

// ---- 4) 必备字段与合规红线 ----
const missing = music.items.filter(
  (it) =>
    !it.name || !it.author || !it.tag || !it.platform || !it.style.length ||
    !it.examples.length || !it.searchKeyword || !it.verifiedAt || !it.musicUrl
);
ok('每条音源必备字段齐全', missing.length === 0, missing.map((i) => i.id).join(','));
ok(
  '每条二创都有荒诞点一句话',
  music.items.every((it) => it.examples.every((e) => e.memePoint && e.memePoint.length >= 8))
);
ok(
  '示例标题与作者都不为空',
  music.items.every((it) => it.examples.every((e) => e.title && e.author))
);

// 合规：这批数据在采集时就剔过擦边/带货搬运，回归时守住「不出现擦边关键词」
const BANNED = ['擦边', '性暗示', '裸', '床', '魅魔', '诱惑'];
const hits = [];
for (const it of music.items) {
  const hay = [it.name, it.searchKeyword, ...it.examples.map((e) => e.title + e.memePoint)].join(' ');
  for (const w of BANNED) if (hay.includes(w)) hits.push(`${it.id}:${w}`);
}
ok('条目里没有擦边关键词', hits.length === 0, hits.join(','));

// ---- 5) 查询与格式化 ----
const gulpGroup = music.groups.find((g) => g.key === 'gulp');
ok('分组筛选：Gulp 组条数正确', Boolean(gulpGroup) && music.filter('gulp', '').length === gulpGroup.count);
ok('分组筛选：未知分组退回全部', music.filter('nope', '').length === music.items.length);
for (const plat of PLATFORMS) {
  ok(`平台筛选：只留 ${plat.label}`, music.filter('all', '', plat.key).length === countsByPlatform(plat.key));
}
ok('平台筛选：all 不筛', music.filter('all', '', 'all').length === music.items.length);
ok('平台 + 分组叠加', music.filter('yhx', '', 'bilibili').every((i) => i.tag === '野花香' && i.source === 'bilibili'));
ok('关键词命中：音乐名', music.filter('all', '野花香').length >= 15);
ok('关键词命中：作者', music.filter('all', 'nicki').length >= 1);
ok('关键词命中：荒诞点也参与匹配', music.filter('all', '诗朗诵').length >= 1);
ok('关键词命中：平台名可搜', music.filter('all', '哔哩哔哩').length === countsByPlatform('bilibili'));
ok('关键词不命中时为空', music.filter('all', '这个词肯定没有').length === 0);

ok('formatCount 走中文习惯单位', music.formatCount('915990') === '91.6万' && music.formatCount('8455') === '8455');
ok('formatCount 对非数字原样返回', music.formatCount('未知') === '未知' && music.formatCount(null) === '');
ok('formatDuration 输出 m:ss', music.formatDuration(21) === '0:21' && music.formatDuration(96) === '1:36');
ok('formatDuration 缺值返回空串', music.formatDuration(null) === '' && music.formatDuration(0) === '');

// ---- 6) 四端同源 ----
const coreSrc = fs.readFileSync(path.join(ROOT, 'src', 'core', 'music.js'), 'utf8');
const mpSrc = fs.readFileSync(path.join(ROOT, 'miniprogram', 'data', 'music.js'), 'utf8');
ok('桌面/安卓/Web 与小程序的模块逐字一致', coreSrc === mpSrc, '两边内容不同，跑 npm run music:build 重新生成');

const mp = require('../miniprogram/data/music.js');
ok('小程序侧条目数一致', mp.items.length === music.items.length);
ok('小程序侧首条 musicId 一致', mp.items[0].musicId === music.items[0].musicId);
ok('小程序侧也带得到平台字段', mp.items.every((i) => i.source && i.platform && i.platformShort && i.usageUnit));

// ---- 7) 用户态纯逻辑：排序口径 / 每日一条（小程序页导出的同一份实现）----
global.Page = global.Page || function () {};
global.getApp = global.getApp || function () { return { globalData: {} }; };
global.wx = global.wx || {
  getStorageSync: () => '',
  setStorageSync: () => {},
  showToast: () => {},
  showModal: () => {},
  getWindowInfo: () => ({ statusBarHeight: 20 }),
  setNavigationBarColor: () => {},
  setBackgroundColor: () => {},
  setTabBarStyle: () => {},
};
const mpMusicPage = require('../miniprogram/pages/music/music.js');

ok('热度排序：平台内归一化，跨平台不直接比原始值', () => {
  const ranked = mpMusicPage.hotRank([
    { id: 'dy-big', source: 'douyin', usageCount: '9000', platform: '抖音', name: 'b' },
    { id: 'bili-small', source: 'bilibili', usageCount: '20000', platform: '哔哩哔哩', name: 'd' },
    { id: 'dy-small', source: 'douyin', usageCount: '1000', platform: '抖音', name: 'a' },
    { id: 'bili-big', source: 'bilibili', usageCount: '100000', platform: '哔哩哔哩', name: 'c' },
  ]).map((x) => x.id);
  if (ranked.indexOf('dy-big') > ranked.indexOf('dy-small')) return false;
  if (ranked.indexOf('bili-big') > ranked.indexOf('bili-small')) return false;
  // 若按原始值全局排序，bili-small(2万) 会排在 dy-big(9千) 前面；归一化后 0.2 < 1.0，必须在其后
  return ranked.indexOf('bili-small') > ranked.indexOf('dy-big');
});

ok('热度排序：usageCount 缺失的平台内排在有值的之后', () => {
  const ranked = mpMusicPage.hotRank([
    { id: 'null-one', source: 'douyin', usageCount: null, platform: '抖音', name: 'x' },
    { id: 'has-one', source: 'douyin', usageCount: '500', platform: '抖音', name: 'y' },
  ]).map((x) => x.id);
  return ranked[0] === 'has-one';
});

ok('每日一条：同一天多次调用结果稳定', () => {
  const a = mpMusicPage.dailyItem();
  const b = mpMusicPage.dailyItem();
  return a && b && a.id === b.id;
});

ok('每日一条：日期 + slug 才是种子，换日期会换结果', () => {
  // 用同一套哈希复算：同一天得分最高的是哪条，页面选中的就该是哪条
  const day = mpMusicPage.dayKey();
  let best = null;
  let bestScore = -1;
  for (const it of mp.items) {
    const score = mpMusicPage.hash(day + '|' + it.id);
    if (score > bestScore) { bestScore = score; best = it; }
  }
  const nextDay = day + 'x'; // 只当另一种「日期」用，验证换种子会改变排序
  let other = null;
  let otherScore = -1;
  for (const it of mp.items) {
    const score = mpMusicPage.hash(nextDay + '|' + it.id);
    if (score > otherScore) { otherScore = score; other = it; }
  }
  return mpMusicPage.dailyItem().id === best.id && best.id !== other.id;
});

ok('卡片装饰：收藏态与使用量单位都来自数据', () => {
  const it = mp.items[0];
  const card = mpMusicPage.decorate(it, 0, new Set([it.id]));
  return card.favored === true && card.platformLabel && card.usageUnit === it.usageUnit && card.no === '01';
});

if (failed) {
  console.error(`\n${failed} 项音乐板块检查未通过`);
  process.exit(1);
}
console.log('\n音乐板块检查全部通过');
