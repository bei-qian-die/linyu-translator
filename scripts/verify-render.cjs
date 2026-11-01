// 一次性校验：确认线上页面真的渲染出了界面（不是只看 HTTP 200）
const { app, BrowserWindow } = require('electron');

const TARGET = process.argv[2] || 'https://linyu-translator.app.workbuddy.host/?sharecode=KYSNKQPHS7';

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1200, height: 900 });
  const errs = [];
  win.webContents.on('console-message', (_e, level, message) => {
    if (level === 2 || level === 1) errs.push(String(message).slice(0, 200));
  });

  await win.loadURL(TARGET).catch((e) => errs.push('loadURL: ' + e.message));
  await new Promise((r) => setTimeout(r, 6000));

  const out = await win.webContents
    .executeJavaScript(
      `(() => {
        const app = document.getElementById('app');
        return JSON.stringify({
          htmlLen: app ? app.innerHTML.length : -1,
          topbar: document.querySelectorAll('.topbar').length,
          tabs: document.querySelectorAll('.topbar .tabs button').length,
          hasApi: typeof window.api,
          hasProbe: !!(window.api && window.api.probePolish),
          cloud: !!window.api && window.api.isCapacitor === false,
          version: (document.querySelector('.mode-chip') || {}).textContent || '',
        });
      })()`
    )
    .catch((e) => 'probe failed: ' + e.message);

  console.log('PROBE ' + out);
  console.log('ERRORS ' + JSON.stringify(errs.slice(0, 6)));
  app.quit();
});
