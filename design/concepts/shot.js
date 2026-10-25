'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PAGE = process.argv[2];
if (!PAGE) {
  console.error('usage: node shot.js <lexicon|history|about|sheet>');
  process.exit(1);
}

const root = __dirname;
const html = path.join(root, 'linyu-pages-concept.html');
const url = pathToFileURL(html).href + (PAGE === 'sheet' ? '' : '?only=' + PAGE);
const out = path.join(root, PAGE === 'sheet' ? 'linyu-pages-sheet.png' : 'linyu-pages-' + PAGE + '.png');
const port = 9333 + Math.floor(Math.random() * 200);
const profile = path.join(os.tmpdir(), 'ly-concept-shot-' + Date.now());

const browser = spawn(EDGE, [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  '--disable-extensions',
  '--no-first-run',
  '--no-default-browser-check',
  '--remote-debugging-port=' + port,
  '--user-data-dir=' + profile,
  url,
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getPageTarget() {
  for (let i = 0; i < 80; i += 1) {
    try {
      const list = await fetch('http://127.0.0.1:' + port + '/json/list').then((r) => r.json());
      const target = list.find((item) => item.type === 'page' && item.url.includes('linyu-pages-concept'));
      if (target) return target;
    } catch {}
    await sleep(150);
  }
  throw new Error('Edge page target not found');
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const pending = new Map();
    let seq = 0;

    ws.addEventListener('open', () => {
      resolve({
        send(method, params) {
          const id = ++seq;
          ws.send(JSON.stringify({ id, method, params: params || {} }));
          return new Promise((res, rej) => pending.set(id, { res, rej }));
        },
        close() { ws.close(); },
      });
    });
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (!msg.id || !pending.has(msg.id)) return;
      const { res, rej } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) rej(new Error(msg.error.message));
      else res(msg.result);
    });
    ws.addEventListener('error', reject);
  });
}

(async () => {
  try {
    const target = await getPageTarget();
    const cdp = await connect(target.webSocketDebuggerUrl);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    const ready = await cdp.send('Runtime.evaluate', {
      expression: 'document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => r(document.readyState))))',
      awaitPromise: true,
      returnByValue: true,
    });
    if (ready.result.value !== 'complete') console.warn('readyState:', ready.result.value);

    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await sleep(300);

    const size = await cdp.send('Runtime.evaluate', {
      expression: '({ w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight })',
      returnByValue: true,
    });
    const { w, h } = size.result.value;
    console.log(PAGE, 'page size', w + 'x' + h);

    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: w,
      height: h,
      deviceScaleFactor: 2,
      mobile: false,
    });
    await sleep(300);

    const shot = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
    fs.writeFileSync(out, Buffer.from(shot.data, 'base64'));
    console.log('saved', out, fs.statSync(out).size, 'bytes');

    await cdp.send('Browser.close').catch(() => {});
    cdp.close();
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    setTimeout(() => browser.kill(), 400);
  }
})();
