'use strict';
/*
 * 手机端网页诊断：Edge headless + CDP 模拟 Android 手机（390x844 + 移动 UA），
 * 打开线上站点，检查音乐页是否渲染 150 张卡、新增平台是否在筛选条里、
 * 页面是否被 CSS 隐藏或溢出遮挡。同时抓 console / 网络错误。
 *
 * 用法：node scripts/_verify-mobile-1380.cjs
 */
const { spawn } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');

const URL_ = process.argv[2] || 'https://linyu-translator.app.workbuddy.host/?sharecode=KYSNKQPHS7';
const PORT = 9337;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT = path.join(__dirname, '..', 'promo', '_mobile-music-check.png');
const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForDevtools(timeoutMs = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (r.ok) return r.json();
    } catch {}
    await sleep(400);
  }
  throw new Error('DevTools 端口未就绪');
}

async function main() {
  const userDataDir = path.join(os.tmpdir(), 'linyu-mobile-' + Date.now());
  fs.mkdirSync(userDataDir, { recursive: true });
  const child = spawn(EDGE, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    'about:blank',
  ], { stdio: 'ignore' });

  let ws;
  try {
    await waitForDevtools();
    const created = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' });
    const target = await created.json();
    ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

    let nextId = 1;
    const pending = new Map();
    const errs = [];
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const p = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) p.reject(new Error(JSON.stringify(msg.error)));
        else p.resolve(msg.result);
        return;
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        const d = msg.params.exceptionDetails;
        errs.push(d.text + ' ' + ((d.exception && d.exception.description) || ''));
      }
      if (msg.method === 'Network.responseReceived' && msg.params.response.status >= 400) {
        errs.push(`[http ${msg.params.response.status}] ${msg.params.response.url}`);
      }
    };
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async (expression) => {
      const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) return { __error: r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description) };
      return r.result.value;
    };

    await send('Runtime.enable');
    await send('Network.enable');
    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true, screenWidth: 390, screenHeight: 844 });
    await send('Emulation.setUserAgentOverride', { userAgent: UA, platform: 'Android' });
    await send('Network.setCacheDisabled', { cacheDisabled: false });

    const result = { ua: UA, viewport: '390x844' };
    await send('Page.navigate', { url: URL_ });

    let ready = false;
    for (let i = 0; i < 50; i += 1) {
      await sleep(600);
      const ok = await evaluate(`(function(){
        const b = document.querySelector('.tabs button');
        return !!(b && !b.textContent.includes('{{') && window.linyuDb);
      })()`);
      if (ok === true) { ready = true; break; }
    }
    result.appReady = ready;

    result.beforeClick = await evaluate(`(function(){
      const tabs = [...document.querySelectorAll('.tabs button')].map(b => b.textContent.trim());
      const musicTab = [...document.querySelectorAll('.tabs button')].find(b => b.textContent.trim().startsWith('音乐'));
      return {
        tabs,
        musicTabFound: !!musicTab,
        musicTabRect: musicTab ? (function(){ const r = musicTab.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), visible: r.width > 0 && r.x < innerWidth && r.right > 0 }; })() : null,
        musicData: (window.MUSIC_DATA && window.MUSIC_DATA.items) ? window.MUSIC_DATA.items.length : null,
        musicPlatforms: (window.MUSIC_DATA && window.MUSIC_DATA.platforms) ? window.MUSIC_DATA.platforms : null,
      };
    })()`);

    result.musicTabClicked = await evaluate(`(function(){
      const b = [...document.querySelectorAll('.tabs button')].find(el => el.textContent.trim().startsWith('音乐'));
      if (!b) return false;
      b.click();
      return true;
    })()`);

    let cards = 0;
    for (let i = 0; i < 25; i += 1) {
      await sleep(400);
      cards = await evaluate(`document.querySelectorAll('.music-card').length`);
      if (cards >= 150) break;
    }
    result.musicCards = cards;
    result.pageState = await evaluate(`(function(){
      const sec = [...document.querySelectorAll('section')].find(s => s.className && String(s.className).includes('music-page'));
      const cs = sec ? getComputedStyle(sec) : null;
      const chips = [...document.querySelectorAll('.music-plat-chip')].map(c => ({
        text: c.textContent.trim(),
        on: c.classList.contains('on'),
        visible: (function(){ const r = c.getBoundingClientRect(); return r.width > 0 && r.height > 0; })(),
      }));
      const groups = [...document.querySelectorAll('.music-group')].map(g => g.textContent.trim());
      const first = document.querySelector('.music-card');
      return {
        sectionDisplay: cs ? cs.display : 'not-found',
        sectionVisibility: cs ? cs.visibility : null,
        sectionHeight: sec ? Math.round(sec.getBoundingClientRect().height) : 0,
        platformChips: chips,
        groups,
        firstCardText: first ? first.textContent.trim().slice(0, 80) : null,
        firstCardVisible: first ? (function(){ const r = first.getBoundingClientRect(); return r.height > 0 && r.top < innerHeight; })() : null,
        bodyScrollWidth: document.body.scrollWidth,
        innerWidth: innerWidth,
      };
    })()`);

    await evaluate(`window.scrollTo(0, 0)`);
    result.versionSync = await evaluate(`(async () => {
      const pageBuild = document.documentElement.getAttribute('data-build');
      let serverBuild = null;
      try {
        const r = await fetch('version.json' + (location.search ? location.search + '&' : '?') + '_t=' + Date.now(), { cache: 'no-store' });
        serverBuild = (await r.json()).build;
      } catch (e) { serverBuild = 'ERR:' + e.message; }
      return { pageBuild, serverBuild, finalUrl: location.href, autoReloaded: location.search.indexOf('_v=') >= 0 };
    })()`);
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(OUT, Buffer.from(shot.data, 'base64'));
    result.screenshot = OUT;
    result.pageErrors = errs;
    console.log(JSON.stringify(result, null, 2));
  } finally {
    try { if (ws) ws.close(); } catch {}
    try { child.kill(); } catch {}
  }
}

main().catch((e) => { console.error('FAILED', e); process.exit(1); });
