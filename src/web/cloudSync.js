'use strict';

/*
 * 淋语翻译器 · 云服务接入层
 *
 * 职责：
 *   1. 初始化 WorkBuddy Cloud SDK（endpoint / oauthRelayBaseUrl / publishableKey 全部来自
 *      workbuddy_cloud_service 返回的 publicConfig，不猜、不硬编码其他来源）
 *   2. 登录：手机号验证码（默认）+ 微信网页授权
 *   3. 云端词库：把本机自建词条上传到 words 表 / 从 words 表拉回本地 SQLite
 *   4. 翻译历史：本机翻译时同步写入 history 表
 *   5. 偏好设置：主题等同步到 settings 表
 *
 * 数据模型说明：
 *   - words 表为「公开读 + 属主写」的词典表（SELECT 策略 USING(true)），
 *     任何人可读全站词条，只有属主能改自己的行。RLS 由数据库保证，前端不发 owner_id。
 *   - history / settings 为用户私有表，SELECT/INSERT/UPDATE/DELETE 均限定 auth.uid()。
 *
 * 本地仍然保留 SQLite + IndexedDB 作为工作库（离线可用、翻译零延迟）；
 * 云端角色是「跨设备持久化 + 备份」，不是替换本地库。
 */

(function () {
  if (window.__LINYU_CLOUD_LOADED) return;
  window.__LINYU_CLOUD_LOADED = true;

  // ---- publicConfig：由 workbuddy_cloud_service activate 返回，原样内联 ----
  var PUBLIC_CONFIG = {
    endpoint: 'https://linyu-translator.app.workbuddy.host',
    oauthRelayBaseUrl: 'https://www.workbuddy.cn/v2/as/genie-baas/oauth',
    publishableKey: 'wbpk_Sd4kigAmHhvYV7chB2LAcw_MZ3UuUaOBD6IjNlyQDc1EnfXIveVZwTI',
  };

  var cloud = null;
  var session = null;
  var sdkError = '';
  var pendingOtp = null; // { phone, verificationId, isExistingUser }
  var busy = false;

  // ---------------------------------------------------------------------------
  // SDK 初始化
  // ---------------------------------------------------------------------------
  function initCloud() {
    if (cloud) return cloud;
    if (typeof window.WorkBuddyCloud === 'undefined' || !window.WorkBuddyCloud.createWorkBuddyCloud) {
      sdkError = '云服务 SDK 未加载（CDN 不可达或脚本被拦截）';
      return null;
    }
    try {
      cloud = window.WorkBuddyCloud.createWorkBuddyCloud({
        endpoint: PUBLIC_CONFIG.endpoint,
        oauthRelayBaseUrl: PUBLIC_CONFIG.oauthRelayBaseUrl,
        publishableKey: PUBLIC_CONFIG.publishableKey,
      });
      sdkError = '';
    } catch (err) {
      sdkError = '云服务初始化失败：' + (err && err.message ? err.message : String(err));
      cloud = null;
    }
    return cloud;
  }

  function db() {
    return window.linyuDb || null;
  }

  // ---------------------------------------------------------------------------
  // 样式与 DOM 骨架
  // ---------------------------------------------------------------------------
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function buildUI() {
    if (document.getElementById('linyu-cloud-fab')) return;

    var fab = el('button', 'lc-fab', '云');
    fab.id = 'linyu-cloud-fab';
    fab.type = 'button';
    fab.title = '云服务 / 登录';
    fab.setAttribute('aria-label', '打开云服务面板');

    var mask = el('div', 'lc-mask');
    mask.id = 'linyu-cloud-mask';

    var panel = el('div', 'lc-panel');
    panel.id = 'linyu-cloud-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', '云服务');

    var head = el('div', 'lc-head');
    head.appendChild(el('span', 'lc-title', '云服务'));
    var close = el('button', 'lc-close', '×');
    close.type = 'button';
    close.setAttribute('aria-label', '关闭');
    close.addEventListener('click', closePanel);
    head.appendChild(close);

    var body = el('div', 'lc-body');
    body.id = 'lc-body';

    panel.appendChild(head);
    panel.appendChild(body);

    // 关闭按钮的 × 用文字渲染；面板点击内部不冒泡关闭
    panel.addEventListener('click', function (e) { e.stopPropagation(); });
    mask.addEventListener('click', closePanel);

    var root = el('div', 'lc-root');
    root.appendChild(fab);
    root.appendChild(mask);
    root.appendChild(panel);
    document.body.appendChild(root);

    fab.addEventListener('click', function () {
      if (panel.classList.contains('lc-open')) closePanel();
      else openPanel();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && panel.classList.contains('lc-open')) closePanel();
    });
  }

  function openPanel() {
    document.getElementById('linyu-cloud-mask').classList.add('lc-open');
    document.getElementById('linyu-cloud-panel').classList.add('lc-open');
    refreshPanel();
  }

  function closePanel() {
    document.getElementById('linyu-cloud-mask').classList.remove('lc-open');
    document.getElementById('linyu-cloud-panel').classList.remove('lc-open');
  }

  function setStatus(msg, kind) {
    var s = document.getElementById('lc-status');
    if (!s) return;
    s.textContent = msg || '';
    s.className = 'lc-status' + (kind ? ' lc-status-' + kind : '');
  }

  // ---------------------------------------------------------------------------
  // 面板渲染
  // ---------------------------------------------------------------------------
  function refreshPanel() {
    var body = document.getElementById('lc-body');
    if (!body) return;
    body.textContent = '';

    if (!initCloud()) {
      body.appendChild(el('p', 'lc-note lc-note-bad', sdkError || '云服务不可用'));
      body.appendChild(el('p', 'lc-note', '本机词库与翻译功能不受影响，仍可正常使用。'));
      return;
    }

    var status = el('div', 'lc-status');
    status.id = 'lc-status';
    body.appendChild(status);

    if (!session) renderLogin(body);
    else renderSignedIn(body);
  }

  function renderLogin(body) {
    var hint = el('p', 'lc-note', '登录后，你自建的词条、翻译历史和偏好会保存到云端，换设备或清缓存都不丢。');
    body.appendChild(hint);

    // ---- 手机号验证码 ----
    var secPhone = el('div', 'lc-sec');
    secPhone.appendChild(el('div', 'lc-sec-title', '手机号登录 / 注册'));

    var phone = el('input', 'lc-input');
    phone.type = 'tel';
    phone.id = 'lc-phone';
    phone.placeholder = '请输入 11 位手机号';
    phone.autocomplete = 'tel';
    phone.addEventListener('input', function () {
      var err = document.getElementById('lc-phone-err');
      if (err) err.textContent = '';
    });
    secPhone.appendChild(phone);

    var phoneErr = el('div', 'lc-field-err');
    phoneErr.id = 'lc-phone-err';
    secPhone.appendChild(phoneErr);

    var rowCode = el('div', 'lc-row');
    var code = el('input', 'lc-input lc-input-code');
    code.type = 'text';
    code.id = 'lc-code';
    code.placeholder = '6 位验证码';
    code.autocomplete = 'one-time-code';
    code.maxLength = 8;
    var sendBtn = el('button', 'lc-btn lc-btn-ghost', '获取验证码');
    sendBtn.type = 'button';
    sendBtn.id = 'lc-send';
    sendBtn.addEventListener('click', function () { sendCode(phone.value, sendBtn); });
    rowCode.appendChild(code);
    rowCode.appendChild(sendBtn);
    secPhone.appendChild(rowCode);

    var loginBtn = el('button', 'lc-btn lc-btn-primary', '登录 / 注册');
    loginBtn.type = 'button';
    loginBtn.id = 'lc-login';
    loginBtn.addEventListener('click', function () { verifyCode(phone.value, code.value, loginBtn); });
    secPhone.appendChild(loginBtn);

    body.appendChild(secPhone);

    // ---- 微信登录 ----
    var secWx = el('div', 'lc-sec');
    secWx.appendChild(el('div', 'lc-sec-title', '其他方式'));
    var wxBtn = el('button', 'lc-btn lc-btn-ghost lc-btn-block', '微信扫码 / 一键登录');
    wxBtn.type = 'button';
    wxBtn.addEventListener('click', function () { wechatLogin(wxBtn); });
    secWx.appendChild(wxBtn);
    secWx.appendChild(el('p', 'lc-tip', '微信登录需在已发布域名下使用；本地预览不可用。'));
    body.appendChild(secWx);
  }

  function renderSignedIn(body) {
    var user = (session && session.user) || {};
    var name = user.name || '已登录用户';
    var row = el('div', 'lc-user');
    var av = el('div', 'lc-avatar');
    av.textContent = String(name).trim().charAt(0) || '淋';
    row.appendChild(av);
    var info = el('div', 'lc-user-info');
    info.appendChild(el('div', 'lc-user-name', name));
    info.appendChild(el('div', 'lc-user-sub', '云端已连接'));
    row.appendChild(info);
    body.appendChild(row);

    var stats = el('div', 'lc-stats');
    var cloudCount = el('div', 'lc-stat');
    cloudCount.id = 'lc-count';
    cloudCount.textContent = '云端词条 —';
    stats.appendChild(cloudCount);
    var localCount = el('div', 'lc-stat');
    localCount.id = 'lc-local';
    var d = db();
    var localN = 0;
    if (d && d.getWords) {
      try { localN = d.getWords().length; } catch (e) { localN = 0; }
    }
    localCount.textContent = '本地词条 ' + localN;
    stats.appendChild(localCount);
    body.appendChild(stats);

    // 操作区
    var act = el('div', 'lc-actions');

    var upBtn = el('button', 'lc-btn lc-btn-primary lc-btn-block', '上传本地自建词条到云端');
    upBtn.type = 'button';
    upBtn.addEventListener('click', function () { uploadLocalWords(upBtn); });
    act.appendChild(upBtn);

    var downBtn = el('button', 'lc-btn lc-btn-ghost lc-btn-block', '从云端拉取词条到本地');
    downBtn.type = 'button';
    downBtn.addEventListener('click', function () { pullCloudWords(downBtn); });
    act.appendChild(downBtn);

    var prefBtn = el('button', 'lc-btn lc-btn-ghost lc-btn-block', '同步偏好设置（主题等）');
    prefBtn.type = 'button';
    prefBtn.addEventListener('click', function () { syncPrefs(prefBtn); });
    act.appendChild(prefBtn);

    body.appendChild(act);

    var outBtn = el('button', 'lc-btn lc-btn-text', '退出登录');
    outBtn.type = 'button';
    outBtn.addEventListener('click', function () { signOut(outBtn); });
    body.appendChild(outBtn);

    refreshCloudCount();
  }

  // ---------------------------------------------------------------------------
  // 认证
  // ---------------------------------------------------------------------------
  async function sendCode(phoneRaw, btn) {
    var phone = String(phoneRaw || '').trim();
    var errEl = document.getElementById('lc-phone-err');
    if (!/^1\d{10}$/.test(phone)) {
      if (errEl) errEl.textContent = '请输入正确的 11 位手机号';
      return;
    }
    if (errEl) errEl.textContent = '';
    if (busy) return;
    busy = true;
    btn.disabled = true;
    btn.textContent = '发送中…';
    try {
      var sent = await cloud.auth.sendOtp({ phone: phone });
      if (sent.error) {
        setStatus(sent.error.message || '验证码发送失败', 'bad');
        return;
      }
      pendingOtp = {
        phone: phone,
        verificationId: sent.data.verificationId,
        isExistingUser: sent.data.isExistingUser,
      };
      setStatus('验证码已发送，请查收短信', 'ok');
      startCountdown(btn);
    } catch (err) {
      setStatus('验证码发送失败，请稍后重试', 'bad');
    } finally {
      busy = false;
      if (btn.textContent === '发送中…') { btn.disabled = false; btn.textContent = '获取验证码'; }
    }
  }

  function startCountdown(btn) {
    var n = 60;
    btn.disabled = true;
    btn.textContent = n + 's';
    var t = setInterval(function () {
      n -= 1;
      if (n <= 0) {
        clearInterval(t);
        btn.disabled = false;
        btn.textContent = '获取验证码';
      } else {
        btn.textContent = n + 's';
      }
    }, 1000);
  }

  async function verifyCode(phoneRaw, codeRaw, btn) {
    var phone = String(phoneRaw || '').trim();
    var code = String(codeRaw || '').trim();
    if (!pendingOtp || pendingOtp.phone !== phone) {
      var errEl = document.getElementById('lc-phone-err');
      if (errEl) errEl.textContent = '请先获取当前手机号的验证码';
      return;
    }
    if (!code) {
      setStatus('请输入验证码', 'bad');
      return;
    }
    if (busy) return;
    busy = true;
    btn.disabled = true;
    btn.textContent = '登录中…';
    try {
      var done = await cloud.auth.verifyOtp({
        phone: pendingOtp.phone,
        verificationId: pendingOtp.verificationId,
        isExistingUser: pendingOtp.isExistingUser,
        token: code,
      });
      if (done.error) {
        setStatus(done.error.message || '验证码校验失败', 'bad');
        return;
      }
      pendingOtp = null;
      session = done.data && done.data.session ? done.data.session : done.data;
      setStatus('登录成功', 'ok');
      await onSignedIn();
      refreshPanel();
    } catch (err) {
      setStatus('登录失败，请重试', 'bad');
    } finally {
      busy = false;
      btn.disabled = false;
      btn.textContent = '登录 / 注册';
    }
  }

  async function wechatLogin(btn) {
    if (busy) return;
    busy = true;
    btn.disabled = true;
    try {
      var back = new URL(location.href);
      back.pathname = '/';
      ['code', 'state', 'provider', 'error'].forEach(function (k) { back.searchParams.delete(k); });
      var res = await cloud.auth.signInWithOAuth({
        provider: 'wechat',
        redirectTo: back.toString(),
      });
      if (res.error) {
        setStatus(res.error.message || '微信登录不可用', 'bad');
        return;
      }
      // 必须同标签页跳转：PKCE 校验值存在本标签页的 sessionStorage 里
      location.assign(res.data.url);
    } catch (err) {
      setStatus('微信登录发起失败', 'bad');
    } finally {
      busy = false;
      btn.disabled = false;
    }
  }

  async function signOut(btn) {
    if (busy) return;
    busy = true;
    btn.disabled = true;
    try {
      await cloud.auth.signOut();
      session = null;
      setStatus('已退出登录', 'ok');
      refreshPanel();
    } catch (err) {
      setStatus('退出失败', 'bad');
    } finally {
      busy = false;
      btn.disabled = false;
    }
  }

  // ---------------------------------------------------------------------------
  // 登录后的动作
  // ---------------------------------------------------------------------------
  async function onSignedIn() {
    hookHistory();
    try {
      await pullCloudWords(null, { silent: true });
    } catch (e) { /* 拉取失败不阻断登录 */ }
  }

  async function refreshCloudCount() {
    var node = document.getElementById('lc-count');
    if (!node || !session) return;
    try {
      var res = await cloud.database.from('words').select('id', { count: 'exact', head: true });
      if (res.error) {
        node.textContent = '云端词条 —';
        return;
      }
      node.textContent = '云端词条 ' + (res.count == null ? '—' : res.count);
    } catch (e) {
      node.textContent = '云端词条 —';
    }
  }

  // 本地词条里「不属于内置 seed」的部分视为用户自建
  function localUserWords() {
    var d = db();
    if (!d || !d.getWords) return [];
    var seedSet = new Set();
    var seed = window.__SEED_DATA && window.__SEED_DATA.words;
    if (Array.isArray(seed)) {
      for (var i = 0; i < seed.length; i++) seedSet.add(String(seed[i].zh));
    }
    var out = [];
    var words = d.getWords();
    for (var j = 0; j < words.length; j++) {
      var w = words[j];
      if (!seedSet.has(String(w.zh))) out.push(w);
    }
    return out;
  }

  async function uploadLocalWords(btn) {
    if (busy) return;
    var mine = localUserWords();
    if (!mine.length) {
      setStatus('本地没有自建词条可上传（内置词库不需要上传）', 'warn');
      return;
    }
    busy = true;
    if (btn) { btn.disabled = true; btn.textContent = '上传中…'; }
    try {
      // 先取云端已有的 zh，避免重复
      var existing = new Set();
      var page = 0;
      var pageSize = 1000;
      for (;;) {
        var q = await cloud.database
          .from('words')
          .select('zh')
          .range(page * pageSize, page * pageSize + pageSize - 1);
        if (q.error) {
          setStatus('读取云端词条失败：' + (q.error.message || '未知错误'), 'bad');
          return;
        }
        if (!q.data || !q.data.length) break;
        for (var i = 0; i < q.data.length; i++) existing.add(String(q.data[i].zh));
        if (q.data.length < pageSize) break;
        page += 1;
        if (page > 20) break;
      }

      var rows = [];
      for (var j = 0; j < mine.length; j++) {
        var w = mine[j];
        if (existing.has(String(w.zh))) continue;
        rows.push({
          zh: String(w.zh || ''),
          linyu: String(w.linyu || ''),
          alias: String(w.alias || ''),
          sense: String(w.sense || ''),
          source: String(w.source || '用户自建'),
          pop: String(w.pop || ''),
          slot: String(w.slot || ''),
        });
      }

      if (!rows.length) {
        setStatus('云端已包含全部 ' + mine.length + ' 条自建词条，无需上传', 'ok');
        return;
      }

      // 分批插入，避免单次请求体过大
      var ok = 0;
      for (var k = 0; k < rows.length; k += 200) {
        var chunk = rows.slice(k, k + 200);
        var ins = await cloud.database.from('words').insert(chunk);
        if (ins.error) {
          setStatus('上传失败：' + (ins.error.message || '未知错误') + '（已成功 ' + ok + ' 条）', 'bad');
          return;
        }
        ok += chunk.length;
      }
      setStatus('已上传 ' + ok + ' 条自建词条到云端', 'ok');
      refreshCloudCount();
    } catch (err) {
      setStatus('上传失败，请检查网络后重试', 'bad');
    } finally {
      busy = false;
      if (btn) { btn.disabled = false; btn.textContent = '上传本地自建词条到云端'; }
    }
  }

  async function pullCloudWords(btn, opts) {
    var silent = opts && opts.silent;
    if (!silent) {
      if (busy) return;
      busy = true;
      if (btn) { btn.disabled = true; btn.textContent = '拉取中…'; }
    }
    try {
      var all = [];
      var page = 0;
      var pageSize = 1000;
      for (;;) {
        var q = await cloud.database
          .from('words')
          .select('zh, linyu, alias, sense, source, pop, slot')
          .order('id', { ascending: true })
          .range(page * pageSize, page * pageSize + pageSize - 1);
        if (q.error) {
          if (!silent) setStatus('读取云端词条失败：' + (q.error.message || '未知错误'), 'bad');
          return;
        }
        if (!q.data || !q.data.length) break;
        all = all.concat(q.data);
        if (q.data.length < pageSize) break;
        page += 1;
        if (page > 20) break;
      }

      var d = db();
      if (!d || !d.addWord) {
        if (!silent) setStatus('本地库尚未就绪，请稍后再试', 'bad');
        return;
      }

      var added = 0;
      for (var i = 0; i < all.length; i++) {
        var w = all[i];
        if (!w || !w.zh || !w.linyu) continue;
        var r = d.addWord({
          zh: w.zh,
          linyu: w.linyu,
          alias: w.alias || '',
          sense: w.sense || '',
          source: w.source || '云端',
          pop: w.pop || '',
          slot: w.slot || '',
        });
        if (r && r.ok) added += 1;
      }

      if (added > 0 && window.api && window.api.reload) {
        try { await window.api.reload(); } catch (e) { /* 渲染层自己会刷新 */ }
      }

      if (!silent) {
        setStatus(
          added > 0
            ? '已从云端同步 ' + added + ' 条词条到本地'
            : '云端共 ' + all.length + ' 条词条，本地均已存在',
          'ok'
        );
        refreshPanel();
      }
    } catch (err) {
      if (!silent) setStatus('拉取失败，请检查网络后重试', 'bad');
    } finally {
      if (!silent) {
        busy = false;
        if (btn) { btn.disabled = false; btn.textContent = '从云端拉取词条到本地'; }
      }
    }
  }

  // ---- 偏好同步 ----
  var PREF_KEYS = ['ui.theme', 'ui.live', 'ui.autoRotate', 'history.limit', 'last.view'];

  async function syncPrefs(btn) {
    if (busy) return;
    var d = db();
    if (!d || !d.getPrefs) {
      setStatus('本地库尚未就绪', 'bad');
      return;
    }
    busy = true;
    if (btn) { btn.disabled = true; btn.textContent = '同步中…'; }
    try {
      var localPrefs = d.getPrefs() || {};
      var rows = [];
      for (var i = 0; i < PREF_KEYS.length; i++) {
        var k = PREF_KEYS[i];
        if (localPrefs[k] == null) continue;
        rows.push({ key: k, value: String(localPrefs[k]) });
      }

      var pushed = 0;
      if (rows.length) {
        var up = await cloud.database
          .from('settings')
          .upsert(rows, { onConflict: 'owner_id,key' });
        if (up.error) {
          setStatus('偏好上传失败：' + (up.error.message || '未知错误'), 'bad');
          return;
        }
        pushed = rows.length;
      }

      // 再拉回云端最新值，缺的补到本地
      var q = await cloud.database.from('settings').select('key, value');
      if (q.error) {
        setStatus('偏好读取失败：' + (q.error.message || '未知错误'), 'bad');
        return;
      }
      var applied = 0;
      var cloudMap = new Map();
      for (var j = 0; j < (q.data || []).length; j++) {
        cloudMap.set(String(q.data[j].key), q.data[j].value);
      }
      for (var m = 0; m < PREF_KEYS.length; m++) {
        var pk = PREF_KEYS[m];
        if (!cloudMap.has(pk)) continue;
        var r = d.setPref(pk, cloudMap.get(pk));
        if (r && r.ok) applied += 1;
      }

      setStatus('偏好已同步（上传 ' + pushed + ' 项，应用 ' + applied + ' 项）', 'ok');
    } catch (err) {
      setStatus('偏好同步失败，请检查网络', 'bad');
    } finally {
      busy = false;
      if (btn) { btn.disabled = false; btn.textContent = '同步偏好设置（主题等）'; }
    }
  }

  // ---- 翻译历史 ----
  var historyHooked = false;
  function hookHistory() {
    if (historyHooked) return;
    var d = db();
    if (!d || typeof d.addHistory !== 'function') return;
    var orig = d.addHistory.bind(d);
    d.addHistory = function (src, dst) {
      var out = orig(src, dst);
      pushHistory(src, dst);
      return out;
    };
    historyHooked = true;
  }

  var historyQueue = [];
  var historyFlushing = false;

  function pushHistory(src, dst) {
    if (!session) return;
    if (!src || !dst) return;
    historyQueue.push({ src: String(src), dst: String(dst) });
    if (historyQueue.length > 50) historyQueue = historyQueue.slice(-50);
    flushHistory();
  }

  async function flushHistory() {
    if (historyFlushing || !session || !historyQueue.length) return;
    historyFlushing = true;
    try {
      var batch = historyQueue.splice(0, 20);
      var res = await cloud.database.from('history').insert(batch);
      if (res.error) {
        // 静默失败：历史不是关键路径，不打断用户翻译
        historyQueue = batch.concat(historyQueue).slice(-50);
      }
    } catch (e) {
      /* 同上 */
    } finally {
      historyFlushing = false;
      if (historyQueue.length && session) setTimeout(flushHistory, 2000);
    }
  }

  // ---------------------------------------------------------------------------
  // 启动：恢复会话 + 处理 OAuth 回调
  // ---------------------------------------------------------------------------
  async function restoreAuth() {
    if (!initCloud()) return;
    try {
      var url = new URL(location.href);
      var hasCode = url.searchParams.has('code');
      var hasError = url.searchParams.has('error');
      if (hasCode || hasError) {
        var provider = url.searchParams.get('provider');
        var handler = null;
        if (provider === 'wechat' && typeof cloud.auth.handleWechatWebCallback === 'function') {
          handler = cloud.auth.handleWechatWebCallback;
        } else if (provider === 'workbuddy' && typeof cloud.auth.handleWorkBuddyCallback === 'function') {
          handler = cloud.auth.handleWorkBuddyCallback;
        }
        if (handler) {
          var done = await handler.call(cloud.auth);
          if (!done.error && done.data) {
            session = done.data.session || done.data;
            ['code', 'state', 'provider', 'error'].forEach(function (k) {
              url.searchParams.delete(k);
            });
            history.replaceState(null, '', url.pathname + url.search + url.hash);
            await onSignedIn();
            return;
          }
        }
      }
      var s = await cloud.auth.getSession();
      if (s && !s.error && s.data) {
        session = s.data.session || s.data;
        await onSignedIn();
      }
    } catch (e) {
      /* 会话恢复失败按未登录处理 */
    }
  }

  function boot() {
    buildUI();
    // 等本地库就绪再恢复会话（拉取云端词条需要本地库）
    var started = false;
    function once() {
      if (started) return;
      started = true;
      restoreAuth();
    }
    if (window.linyuDb) once();
    else {
      window.addEventListener('linyu-db-ready', once);
      setTimeout(once, 8000); // 兜底：即使 db 未就绪也先把登录态恢复出来
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
