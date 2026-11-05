'use strict';

/*
 * 分页工具：小程序端词库 / 句式页（主包）与词卡 / 名言 / 人物页（分包）共用。
 *
 * 之前是「加载更多」累积模型：滚到底把下一页 append 进 shown，翻到第 100 页时
 * setData 里已经堆着 3000 条节点，越滑越卡。改成整页替换后，不管跳到第几页，
 * 下发到视图层的数据量都恒定 = 一页 30 条，跳页也就成了 O(1) 的切片。
 *
 * 这里只放纯函数，页面自己管 setData，方便 test/weapp.test.js 直接断言边界。
 */

const DEFAULT_SIZE = 30;

function countPages(total, size) {
  const n = Number(total) || 0;
  const s = Number(size) || DEFAULT_SIZE;
  return Math.max(1, Math.ceil(n / s));
}

// 页码一律夹到 [1, pages]；解析不出数字就当第 1 页
function clampPage(value, pages) {
  const max = Math.max(1, Number(pages) || 1);
  const n = parseInt(String(value), 10);
  if (!Number.isFinite(n)) return 1;
  return Math.min(Math.max(1, n), max);
}

// 输入框里的东西 → 页码数字。全角数字、夹带文字（「第10页」）都容忍；
// 解析不出返回 null，交给调用方决定是提示还是忽略。
function parsePageInput(raw) {
  const text = raw === null || raw === undefined ? '' : String(raw);
  const ascii = text.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  const hit = ascii.match(/\d+/);
  if (!hit) return null;
  const n = parseInt(hit[0], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function pageSlice(list, page, size) {
  const arr = Array.isArray(list) ? list : [];
  const s = Number(size) || DEFAULT_SIZE;
  const pages = countPages(arr.length, s);
  const p = clampPage(page, pages);
  const from = (p - 1) * s;
  return { page: p, pages, from, items: arr.slice(from, from + s) };
}

module.exports = { DEFAULT_SIZE, countPages, clampPage, parsePageInput, pageSlice };
