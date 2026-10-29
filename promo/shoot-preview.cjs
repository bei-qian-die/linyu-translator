'use strict';
/* 用 Edge headless + CDP 按成片尺寸逐镜头截图，用于排版校验 */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const HTML = path.resolve(__dirname, 'linyu-promo-30s.html');
const OUT = path.resolve(__dirname, 'preview');
fs.mkdirSync(OUT, { recursive: true });

const SHOTS = [
  { t: 1800, name: '01-hook' },
  { t: 4600, name: '02-input' },
  { t: 8300, name: '03-result' },
  { t: 12500, name: '04-lexicon' },
  { t: 14600, name: '05-cards' },
  { t: 16700, name: '06-heroes' },
  { t: 21000, name: '07-devmode' },
  { t: 26000, name: '08-privacy' },
  { t: 29400, name: '09-endcard' },
];

const port = 9700 + Math.floor(Math.random() * 200);
const profile = path.join(os.tmpdir(), 'ly-promo-shot-' + Date.now());
const url = pathToFileURL(HTML).href;

const browser = spawn(EDGE, [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  '--disable-extensions',
  '--no-first-run',
  '--no-default-browser-check',
  '--allow-file-access-from-files',
  '--force-device-scale-factor=1',
  '--remote-debugging-port=' + port,
  '--user-data-dir=' + profile,
  '--window-size=1080,1920',
  url,
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function target() {
  for (let i = 0; i < 90; i += 1) {
    try {
      const list = await fetch('http://127.0.0.1:' + port + '/json/list').then((r) => r.json());
      const p = list.find((it) => it.type === 'page' && it.url.includes('linyu-promo'));
      if (p) return p;
    } catch {}
    await sleep(150);
  }
  throw new Error('page target not found');
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const pending = new Map();
    let seq = 0;
    ws.addEventListener('open', () => {
      resolve({
        send(method, params = {}) {
          const id = ++seq;
          ws.send(JSON.stringify({ id, method, params }));
          return new Promise((res, rej) => pending.set(id, { res, rej }));
        },
        close() { ws.close(); },
      });
    });
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
      }
    });
    ws.addEventListener('error', reject);
  });
}

(async () => {
  const tgt = await target();
  const cdp = await connect(tgt.webSocketDebuggerUrl);

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1080, height: 1920, deviceScaleFactor: 1, mobile: false,
  });

  /* 等页面就绪 */
  for (let i = 0; i < 80; i += 1) {
    const r = await cdp.send('Runtime.evaluate', { expression: '!!window.__ready', returnByValue: true });
    if (r.result.value) break;
    await sleep(150);
  }
  await sleep(600);
  /* 让舞台按模拟后的视口重新计算缩放，保证截图是 1:1 */
  await cdp.send('Runtime.evaluate', { expression: 'window.dispatchEvent(new Event("resize"))' });
  await sleep(200);

  for (const s of SHOTS) {
    await cdp.send('Runtime.evaluate', { expression: `window.__seek(${s.t})` });
    await sleep(s.t === 16700 ? 1400 : 950);
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    fs.writeFileSync(path.join(OUT, s.name + '.png'), Buffer.from(shot.data, 'base64'));
    console.log('ok', s.name, s.t + 'ms');
  }

  cdp.close();
  browser.kill();
  process.exit(0);
})().catch((e) => {
  console.error('FAIL', e.message);
  browser.kill();
  process.exit(1);
});
