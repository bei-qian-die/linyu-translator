'use strict';

function toast(title) {
  wx.showToast({
    title: String(title || '').slice(0, 30),
    icon: 'none',
    duration: 1800,
  });
}

function confirm(options) {
  const opts = options || {};
  return new Promise((resolve) => {
    wx.showModal({
      title: opts.title || '提示',
      content: opts.content || '',
      confirmText: opts.confirmText || '确定',
      cancelText: opts.cancelText || '取消',
      confirmColor: opts.confirmColor || '#141414',
      success: (res) => resolve(Boolean(res.confirm)),
      fail: () => resolve(false),
    });
  });
}

function copy(text, tip) {
  const data = String(text || '');
  if (!data) return;
  wx.setClipboardData({
    data,
    success: () => {
      wx.hideToast();
      toast(tip || '已复制♥');
    },
    fail: (err) => {
      // 常见原因：未在 mp 后台隐私指引声明「读取你的剪切板」（iOS 必现）
      console.error('[linyu] setClipboardData 失败', err);
      toast('复制失败，请长按选择文本');
    },
  });
}

function chromeMetrics() {
  try {
    const win = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    const statusBar = (win && win.statusBarHeight) || 20;
    return { statusBar, navBarH: statusBar + 44, navTop: statusBar + 62 };
  } catch (err) {
    return { statusBar: 20, navBarH: 64, navTop: 82 };
  }
}

module.exports = { toast, confirm, copy, chromeMetrics };
