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

// ---- 剪贴板 ----
// wx.setClipboardData 是隐私接口（2023-09 起全量拦截）。失败只有三种真实原因：
//   1) errno 112 / "api scope is not declared"：后台《用户隐私保护指引》没勾「剪贴板」
//   2) errno 103 / 104：用户在微信官方隐私弹窗点了拒绝（103 拒绝 104 未同意）
//   3) "appid privacy api banned"：提审时勾了「未采集隐私」，平台回收了接口权限
// 代码侧不能替用户修 1 和 3，所以这里只负责「判定 + 归类 + 上报」，
// 拿不到剪贴板时由页面弹「手动复制」面板（utils/copySheet.js）让用户长按复制，
// 保证「复制」这个核心动作在任何权限状态下都能完成。
function classifyCopyError(err) {
  const code = Number((err && (err.errno || err.errCode)) || 0);
  const msg = String((err && (err.errMsg || err.message)) || '');
  if (code === 112 || /scope is not declared/i.test(msg)) return 'undeclared';
  if (code === 103 || code === 104) return 'denied';
  if (/privacy api banned/i.test(msg)) return 'banned';
  if (/deny|denied|not authorized/i.test(msg)) return 'denied';
  return 'unknown';
}

function report(kind, detail) {
  try {
    const app = getApp();
    if (app && app.reportError) app.reportError(kind, detail);
  } catch (err) {
    // getApp 不可用（如单页模式）时忽略
  }
}

// 官方隐私弹窗只会在「开发者没有响应 onNeedPrivacyAuthorization」时出现，
// 且基础库 < 2.32.3 不拦截隐私接口。所以这里只在支持时主动模拟一次隐私接口调用：
// 需要授权时微信会弹官方弹窗，用户同意后后续调用即可通过。
function ensurePrivacy() {
  return new Promise((resolve) => {
    if (typeof wx.requirePrivacyAuthorize !== 'function') return resolve(true);
    wx.requirePrivacyAuthorize({
      success: () => resolve(true),
      fail: () => resolve(false),
    });
  });
}

function writeClipboard(data) {
  return new Promise((resolve, reject) => {
    wx.setClipboardData({
      data,
      success: () => resolve(true),
      fail: (err) => reject(err || new Error('setClipboardData fail')),
    });
  });
}

// 复制：成功 toast 提示，失败返回 false 且不上报错误给用户看，
// 由调用方（copyText）决定是否弹手动复制面板。
function copy(text, tip) {
  const data = String(text === null || text === undefined ? '' : text);
  if (!data) return Promise.resolve(false);
  return ensurePrivacy()
    .then((authorized) => {
      if (!authorized) {
        const err = new Error('privacy not authorized');
        err.errno = 104;
        throw err;
      }
      return writeClipboard(data);
    })
    .then(() => {
      wx.hideToast();
      toast(tip || '已复制♥');
      return true;
    })
    .catch((err) => {
      const reason = classifyCopyError(err);
      const detail = reason + ' ' + String((err && (err.errMsg || err.message)) || '');
      console.warn('[linyu] 复制失败', detail);
      report('copy_fail', detail);
      return false;
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

module.exports = { toast, confirm, copy, ensurePrivacy, classifyCopyError, chromeMetrics };
