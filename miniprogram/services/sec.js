'use strict';

// UGC 内容安全兜底（A3）：调用微信 msgSecCheck。
// 接口不可用 / 调用失败时 fail-open（视为通过），避免网络问题阻塞翻译与分享主流程。
function checkText(text) {
  const content = String(text || '');
  if (!content || typeof wx.msgSecCheck !== 'function') return Promise.resolve(true);
  return new Promise((resolve) => {
    let settled = false;
    const done = (ok) => {
      if (!settled) {
        settled = true;
        resolve(ok);
      }
    };
    try {
      wx.msgSecCheck({
        content,
        version: 2,
        scene: 2,
        success: (res) => {
          const suggest = res && res.result && res.result.suggest;
          done(suggest !== 'risky');
        },
        fail: (err) => {
          console.warn('[linyu] msgSecCheck 调用失败，按通过处理', err);
          done(true);
        },
      });
    } catch (err) {
      console.warn('[linyu] msgSecCheck 异常，按通过处理', err);
      done(true);
    }
  });
}

module.exports = { checkText };
