'use strict';

// 翻译耗时采样（B13）：独立模块，避免关于页为了看统计而加载 390KB 的 seed。
const STAT_WINDOW = 200;
const SLOW_MS = 50;

const durations = [];
let calls = 0;
let cursor = 0;
let slowCount = 0;

function record(ms, input) {
  if (durations.length < STAT_WINDOW) durations.push(ms);
  else durations[cursor % STAT_WINDOW] = ms;
  cursor += 1;
  calls += 1;

  if (ms <= SLOW_MS) return;
  slowCount += 1;
  try {
    if (typeof wx !== 'undefined' && wx.getRealtimeLogManager) {
      const logger = wx.getRealtimeLogManager();
      if (logger && logger.warn) logger.warn('translate_slow', { ms, len: String(input || '').length });
    }
  } catch (err) {
    // 日志通道异常不影响翻译主链路
  }
}

function stats() {
  if (!durations.length) return null;
  const sorted = durations.slice().sort((a, b) => a - b);
  const pick = (p) => sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
  return {
    count: calls,
    window: durations.length,
    avg: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
    p50: pick(50),
    p95: pick(95),
    slowCount,
  };
}

module.exports = { record, stats };
