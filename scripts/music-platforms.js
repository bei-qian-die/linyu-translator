'use strict';

/*
 * 音乐板块的平台注册表（配置驱动）
 *
 * 轨道 B 的核心：新增一个音源平台只改这张表，`scripts/build-music.mjs`、
 * `test/music.test.js` 与界面平台筛选器全部从这里推导。
 *
 * 每个平台一条配置：
 *   key            数据集 / 生成物里的平台标识（条目 source 字段）
 *   label          全称（卡片徽章、平台筛选器）
 *   shortLabel     短名（窄屏筛选器 / 小程序文案）
 *   musicUrlRe     音源落点链接形态；捕获组 1 是平台内唯一 id
 *   exampleUrlRe   该平台「二创作品」的链接形态；捕获组 1 是作品 id
 *   idField        存平台唯一 id 的字段名（抖音习惯用 music_id，其余用 platform_id）
 *   idRequired     该 id 是否必填
 *   musicIdPolicy  抖音专用字段 music_id 的规则：
 *                  'required' = 必须填且等于 URL 尾段
 *                  'null'     = 必须为 null（该平台没有独立音乐 id，如 B 站作品页）
 *                  'copy'     = 与 platform_id 同值（网易云 / QQ 音乐都是歌曲 id）
 *   usageUnit      使用量单位（界面直接读，不再写 if (src === 'douyin')）
 *   usageLabel     使用量的界面标签
 *
 * 备注：网易云 / QQ 音乐的使用量口径与抖音「xx 人在用」、B 站「播放」不同（评论数 / 播放量），
 * 所以界面排序必须按平台分组或归一化，不能跨平台直接比数值（见 src/renderer/app.js 的排序实现）。
 */

const PLATFORMS = [
  {
    key: 'douyin',
    label: '抖音',
    shortLabel: '抖音',
    musicUrlRe: /^https:\/\/www\.douyin\.com\/music\/(\d+)$/,
    exampleUrlRe: /^https:\/\/www\.douyin\.com\/video\/(\d{19})$/,
    idField: 'music_id',
    idRequired: true,
    musicIdPolicy: 'required',
    usageUnit: '人在用',
    usageLabel: '使用量',
  },
  {
    key: 'bilibili',
    label: '哔哩哔哩',
    shortLabel: 'B 站',
    // B 站没有独立音乐页：音源落点就是引用该音源的作品页，platform_id 存 BV 号
    musicUrlRe: /^https:\/\/www\.bilibili\.com\/video\/(BV[0-9A-Za-z]{10})$/,
    exampleUrlRe: /^https:\/\/www\.bilibili\.com\/video\/(BV[0-9A-Za-z]{10})$/,
    idField: 'platform_id',
    idRequired: true,
    musicIdPolicy: 'null',
    usageUnit: '播放',
    usageLabel: '使用量',
  },
  {
    key: 'netease',
    label: '网易云音乐',
    shortLabel: '网易云',
    musicUrlRe: /^https:\/\/music\.163\.com\/song\?id=(\d+)$/,
    exampleUrlRe: /^https:\/\/music\.163\.com\/song\?id=(\d+)$/,
    idField: 'platform_id',
    idRequired: true,
    musicIdPolicy: 'copy',
    usageUnit: '评论',
    usageLabel: '评论数',
  },
  {
    key: 'qqmusic',
    label: 'QQ音乐',
    shortLabel: 'QQ音乐',
    musicUrlRe: /^https:\/\/y\.qq\.com\/n\/ryqq\/songDetail\/([0-9A-Za-z]+)$/,
    exampleUrlRe: /^https:\/\/y\.qq\.com\/n\/ryqq\/songDetail\/([0-9A-Za-z]+)$/,
    idField: 'platform_id',
    idRequired: true,
    musicIdPolicy: 'copy',
    usageUnit: '播放',
    usageLabel: '播放量',
  },
];

const PLATFORM_BY_KEY = new Map(PLATFORMS.map((p) => [p.key, p]));

// 梗标签的显示名 / 稳定分组键 / 排序权重。
// 新增梗只改数据集（tag 值），这里缺省会自动回退成「tag 原文」，不需要先登记。
const TAG_META = [
  { tag: '野花香', key: 'yhx', label: '野花香', order: 1 },
  { tag: 'Gulp', key: 'gulp', label: 'Gulp', order: 2 },
  { tag: '野花香+Gulp', key: 'yg', label: '双音源', order: 3 },
];

const TAG_ORDER = new Map(TAG_META.map((t) => [t.tag, t.order]));

function platformByKey(key) {
  return PLATFORM_BY_KEY.get(key) || null;
}

// 从链接反推平台：先用「音源落点」匹配，再用「作品落点」匹配（二创示例跨平台存在）
function platformOfUrl(url) {
  const u = String(url || '');
  for (const p of PLATFORMS) {
    if (p.musicUrlRe.test(u)) return { platform: p, kind: 'music', id: u.match(p.musicUrlRe)[1] };
  }
  for (const p of PLATFORMS) {
    if (p.exampleUrlRe.test(u)) return { platform: p, kind: 'example', id: u.match(p.exampleUrlRe)[1] };
  }
  return null;
}

// tag → 稳定分组键：登记过的用映射值；没登记的 ASCII 标签转小写骨架，中文标签原样做键
function groupKeyOf(tag) {
  const meta = TAG_META.find((t) => t.tag === tag);
  if (meta) return meta.key;
  const raw = String(tag || '').trim();
  const ascii = raw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return ascii || raw;
}

function groupLabelOf(tag) {
  const meta = TAG_META.find((t) => t.tag === tag);
  return meta ? meta.label : String(tag || '');
}

module.exports = { PLATFORMS, TAG_META, TAG_ORDER, platformByKey, platformOfUrl, groupKeyOf, groupLabelOf };
