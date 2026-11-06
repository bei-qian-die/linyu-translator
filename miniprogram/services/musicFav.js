'use strict';

/*
 * 音乐用户态（小程序）：收藏 / 最近浏览
 *
 * 与桌面（src/core/db.js 的 music_favs / music_seen 两张表）、
 * Web（src/web/webEntry.js 的 linyu.music.favs / linyu.music.seen）同名同语义：
 *   getMusicFavs()               → [{ id, platform, createdAt }]，按收藏时间倒序
 *   toggleMusicFav(id, platform) → { id, favored }（再点一次取反，幂等）
 *   getMusicSeen()               → [{ id, seenAt }]，最近 50 条、去重、按时间倒序
 *   markMusicSeen(id)            → { id, seen: true }（同一条重复点开只更新时间）
 *
 * 只在本地存储，不上传、不同步；静态音源本身仍在 miniprogram/data/music.js 里，不进 Storage。
 */

const FAV_KEY = 'linyu.music.favs.v1';
const SEEN_KEY = 'linyu.music.seen.v1';
const SEEN_LIMIT = 50;

let favCache = null;
let seenCache = null;

function readArray(key) {
  try {
    const raw = wx.getStorageSync(key);
    return Array.isArray(raw) ? raw.filter((x) => x && typeof x === 'object' && x.id) : [];
  } catch (err) {
    return [];
  }
}

function writeArray(key, rows) {
  try {
    wx.setStorageSync(key, rows);
  } catch (err) {
    // 配额异常时退到最近 20 条再试一次：宁可少存，也不要让收藏操作直接抛错
    try {
      wx.setStorageSync(key, rows.slice(0, 20));
    } catch (e) {
      /* ignore */
    }
  }
}

function slugOf(id) {
  const s = String(id == null ? '' : id).trim();
  if (!s) throw new Error('缺少音源 id');
  return s;
}

function getMusicFavs() {
  if (!favCache) favCache = readArray(FAV_KEY);
  return favCache.slice();
}

function toggleMusicFav(id, platform) {
  const slug = slugOf(id);
  const rows = getMusicFavs();
  const idx = rows.findIndex((r) => r.id === slug);
  if (idx >= 0) {
    rows.splice(idx, 1);
    favCache = rows;
    writeArray(FAV_KEY, rows);
    return { id: slug, favored: false };
  }
  rows.unshift({ id: slug, platform: String(platform || 'douyin'), createdAt: new Date().toISOString() });
  favCache = rows;
  writeArray(FAV_KEY, rows);
  return { id: slug, favored: true };
}

function getMusicSeen() {
  if (!seenCache) seenCache = readArray(SEEN_KEY).slice(0, SEEN_LIMIT);
  return seenCache.slice();
}

function markMusicSeen(id) {
  const slug = slugOf(id);
  const rows = getMusicSeen().filter((r) => r.id !== slug);
  rows.unshift({ id: slug, seenAt: new Date().toISOString() });
  if (rows.length > SEEN_LIMIT) rows.length = SEEN_LIMIT;
  seenCache = rows;
  writeArray(SEEN_KEY, rows);
  return { id: slug, seen: true };
}

// 测试 / 热更新时清掉内存缓存，下次读会重新从 Storage 取
function resetCache() {
  favCache = null;
  seenCache = null;
}

module.exports = {
  FAV_KEY,
  SEEN_KEY,
  SEEN_LIMIT,
  getMusicFavs,
  toggleMusicFav,
  getMusicSeen,
  markMusicSeen,
  resetCache,
};
