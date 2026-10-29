(function () {
'use strict';
// __wrapped by scripts/lib/wrap-iife.mjs
'use strict';

/*
 * 文件系统适配器
 *
 * Electron 主进程用的 Node `fs` + `path`，与 Capacitor WebView 里通过 @capacitor/filesystem
 * 走的 URI / Directory 模型形状不同。db.js 不直接依赖任何一个，而是只调用这里暴露的几个原子操作：
 *   - exists / read / write / unlink / rename / copy / readdir / stat / mkdirp
 *
 * 所有 path 都是相对于"库目录"的逻辑路径（不带绝对前缀）：
 *   '<name>.db' / '<name>.db.bak1' / '<name>.db.bak2' / '<name>.db.before-restore' / 'media/<name>.<ext>'
 *
 * nodeAdapter：桌面 Electron（require('fs') / require('path')）
 * capacitorAdapter：Android WebView（@capacitor/filesystem，Directory.Data）
 *
 * 适配器在同一次会话里只能选一个——选错就会写到错误的位置，所以这里用 Platform.select() 静态判定。
 *
 * 复制用「读 + 写」是故意省一个 native call：Capacitor Filesystem 没有 copy API，扩到 node 也仍是最
 * 少依赖的实现。注意 copy 不是原子的；只有 persist 写主库会写 .tmp 再 rename，那个语义保留在 db.js 内部。
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    // path 模块在 Windows 上自动用反斜杠；在 Linux/Mac 上用正斜杠。这样 db.js 不用关心平台
    module.exports = factory(require('fs'), require('path'), false);
  } else {
    root.fsAdapter = factory(null, null, true);
    // entry.js 的兜底分支引用 linyuFsAdapter 这个名字——正常加载时 window.fsAdapter
    // 已经就位、那段代码不会执行，但名字本身得存在，别留一个一碰就 ReferenceError 的全局。
    root.linyuFsAdapter = root.fsAdapter;
  }
}(typeof self !== 'undefined' ? self : this, function (nodeFs, sysPath, browserBuild) {
  // ---- path helpers（绝对路径与相对路径都支持；Windows 与 POSIX 都吃） ----
  function dirOf(p) {
    if (!p) return '';
    const s = String(p);
    // 反斜杠与正斜杠都视为分隔符
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

  // ---- 浏览器（Capacitor WebView）：用 @capacitor/filesystem ----
  async function capacitorRead(path) {
    const cap = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem;
    if (!cap) throw new Error('@capacitor/filesystem 不可用');
    const r = await cap.readFile({ path, directory: 'DATA' });
    return bytesFromCap(r);
  }
  async function capacitorWrite(path, bytes) {
    const cap = window.Capacitor.Plugins.Filesystem;
    await cap.writeFile({ path, directory: 'DATA', data: bytesToBase64(bytes) });
  }
  async function capacitorUnlink(path) {
    const cap = window.Capacitor.Plugins.Filesystem;
    try {
      await cap.deleteFile({ path, directory: 'DATA' });
    } catch (err) {
      // 不存在也算成功删除
      const msg = String((err && err.message) || err);
      if (!/does not exist|not exist|NOT_FOUND/i.test(msg)) throw err;
    }
  }
  async function capacitorExists(path) {
    const cap = window.Capacitor.Plugins.Filesystem;
    try {
      const r = await cap.stat({ path, directory: 'DATA' });
      return Boolean(r && r.type);
    } catch {
      return false;
    }
  }
  async function capacitorRename(from, to) {
    const cap = window.Capacitor.Plugins.Filesystem;
    // Capacitor Filesystem 没有 rename，只能 read + write + unlink
    const bytes = await capacitorRead(from);
    await capacitorWrite(to, bytes);
    await capacitorUnlink(from);
  }
  async function capacitorCopy(from, to) {
    const bytes = await capacitorRead(from);
    await capacitorWrite(to, bytes);
  }
  async function capacitorReaddir(dir) {
    const cap = window.Capacitor.Plugins.Filesystem;
    const r = await cap.readdir({ path: dir || '', directory: 'DATA' });
    return (r && r.files ? r.files : []).map((f) => (typeof f === 'string' ? f : f.name));
  }
  async function capacitorStat(path) {
    const cap = window.Capacitor.Plugins.Filesystem;
    const r = await cap.stat({ path, directory: 'DATA' });
    return {
      size: Number(r.size) || 0,
      mtime: r.mtime ? new Date(r.mtime).toISOString() : new Date().toISOString(),
    };
  }
  async function capacitorMkdirp(dir) {
    const cap = window.Capacitor.Plugins.Filesystem;
    if (!dir) return;
    // Capacitor Filesystem.mkdir 是递归的
    try { await cap.mkdir({ path: dir, directory: 'DATA', recursive: true }); } catch { /* 已存在 */ }
  }

  function bytesFromCap(r) {
    if (!r) return new Uint8Array(0);
    if (typeof r.data === 'string') return base64ToBytes(r.data);
    if (r.data && typeof r.data === 'object') return new Uint8Array(r.data);
    return new Uint8Array(0);
  }
  function bytesToBase64(bytes) {
    const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
    let s = '';
    for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
    return btoa(s);
  }
  function base64ToBytes(b64) {
    const s = atob(String(b64 || ''));
    const u = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
    return u;
  }

  // ---- Node（Electron）----
  async function nodeRead(path) {
    return new Uint8Array(nodeFs.readFileSync(path));
  }
  async function nodeWrite(path, bytes) {
    const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
    const buf = Buffer.from(u);
    // 用 atomic rename：先写 .tmp，再 rename
    const tmp = path + '.tmp';
    const dir = sysPath.dirname(path);
    if (dir && dir !== '.') nodeFs.mkdirSync(dir, { recursive: true });
    nodeFs.writeFileSync(tmp, buf);
    try { nodeFs.renameSync(tmp, path); }
    catch (err) {
      try { nodeFs.unlinkSync(tmp); } catch { /* 临时文件没建起来 */ }
      nodeFs.writeFileSync(path, buf);
    }
  }
  async function nodeUnlink(path) {
    try { nodeFs.unlinkSync(path); }
    catch (err) {
      const code = err && err.code;
      if (code !== 'ENOENT') throw err;
    }
  }
  async function nodeExists(path) {
    try { nodeFs.accessSync(path); return true; }
    catch { return false; }
  }
  async function nodeRename(from, to) {
    const dir = sysPath.dirname(to);
    if (dir && dir !== '.') nodeFs.mkdirSync(dir, { recursive: true });
    nodeFs.renameSync(from, to);
  }
  async function nodeCopy(from, to) {
    const dir = sysPath.dirname(to);
    if (dir && dir !== '.') nodeFs.mkdirSync(dir, { recursive: true });
    nodeFs.copyFileSync(from, to);
  }
  async function nodeReaddir(dir) {
    try { return nodeFs.readdirSync(dir); } catch { return []; }
  }
  async function nodeStat(path) {
    const st = nodeFs.statSync(path);
    return { size: Number(st.size) || 0, mtime: st.mtime.toISOString() };
  }
  async function nodeMkdirp(dir) {
    if (!dir) return;
    nodeFs.mkdirSync(dir, { recursive: true });
  }

  // ---- 工厂：选择后端 ----
  function makeNode() {
    function nodeWriteSync(path, bytes) {
      const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
      const buf = Buffer.from(u);
      const tmp = path + '.tmp';
      const dir = sysPath.dirname(path);
      if (dir && dir !== '.') nodeFs.mkdirSync(dir, { recursive: true });
      nodeFs.writeFileSync(tmp, buf);
      try {
        nodeFs.renameSync(tmp, path);
      } catch (renameErr) {
        try { nodeFs.unlinkSync(tmp); } catch { /* 临时文件没建起来 */ }
        // 改名失败不抛：Node 路径下经常被索引器占着
        nodeFs.writeFileSync(path, buf);
      }
    }
    function nodeReaddirSync(dir) {
      try { return nodeFs.readdirSync(dir); } catch { return []; }
    }
    function nodeStatSync(p) {
      const st = nodeFs.statSync(p);
      return { size: Number(st.size) || 0, mtime: st.mtime.toISOString() };
    }
    function nodeReadSync(p) {
      return new Uint8Array(nodeFs.readFileSync(p));
    }
    function nodeExistsSync(p) {
      try { nodeFs.accessSync(p); return true; }
      catch { return false; }
    }
    return {
      kind: 'node',
      dirOf, basenameOf,
      read: nodeRead, readSync: nodeReadSync, write: nodeWrite, writeSync: nodeWriteSync, unlink: nodeUnlink,
      rename: nodeRename, copy: nodeCopy,
      readdir: nodeReaddir, readdirSync: nodeReaddirSync,
      stat: nodeStat, statSync: nodeStatSync,
      exists: nodeExists, existsSync: nodeExistsSync,
      mkdirp: nodeMkdirp,
    };
  }
  function makeCapacitor() {
    function capacitorWriteSync() {
      throw new Error('writeSync not available in Capacitor WebView; use async write()');
    }
    function capacitorReaddirSync() {
      throw new Error('readdirSync not available in Capacitor WebView; use async readdir()');
    }
    function capacitorStatSync() {
      throw new Error('statSync not available in Capacitor WebView; use async stat()');
    }
    function capacitorReadSync() {
      throw new Error('readSync not available in Capacitor WebView; use async read()');
    }
    function capacitorExistsSync() {
      throw new Error('existsSync not available in Capacitor WebView; use async exists()');
    }
    return {
      kind: 'capacitor',
      dirOf, basenameOf,
      read: capacitorRead, readSync: capacitorReadSync,
      write: capacitorWrite, writeSync: capacitorWriteSync, unlink: capacitorUnlink,
      rename: capacitorRename, copy: capacitorCopy,
      readdir: capacitorReaddir, readdirSync: capacitorReaddirSync,
      stat: capacitorStat, statSync: capacitorStatSync,
      exists: capacitorExists, existsSync: capacitorExistsSync,
      mkdirp: capacitorMkdirp,
    };
  }

  if (browserBuild) {
    // 在浏览器构建里，Capacitor 通过全局注入；Electron 走 CommonJS 路径所以不会到这分支。
    return makeCapacitor();
  }
  return makeNode();
}));

}).call(window);
