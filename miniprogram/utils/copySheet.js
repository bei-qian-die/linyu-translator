'use strict';

// 「手动复制」兜底面板：剪贴板隐私接口不可用（后台未声明「剪贴板」/ 用户拒绝授权 /
// 提审勾了「未采集隐私」）时，把要复制的内容放进可选中的浮层，长按全选即可复制，
// 保证「复制」这个核心动作在任何权限状态下都能完成。
//
// 用法（Page 内，onLoad 第一行）：
//   const { attachCopySheet } = require('../../utils/copySheet');
//   onLoad(options) { attachCopySheet(this); ... }
//   this.copyText('要复制的文本', '已复制♥');
// WXML 里加 <import src="/templates/copy-sheet.wxml" /> 与 <template is="copy-sheet" />。

const { copy } = require('./ui');

const HINT = '剪贴板授权未打开，长按下面文字全选后复制；也可以点「再试一次」重新授权';

const EMPTY = { text: '', hint: '' };

function attachCopySheet(page) {
  if (!page || page.copyText) return page;

  page.copyText = function copyText(text, tip) {
    const data = text === null || text === undefined ? '' : String(text);
    if (!data) return;
    return copy(data, tip).then((ok) => {
      if (!ok) this.setData({ copySheet: { text: data, hint: HINT } });
    });
  };

  page.closeCopySheet = function closeCopySheet() {
    this.setData({ copySheet: EMPTY });
  };

  page.retryCopy = function retryCopy() {
    const text = (this.data.copySheet && this.data.copySheet.text) || '';
    if (!text) return;
    return copy(text, '已复制♥').then((ok) => {
      if (ok) this.closeCopySheet();
      else {
        wx.showToast({
          title: '仍没有剪贴板权限，请长按文字复制',
          icon: 'none',
          duration: 2000,
        });
      }
    });
  };

  // 遮罩层挡滚动用，避免滚动穿透到页面
  page.noop = function noop() {};

  return page;
}

module.exports = { attachCopySheet, HINT };
