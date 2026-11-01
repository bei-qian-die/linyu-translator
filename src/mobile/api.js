'use strict';

/*
 * 渲染层 IPC shim：与 src/main/preload.js 一一对位。
 *
 * 桌面 Electron 的 preload 是把 ipcRenderer.invoke 包成 window.api.*；
 * 在 Capacitor WebView 里没有 ipc，所以这里用本地 db.js / auth.js 的方法
 * 直接同步出同名方法。需要异步文件系统返回的操作（导出、备份、媒体、导入、打开外链）
 * 通过 @capacitor/filesystem / @capacitor/share / @capacitor/browser 走原生。
 *
 * 全部调用统一返回 { ok: true, data } 或 { ok: false, error }，与桌面 IPC 形状一致。
 * 调用方式保持同步：渲染层只 await window.api.xxx(...)。
 */

(function (root) {
  // ---- 平台能力（来自 capacitor globals 或浏览器内置 API） ----
  function isCapacitor() {
    return !!(root.Capacitor && root.Capacitor.isNativePlatform && root.Capacitor.isNativePlatform());
  }
  function capPlugin(name) {
    return (root.Capacitor && root.Capacitor.Plugins && root.Capacitor.Plugins[name]) || null;
  }
  function fsCap() { return capPlugin('Filesystem'); }
  function shareCap() { return capPlugin('Share'); }
  function browserCap() { return capPlugin('Browser'); }
  function appCap() { return capPlugin('App'); }
  function orientCap() { return capPlugin('ScreenOrientation'); }

  // @capacitor/screen-orientation 返回 'portrait-primary' / 'landscape-secondary' 这类细分值，
  // UI 只关心竖还是横
  function normOrient(type) {
    return String(type || '').startsWith('landscape') ? 'landscape' : 'portrait';
  }

  // ---- 通用错误包装：让所有 channel 的形状都是 {ok,data} / {ok,error} ----
  async function safe(fn) {
    try {
      const data = await fn();
      return { ok: true, data };
    } catch (err) {
      const e = err || {};
      return { ok: false, error: e.message || String(e) };
    }
  }

  // ---- WebView 端专用的"选文件"对话框：用隐藏的 <input type="file"> ----
  function pickFile({ accept, multiple } = {}) {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      if (accept) input.accept = accept;
      if (multiple) input.multiple = true;
      input.style.position = 'fixed';
      input.style.left = '-10000px';
      input.style.top = '-10000px';
      document.body.appendChild(input);
      let resolved = false;
      const onChange = () => {
        if (resolved) return;
        resolved = true;
        const files = input.files ? Array.from(input.files) : [];
        document.body.removeChild(input);
        resolve({ canceled: false, files });
      };
      const onCancel = () => {
        if (resolved) return;
        resolved = true;
        document.body.removeChild(input);
        resolve({ canceled: true, files: [] });
      };
      input.addEventListener('change', onChange, { once: true });
      // 用户取消（多次 pick 后第二次未选）兼容：Android WebView 不会触发 cancel，但桌面浏览器会
      input.addEventListener('cancel', onCancel, { once: true });
      input.click();
      // WebView 在 30s 内没选就自动取消兜底
      setTimeout(onCancel, 30000);
    });
  }
  function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(new Error('读取文件失败'));
      r.readAsArrayBuffer(file);
    });
  }
  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(new Error('读取文件失败'));
      r.readAsDataURL(file);
    });
  }
  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(new Error('读取文件失败'));
      r.readAsText(file, 'utf-8');
    });
  }
  function dataUrlToUint8Array(dataUrl) {
    const s = String(dataUrl || '');
    const comma = s.indexOf(',');
    if (comma < 0) return new Uint8Array(0);
    const b64 = s.slice(comma + 1);
    const bin = atob(b64);
    const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }
  function extFromMime(mime) {
    if (!mime) return '.bin';
    if (mime === 'image/png') return '.png';
    if (mime === 'image/jpeg') return '.jpg';
    if (mime === 'image/gif') return '.gif';
    if (mime === 'image/webp') return '.webp';
    if (mime === 'application/json') return '.json';
    return '.bin';
  }

  function randomName(len = 16) {
    const u = new Uint8Array(len / 2);
    (root.crypto || root.msCrypto).getRandomValues(u);
    let s = '';
    for (let i = 0; i < u.length; i++) s += (u[i] < 16 ? '0' : '') + u[i].toString(16);
    return s;
  }

  function debounce(fn, ms) {
    let t = null;
    const wrapped = (...args) => {
      if (t) clearTimeout(t);
      t = setTimeout(() => { t = null; fn(...args); }, ms);
    };
    return wrapped;
  }

  // ---- 真正的工厂：在 entry.js 里调用，传入 db / auth / translator / lore ----
  function createApi({ db, auth, lore, translator, version, TRACE_LIMIT, IMPORT_STALE_MS, ATTEMPT_LIMIT, LOCK_MS }) {
    // 业务规则（开发者门禁 / 撤销槽位 / 导入暂存过期 / 登录失败锁定）统一走
    // src/core/service.js —— 与桌面主进程是同一份，加接口不用再改两处。
    // 这个文件只留 Capacitor 相关的部分：文件选择、分享、媒体、屏幕方向、日志缓冲。
    const serviceMod = root.LINYU_SERVICE || {};

    // Phase 2（Web / 小程序 / 安卓端）：没有本地 Ollama，润色有两种来源——
    //   ① 智谱 GLM 直连（设置里填 Key，浏览器/WebView 直接 fetch open.bigmodel.cn）
    //   ② 云端代理（polishProxyUrl，Key 留在服务端）
    // 都没配时闭包直接回退草稿，svc.polishDraft 返回 polished:false，不影响主翻译。
    function readPolishPref(k, d) {
      const prefs = (db && typeof db.getPrefs === 'function') ? db.getPrefs() : {};
      const v = prefs[k];
      if (v == null || v === '') return d;
      try {
        return JSON.parse(v);
      } catch {
        return v;
      }
    }

    // 安卓 WebView 里 fetch 受 CORS 限制（Origin 是 https://localhost），智谱接口不一定放行。
    // Capacitor 自带的原生 HTTP 通道不受 CORS 约束，优先用它；Web 浏览器没有这个插件就退回 fetch。
    function nativeFetch(timeoutMs) {
      const cap = root.Capacitor;
      const plugin = cap && cap.Plugins && cap.Plugins.CapacitorHttp;
      if (!plugin || typeof plugin.request !== 'function') return undefined;
      return async (url, init) => {
        const o = init || {};
        let data;
        if (o.body) {
          try {
            data = JSON.parse(o.body);
          } catch {
            data = o.body;
          }
        }
        const r = await plugin.request({
          url: String(url),
          method: o.method || 'GET',
          headers: o.headers || {},
          data,
          connectTimeout: timeoutMs,
          readTimeout: timeoutMs,
        });
        const raw = typeof r.data === 'string' ? r.data : JSON.stringify(r.data);
        return {
          ok: r.status >= 200 && r.status < 300,
          status: r.status,
          json: async () => (typeof r.data === 'string' ? JSON.parse(r.data) : r.data),
          text: async () => raw,
        };
      };
    }

    // ---- 内置云通道（WorkBuddy 云服务 LLM，免 Key）----
    // 浏览器直连智谱会被 CORS 拦死，代理又需要用户自己有后端。
    // 云服务的数据面与本页同源（endpoint 就是站点域名），SDK 由构建脚本注入，
    // publishableKey 只标识应用、服务端按 Origin 校验，放在前端是安全的。
    let _cloud = null;
    function cloudClient() {
      if (_cloud) return _cloud;
      // cloudSync.js 已经建好实例就复用，避免同页两个 client
      if (root.LINYU_CLOUD_CLIENT) {
        _cloud = root.LINYU_CLOUD_CLIENT;
        return _cloud;
      }
      const WBC = root.WorkBuddyCloud;
      const cfg = root.LINYU_CLOUD;
      if (!WBC || !cfg || !cfg.endpoint || !cfg.publishableKey) return null;
      if (typeof WBC.createWorkBuddyCloud !== 'function') return null;
      _cloud = WBC.createWorkBuddyCloud({
        endpoint: cfg.endpoint,
        publishableKey: cfg.publishableKey,
        oauthRelayBaseUrl: cfg.oauthRelayBaseUrl,
      });
      return _cloud;
    }

    // 走云服务跑一次润色：SDK 只支持流式，这里把增量拼成整句再交给同一套护栏。
    // ---- 结果缓存：外部访客量大，同一句反复润色没必要每次都烧额度 ----
    // key = 原文 + 草稿（草稿本身已由本地引擎确定性生成，同句必同草稿）。
    // 存 localStorage 让刷新/二次访问也命中；写失败（隐私模式 / 配额满）就只留内存。
    const PCACHE_KEY = 'linyu.polish.cache.v1';
    const PCACHE_MAX = 300;
    let _pcache = null;

    function pcacheLoad() {
      if (_pcache) return _pcache;
      _pcache = {};
      try {
        const raw = root.localStorage && root.localStorage.getItem(PCACHE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') _pcache = parsed;
        }
      } catch {
        _pcache = {};
      }
      return _pcache;
    }

    function pcacheGet(k) {
      const c = pcacheLoad();
      const hit = c[k];
      return hit && typeof hit.t === 'string' ? hit.t : '';
    }

    function pcacheSet(k, t) {
      const c = pcacheLoad();
      c[k] = { t, at: Date.now() };
      const keys = Object.keys(c);
      if (keys.length > PCACHE_MAX) {
        // 简单淘汰：按写入时间丢掉最旧的一半，避免无限涨
        keys
          .sort((a, b) => (c[a].at || 0) - (c[b].at || 0))
          .slice(0, keys.length - Math.floor(PCACHE_MAX * 0.7))
          .forEach((x) => delete c[x]);
      }
      try {
        root.localStorage && root.localStorage.setItem(PCACHE_KEY, JSON.stringify(c));
      } catch {
        /* 存不下不影响本会话的内存命中 */
      }
    }

    // 模型目录一次会话只拉一次（每次润色都拉一遍纯属浪费一次往返）
    let _modelId = '';

    async function cloudModelId(cloud) {
      if (_modelId) return _modelId;
      const list = await cloud.llm.models.list();
      const usable = (list || []).filter((m) => m && m.disabled !== true);
      if (!usable.length) throw new Error('云服务没有可用模型');
      // 目录里第一个是 auto（平台路由），润色要风格稳定，优先固定 GLM 系：
      // 实测 glm-5.3-flash 单句 1.9s，输出「救命惹，本可气到跺脚厚。」能过护栏。
      const PREFER = ['glm-5.3-flash', 'glm-4.6', 'glm-4.7', 'glm-5.0', 'glm-5.2'];
      const model =
        usable.find((m) => PREFER.indexOf(m.id) >= 0) ||
        usable.find((m) => /^glm/i.test(String(m.id))) ||
        usable[0];
      _modelId = String(model.id);
      return _modelId;
    }

    // 把云服务抛出的原始错误翻成用户看得懂的一句话（设置页与 toast 共用）
    function cloudErrorText(e) {
      const code = String((e && ((e.error && e.error.code) || e.code || e.status)) || '');
      const msg = String((e && ((e.error && e.error.message) || e.message)) || e || '');
      if (/429|rate.?limit|too.?many/i.test(code + ' ' + msg)) {
        return '润色通道当前太挤（限流），过一会儿再点一次';
      }
      if (/402|403|quota|exceed|balance|insufficient/i.test(code + ' ' + msg)) {
        return '内置润色额度已用完，可改用「云端代理」或自己填 Key';
      }
      if (/401|unauthor/i.test(code + ' ' + msg)) return '内置通道鉴权失败';
      if (/timeout|abort/i.test(code + ' ' + msg)) return '内置通道超时，稍后再试';
      return '内置通道不可用：' + (msg || code || '未知原因');
    }

    // 流式接口本身没有超时控制：网络卡住时 await 会一直挂着，翻译按钮一直转圈。
    // 外部访客不能等太久，15s 还没出就放弃（草稿照常显示）。
    function withTimeout(promise, ms, msg) {
      let timer = null;
      const guard = new Promise((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(msg)), ms);
      });
      return Promise.race([promise, guard]).finally(() => {
        if (timer) clearTimeout(timer);
      });
    }

    async function cloudPolish(source, draft) {
      const mod = root.LINYU_POLISH;
      if (!mod || !mod.buildPolishMessages) throw new Error('润色模块未加载');

      const key = String(source || '') + '\u0000' + String(draft || '');
      const cached = pcacheGet(key);
      if (cached) return cached;

      const cloud = cloudClient();
      if (!cloud) throw new Error('内置通道未就绪（云 SDK 没加载）');

      try {
        const model = await cloudModelId(cloud);
        let text = '';
        await withTimeout(
          (async () => {
            const stream = cloud.llm.chat.completions.create({
              model,
              messages: mod.buildPolishMessages({ source, draft }),
              stream: true,
              temperature: 0.45,
            });
            for await (const chunk of stream) {
              const delta = chunk && chunk.choices && chunk.choices[0] && chunk.choices[0].delta;
              if (delta && delta.content) text += delta.content;
            }
          })(),
          15000,
          '内置通道超时'
        );
        const out = mod.cleanPolishOutput ? mod.cleanPolishOutput(text) : String(text || '').trim();
        if (!out) return draft;
        if (mod.retentionOk && !mod.retentionOk(draft, out, source)) return draft;
        // 只缓存「过了护栏的有效润色」，护栏拦下的不缓存，免得下次直接拿到草稿
        pcacheSet(key, out);
        return out;
      } catch (e) {
        throw new Error(cloudErrorText(e), { cause: e });
      }
    }

    // 按偏好造一个润色客户端；返回 null 表示「没配置，别调模型」
    function pickPolishClient(opts) {
      const mod = root.LINYU_POLISH;
      if (!mod) return null;
      const o = opts || {};
      const engine = String(o.engine || readPolishPref('polishEngine', '') || '').toLowerCase();
      const strict = Boolean(o.strict);

      if (engine === 'zhipu') {
        const apiKey = String(o.zhipuApiKey != null ? o.zhipuApiKey : readPolishPref('zhipuApiKey', '') || '').trim();
        if (!apiKey || !mod.createOpenAIChatClient) return null;
        return mod.createOpenAIChatClient({
          baseUrl: String((o.zhipuBaseUrl != null ? o.zhipuBaseUrl : readPolishPref('zhipuBaseUrl', '')) || ''),
          apiKey,
          model: String((o.zhipuModel != null ? o.zhipuModel : readPolishPref('zhipuModel', '')) || ''),
          strict,
          fetchImpl: nativeFetch(30000),
        });
      }

      if (engine === 'ollama') return null; // 手机/网页没有本机 Ollama，交给上层提示
      // engine === 'proxy'（云端代理）以及未指定引擎时的兜底，都按代理地址走
      const url = String(o.polishProxyUrl != null ? o.polishProxyUrl : readPolishPref('polishProxyUrl', '') || '').trim();
      if (!url || !mod.createHttpProxyClient) return null;
      return mod.createHttpProxyClient({ baseUrl: url });
    }

    function makeProxyPolish() {
      return async (source, draft) => {
        // 默认引擎：手机上没得选（没有本地模型），浏览器直连必被 CORS 拦，
        // 所以「没设置过」就等于走免 Key 内置通道 —— 外部访客不用进设置页也能用。
        const engine = String(readPolishPref('polishEngine', 'cloud') || 'cloud').toLowerCase();
        if (engine === 'cloud' || engine === 'ollama') {
          // 抛出而不是吞掉：service.polishDraft 会把原因写进 error 字段，
          // 「润色 ♥」按钮才能显示「额度用完了」「模型没就绪」而不是静默无反应。
          return await cloudPolish(source, draft);
        }
        const client = pickPolishClient();
        if (!client) throw new Error('还没配置润色通道');
        return client.polish(source, draft);
      };
    }

    // 设置页「测试连接」：手机端没有主进程，这里用同一份 core 客户端直接跑样例。
    // strict 打开，Key 错 / CORS / 超时都要把原因带回给界面。
    const PROBE_SAMPLE = { source: '救命，气死我了。', draft: '救命，我气死了。' };
    async function runProbe(opts) {
      const o = opts || {};
      const engine = String(o.engine || readPolishPref('polishEngine', 'zhipu') || 'zhipu').toLowerCase();
      if (engine === 'ollama') {
        throw new Error('手机端没有本机 Ollama，请改用「智谱 GLM 直连」或云端代理');
      }
      const mod = root.LINYU_POLISH;
      if (!mod) throw new Error('润色模块未加载（core/llm-polish.js）');

      // 内置云通道：免 Key，直接跑样例
      if (engine === 'cloud') {
        const t0c = Date.now();
        const textc = await cloudPolish(PROBE_SAMPLE.source, PROBE_SAMPLE.draft);
        return {
          engine: 'cloud',
          ms: Date.now() - t0c,
          source: PROBE_SAMPLE.source,
          draft: PROBE_SAMPLE.draft,
          text: textc,
          changed: textc !== PROBE_SAMPLE.draft,
        };
      }

      // 云端代理：同样跑一遍样例，把 HTTP 状态 / 超时 / 空结果的原因带回去
      if (engine === 'proxy') {
        const url = String(o.polishProxyUrl != null ? o.polishProxyUrl : readPolishPref('polishProxyUrl', '') || '').trim();
        if (!url) throw new Error('还没填云端代理地址');
        if (!mod.createHttpProxyClient) throw new Error('润色模块未加载（core/llm-polish.js）');
        const pc = mod.createHttpProxyClient({ baseUrl: url, strict: true, fetchImpl: nativeFetch(30000) });
        const t1 = Date.now();
        const text1 = await pc.polish(PROBE_SAMPLE.source, PROBE_SAMPLE.draft);
        return {
          engine: pc.name,
          ms: Date.now() - t1,
          source: PROBE_SAMPLE.source,
          draft: PROBE_SAMPLE.draft,
          text: text1,
          changed: text1 !== PROBE_SAMPLE.draft,
        };
      }

      if (!mod.createOpenAIChatClient) throw new Error('润色模块未加载（core/llm-polish.js）');
      const client = pickPolishClient({
        engine: 'zhipu',
        strict: true,
        zhipuApiKey: o.zhipuApiKey,
        zhipuBaseUrl: o.zhipuBaseUrl,
        zhipuModel: o.zhipuModel,
      });
      if (!client) throw new Error('请先填智谱 API Key');
      const t0 = Date.now();
      const text = await client.polish(PROBE_SAMPLE.source, PROBE_SAMPLE.draft);
      return {
        engine: client.name,
        ms: Date.now() - t0,
        source: PROBE_SAMPLE.source,
        draft: PROBE_SAMPLE.draft,
        text,
        changed: text !== PROBE_SAMPLE.draft,
      };
    }

    const svc = serviceMod.createService({
      db,
      auth,
      translator,
      version,
      config: {
        traceLimit: TRACE_LIMIT || 240,
        importStaleMs: IMPORT_STALE_MS || 10 * 60 * 1000,
        attemptLimit: ATTEMPT_LIMIT || 5,
        lockMs: LOCK_MS || 30000,
      },
      // Web / 小程序端注入云端代理润色；桌面端走 preload→主进程 Ollama，不走这里。
      polish: makeProxyPolish(),
    });

    let ioListeners = [];
    let orientListeners = [];
    let orientHandle = null;

    function readPref(key, fallback) {
      return svc.readPref(key, fallback);
    }
    function writePref(key, value) {
      // 返回 db 的结果：PREF_KEYS 白名单外的键会被拒掉，设置项必须能知道自己没写进去
      return svc.writePref(key, value);
    }

    // 导入暂存：payload 交给 service 管过期，媒体还原是本端的事
    function replanImport(strategy) {
      const r = svc.replanImport(strategy);
      return { canceled: false, file: r.file, ...r.plan };
    }
    function applyImport(strategy) {
      const slot = svc.peekImport();
      const r = svc.applyImport(strategy);
      // 落库后把 media/<file> 还原到 DATA/media/（与桌面同格式）
      if (slot && Array.isArray(slot.payload.media)) {
        const fs = fsCap();
        if (fs) {
          (async () => {
            try { await fs.mkdir({ path: 'media', directory: 'DATA', recursive: true }); } catch {}
            for (const m of slot.payload.media) {
              if (!m || typeof m !== 'object') continue;
              const name = String(m.name || '');
              if (!name) continue;
              try {
                await fs.writeFile({ path: `media/${name}`, directory: 'DATA', data: String(m.base64 || '') });
              } catch { /* 写不进去就忽略 */ }
            }
          })();
        }
      }
      return { ...r.result, file: r.file };
    }

    async function pickImage() {
      const r = await pickFile({ accept: 'image/*' });
      if (r.canceled || !r.files.length) return { canceled: true };
      const file = r.files[0];
      if (file.size > 8 * 1024 * 1024) throw new Error('图片请控制在 8MB 以内');
      const ext = extFromMime(file.type) || '.' + (file.name.split('.').pop() || 'png').toLowerCase();
      const dataUrl = await readFileAsDataURL(file);
      const bytes = dataUrlToUint8Array(dataUrl);
      const name = randomName() + ext;
      const path = `media/${name}`;
      const fs = fsCap();
      if (!fs) throw new Error('@capacitor/filesystem 不可用');
      await fs.mkdir({ path: 'media', directory: 'DATA', recursive: true }).catch(() => {});
      const b64 = dataUrl.split(',')[1];
      await fs.writeFile({ path, directory: 'DATA', data: b64 });
      return { canceled: false, ref: 'media:' + name };
    }
    async function mediaData(ref) {
      const name = String(ref || '').replace(/^media:/, '');
      const ext = extFromMime(name.endsWith('.png') ? 'image/png' : name.endsWith('.gif') ? 'image/gif' : name.endsWith('.webp') ? 'image/webp' : 'image/jpeg');
      const path = `media/${name}`;
      const fs = fsCap();
      if (!fs) throw new Error('@capacitor/filesystem 不可用');
      const r = await fs.readFile({ path, directory: 'DATA' });
      let b64 = r.data;
      if (b64 && b64.startsWith('data:')) b64 = b64.split(',')[1];
      return 'data:' + ext + ';base64,' + b64;
    }

    // ---- 导入导出：导出先写到 Cache（系统级分享目录），再通过 Share 选择 App；导入通过 <input type="file"> ----
    async function exportData({ includeMedia } = {}) {
      const payload = db.exportAll();
      if (includeMedia) {
        // 收集 media/<file>，转 base64 包进 payload.media；与桌面格式一致
        const fs = fsCap();
        if (!fs) throw new Error('@capacitor/filesystem 不可用');
        let mediaNames = [];
        try {
          const r = await fs.readdir({ path: 'media', directory: 'DATA' });
          mediaNames = (r.files || []).map((f) => (typeof f === 'string' ? f : f.name));
        } catch { /* 没创建过 media 目录 */ }
        const list = [];
        for (const n of mediaNames) {
          try {
            const rr = await fs.readFile({ path: `media/${n}`, directory: 'DATA' });
            let b64 = rr.data;
            if (b64 && b64.startsWith('data:')) b64 = b64.split(',')[1];
            list.push({ name: n, base64: b64 });
          } catch { /* 读不出来就跳过 */ }
        }
        payload.media = list;
      }
      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const fileName = `淋语数据-${stamp}.json`;
      const json = JSON.stringify(payload, null, 2);
      // 先写到 Cache 目录；Android 应用 Cache 不需要权限，原生 Share 拿到这个路径就能转发
      const fs = fsCap();
      const tmpDir = (root.Capacitor && root.Capacitor.platform === 'android') ? 'CACHE' : 'DATA';
      const tmpPath = `exports/${fileName}`;
      if (fs) {
        try { await fs.mkdir({ path: 'exports', directory: tmpDir, recursive: true }); } catch {}
        const b64 = btoa(unescape(encodeURIComponent(json)));
        await fs.writeFile({ path: tmpPath, directory: tmpDir, data: b64 });
      }
      const sh = shareCap();
      if (sh) {
        try {
          const fileUri = await fs.getUri({ path: tmpPath, directory: tmpDir });
          await sh.share({
            title: fileName,
            text: '淋语翻译器数据导出',
            url: fileUri.uri,
            dialogTitle: '保存或分享导出的 JSON',
          });
          return { canceled: false, file: tmpPath, counts: payload.counts, media: (payload.media || []).length };
        } catch { /* 分享失败也仍把文件放着了 */ }
      }
      // 没有 Share 插件：把 JSON 直接塞进剪贴板并返回
      try { await navigator.clipboard.writeText(json); } catch {}
      return { canceled: false, file: tmpPath, counts: payload.counts, media: (payload.media || []).length, copied: true };
    }

    async function pickImport() {
      const r = await pickFile({ accept: 'application/json,.json' });
      if (r.canceled || !r.files.length) return { canceled: true };
      const file = r.files[0];
      const text = await readFileAsText(file);
      let payload;
      try { payload = JSON.parse(text); }
      catch { throw new Error('文件不是有效的 JSON'); }
      const plan = svc.planImport(payload, 'merge');
      svc.stashImport(payload, file.name);
      ioListeners.forEach((cb) => cb());
      return { canceled: false, file: file.name, ...plan };
    }
    // ---- 备份与恢复：直接调底层 db.listBackups / restore ----
    const api = {
      isCapacitor: isCapacitor(),

      translate: (text, mode) => safe(() => Promise.resolve(svc.translate(text, mode))),

      // Phase 2（Web / 小程序 / 安卓端）：LLM 润色后处理。不可达时返回草稿原样（polished:false）。
      polish: (source, draft) => safe(() => Promise.resolve(svc.polishDraft(source, draft))),
      // 设置页「测试连接」：与桌面端同名同参，用到同一份 core 客户端
      probePolish: (opts) => safe(() => runProbe(opts)),

      // ---- 认证：门禁与失败锁定都在 service 里 ----
      authStatus: () => safe(() => Promise.resolve(svc.authStatus())),
      login: (user, pass) => safe(() => Promise.resolve(svc.login(user, pass))),
      logout: () => safe(() => Promise.resolve(svc.logout())),
      changePassword: (oldPass, newPass) => safe(() => Promise.resolve(svc.changePassword(oldPass, newPass))),
      meta: () => safe(() => Promise.resolve(svc.meta())),

      // ---- 数据 / 撤销 ----
      syncSeed: () => safe(() => Promise.resolve(svc.syncSeed())),
      undoDelete: () => safe(() => Promise.resolve(svc.undoDelete())),
      undoState: () => ({ ok: true, data: svc.undoState() }),
      onUndoChange: (cb) => svc.onUndoChange(cb),
      onIoChange(cb) {
        ioListeners.push(cb);
        return () => { ioListeners = ioListeners.filter((x) => x !== cb); };
      },

      // ---- 五板块 CRUD：与桌面共用 service，这里只做转发 ----
      listWords: () => safe(() => Promise.resolve(svc.crud.words.list())),
      addWord: (w) => safe(() => Promise.resolve(svc.crud.words.add(w))),
      updateWord: (id, w) => safe(() => Promise.resolve(svc.crud.words.update(id, w))),
      deleteWord: (id) => safe(() => Promise.resolve(svc.crud.words.remove(id))),

      listRules: () => safe(() => Promise.resolve(svc.crud.rules.list())),
      addRule: (r) => safe(() => Promise.resolve(svc.crud.rules.add(r))),
      updateRule: (id, r) => safe(() => Promise.resolve(svc.crud.rules.update(id, r))),
      deleteRule: (id) => safe(() => Promise.resolve(svc.crud.rules.remove(id))),

      listCards: () => safe(() => Promise.resolve(svc.crud.cards.list())),
      addCard: (c) => safe(() => Promise.resolve(svc.crud.cards.add(c))),
      updateCard: (id, c) => safe(() => Promise.resolve(svc.crud.cards.update(id, c))),
      deleteCard: (id) => safe(() => Promise.resolve(svc.crud.cards.remove(id))),

      listQuotes: () => safe(() => Promise.resolve(svc.crud.quotes.list())),
      addQuote: (q) => safe(() => Promise.resolve(svc.crud.quotes.add(q))),
      updateQuote: (id, q) => safe(() => Promise.resolve(svc.crud.quotes.update(id, q))),
      deleteQuote: (id) => safe(() => Promise.resolve(svc.crud.quotes.remove(id))),

      listHeroes: () => safe(() => Promise.resolve(svc.crud.heroes.list())),
      addHero: (h) => safe(() => Promise.resolve(svc.crud.heroes.add(h))),
      updateHero: (id, h) => safe(() => Promise.resolve(svc.crud.heroes.update(id, h))),
      deleteHero: (id) => safe(() => Promise.resolve(svc.crud.heroes.remove(id))),

      // ---- 媒体：Capacitor 自己的目录，桌面走 userData/media ----
      pickImage: () => safe(() => pickImage()),
      mediaData: (ref) => safe(() => mediaData(ref)),

      // ---- 导入导出：选文件 / 分享是本端的事，暂存与落库规则在 service ----
      exportData: (opts) => safe(() => exportData(opts || {})),
      pickImport: () => safe(() => pickImport()),
      replanImport: (opts) => safe(() => Promise.resolve(replanImport(opts && opts.strategy))),
      applyImport: (opts) => safe(() => Promise.resolve(applyImport(opts && opts.strategy))),
      cancelImport: () => safe(() => Promise.resolve(svc.cancelImport())),

      // ---- 备份 / 体检 ----
      listBackups: () => safe(() => svc.listBackups()),
      restoreBackup: (name) => safe(() => svc.restoreBackup(name)),
      restoreBefore: () => safe(() => svc.restoreBefore()),
      inspect: () => safe(() => Promise.resolve(svc.inspect())),
      cleanHeroWords: (list) => safe(() => Promise.resolve(svc.cleanHeroWords(list))),

      // ---- 历史 / 偏好 ----
      listHistory: () => safe(() => Promise.resolve(svc.listHistory())),
      clearHistory: () => safe(() => Promise.resolve(svc.clearHistory())),
      getPrefs: () => safe(() => Promise.resolve(svc.getPrefs())),
      // 渲染层会写 window.api.setPref(...).catch(() => {})，必须返回 Promise 才与桌面
      // preload 的 ipc invoke 同形；同步返回对象会让 .catch 直接 TypeError。
      setPref: (key, value) => safe(() => Promise.resolve(svc.setPref(String(key), value))),

      // ---- 日志 / 外部链接 ----
      // 移动端没有"打开日志目录"的概念：返回近 60 行 + 让用户在设置里复制
      openLogs: () => safe(() => {
        const lines = (root.__linyuLogBuffer || []).slice(-60).join('\n');
        return { dir: 'App-data 内置，复制以下内容给开发者：', tail: lines };
      }),
      appendLog: (scope, msg) => {
        if (!root.__linyuLogBuffer) root.__linyuLogBuffer = [];
        root.__linyuLogBuffer.push(`[${new Date().toISOString()}] ${scope}: ${msg}`);
        if (root.__linyuLogBuffer.length > 1000) root.__linyuLogBuffer.shift();
        // 同时打到控制台 / Logcat
        try { console.log('[linyu]', scope, msg); } catch {}
      },
      async openExternal(url) {
        const raw = String(url || '');
        let u;
        try { u = new URL(raw); }
        catch { return { ok: false, error: '非法链接' }; }
        if (u.protocol !== 'http:' && u.protocol !== 'https:') return { ok: false, error: '仅允许打开 http/https 链接' };
        const b = browserCap();
        if (b) {
          try { await b.open({ url: raw }); return { ok: true, data: true }; }
          catch (err) { /* 退回到 window.open */ }
        }
        try { window.open(raw, '_blank'); return { ok: true, data: true }; }
        catch (err) { return { ok: false, error: err.message || String(err) }; }
      },

      // ---- 屏幕方向 ----
      // 只有原生平台能锁朝向；桌面是可调大小的窗口，一律回 supported:false，界面就不画这个按钮。
      async orientationState() {
        const so = orientCap();
        const autoRotate = readPref('ui.autoRotate', false) === true;
        if (!so) return { ok: true, data: { supported: false, type: 'portrait', autoRotate: false } };
        let type = 'portrait';
        try { type = normOrient((await so.orientation()).type); } catch { /* 读不到就按竖屏算 */ }
        return { ok: true, data: { supported: true, type, autoRotate } };
      },
      // 启动时调用：默认锁竖屏，只有用户在设置里开过"跟随设备旋转"才放开
      async initOrientation() {
        const so = orientCap();
        if (!so) return { ok: true, data: { supported: false, type: 'portrait', autoRotate: false } };
        const autoRotate = readPref('ui.autoRotate', false) === true;
        try {
          if (autoRotate) await so.unlock();
          else await so.lock({ orientation: 'portrait' });
        } catch (err) { return { ok: false, error: err.message || String(err) }; }
        let type = 'portrait';
        try { type = normOrient((await so.orientation()).type); } catch {}
        return { ok: true, data: { supported: true, type, autoRotate } };
      },
      async setOrientation(target) {
        const so = orientCap();
        if (!so) return { ok: false, error: '当前平台不支持屏幕方向控制' };
        const want = target === 'landscape' ? 'landscape' : 'portrait';
        // 手动切一次就松开"跟随设备旋转"：不然用户下一次转身又把方向抢回去了
        writePref('ui.autoRotate', false);
        try { await so.lock({ orientation: want }); }
        catch (err) { return { ok: false, error: err.message || String(err) }; }
        return { ok: true, data: { supported: true, type: want, autoRotate: false } };
      },
      async setAutoRotate(on) {
        const so = orientCap();
        if (!so) return { ok: false, error: '当前平台不支持屏幕方向控制' };
        const enable = on === true || on === 'true';
        const w = writePref('ui.autoRotate', enable);
        if (w && w.error) return { ok: false, error: '偏好存不下去：' + w.error };
        try {
          if (enable) await so.unlock();
          else await so.lock({ orientation: normOrient((await so.orientation()).type) });
        } catch (err) { return { ok: false, error: err.message || String(err) }; }
        return { ok: true, data: { supported: true, autoRotate: enable } };
      },
      onOrientationChange(cb) {
        orientListeners.push(cb);
        const so = orientCap();
        if (so && !orientHandle) {
          so.addListener('screenOrientationChange', (r) => {
            const type = normOrient(r && r.type);
            orientListeners.forEach((fn) => fn({ type }));
          }).then((h) => { orientHandle = h; }).catch(() => {});
        }
        return () => { orientListeners = orientListeners.filter((x) => x !== cb); };
      },
    };
    return api;
  }

  if (typeof module === 'object' && module.exports) {
    module.exports = { createApi };
  } else {
    root.linyuApi = { createApi };
  }
}(typeof self !== 'undefined' ? self : this));
