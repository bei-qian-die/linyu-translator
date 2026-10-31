'use strict';

// 音乐板块（1.32.0）的数据契约测试。
//
// 这一块的失败模式跟别处不一样：界面写错顶多难看，数据写错会把用户送到一个不存在的抖音页面，
// 或者四端跑出四份不一样的条目。所以这里守三条线：
//   1) 链接形态（只允许 music/<id> 与 video/<19位数字>，id 必须和 URL 尾段一致）
//   2) 唯一性（music_id / aweme_id / slug 全批唯一，同一作者最多 2 条）
//   3) 四端同源（src/core/music.js 与 miniprogram/data/music.js 必须逐字一致，
//      且与 src/core/music-douyin.json 的原始数据集对得上）

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

const MUSIC_RE = /^https:\/\/www\.douyin\.com\/music\/\d+$/;
const VIDEO_RE = /^https:\/\/www\.douyin\.com\/video\/\d{19}$/;

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

// ---- 2) 链接形态 ----
const badMusic = music.items.filter((it) => !MUSIC_RE.test(it.musicUrl) || String(it.musicId) !== it.musicUrl.split('/').pop());
const badVideo = [];
for (const it of music.items) {
  for (const ex of it.examples) {
    if (!VIDEO_RE.test(ex.videoUrl) || String(ex.awemeId) !== ex.videoUrl.split('/').pop()) badVideo.push(ex.awemeId);
  }
}
ok('音乐页链接形态与 id 一致', badMusic.length === 0, badMusic.map((i) => i.id).join(','));
ok('作品页链接形态与 id 一致', badVideo.length === 0, badVideo.join(','));

// ---- 3) 唯一性 ----
const musicIds = music.items.map((i) => i.musicId);
const awemeIds = music.items.flatMap((i) => i.examples.map((e) => e.awemeId));
const slugs = music.items.map((i) => i.id);
ok('music_id 全批唯一', new Set(musicIds).size === musicIds.length);
ok('aweme_id 全批唯一', new Set(awemeIds).size === awemeIds.length, `${awemeIds.length} 条`);
ok('slug 全批唯一', new Set(slugs).size === slugs.length);

const perAuthor = {};
for (const it of music.items) perAuthor[it.author] = (perAuthor[it.author] || 0) + 1;
const heavy = Object.keys(perAuthor).filter((a) => perAuthor[a] > 2);
ok('同一作者最多 2 条', heavy.length === 0, heavy.join(','));

// ---- 4) 必备字段与合规红线 ----
const missing = music.items.filter(
  (it) => !it.name || !it.author || !it.tag || !it.style.length || !it.examples.length || !it.searchKeyword || !it.verifiedAt
);
ok('每条音乐必备字段齐全', missing.length === 0, missing.map((i) => i.id).join(','));
ok(
  '每条二创都有荒诞点一句话',
  music.items.every((it) => it.examples.every((e) => e.memePoint && e.memePoint.length >= 8))
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
ok('关键词命中：音乐名', music.filter('all', '野花香').length >= 7);
ok('关键词命中：作者', music.filter('all', 'nicki').length >= 1);
ok('关键词命中：荒诞点也参与匹配', music.filter('all', '诗朗诵').length >= 1);
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

if (failed) {
  console.error(`\n${failed} 项音乐板块检查未通过`);
  process.exit(1);
}
console.log('\n音乐板块检查全部通过');
