// 验证「外部访客」路径：全新会话（无 cookie / 无 localStorage / 未登录 / 没有任何偏好），
// 打开页面后是否【默认就开着润色】、【能不能直接拿到润色结果】、【缓存是否生效】。
// 用法：npm run verify:external [url]
const { app, BrowserWindow, session } = require('electron');

const TARGET = process.argv[2] || 'https://linyu-translator.app.workbuddy.host/?sharecode=KYSNKQPHS7';

app.whenReady().then(async () => {
  // 每次跑用一个临时 partition，确保是「第一次来的访客」
  const part = 'verify-external-' + Date.now();
  const ses = session.fromPartition(part, { cache: false });
  const win = new BrowserWindow({
    show: false,
    width: 1200,
    height: 900,
    webPreferences: { session: ses, contextIsolation: false, nodeIntegration: false },
  });

  const errs = [];
  win.webContents.on('console-message', (_e, level, message) => {
    if (level === 2) errs.push(String(message).slice(0, 200));
  });

  await win.loadURL(TARGET).catch((e) => errs.push('loadURL: ' + e.message));
  // 等 Vue 挂载 + 偏好读取完成
  await new Promise((r) => setTimeout(r, 15000)); // 等 db 初始化 + onMounted 读完偏好

  const report = await win.webContents
    .executeJavaScript(
      `(async () => {
        const out = {};
        out.htmlLen = (document.getElementById('app') || { innerHTML: '' }).innerHTML.length;

        // 1) 是否默认开了润色：找工具栏里文字含「润色」的 checkbox
        const boxes = Array.from(document.querySelectorAll('input[type=checkbox]'));
        const polishBox = boxes.find((b) => (b.parentElement || {}).textContent && /润色/.test(b.parentElement.textContent));
        out.polishCheckboxFound = !!polishBox;
        out.polishCheckedByDefault = polishBox ? polishBox.checked : null;

        // 2) 访客身份：确认真的没有登录态
        try {
          const s = await window.WorkBuddyCloud.createWorkBuddyCloud({
            endpoint: window.LINYU_CLOUD.endpoint,
            publishableKey: window.LINYU_CLOUD.publishableKey,
          }).auth.getSession();
          out.loggedIn = !!(s && s.data);
        } catch (e) { out.loggedIn = 'probe-failed'; }

        // 环境判定：这两项决定「非桌面默认开润色」走不走得到
        out.isCapacitorType = typeof window.api.isCapacitor;
        out.isCapacitor = window.api.isCapacitor;

        // 访客的偏好表（应当基本为空，证明是首次访问）
        try {
          const raw = await window.api.getPrefs();
          const prefs = (raw && raw.ok) ? raw.data : raw;
          out.prefKeys = Object.keys(prefs || {});
          out.polishEnabledPref = String((prefs || {})['polishEnabled']);
        } catch (e) { out.prefErr = String(e && e.message); }

        // Vue 里的真实状态：polishOn / polishEngine 到底是多少
        try {
          const inst = document.getElementById('app').__vue_app__._instance;
          const st = inst && inst.setupState;
          out.vuePolishOn = st ? st.polishOn : 'no-setup-state';
          out.vueEngine = st ? st.polishEngine : '';
          out.vueNonDesktop = st ? st.nonDesktop : '';
        } catch (e) { out.vueErr = String(e && e.message); }

        // 3) 直接跑一次润色（外部访客最核心的诉求）；api 返回 {ok,data} 需解包
        const unwrap = (r) => (r && r.ok === false ? { fatal: r.error } : (r && r.data) || {});
        const src = '救命，气死我了。';
        const draft = '救命，我气死了。';
        const t1 = Date.now();
        try {
          const r1 = unwrap(await window.api.polish(src, draft));
          out.run1 = { ms: Date.now() - t1, polished: !!r1.polished, text: r1.text || '', error: r1.error || '', fatal: r1.fatal || '' };
        } catch (e) { out.run1 = { ms: Date.now() - t1, fatal: String(e && e.message) }; }

        // 4) 同句再跑一次：应命中缓存（快得多）
        const t2 = Date.now();
        try {
          const r2 = unwrap(await window.api.polish(src, draft));
          out.run2 = { ms: Date.now() - t2, text: r2.text || '', error: r2.error || '' };
        } catch (e) { out.run2 = { ms: Date.now() - t2, fatal: String(e && e.message) }; }

        // 5) 换一句，确认不是死缓存
        const t3 = Date.now();
        try {
          const r3 = unwrap(await window.api.polish('今天天气真好。', '今日天气珍好。'));
          out.run3 = { ms: Date.now() - t3, text: r3.text || '', error: r3.error || '' };
        } catch (e) { out.run3 = { ms: Date.now() - t3, fatal: String(e && e.message) }; }

        return JSON.stringify(out);
      })()`
    )
    .catch((e) => JSON.stringify({ probeFailed: String(e && e.message) }));

  console.log('EXTERNAL ' + report);
  console.log('ERRORS ' + JSON.stringify(errs.slice(0, 5)));
  app.quit();
});
