'use strict';

/*
 * IndexedDB 文件系统适配器 —— 网页端持久化后端
 *
 * 实现 fsAdapter 家族的同款接口（read / write / unlink / rename / copy / readdir / stat / mkdirp /
 * exists + dirOf / basenameOf），让 db.js 无需改动就能把 SQLite 库文件存进浏览器 IndexedDB。
 *
 * 策略：
 *   - DB 名：linyu-fs（全局唯一，不与应用自身的 object store 混用）
 *   - Object Store：fs-blobs（单 store，keyPath=name，存 Uint8Array Blob）
 *   - linyu.db 整体存为一个 Blob key，与 db.js「内存库 + persist 整库落盘」模型完美吻合
 *   - media/ 目录的文件也存同一 store，key 为 full path
 *
 * 配额：IndexedDB 典型限额是磁盘空闲空间的 50-60%（桌面浏览器），移动端可能是 1-2GB。
 * 本应用的完整库不到 10MB，人物图加起来 ~12MB，远低于配额。隐私模式下 IndexedDB 不可用时，
 * 回退到 sessionStorage（entry.js 兜底 branch），并提示用户数据不持久。
 *
 * 注意：IndexedDB 后端无同步 API（readSync / writeSync / existsSync / statSync / readdirSync），
 * 这些方法会直接 throw，因为 db.js 在 Web 环境不应路径走到同步分支（Web 端 db.js 总是走
 * 异步 persist）。
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.linyuIdbAdapter = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {

  const DB_NAME = 'linyu-fs';
  const STORE_NAME = 'fs-blobs';
  const DB_VERSION = 1;

  // ---- path helpers（保持与 node/capacitor adapter 一致的接口）----
  function dirOf(p) {
    if (!p) return '';
    const s = String(p);
    const f = s.lastIndexOf('/');
    const b = s.lastIndexOf('\\');
    const i = Math.max(f, b);
    return i < 0 ? '' : s.slice(0, i);
  }
  function basenameOf(p) {
    if (!p) return '';
    const s = String(p);
    const f = s.lastIndexOf('/');
    const b = s.lastIndexOf('\\');
    const i = Math.max(f, b);
    return i < 0 ? s : s.slice(i + 1);
  }

  // ---- 懒初始化 DB（单例，失败则记下错误，后续所有调用都 reject）----
  let _db = null;
  let _initPromise = null;
  let _initError = null;

  function _getDb() {
    if (_db) return Promise.resolve(_db);
    if (_initError) return Promise.reject(_initError);
    if (_initPromise) return _initPromise;

    _initPromise = new Promise((resolve, reject) => {
      // 检测 IndexedDB 是否可用
      if (typeof indexedDB === 'undefined') {
        const err = new Error('IndexedDB 不可用（浏览器不支持或处于隐私模式）');
        _initError = err;
        reject(err);
        return;
      }

      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function (e) {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = function (e) {
        _db = e.target.result;
        resolve(_db);
      };
      req.onerror = function (e) {
        const err = new Error('IndexedDB 打开失败: ' + (e.target.error && e.target.error.message || 'unknown'));
        _initError = err;
        reject(err);
      };
      req.onblocked = function () {
        const err = new Error('IndexedDB 被其他标签页阻塞（请关闭其他打开本网站的标签页）');
        _initError = err;
        reject(err);
      };
    });

    return _initPromise;
  }

  // ---- 原子操作包装 ----
  function _tx(mode) {
    return _getDb().then(function (db) {
      return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
    });
  }

  function _promisify(request) {
    return new Promise(function (resolve, reject) {
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error); };
    });
  }

  // ---- 公共接口（异步，对标 Capacitor 分支）----

  async function read(path) {
    const store = await _tx('readonly');
    const result = await _promisify(store.get(path));
    if (!result) return new Uint8Array(0);
    // result 可能是 ArrayBuffer（最早存进去的）或 Blob（后续存的）
    if (result instanceof ArrayBuffer) return new Uint8Array(result);
    if (result instanceof Uint8Array) return result;
    // Blob
    const buf = await result.arrayBuffer();
    return new Uint8Array(buf);
  }

  async function write(path, bytes) {
    const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
    const store = await _tx('readwrite');
    await _promisify(store.put(u, path));
  }

  async function unlink(path) {
    const store = await _tx('readwrite');
    try {
      await _promisify(store.delete(path));
    } catch (err) {
      // 删除不存在的 key 不算错误（对标 nodeUnlink 的 ENOENT 忽略）
      if (err.name !== 'NotFoundError') throw err;
    }
  }

  async function exists(path) {
    const store = await _tx('readonly');
    const result = await _promisify(store.getKey(path));
    return result !== undefined;
  }

  async function rename(from, to) {
    const bytes = await read(from);
    await write(to, bytes);
    await unlink(from);
  }

  async function copy(from, to) {
    const bytes = await read(from);
    await write(to, bytes);
  }

  async function readdir(dir) {
    const store = await _tx('readonly');
    const prefix = dir ? (dir + '/') : '';
    const all = await _promisify(store.getAllKeys());
    const result = [];
    for (const key of all) {
      const s = String(key);
      if (s.startsWith(prefix)) {
        const rest = s.slice(prefix.length);
        // 只收直属文件，不递归子目录
        if (!rest.includes('/')) result.push(rest);
      }
    }
    return result;
  }

  async function stat(path) {
    const bytes = await read(path);
    // IndexedDB 没有原生的 mtime，用当前时间代替（db.js 只用 size）
    return {
      size: bytes.length || 0,
      mtime: new Date().toISOString(),
    };
  }

  async function mkdirp(dir) {
    // IndexedDB 没有目录概念，文件路径直接当 key，无需创建目录
    // 保持接口一致，no-op
  }

  // ---- 同步接口脏实现（抛错，因为 Web 端 db.js 不该走到同步路径）----
  function _noSync(name) {
    return function () {
      throw new Error(name + ' 不可用于 IndexedDB 适配器；Web 端应走异步路径');
    };
  }

  // ---- 检测 IndexedDB 是否真的可以写入（隐私模式可能读/写静默失败）----
  async function probe() {
    try {
      await write('__probe__', new Uint8Array([1]));
      const r = await read('__probe__');
      await unlink('__probe__');
      return r.length === 1 && r[0] === 1;
    } catch {
      return false;
    }
  }

  return {
    kind: 'indexeddb',
    dirOf,
    basenameOf,
    read,
    readSync: _noSync('readSync'),
    write,
    writeSync: _noSync('writeSync'),
    unlink,
    rename,
    copy,
    readdir,
    readdirSync: _noSync('readdirSync'),
    stat,
    statSync: _noSync('statSync'),
    exists,
    existsSync: _noSync('existsSync'),
    mkdirp,
    // 附加：供 entry 层判断持久化是否真正可用
    probe,
  };
}));