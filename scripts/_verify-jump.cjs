'use strict';
/*
 * 一次性验收脚本：本机 Edge headless + CDP 打开本地 Web 产物，
 * 验证四个分页列表的跳页控件（顶部/底部）与键盘敲数字跳页。
 *
 * 用法：node scripts/_verify-jump.cjs
 */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const URL_ = process.argv[2] || 'http://127.0.0.1:8123/index.html';
const MOBILE = process.env.JUMP_MOBILE === '1';
const PORT = MOBILE ? 9335 : 9334;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT = path.join(__dirname, '..', 'promo', MOBILE ? '_jump-check-mobile.png' : '_jump-check.png');
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
  const userDataDir = path.join(os.tmpdir(), 'linyu-jump-' + Date.now());
  fs.mkdirSync(userDataDir, { recursive: true });
  const child = spawn(EDGE, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    MOBILE ? '--window-size=390,844' : '--window-size=1280,900',
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
    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', MOBILE
      ? { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }
      : { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: URL_ });

    // 等应用初始化（IndexedDB + sql.js 建库）
    let ready = false;
    for (let i = 0; i < 40; i += 1) {
      await sleep(500);
      const ok = await evaluate(`!!(window.linyuDb && document.querySelector('.tabs button'))`);
      if (ok === true) { ready = true; break; }
    }
    console.log('初始化完成:', ready);

    const clickTab = (label) => evaluate(`(function(){
      const b = [...document.querySelectorAll('.tabs button')].find(el => el.textContent.trim().startsWith('${label}'));
      if (!b) return false;
      b.click();
      return true;
    })()`);

    await clickTab('词库');
    await sleep(600);

    const probeWords = await evaluate(`(function(){
      const sec = [...document.querySelectorAll('section.manage-page')].find(s => s.style.display !== 'none' && s.querySelector('.pg-jump'));
      const jumps = sec ? sec.querySelectorAll('.pg-jump').length : 0;
      const inputs = sec ? sec.querySelectorAll('.pg-input').length : 0;
      const pager = sec ? sec.querySelector('.pager') : null;
      return { jumps, inputs, pagerText: pager ? pager.querySelector('.pg-info').textContent.trim() : '', scrollTop: window.scrollY };
    })()`);
    console.log('词库页跳页控件:', probeWords);

    // 在顶部输入框里输入 10 并回车
    const typed = await evaluate(`(function(){
      const sec = [...document.querySelectorAll('section.manage-page')].find(s => s.style.display !== 'none' && s.querySelector('.pg-jump'));
      const input = sec.querySelector('.pg-jump:not(.inline) .pg-input');
      input.focus();
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, '10');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      return input.value;
    })()`);
    await sleep(500);
    const afterEnter = await evaluate(`(function(){
      const sec = [...document.querySelectorAll('section.manage-page')].find(s => s.style.display !== 'none' && s.querySelector('.pg-jump'));
      const pager = sec.querySelector('.pager');
      return { typedInInput: ${JSON.stringify(typed)}, pagerText: pager ? pager.querySelector('.pg-info').textContent.trim() : '', firstRow: (sec.querySelector('tbody tr td') || {}).textContent };
    })()`);
    console.log('顶部输入 10 + 回车后:', afterEnter);

    // 键盘直接敲数字：不聚焦任何输入框，敲 2、3 再回车
    await evaluate(`document.activeElement && document.activeElement.blur()`);
    await evaluate(`document.body.click()`);
    for (const key of ['2', '3', 'Enter']) {
      await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: '${key}', bubbles: true, cancelable: true }))`);
      await sleep(120);
    }
    await sleep(400);
    const afterKb = await evaluate(`(function(){
      const sec = [...document.querySelectorAll('section.manage-page')].find(s => s.style.display !== 'none' && s.querySelector('.pg-jump'));
      const pager = sec.querySelector('.pager');
      return { pagerText: pager ? pager.querySelector('.pg-info').textContent.trim() : '', kbVisible: !!document.querySelector('.kb-jump') };
    })()`);
    console.log('裸敲 23 + 回车后:', afterKb);

    // 底部翻页条的跳页框
    const bottom = await evaluate(`(function(){
      const sec = [...document.querySelectorAll('section.manage-page')].find(s => s.style.display !== 'none' && s.querySelector('.pg-jump'));
      const input = sec.querySelector('.pager .pg-input');
      input.focus();
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, '5');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      const btn = sec.querySelector('.pager .pg-jump .ghost');
      btn.click();
      return true;
    })()`);
    await sleep(400);
    const afterBottom = await evaluate(`(function(){
      const sec = [...document.querySelectorAll('section.manage-page')].find(s => s.style.display !== 'none' && s.querySelector('.pg-jump'));
      const pager = sec.querySelector('.pager');
      return { clicked: ${Boolean(bottom)}, pagerText: pager.querySelector('.pg-info').textContent.trim() };
    })()`);
    console.log('底部输入 5 + 点跳转后:', afterBottom);

    // 词卡 / 名言 / 句式页各点一遍，确认都有两份跳页控件
    for (const label of ['句式', '词卡', '名言']) {
      await clickTab(label);
      await sleep(500);
      const r = await evaluate(`(function(){
        const sec = [...document.querySelectorAll('section.manage-page')].find(s => s.style.display !== 'none' && s.querySelector('.pg-jump'));
        return sec ? { jumps: sec.querySelectorAll('.pg-jump').length, inputs: sec.querySelectorAll('.pg-input').length } : null;
      })()`);
      console.log(label + '页:', r);
    }

    await clickTab('词库');
    await sleep(400);
    await evaluate(`window.scrollTo(0,0)`);
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(OUT, Buffer.from(shot.data, 'base64'));
    console.log('截图:', OUT);
    console.log('页面异常:', errs.length ? errs : '无');
  } finally {
    try { if (ws) ws.close(); } catch {}
    try { child.kill(); } catch {}
  }
}

main().catch((e) => { console.error('FAILED', e); process.exit(1); });
