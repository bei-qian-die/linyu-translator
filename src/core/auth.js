'use strict';

// 本地开发者账号：不接后端，凭据用 node:crypto 的 scrypt 加盐哈希后存在同一个 sqlite 里。
// 这只是「防误改」门禁，不是安全边界——拿到 linyu.db 的人本就能改数据，因此不承诺抗逆向。
const crypto = require('crypto');

const DEFAULT_USER = 'linyu';
const DEFAULT_PASSWORD = 'linyu130';
const KEY = 'dev_user';
const SALT = 'dev_salt';
const HASH = 'dev_hash';

function hashPassword(password, salt) {
  return crypto.scryptSync(String(password), String(salt), 64).toString('hex');
}

function safeEqual(a, b) {
  const A = Buffer.from(String(a), 'utf8');
  const B = Buffer.from(String(b), 'utf8');
  if (A.length !== B.length) return false;
  return crypto.timingSafeEqual(A, B);
}

function createAuth({ getSetting, setSetting }) {
  function ensureInit() {
    if (getSetting(HASH)) return { created: false };
    const salt = crypto.randomBytes(16).toString('hex');
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
    const salt = crypto.randomBytes(16).toString('hex');
    setSetting(SALT, salt);
    setSetting(HASH, hashPassword(next, salt));
    return { ok: true };
  }

  function resetToDefault() {
    const salt = crypto.randomBytes(16).toString('hex');
    setSetting(KEY, DEFAULT_USER);
    setSetting(SALT, salt);
    setSetting(HASH, hashPassword(DEFAULT_PASSWORD, salt));
    return { ok: true, user: DEFAULT_USER };
  }

  return { ensureInit, status, verify, changePassword, resetToDefault, usesDefaultPassword, DEFAULT_USER, DEFAULT_PASSWORD };
}

module.exports = { createAuth, DEFAULT_USER, DEFAULT_PASSWORD };
