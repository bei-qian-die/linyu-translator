'use strict';

/*
 * scrypt 适配器
 *
 * Electron 用 node:crypto.scryptSync 同步实现。WebView 没有 node:crypto，
 * scrypt-js 3.x 是纯 JS 库，浏览器 UMD 入口在 window 上挂 lib：lib.syncScrypt(pw,salt,N,r,p,dkLen)。
 *
 * 两边都返回 hex string，64 字节（128 hex chars），与现有 auth.js 默认实现一致。
 * Node 的 crypto.scryptSync(pw, salt, 64) 等价于 syncScrypt(pw, salt, 16384, 8, 1, 64)。
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const crypto = require('crypto');
    module.exports = factory({
      hashPassword: (password, salt) => crypto.scryptSync(String(password), String(salt), 64).toString('hex'),
    });
  } else if (root.scrypt && root.scrypt.syncScrypt) {
    // scrypt-js 与 node:crypto 不一样：它只收 Uint8Array/数组，传字符串会直接抛
    // "password must be an array or buffer"。utf8 编码后与 crypto.scryptSync(字符串) 等价。
    const toUtf8 = (s) => new TextEncoder().encode(String(s));
    root.linyuScrypt = factory({
      hashPassword: (password, salt) => {
        const u8 = root.scrypt.syncScrypt(toUtf8(password), toUtf8(salt), 16384, 8, 1, 64);
        let s = '';
        for (let i = 0; i < u8.length; i++) s += (u8[i] < 16 ? '0' : '') + u8[i].toString(16);
        return s;
      },
    });
  }
}(typeof self !== 'undefined' ? self : this, function (impl) {
  return { hashPassword: impl.hashPassword };
}));
