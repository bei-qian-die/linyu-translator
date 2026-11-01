#!/usr/bin/env node
/*
 * npm run music:build
 *
 * 音乐板块数据管线：src/core/music-douyin.json（人工采集 + 逐条开页核验的原始数据集）
 *   → src/core/music.js        （四端共用：桌面 require / 浏览器 window.MUSIC_DATA）
 *   → miniprogram/data/music.js（小程序 require）
 *
 * 为什么要过一道生成：原始 JSON 是「采编交付物」，字段名与 schema 保持和抖音采集侧一致
 * （snake_case，便于和 release/ 里的采集说明对齐）；界面侧想要的是可直接遍历的 JS 模块 +
 * 分组元数据 + 计数格式化。两层之间只允许本脚本做转换，避免手抄两处写歪。
 *
 * 校验即门禁：任何一条链接形态不对、music_id / aweme_id 重复、examples 为空、
 * music_used 与上层音乐名不一致，直接非零退出，不出产物。
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const SRC = path.join(root, 'src', 'core', 'music-douyin.json');
const OUT_CORE = path.join(root, 'src', 'core', 'music.js');
const OUT_MP = path.join(root, 'miniprogram', 'data', 'music.js');

// 分组：tag 是数据集里的原始归类，key 是界面上的筛选键
const GROUPS = [
  {
    key: 'all',
    label: '全部',
    tag: null,
    desc: '野花香 × Gulp 两个梗音源的全部入选条目',
  },
  {
    key: 'yhx',
    label: '野花香',
    tag: '野花香',
    desc: 'DJ 加速、土味广场舞、Kpop 缝合、嘉菲（Jiafei）抽象系',
  },
  {
    key: 'gulp',
    label: 'Gulp',
    tag: 'Gulp',
    desc: '吞咽音当万能音效：诗朗诵、早读、生日歌、不笑挑战',
  },
  {
    key: 'yg',
    label: '双音源',
    tag: '野花香+Gulp',
    desc: '两条梗音源同框混音，童年动画与抒情歌是重灾区',
  },
];

const DY_MUSIC_URL_RE = /^https:\/\/www\.douyin\.com\/music\/\d+$/;
const DY_VIDEO_URL_RE = /^https:\/\/www\.douyin\.com\/video\/\d{19}$/;
// B 站没有独立音乐页：条目的 music_url 指向「引用该音源的作品页」，平台 id 是 BV 号
const BILI_VIDEO_URL_RE = /^https:\/\/www\.bilibili\.com\/video\/(BV[0-9A-Za-z]{10})$/;
const SOURCES = new Set(['douyin', 'bilibili']);
const VALID_TAGS = new Set(GROUPS.map((g) => g.tag).filter(Boolean));

function die(msg) {
  console.error('[build-music] ' + msg);
  process.exit(1);
}

function validate(ds) {
  if (!ds || !Array.isArray(ds.items) || !ds.items.length) die('数据集缺少 items');
  const dyMusicIds = new Set();
  const biliIds = new Set();
  const exampleIds = new Set();
  const slugs = new Set();
  const problems = [];

  ds.items.forEach((it, i) => {
    const src = it.source || 'douyin';
    const tag = `items[${i}] ${it.id || '(无 id)'} [${src}]`;
    if (!SOURCES.has(src)) problems.push(`${tag}: source 非法（${it.source}）`);
    for (const field of ['id', 'name', 'author', 'tag', 'music_url', 'search_keyword', 'verified_at']) {
      if (!it[field]) problems.push(`${tag}: 缺字段 ${field}`);
    }
    if (slugs.has(it.id)) problems.push(`${tag}: id 重复`);
    slugs.add(it.id);
    if (!VALID_TAGS.has(it.tag)) problems.push(`${tag}: tag 非法（${it.tag}）`);
    if (!Array.isArray(it.style) || !it.style.length) problems.push(`${tag}: style 为空`);
    if (!Array.isArray(it.examples) || !it.examples.length) problems.push(`${tag}: 没有二创示例`);

    if (src === 'douyin') {
      if (!DY_MUSIC_URL_RE.test(it.music_url || '')) problems.push(`${tag}: music_url 不是抖音音乐页（${it.music_url}）`);
      if (!it.music_id) problems.push(`${tag}: 抖音条目缺 music_id`);
      if (String(it.music_id) !== String(it.music_url || '').split('/').pop()) {
        problems.push(`${tag}: music_id 与 music_url 不一致`);
      }
      if (dyMusicIds.has(it.music_id)) problems.push(`${tag}: music_id 重复（${it.music_id}）`);
      dyMusicIds.add(it.music_id);
    } else {
      const m = BILI_VIDEO_URL_RE.exec(it.music_url || '');
      if (!m) problems.push(`${tag}: music_url 不是 B 站作品页（${it.music_url}）`);
      if (!it.platform_id) problems.push(`${tag}: B 站条目缺 platform_id（BV 号）`);
      if (m && it.platform_id !== m[1]) problems.push(`${tag}: platform_id 与 music_url 不一致`);
      if (it.music_id !== null && it.music_id !== undefined) {
        problems.push(`${tag}: B 站条目 music_id 必须为 null（B 站无独立音乐 id）`);
      }
      if (biliIds.has(it.platform_id)) problems.push(`${tag}: platform_id 重复（${it.platform_id}）`);
      biliIds.add(it.platform_id);
    }

    (it.examples || []).forEach((ex, j) => {
      const etag = `${tag}.examples[${j}]`;
      for (const field of ['title', 'author', 'video_url', 'aweme_id', 'meme_point']) {
        if (!ex[field]) problems.push(`${etag}: 缺字段 ${field}`);
      }
      if (src === 'douyin') {
        if (!DY_VIDEO_URL_RE.test(ex.video_url || '')) problems.push(`${etag}: video_url 不是抖音作品页（${ex.video_url}）`);
        if (String(ex.aweme_id) !== String(ex.video_url || '').split('/').pop()) {
          problems.push(`${etag}: aweme_id 与 video_url 不一致`);
        }
      } else {
        const m = BILI_VIDEO_URL_RE.exec(ex.video_url || '');
        if (!m) problems.push(`${etag}: video_url 不是 B 站作品页（${ex.video_url}）`);
        if (m && ex.aweme_id !== m[1]) problems.push(`${etag}: aweme_id（BV）与 video_url 不一致`);
      }
      if (exampleIds.has(ex.aweme_id)) problems.push(`${etag}: 示例 id 重复（${ex.aweme_id}）`);
      exampleIds.add(ex.aweme_id);
      if (ex.music_used !== it.name) problems.push(`${etag}: music_used 与音乐名不一致`);
    });
  });

  if (problems.length) {
    problems.forEach((p) => console.error('  ✗ ' + p));
    die(`校验未通过，共 ${problems.length} 处问题（没有生成任何文件）`);
  }
  const platforms = ds.items.reduce((acc, it) => {
    const s = it.source || 'douyin';
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});
  return {
    musicCount: dyMusicIds.size + biliIds.size,
    dyMusicCount: dyMusicIds.size,
    biliCount: biliIds.size,
    awemeCount: exampleIds.size,
    platforms,
  };
}

function normalize(it) {
  const source = it.source || 'douyin';
  return {
    id: it.id,
    source,
    // 平台名：界面要按平台给徽章 / 改动词（抖音「人在用」vs B 站「播放」）
    platform: source === 'bilibili' ? '哔哩哔哩' : '抖音',
    name: it.name,
    author: it.author,
    tag: it.tag,
    style: it.style,
    musicUrl: it.music_url,
    musicId: it.music_id === undefined ? null : it.music_id,
    platformId: it.platform_id || null,
    searchKeyword: it.search_keyword,
    // 使用量原样保留平台展示值（可能是 "915990" 这种纯数字串），由界面层决定怎么显示
    usageCount: it.usage_count === null || it.usage_count === undefined ? null : String(it.usage_count),
    verifiedAt: it.verified_at,
    examples: it.examples.map((ex) => ({
      title: ex.title,
      author: ex.author,
      videoUrl: ex.video_url,
      awemeId: ex.aweme_id,
      likeCount: ex.like_count === null || ex.like_count === undefined ? null : String(ex.like_count),
      playCount: ex.play_count === null || ex.play_count === undefined ? null : String(ex.play_count),
      duration: ex.duration === null || ex.duration === undefined ? null : Number(ex.duration),
      memePoint: ex.meme_point,
    })),
  };
}

// 每条数据一行 JSON：文件小、diff 也能看，出问题时还能直接 grep 到某个 aweme_id
function emitJson(value, indent) {
  const pad = ' '.repeat(indent);
  if (Array.isArray(value)) {
    if (!value.length) return '[]';
    const rows = value.map((v) => pad + '  ' + JSON.stringify(v));
    return '[\n' + rows.join(',\n') + '\n' + pad + ']';
  }
  return JSON.stringify(value);
}

function renderModule(ds, stats) {
  const groups = GROUPS.map((g) => ({
    ...g,
    count: g.tag ? ds.items.filter((it) => it.tag === g.tag).length : ds.items.length,
  }));
  const items = ds.items.map(normalize);

  const lines = [];
  lines.push('// @ts-check');
  lines.push("'use strict';");
  lines.push('');
  lines.push('// 音乐板块数据（抖音 × 哔哩哔哩 搞怪二创音源 · batch ' + ds.batch + '）');
  lines.push('//');
  lines.push('// 生成物：由 `npm run music:build` 从 src/core/music-douyin.json 生成，不要手改这个文件。');
  lines.push('// 采集口径与逐条核验记录见 release/1.33.0-notes.md；每条 verifiedAt 是那次打开原页确认');
  lines.push('// 链接落点（抖音音乐页 / 抖音作品页 / B 站作品页）的日期。play_count 抖音网页端不公开，故为 null。');
  lines.push('//');
  lines.push('// 两平台的差别只在「音源落在哪个页面」：抖音有独立音乐页（music/<id>），');
  lines.push('// B 站没有，条目的 musicUrl 指向引用该音源的作品页（video/BVxxx），platformId 存 BV 号。');
  lines.push('//');
  lines.push(`// 规模：${stats.musicCount} 条音源 / ${stats.awemeCount} 条二创作品`
    + `（抖音 ${stats.dyMusicCount} · B 站 ${stats.biliCount}；示例 id 全批唯一）。`);
  lines.push('');
  lines.push('const MUSIC_PLATFORMS = ' + emitJson([
    { key: 'all', label: '全部' },
    { key: 'douyin', label: '抖音' },
    { key: 'bilibili', label: 'B 站' },
  ], 0) + ';');
  lines.push('');
  lines.push('const MUSIC_GROUPS = ' + emitJson(groups, 0) + ';');
  lines.push('');
  lines.push('const MUSIC_ITEMS = ' + emitJson(items, 0) + ';');
  lines.push('');
  lines.push(`const MUSIC_SOURCE = ${JSON.stringify(ds.source || 'douyin')};`);
  lines.push(`const MUSIC_PLATFORM_LIST = ${JSON.stringify(ds.platforms || ['douyin'])};`);
  lines.push(`const MUSIC_BATCH = ${JSON.stringify(ds.batch)};`);
  lines.push(`const MUSIC_COLLECTED_AT = ${JSON.stringify(ds.collected_at)};`);
  lines.push('');
  lines.push(`const MUSIC_COUNTS = ${JSON.stringify({
    music: stats.musicCount,
    videos: stats.awemeCount,
    platforms: stats.platforms,
    groups: groups.filter((g) => g.tag).reduce((acc, g) => {
      acc[g.key] = g.count;
      return acc;
    }, {}),
  })};`);
  lines.push('');
  lines.push(`function musicGroupOf(tag) {
  return MUSIC_GROUPS.find((g) => g.tag === tag) || null;
}

// 大数字统一成「9.2万 / 1234」这种中文习惯写法；非数字原样返回，别把平台展示值改残
function formatMusicCount(raw) {
  if (raw === null || raw === undefined || raw === '') return '';
  const n = Number(raw);
  if (!Number.isFinite(n)) return String(raw);
  if (n >= 100000000) return (n / 100000000).toFixed(1).replace(/\\.0$/, '') + '亿';
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\\.0$/, '') + '万';
  return String(n);
}

// 秒数 → m:ss（数据集里的 duration 单位就是秒，缺失返回空串让界面自己兜底）
function formatMusicDuration(sec) {
  const n = Number(sec);
  if (!Number.isFinite(n) || n <= 0) return '';
  const m = Math.floor(n / 60);
  const s = Math.round(n % 60);
  return m + ':' + String(s).padStart(2, '0');
}

// 分组 + 平台 + 关键词（音乐名 / 作者 / 玩法标签 / 示例作者与荒诞点都参与匹配）
function filterMusicItems(groupKey, keyword, platformKey) {
  const group = MUSIC_GROUPS.find((g) => g.key === groupKey) || MUSIC_GROUPS[0];
  const plat = platformKey && platformKey !== 'all' ? platformKey : null;
  const kw = String(keyword || '').trim().toLowerCase();
  return MUSIC_ITEMS.filter((it) => {
    if (group.tag && it.tag !== group.tag) return false;
    if (plat && it.source !== plat) return false;
    if (!kw) return true;
    const hay = [it.name, it.author, it.searchKeyword, it.tag, it.platform, it.style.join(' ')]
      .concat(it.examples.map((e) => e.author + ' ' + e.memePoint + ' ' + e.title))
      .join(' ')
      .toLowerCase();
    return hay.includes(kw);
  });
}`);
  lines.push('');
  lines.push(`const __export = {
  source: MUSIC_SOURCE,
  platforms: MUSIC_PLATFORM_LIST,
  platformFilters: MUSIC_PLATFORMS,
  batch: MUSIC_BATCH,
  collectedAt: MUSIC_COLLECTED_AT,
  counts: MUSIC_COUNTS,
  groups: MUSIC_GROUPS,
  items: MUSIC_ITEMS,
  groupOf: musicGroupOf,
  formatCount: formatMusicCount,
  formatDuration: formatMusicDuration,
  filter: filterMusicItems,
};`);
  lines.push('// @platform: 双端导出，Node/打包器走 module.exports，浏览器/小程序同步脚本走 window 全局');
  lines.push('if (typeof module === \'object\' && module.exports) module.exports = __export;');
  lines.push('else if (typeof window !== \'undefined\') window.MUSIC_DATA = __export;');
  lines.push('');
  return lines.join('\n');
}

async function main() {
  const raw = await fs.readFile(SRC, 'utf8');
  let ds;
  try {
    ds = JSON.parse(raw);
  } catch (err) {
    die('music-douyin.json 不是合法 JSON：' + err.message);
  }
  const stats = validate(ds);
  const code = renderModule(ds, stats);
  await fs.writeFile(OUT_CORE, code, 'utf8');
  await fs.mkdir(path.dirname(OUT_MP), { recursive: true });
  await fs.writeFile(OUT_MP, code, 'utf8');
  console.log(
    `[build-music] ${stats.musicCount} 首音乐 / ${stats.awemeCount} 条二创 → src/core/music.js + miniprogram/data/music.js`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
