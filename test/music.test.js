'use strict';

// 音乐板块（1.33.0，双平台批次）的数据契约测试。
//
// 这一块的失败模式跟别处不一样：界面写错顶多难看，数据写错会把用户送到一个不存在的页面，
// 或者四端跑出四份不一样的条目。所以这里守四条线：
//   1) 链接形态（抖音 music/<id>、抖音 video/<19位数字>、B 站 video/<BV号>，id 必须与 URL 尾段一致）
//   2) 唯一性（抖音 music_id 唯一 + B 站 platform_id 唯一 + 示例 id 全局唯一 + slug 全局唯一
//      + 同一作者跨平台合计 ≤2 条）
//   3) 两平台字段差异（B 站没有独立音乐页：music_id 必须为 null，platform_id 必须是 BV 号）
//   4) 四端同源（src/core/music.js 与 miniprogram/data/music.js 逐字一致，且与原始数据集对得上）

const fs = require('fs');
const path = require('path');

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

const DY_MUSIC_RE = /^https:\/\/www\.douyin\.com\/music\/\d+$/;
const DY_VIDEO_RE = /^https:\/\/www\.douyin\.com\/video\/\d{19}$/;
const BILI_VIDEO_RE = /^https:\/\/www\.bilibili\.com\/video\/(BV[0-9A-Za-z]{10})$/;

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
const dyCount = music.items.filter((i) => i.source === 'douyin').length;
const biliCount = music.items.filter((i) => i.source === 'bilibili').length;
ok('两个平台都有条目', dyCount > 0 && biliCount > 0, `抖音 ${dyCount} / B 站 ${biliCount}`);
ok(
  '平台计数与条目一致',
  music.counts.platforms.douyin === dyCount && music.counts.platforms.bilibili === biliCount,
  JSON.stringify(music.counts.platforms)
);
ok('平台筛选器齐全', music.platformFilters.map((p) => p.key).join(',') === 'all,douyin,bilibili');

// ---- 2) 链接形态（按平台分别校验）----
const badDyMusic = [];
const badBiliMusic = [];
const badVideo = [];
for (const it of music.items) {
  if (it.source === 'douyin') {
    if (!DY_MUSIC_RE.test(it.musicUrl) || String(it.musicId) !== it.musicUrl.split('/').pop()) badDyMusic.push(it.id);
  } else if (it.source === 'bilibili') {
    const m = BILI_VIDEO_RE.exec(it.musicUrl || '');
    if (!m || it.platformId !== m[1]) badBiliMusic.push(it.id);
    if (it.musicId !== null) badBiliMusic.push(it.id + '(music_id 非 null)');
  } else {
    badDyMusic.push(it.id + '(未知 source)');
  }
  for (const ex of it.examples) {
    if (it.source === 'douyin') {
      if (!DY_VIDEO_RE.test(ex.videoUrl) || String(ex.awemeId) !== ex.videoUrl.split('/').pop()) badVideo.push(ex.awemeId);
    } else {
      const m = BILI_VIDEO_RE.exec(ex.videoUrl || '');
      if (!m || ex.awemeId !== m[1]) badVideo.push(ex.awemeId);
    }
  }
}
ok('抖音音乐页链接形态与 id 一致', badDyMusic.length === 0, badDyMusic.join(','));
ok('B 站音源链接形态与 BV 一致', badBiliMusic.length === 0, badBiliMusic.join(','));
ok('作品页链接形态与 id 一致', badVideo.length === 0, badVideo.join(','));

// ---- 3) 唯一性 ----
const dyMusicIds = music.items.filter((i) => i.source === 'douyin').map((i) => i.musicId);
const biliIds = music.items.filter((i) => i.source === 'bilibili').map((i) => i.platformId);
const exampleIds = music.items.flatMap((i) => i.examples.map((e) => e.awemeId));
const slugs = music.items.map((i) => i.id);
ok('抖音 music_id 全批唯一', new Set(dyMusicIds).size === dyMusicIds.length, `${dyMusicIds.length} 条`);
ok('B 站 platform_id 全批唯一', new Set(biliIds).size === biliIds.length, `${biliIds.length} 条`);
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
ok('分组筛选：Gulp 组条数正确', music.filter('gulp', '').length === music.groups.find((g) => g.key === 'gulp').count);
ok('分组筛选：未知分组退回全部', music.filter('nope', '').length === music.items.length);
ok('平台筛选：只留 B 站', music.filter('all', '', 'bilibili').length === biliCount);
ok('平台筛选：只留抖音', music.filter('all', '', 'douyin').length === dyCount);
ok('平台筛选：all 不筛', music.filter('all', '', 'all').length === music.items.length);
ok('平台 + 分组叠加', music.filter('yhx', '', 'bilibili').every((i) => i.tag === '野花香' && i.source === 'bilibili'));
ok('关键词命中：音乐名', music.filter('all', '野花香').length >= 15);
ok('关键词命中：作者', music.filter('all', 'nicki').length >= 1);
ok('关键词命中：荒诞点也参与匹配', music.filter('all', '诗朗诵').length >= 1);
ok('关键词命中：平台名可搜', music.filter('all', '哔哩哔哩').length === biliCount);
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
ok('小程序侧也带得到平台字段', mp.items.every((i) => i.source && i.platform));

if (failed) {
  console.error(`\n${failed} 项音乐板块检查未通过`);
  process.exit(1);
}
console.log('\n音乐板块检查全部通过');
