'use strict';

const { findBlocked } = require('./sensitive-words');

// UGC 内容安全兜底（A3）。
// 微信 msgSecCheck 只能在服务端调用，小程序客户端没有这个 API；
// 所以先走本地词表（真正生效、零网络），再探测未来可能注入的远端校验。
// 远端不可用 / 调用失败时 fail-open，避免网络问题阻塞翻译与分享主流程。
function checkLocal(text) {
  return findBlocked(text);
}

function checkText(text) {
  const content = String(text || '');
  if (!content) return Promise.resolve(true);

  const hit = checkLocal(content);
  if (hit) {
    console.warn('[linyu] 本地内容安全命中', hit.label, hit.term);
    return Promise.resolve(false);
  }

  if (typeof wx === 'undefined' || typeof wx.msgSecCheck !== 'function') return Promise.resolve(true);

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

module.exports = { checkLocal, checkText };
