(function () {
'use strict';
// __wrapped by scripts/build-mobile.mjs
'use strict';

// 本地开发者账号：不接后端，凭据用 scrypt 加盐哈希后存在同一个 sqlite 里。
// 这只是「防误改」门禁，不是安全边界——拿到 linyu.db 的人本就能改数据，因此不承诺抗逆向。
//
// scrypt 实现是可换的：Electron 主进程走 src/mobile/scrypt.js 的 Node 分支；移动入口走浏览器分支（scrypt-js）。
// 不通过 require('crypto') 拉死 node:crypto。

const DEFAULT_USER = 'linyu';
const DEFAULT_PASSWORD = 'linyu130';
const KEY = 'dev_user';
const SALT = 'dev_salt';
const HASH = 'dev_hash';

function hashPassword(password, salt) {
  return linyuScrypt.hashPassword(password, salt);
}

function toUtf8(str) {
  return new TextEncoder().encode(String(str));
}

function safeEqual(a, b) {
  const A = toUtf8(a);
  const B = toUtf8(b);
  if (A.length !== B.length) return false;
  let diff = 0;
  for (let i = 0; i < A.length; i++) diff |= (A[i] ^ B[i]);
  return diff === 0;
}

function randomSaltHex(len) {
  const u = new Uint8Array(len);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(u);
  } else {
    for (let i = 0; i < len; i++) u[i] = Math.floor(Math.random() * 256);
  }
  let s = '';
  for (let i = 0; i < u.length; i++) s += (u[i] < 16 ? '0' : '') + u[i].toString(16);
  return s;
}

function createAuth({ getSetting, setSetting }) {
  function ensureInit() {
    if (getSetting(HASH)) return { created: false };
    const salt = randomSaltHex(16);
    setSetting(KEY, DEFAULT_USER);
    setSetting(SALT, salt);
    setSetting(HASH, hashPassword(DEFAULT_PASSWORD, salt));
    return { created: true };
  }

  function status() {
    return { user: getSetting(KEY) || DEFAULT_USER, initialized: Boolean(getSetting(HASH)) };
  }

  function verify(username, password) {
    ensureInit();
    const storedUser = getSetting(KEY);
    const salt = getSetting(SALT);
    const storedHash = getSetting(HASH);
    if (!storedUser || !salt || !storedHash) return false;
    if (!safeEqual(String(username || '').trim(), storedUser)) return false;
    return safeEqual(hashPassword(password, salt), storedHash);
  }

  // 出厂密码没被改掉之前，界面上要能看到它；改了之后就藏起来。
  function usesDefaultPassword() {
    const salt = getSetting(SALT);
    const storedHash = getSetting(HASH);
    if (!salt || !storedHash) return true;
    return hashPassword(DEFAULT_PASSWORD, salt) === storedHash;
  }

  function changePassword(oldPassword, newPassword) {
    ensureInit();
    if (!verify(getSetting(KEY), oldPassword)) return { error: '原密码不正确' };
    const next = String(newPassword || '');
    if (next.length < 6) return { error: '新密码至少 6 位' };
    const salt = randomSaltHex(16);
    setSetting(SALT, salt);
    setSetting(HASH, hashPassword(next, salt));
    return { ok: true };
  }

  function resetToDefault() {
    const salt = randomSaltHex(16);
    setSetting(KEY, DEFAULT_USER);
    setSetting(SALT, salt);
    setSetting(HASH, hashPassword(DEFAULT_PASSWORD, salt));
    return { ok: true, user: DEFAULT_USER };
  }

  return { ensureInit, status, verify, changePassword, resetToDefault, usesDefaultPassword, DEFAULT_USER, DEFAULT_PASSWORD };
}

if (typeof module === 'object' && module.exports) {
  module.exports = { createAuth, DEFAULT_USER, DEFAULT_PASSWORD };
} else if (typeof window !== 'undefined') {
  window.createAuth = createAuth;
}

}).call(window);
