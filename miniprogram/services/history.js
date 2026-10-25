'use strict';

const { getPrefs, setPref, HISTORY_LIMITS } = require('./prefs');

const HISTORY_KEY = 'linyu.history.v1';
const FLUSH_DELAY = 300;

// B4：模块内维护内存缓存，读不再每次走 getStorageSync 全量 JSON.parse；
// 写入改为节流 + 异步 wx.setStorage，页面 onHide/onUnload 与 app.onHide 时强制 flush 防丢数据。
let cache = null;
let flushTimer = null;

function normalizeRow(row) {
  if (!row || typeof row !== 'object') return null;
  const input = String(row.input || '').trim();
  const output = String(row.output || '');
  if (!input || !output) return null;
  return {
    id: String(row.id || row.createdAt || Date.now()),
    input,
    output,
    createdAt: Number(row.createdAt) || Date.now(),
  };
}

function readHistory() {
  if (cache) return cache;
  try {
    const raw = wx.getStorageSync(HISTORY_KEY);
    if (!Array.isArray(raw)) {
      cache = [];
      return cache;
    }
    const rows = raw.map(normalizeRow).filter(Boolean);
    const limit = getPrefs().historyLimit;
    cache = rows.slice(0, limit);
  } catch (err) {
    cache = [];
  }
  return cache;
}

function persistSync(rows) {
  try {
    wx.setStorageSync(HISTORY_KEY, rows);
  } catch (err) {
    // 存储配额异常时退到 100 条再试一次，至少别让本次翻译直接失败
    try {
      wx.setStorageSync(HISTORY_KEY, rows.slice(0, 100));
    } catch (e) {
      // ignore
    }
  }
}

function flush() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (!cache) return;
  const rows = cache;
  if (typeof wx.setStorage === 'function') {
    wx.setStorage({
      key: HISTORY_KEY,
      data: rows,
      fail: () => persistSync(rows.slice(0, 100)),
    });
  } else {
    persistSync(rows);
  }
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush();
  }, FLUSH_DELAY);
}

function writeHistory(rows) {
  cache = rows.slice();
  scheduleFlush();
}

function getHistoryLimit() {
  return getPrefs().historyLimit;
}

function addHistory(input, output) {
  const src = String(input || '').trim();
  const dst = String(output || '');
  if (!src || !dst) return readHistory();

  const rows = readHistory().filter((row) => !(row.input === src && row.output === dst));
  rows.unshift({
    id: Date.now() + '-' + Math.random().toString(36).slice(2, 8),
    input: src,
    output: dst,
    createdAt: Date.now(),
  });

  const limit = getHistoryLimit();
  if (rows.length > limit) rows.length = limit;
  writeHistory(rows);
  return rows;
}

function removeHistory(id) {
  const rows = readHistory().filter((row) => row.id !== id);
  writeHistory(rows);
  return rows;
}

function clearHistory() {
  writeHistory([]);
  return [];
}

function setHistoryLimit(limit) {
  const n = Number(limit);
  const next = HISTORY_LIMITS.indexOf(n) >= 0 ? n : getHistoryLimit();
  setPref('historyLimit', next);
  const rows = readHistory();
  if (rows.length > next) {
    rows.length = next;
    writeHistory(rows);
  }
  return next;
}

module.exports = {
  HISTORY_KEY,
  readHistory,
  addHistory,
  removeHistory,
  clearHistory,
  getHistoryLimit,
  setHistoryLimit,
  flush,
};
