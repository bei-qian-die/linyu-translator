'use strict';
/*
 * 线上核验脚本（1.38.0）：Edge headless + CDP 打开已发布站点，验证
 *   1) version.json = 1.38.0
 *   2) 音乐页渲染 150 张卡
 *   3) 收藏写入 localStorage 并在刷新后仍然保留
 *
 * 用法：node scripts/_verify-online-1380.cjs
 */
const { spawn } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');

const URL_ = process.argv[2] || 'https://linyu-translator.app.workbuddy.host/?sharecode=KYSNKQPHS7';
const PORT = 9336;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
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
  const userDataDir = path.join(os.tmpdir(), 'linyu-online-' + Date.now());
  fs.mkdirSync(userDataDir, { recursive: true });
  const child = spawn(EDGE, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--disable-features=CalculateNativeWinOcclusion',
    '--window-size=1280,900',
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

    const result = {};
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

    // 1) version.json（站点所有路径都要求带 sharecode）
    result.versionFile = await evaluate(`(async () => {
      try {
        const r = await fetch('/version.json?sharecode=KYSNKQPHS7', { cache: 'no-store' });
        return await r.json();
      } catch (e) { return { error: String(e) }; }
    })()`);

    // 切到音乐页
    result.musicTabClicked = await evaluate(`(function(){
      const b = [...document.querySelectorAll('.tabs button')].find(el => el.textContent.trim().startsWith('音乐'));
      if (!b) return false;
      b.click();
      return true;
    })()`);

    // 等卡片渲染完成（Vue 异步更新 + 数据初始化）
    let cards = 0;
    for (let i = 0; i < 25; i += 1) {
      await sleep(400);
      cards = await evaluate(`document.querySelectorAll('.music-card').length`);
      if (cards >= 150) break;
    }
    result.musicCards = cards;
    result.musicCountLabel = await evaluate(`(function(){
      const el = document.querySelector('.stat');
      return el ? el.textContent.trim() : '';
    })()`);
    result.musicDataLength = await evaluate(`(window.MUSIC_DATA && window.MUSIC_DATA.items) ? window.MUSIC_DATA.items.length : (window.MUSIC_DATA && window.MUSIC_DATA.count) || null`);

    // 2) 收藏：点第一张卡的心形
    result.favClick = await evaluate(`(function(){
      const card = document.querySelector('.music-card');
      if (!card) return { error: '无卡片' };
      const btn = card.querySelector('.mc-fav');
      if (!btn) return { error: '无收藏按钮' };
      const id = card.id;
      btn.click();
      return { id, before: btn.textContent.trim() };
    })()`);
    await sleep(900);
    result.afterFav = await evaluate(`(function(){
      const card = document.querySelector('.music-card');
      const btn = card && card.querySelector('.mc-fav');
      let raw = null, parsed = null;
      try { raw = localStorage.getItem('linyu.music.favs'); parsed = JSON.parse(raw); } catch {}
      return {
        label: btn ? btn.textContent.trim() : null,
        on: btn ? btn.classList.contains('on') : null,
        storageRaw: raw,
        storageCount: Array.isArray(parsed) ? parsed.length : (parsed && typeof parsed === 'object' ? Object.keys(parsed).length : null),
      };
    })()`);

    // 3) 刷新后收藏是否还在
    await send('Page.reload', { ignoreCache: true });
    let ready2 = false;
    for (let i = 0; i < 50; i += 1) {
      await sleep(600);
      const ok = await evaluate(`(function(){
        const b = document.querySelector('.tabs button');
        return !!(b && !b.textContent.includes('{{') && window.linyuDb);
      })()`);
      if (ok === true) { ready2 = true; break; }
    }
    result.appReadyAfterReload = ready2;
    await evaluate(`(function(){
      const b = [...document.querySelectorAll('.tabs button')].find(el => el.textContent.trim().startsWith('音乐'));
      if (b) b.click();
      return true;
    })()`);
    for (let i = 0; i < 25; i += 1) {
      await sleep(400);
      const n = await evaluate(`document.querySelectorAll('.music-card').length`);
      if (n >= 150) break;
    }
    const favId = result.favClick && result.favClick.id;
    result.afterReload = await evaluate(`(function(){
      const card = document.getElementById(${JSON.stringify(favId)});
      const btn = card && card.querySelector('.mc-fav');
      let raw = null;
      try { raw = localStorage.getItem('linyu.music.favs'); } catch {}
      return {
        cardFound: !!card,
        label: btn ? btn.textContent.trim() : null,
        on: btn ? btn.classList.contains('on') : null,
        storageRaw: raw,
        cards: document.querySelectorAll('.music-card').length,
      };
    })()`);

    result.pageErrors = errs;
    console.log(JSON.stringify(result, null, 2));
  } finally {
    try { if (ws) ws.close(); } catch {}
    try { child.kill(); } catch {}
  }
}

main().catch((e) => { console.error('FAILED', e); process.exit(1); });
