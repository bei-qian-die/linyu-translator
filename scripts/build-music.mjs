#!/usr/bin/env node
/*
 * npm run music:build
 *
 * 音乐板块数据管线：src/core/music-douyin.json（人工采集 + 逐条开页核验的原始数据集）
 *   → src/core/music.js        （四端共用：桌面 require / 浏览器 window.MUSIC_DATA）
 *   → miniprogram/data/music.js（小程序 require）
 *
 * 为什么要过一道生成：原始 JSON 是「采编交付物」，字段名与 schema 保持和采集侧一致
 * （snake_case）；界面侧想要的是可直接遍历的 JS 模块 + 分组元数据 + 计数格式化。
 * 两层之间只允许本脚本做转换，避免手抄两处写歪。
 *
 * 轨道 B 之后，平台与梗都由配置/数据集驱动：
 *   - 平台：scripts/music-platforms.js 的 PLATFORMS 表（新增平台 = 加一条配置）
 *   - 分组：由数据集里的 tag 自动生成（新增梗 = 只改数据集）
 * 本脚本不再出现 `if (source === 'douyin')` 这类硬分支。
 *
 * 校验即门禁：任何一条链接形态不对、平台内 id 重复、examples 为空、
 * music_used 与上层音乐名不一致，直接非零退出，不出产物。
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import platforms from './music-platforms.js';

const { PLATFORMS, TAG_ORDER, platformByKey, platformOfUrl, groupKeyOf, groupLabelOf } = platforms;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const SRC = path.join(root, 'src', 'core', 'music-douyin.json');
const OUT_CORE = path.join(root, 'src', 'core', 'music.js');
const OUT_MP = path.join(root, 'miniprogram', 'data', 'music.js');

const PLATFORM_KEYS = new Set(PLATFORMS.map((p) => p.key));

function die(msg) {
  console.error('[build-music] ' + msg);
  process.exit(1);
}

function validate(ds) {
  if (!ds || !Array.isArray(ds.items) || !ds.items.length) die('数据集缺少 items');
  const problems = [];
  const idsByPlatform = new Map();
  const exampleIds = new Set();
  const slugs = new Set();

  for (const key of ds.platforms || []) {
    if (!PLATFORM_KEYS.has(key)) problems.push(`platforms 出现未注册平台（${key}）`);
  }

  ds.items.forEach((it, i) => {
    const src = it.source || 'douyin';
    const tag = `items[${i}] ${it.id || '(无 id)'} [${src}]`;
    const plat = platformByKey(src);
    if (!plat) {
      problems.push(`${tag}: source 未在平台注册表登记（${it.source}）`);
      return;
    }
    for (const field of ['id', 'name', 'author', 'tag', 'music_url', 'search_keyword', 'verified_at']) {
      if (!it[field]) problems.push(`${tag}: 缺字段 ${field}`);
    }
    if (slugs.has(it.id)) problems.push(`${tag}: id 重复`);
    slugs.add(it.id);
    if (!Array.isArray(it.style) || !it.style.length) problems.push(`${tag}: style 为空`);
    if (!Array.isArray(it.examples) || !it.examples.length) problems.push(`${tag}: 没有二创示例`);

    // 音源落点：按该平台的 urlRe 校验，捕获组 1 就是平台内唯一 id
    const m = plat.musicUrlRe.exec(it.music_url || '');
    if (!m) problems.push(`${tag}: music_url 不符合 ${plat.label} 的落点形态（${it.music_url}）`);
    const urlId = m ? m[1] : '';
    const idVal = it[plat.idField];
    if (plat.idRequired && !idVal) problems.push(`${tag}: ${plat.label} 条目缺 ${plat.idField}`);
    if (m && String(idVal) !== String(urlId)) problems.push(`${tag}: ${plat.idField} 与 music_url 不一致`);

    if (plat.musicIdPolicy === 'required') {
      if (!it.music_id) problems.push(`${tag}: 缺 music_id`);
      else if (String(it.music_id) !== String(urlId)) problems.push(`${tag}: music_id 与 music_url 不一致`);
    } else if (plat.musicIdPolicy === 'null') {
      if (it.music_id !== null && it.music_id !== undefined) {
        problems.push(`${tag}: ${plat.label} 条目 music_id 必须为 null（该平台没有独立音乐 id）`);
      }
    } else if (plat.musicIdPolicy === 'copy') {
      if (String(it.music_id) !== String(it.platform_id)) problems.push(`${tag}: music_id 应与 platform_id 同值`);
    }

    const set = idsByPlatform.get(src) || new Set();
    if (set.has(String(idVal))) problems.push(`${tag}: ${plat.idField} 在 ${plat.label} 内重复（${idVal}）`);
    set.add(String(idVal));
    idsByPlatform.set(src, set);

    // 二创示例：落点可以跨平台（网易云 / QQ 音源的示例仍是抖音 / B 站作品），按链接反推平台
    (it.examples || []).forEach((ex, j) => {
      const etag = `${tag}.examples[${j}]`;
      for (const field of ['title', 'author', 'video_url', 'aweme_id', 'meme_point']) {
        if (!ex[field]) problems.push(`${etag}: 缺字段 ${field}`);
      }
      const hit = platformOfUrl(ex.video_url);
      if (!hit) {
        problems.push(`${etag}: video_url 不属于任何已注册平台的二创落点（${ex.video_url}）`);
      } else if (String(ex.aweme_id) !== String(hit.id)) {
        problems.push(`${etag}: aweme_id 与 video_url 不一致`);
      }
      if (exampleIds.has(String(ex.aweme_id))) problems.push(`${etag}: 示例 id 重复（${ex.aweme_id}）`);
      exampleIds.add(String(ex.aweme_id));
      if (ex.music_used !== it.name) problems.push(`${etag}: music_used 与音乐名不一致`);
    });
  });

  if (problems.length) {
    problems.forEach((p) => console.error('  ✗ ' + p));
    die(`校验未通过，共 ${problems.length} 处问题（没有生成任何文件）`);
  }

  const platformCounts = ds.items.reduce((acc, it) => {
    const s = it.source || 'douyin';
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});
  return {
    musicCount: ds.items.length,
    awemeCount: exampleIds.size,
    platforms: platformCounts,
  };
}

function normalize(it) {
  const plat = platformByKey(it.source || 'douyin');
  return {
    id: it.id,
    source: it.source || 'douyin',
    // 平台名与使用量单位全部来自注册表，界面不再自己判平台
    platform: plat.label,
    platformShort: plat.shortLabel,
    usageUnit: plat.usageUnit,
    usageLabel: plat.usageLabel,
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

// 分组从数据集自动生成：tag → 一条分组；顺序先按 TAG_META 的 order，其余按条目数倒序
function buildGroups(ds) {
  const tagCount = new Map();
  const tagStyles = new Map();
  for (const it of ds.items) {
    tagCount.set(it.tag, (tagCount.get(it.tag) || 0) + 1);
    if (!tagStyles.has(it.tag)) tagStyles.set(it.tag, new Map());
    const sc = tagStyles.get(it.tag);
    for (const s of it.style || []) sc.set(s, (sc.get(s) || 0) + 1);
  }

  const tags = [...tagCount.keys()].sort((a, b) => {
    const oa = TAG_ORDER.has(a) ? TAG_ORDER.get(a) : 999;
    const ob = TAG_ORDER.has(b) ? TAG_ORDER.get(b) : 999;
    if (oa !== ob) return oa - ob;
    return (tagCount.get(b) || 0) - (tagCount.get(a) || 0);
  });

  const usedKeys = new Set(['all']);
  const groups = [];
  const platformTotal = (ds.platforms || []).length;
  const awemeTotal = ds.items.reduce((n, it) => n + (it.examples || []).length, 0);
  groups.push({
    key: 'all',
    label: '全部',
    tag: null,
    desc: `共 ${ds.items.length} 条音源 · ${awemeTotal} 条二创 · ${platformTotal} 个平台`,
  });

  for (const tag of tags) {
    let key = groupKeyOf(tag);
    if (usedKeys.has(key)) key = `${key}-${groups.length}`;
    usedKeys.add(key);
    const styles = [...(tagStyles.get(tag) || new Map()).entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map((x) => x[0]);
    groups.push({
      key,
      label: groupLabelOf(tag),
      tag,
      desc: `音源 ${tagCount.get(tag)} 条` + (styles.length ? ` · 常见玩法：${styles.join(' / ')}` : ''),
    });
  }
  return groups;
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
  const groups = buildGroups(ds).map((g) => ({
    ...g,
    count: g.tag ? ds.items.filter((it) => it.tag === g.tag).length : ds.items.length,
  }));
  const items = ds.items.map(normalize);

  const platformLine = PLATFORMS.filter((p) => stats.platforms[p.key])
    .map((p) => `${p.shortLabel} ${stats.platforms[p.key]}`)
    .join(' · ');

  const lines = [];
  lines.push('// @ts-check');
  lines.push("'use strict';");
  lines.push('');
  lines.push('// 音乐板块数据（搞怪二创音源 · batch ' + ds.batch + '）');
  lines.push('//');
  lines.push('// 生成物：由 `npm run music:build` 从 src/core/music-douyin.json 生成，不要手改这个文件。');
  lines.push('// 平台落点、使用量单位、分组与平台筛选器全部来自 scripts/music-platforms.js 注册表；');
  lines.push('// 每条 verifiedAt 是那次打开原页确认链接落点的日期。抖音 play_count 网页端不公开，故为 null。');
  lines.push('//');
  lines.push('// 规模：' + stats.musicCount + ' 条音源 / ' + stats.awemeCount + ' 条二创作品（' + platformLine + '）。');
  lines.push('');
  lines.push('const MUSIC_PLATFORMS = ' + emitJson([
    { key: 'all', label: '全部' },
  ].concat(PLATFORMS.map((p) => ({ key: p.key, label: p.shortLabel }))), 0) + ';');
  lines.push('');
  lines.push('const MUSIC_GROUPS = ' + emitJson(groups, 0) + ';');
  lines.push('');
  lines.push('const MUSIC_ITEMS = ' + emitJson(items, 0) + ';');
  lines.push('');
  lines.push(`const MUSIC_SOURCE = ${JSON.stringify(ds.source || (ds.platforms || ['douyin'])[0] || 'douyin')};`);
  lines.push(`const MUSIC_PLATFORM_LIST = ${JSON.stringify(ds.platforms || ['douyin'])};`);
  lines.push(`const MUSIC_BATCH = ${JSON.stringify(ds.batch)};`);
  lines.push(`const MUSIC_COLLECTED_AT = ${JSON.stringify(ds.collected_at)};`);
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
  lines.push("if (typeof module === 'object' && module.exports) module.exports = __export;");
  lines.push("else if (typeof window !== 'undefined') window.MUSIC_DATA = __export;");
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
