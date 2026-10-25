'use strict';

const historyStore = require('../../services/history');
const { HISTORY_LIMITS, dangerFor } = require('../../services/prefs');
const { toast, confirm, copy, chromeMetrics } = require('../../utils/ui');
const { formatClock } = require('../../utils/format');
const { syncChrome } = require('../../utils/pageBase');

const PAGE_SIZE = 50;
const EXPORT_MAX_CHARS = 100000;

function dayLabel(createdAt, todayStart, yesterdayStart) {
  const d = new Date(Number(createdAt) || Date.now());
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  if (start === todayStart) return '今天';
  if (start === yesterdayStart) return '昨天';
  return '更早';
}

Page({
  data: {
    theme: 'white',
    keyword: '',
    total: 0,
    matched: 0,
    shownCount: 0,
    groups: [],
    hasMore: false,
    rest: 0,
    selecting: false,
    selectedCount: 0,
    allChecked: false,
    limit: 200,
    limitIndex: 1,
    limitLabels: HISTORY_LIMITS.map((n) => n + ' 条'),
    statusBar: 20,
    navBarH: 64,
    navTop: 82,
  },

  onLoad() {
    this.setData(chromeMetrics());
    wx.hideShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] });
  },

  onShow() {
    syncChrome(this, 2);
    this._selected = new Set();
    this.reload();
  },

  onHide() {
    clearTimeout(this._searchTimer);
    historyStore.flush();
  },

  onUnload() {
    historyStore.flush();
  },

  reload() {
    const limit = historyStore.getHistoryLimit();
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime();
    const rows = historyStore.readHistory().map((row) => ({
      id: row.id,
      input: row.input,
      output: row.output,
      timeShort: formatClock(row.createdAt),
      groupLabel: dayLabel(row.createdAt, todayStart, yesterdayStart),
    }));
    this._rows = rows;
    this._visible = PAGE_SIZE;
    this.setData({
      limit,
      limitIndex: Math.max(0, HISTORY_LIMITS.indexOf(limit)),
      total: rows.length,
    });
    this.applyFilter(true);
  },

  applyFilter(reset) {
    const keyword = this.data.keyword.trim().toLowerCase();
    const rows = this._rows || [];
    const filtered = keyword
      ? rows.filter((row) => (row.input + ' ' + row.output).toLowerCase().indexOf(keyword) >= 0)
      : rows;
    this._filtered = filtered;

    const visible = Math.min(PAGE_SIZE, filtered.length);
    this._shownCount = visible;
    const groups = this.buildGroups(this._decorate(filtered.slice(0, visible)));

    this.setData({
      groups,
      shownCount: visible,
      matched: filtered.length,
      hasMore: filtered.length > visible,
      rest: Math.max(0, filtered.length - visible),
    });
  },

  // 批量删除模式下给行视图补 checked 标记，普通模式原样返回
  _decorate(rows) {
    if (!this.data.selecting) return rows;
    const selected = this._selected || new Set();
    return rows.map((row) => Object.assign({}, row, { checked: selected.has(row.id) }));
  },

  buildGroups(rows) {
    const groups = [];
    rows.forEach((row) => {
      const last = groups[groups.length - 1];
      if (!last || last.label !== row.groupLabel) {
        groups.push({ label: row.groupLabel, count: 0, items: [] });
      }
      const group = groups[groups.length - 1];
      group.items.push(row);
      group.count += 1;
    });
    return groups;
  },

  // 增量 setData（B3）：只补新条目路径与新增分组，不再全量重建 groups
  loadMore() {
    if (!this.data.hasMore) return;
    const filtered = this._filtered || [];
    const from = this._shownCount;
    const to = Math.min(from + PAGE_SIZE, filtered.length);
    if (to <= from) return;

    const rows = this._decorate(filtered.slice(from, to));
    const groups = this.data.groups;
    const lastIndex = groups.length - 1;
    const last = lastIndex >= 0 ? groups[lastIndex] : null;
    const patch = {};

    let cursor = 0;
    if (last) {
      // 先接到最后一组；这里必须先写 patch，否则「同一天继续加载」会一条都追加不进去
      const sameGroup = [];
      while (cursor < rows.length && rows[cursor].groupLabel === last.label) {
        sameGroup.push(rows[cursor]);
        cursor += 1;
      }
      if (sameGroup.length) {
        const base = last.items.length;
        sameGroup.forEach((row, j) => {
          patch['groups[' + lastIndex + '].items[' + (base + j) + ']'] = row;
        });
        patch['groups[' + lastIndex + '].count'] = base + sameGroup.length;
      }
    }

    // 剩余行按日期标签整组追加
    const appended = [];
    let current = null;
    for (; cursor < rows.length; cursor += 1) {
      const row = rows[cursor];
      if (!current || current.label !== row.groupLabel) {
        current = { label: row.groupLabel, count: 0, items: [] };
        appended.push(current);
      }
      current.items.push(row);
      current.count += 1;
    }
    appended.forEach((group, j) => {
      patch['groups[' + (lastIndex + 1 + j) + ']'] = group;
    });

    this._shownCount = to;
    patch.shownCount = to;
    patch.hasMore = filtered.length > to;
    patch.rest = Math.max(0, filtered.length - to);
    this.setData(patch);
  },

  onReachBottom() {
    this.loadMore();
  },

  onSearch(e) {
    this.setData({ keyword: e.detail.value });
    clearTimeout(this._searchTimer);
    this._searchTimer = setTimeout(() => this.applyFilter(true), 150);
  },

  clearSearch() {
    this.setData({ keyword: '' }, () => this.applyFilter(true));
  },

  changeLimit(e) {
    const index = Number(e.detail.value);
    const limit = HISTORY_LIMITS[index];
    if (!limit) return;
    historyStore.setHistoryLimit(limit);
    getApp().setHistoryLimit(limit);
    this.reload();
    toast('最多保留 ' + limit + ' 条');
  },

  reuse(e) {
    const id = e.currentTarget.dataset.id;
    const row = (this._rows || []).find((item) => item.id === id);
    if (!row) return;
    getApp().globalData.pendingInput = row.input;
    wx.switchTab({ url: '/pages/index/index' });
  },

  onRowTap(e) {
    if (this.data.selecting) {
      this.toggleSelect(e);
      return;
    }
    this.reuse(e);
  },

  copyRow(e) {
    if (this.data.selecting) return;
    const id = e.currentTarget.dataset.id;
    const row = (this._rows || []).find((item) => item.id === id);
    if (!row) return;
    copy(row.output, '译文已复制♥');
  },

  enterSelect() {
    if (!this.data.total) return;
    this._selected = new Set();
    this.setData({ selecting: true, selectedCount: 0, allChecked: false }, () => this.applyFilter(true));
  },

  cancelSelect() {
    this._selected = new Set();
    this.setData({ selecting: false, selectedCount: 0, allChecked: false }, () => this.applyFilter(true));
  },

  toggleSelect(e) {
    const id = e.currentTarget.dataset.id;
    const gi = Number(e.currentTarget.dataset.gi);
    const ji = Number(e.currentTarget.dataset.ji);
    if (!id) return;
    const selected = this._selected || new Set();
    if (selected.has(id)) {
      selected.delete(id);
      this.setData({
        ['groups[' + gi + '].items[' + ji + '].checked']: false,
        selectedCount: selected.size,
        allChecked: false,
      });
    } else {
      selected.add(id);
      this.setData({
        ['groups[' + gi + '].items[' + ji + '].checked']: true,
        selectedCount: selected.size,
      });
      this._refreshAllChecked();
    }
  },

  toggleAll() {
    const selected = this._selected || new Set();
    if (this.data.allChecked) {
      selected.clear();
    } else {
      for (const group of this.data.groups) {
        for (const row of group.items) selected.add(row.id);
      }
    }
    const patch = { selectedCount: selected.size, allChecked: !this.data.allChecked };
    this.data.groups.forEach((group, gi) => {
      group.items.forEach((row, ji) => {
        patch['groups[' + gi + '].items[' + ji + '].checked'] = patch.allChecked;
      });
    });
    this.setData(patch);
  },

  _refreshAllChecked() {
    const selected = this._selected || new Set();
    let all = this.data.shownCount > 0;
    for (const group of this.data.groups) {
      for (const row of group.items) {
        if (!selected.has(row.id)) {
          all = false;
          break;
        }
      }
      if (!all) break;
    }
    if (this.data.allChecked !== all) this.setData({ allChecked: all });
  },

  async deleteSelected() {
    const selected = this._selected || new Set();
    if (!selected.size) return;
    const ok = await confirm({
      title: '删除选中记录',
      content: `确定删除选中的 ${selected.size} 条记录？删除后无法恢复。`,
      confirmText: '删除',
      confirmColor: dangerFor(this.data.theme),
    });
    if (!ok) return;
    for (const id of selected) historyStore.removeHistory(id);
    this._selected = new Set();
    this.setData({ selecting: false, selectedCount: 0, allChecked: false });
    this.reload();
    toast('已删除选中的记录');
  },

  exportText() {
    const rows = this.data.keyword.trim() ? this._filtered || [] : this._rows || [];
    if (!rows.length) return;
    let text = rows.map((row) => '原文：' + row.input + '\n淋语：' + row.output).join('\n\n');
    let truncated = false;
    if (text.length > EXPORT_MAX_CHARS) {
      text = text.slice(0, EXPORT_MAX_CHARS);
      truncated = true;
    }
    copy(text, truncated ? `已导出前 ${EXPORT_MAX_CHARS} 字（超出部分被截断）` : '已导出到剪贴板');
  },

  removeOne(e) {
    const id = e.currentTarget.dataset.id;
    historyStore.removeHistory(id);
    this.reload();
    toast('已删除这条记录');
  },

  async confirmClear() {
    if (!this.data.total) return;
    const ok = await confirm({
      title: '清空翻译历史',
      content: '确定清空全部翻译历史？清空后无法恢复。',
      confirmText: '清空',
      confirmColor: dangerFor(this.data.theme),
    });
    if (!ok) return;
    historyStore.clearHistory();
    this.reload();
    toast('已清空翻译历史');
  },

  goTranslate() {
    wx.switchTab({ url: '/pages/index/index' });
  },
});
