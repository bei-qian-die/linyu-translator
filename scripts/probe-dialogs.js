'use strict';
// 临时探针：确认 Electron 33 渲染层里 window.alert/confirm/prompt 是否可用
const { app, BrowserWindow } = require('electron');
const path = require('path');

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true } });
  await win.loadFile(path.join(__dirname, 'probe-dialogs.html'));
  const r = await win.webContents.executeJavaScript(`JSON.stringify({
    confirmType: typeof window.confirm,
    alertType: typeof window.alert,
    promptType: typeof window.prompt,
    confirmResult: (() => { try { return String(window.confirm('x')); } catch (e) { return 'THROW:' + e.message; } })()
  })`);
  console.log('PROBE ' + r);
  app.quit();
});
