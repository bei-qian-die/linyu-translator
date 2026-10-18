/* 假的 Capacitor 原生桥：Directory.DATA 用一个内存 Map 顶上，只为在桌面浏览器里跑通
 * mobile/fsAdapter.js → core/db.js 的读写链路。必须在 index.html 的第一个 <script> 之前注入。 */
(function () {
  if (window.Capacitor) return;
  window.__errs = [];
  window.addEventListener('error', function (e) {
    window.__errs.push((e.filename || '?').split('/').pop() + ': ' + e.message);
  }, true);
  const files = new Map();
  window.__capFiles = files;
  window.Capacitor = {
    platform: 'android',
    isNativePlatform: function () { return true; },
    Plugins: {
      Filesystem: {
        async readFile({ path }) {
          if (!files.has(path)) throw new Error('does not exist');
          return { data: files.get(path) };
        },
        async writeFile({ path, data }) { files.set(path, data); },
        async stat({ path }) {
          if (!files.has(path)) throw new Error('does not exist');
          let size = 0;
          try { size = atob(files.get(path)).length; } catch {}
          return { type: 'file', size, mtime: Date.now() / 1000 };
        },
        async deleteFile({ path }) { files.delete(path); },
        async readdir({ path }) {
          const prefix = (path || '') + '/';
          return { files: [...files.keys()].filter((p) => p.startsWith(prefix)).map((p) => p.slice(prefix.length)) };
        },
        async mkdir() { return {}; },
      },
      Share: { async write() { return { sharedAction: 'other' }; } },
      Browser: { async open() { return {}; } },
      ScreenOrientation: (function () {
        // 浏览器里没法真的转屏：只记"锁到哪"，由测试自己改 iframe 尺寸来模拟朝向变化。
        const st = { type: 'portrait-primary', locked: null, listeners: [] };
        window.__capOrient = st;
        return {
          async orientation() { return { type: st.type }; },
          async lock({ orientation }) {
            st.locked = orientation;
            st.type = orientation === 'landscape' ? 'landscape-primary' : 'portrait-primary';
            return {};
          },
          async unlock() { st.locked = null; return {}; },
          async addListener(name, fn) {
            if (name !== 'screenOrientationChange') throw new Error('unknown event ' + name);
            st.listeners.push(fn);
            return { remove: async () => { st.listeners = st.listeners.filter((x) => x !== fn); } };
          },
          async removeAllListeners() { st.listeners = []; },
          // 测试用：假装传感器把设备转过去了，锁着的时候忽略
          __rotate(target) {
            if (!st.locked) st.type = target === 'landscape' ? 'landscape-primary' : 'portrait-primary';
            st.listeners.forEach((fn) => fn({ type: st.type }));
            return st.type;
          },
        };
      })(),
    },
  };
})();
