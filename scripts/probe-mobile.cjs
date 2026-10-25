'use strict';
/*
 * 移动端适配验证：本地静态服务 + headless Edge 设备模拟 + CDP。
 *
 * 做三件事：
 *   1. 用 iPhone 的 UA 与 390×844 视口打开 www-web，断言 body.mobile-app 生效、
 *      底部导航变成 fixed、翻译页双栏变单栏、词库表格变卡片、页面没有横向溢出。
 *   2. 同一份页面用桌面 UA 打开，断言移动端类名不存在（桌面端零影响）。
 *   3. 各页截图存到 evidence/mobile/，用来肉眼复核排版。
 *
 * 用法：node scripts/probe-mobile.cjs
 */
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const WWW = path.join(ROOT, 'www-web');
const OUT = path.join(ROOT, 'evidence', 'mobile');
const PORT = 9334;
const HTTP_PORT = 8791;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OSX) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

// 可选的线上地址：`node scripts/probe-mobile.cjs https://xxx/?sharecode=...`
// 给了就走真实站点（不再起本地静态服务），用来验证「发布后线上到底对不对」。
const REMOTE = /^https?:\/\//i.test(process.argv[2] || '') ? process.argv[2] : '';
const BASE = REMOTE || `http://127.0.0.1:${HTTP_PORT}/index.html`;
// ?ui=mobile 是为了排除 UA 判定的偶然性：即便线上代理改写了 UA，也能验证样式链路本身。
const WITH_MOBILE_FLAG = BASE + (BASE.includes('?') ? '&' : '?') + 'ui=mobile';
const SHOT_DIR = REMOTE ? path.join(OUT, 'live') : OUT;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function serve() {
  const srv = http.createServer((req, res) => {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    const rel = url === '/' ? 'index.html' : url.replace(/^\/+/, '');
    const file = path.join(WWW, rel);
    if (!file.startsWith(WWW)) {
      res.writeHead(403).end('forbidden');
      return;
    }
    fs.readFile(file, (err, buf) => {
      if (err) {
        res.writeHead(404).end('not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(buf);
    });
  });
  return new Promise((resolve) => srv.listen(HTTP_PORT, '127.0.0.1', () => resolve(srv)));
}

async function waitForDevtools(timeoutMs = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (r.ok) return await r.json();
    } catch {
      /* 还没起来 */
    }
    await sleep(400);
  }
  throw new Error('DevTools 端口未就绪');
}

function makeCdp(ws) {
  let nextId = 1;
  const pending = new Map();
  const logs = [];

  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
      return;
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      logs.push(`[exception] ${d.text} ${d.exception?.description?.split('\n')[0] || ''}`);
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      logs.push('[console.error] ' + (msg.params.args || []).map((a) => a.value || a.description || a.type).join(' '));
    }
    if (msg.method === 'Network.responseReceived' && msg.params.response.status >= 400) {
      logs.push(`[http ${msg.params.response.status}] ${msg.params.response.url}`);
    }
  };

  function send(method, params = {}) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async function evaluate(expr) {
    const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (res.exceptionDetails) return { __error: res.exceptionDetails.text };
    return res.result.value;
  }

  return { send, evaluate, logs };
}

const SNAP = `(function(){
  var b = document.body;
  var cs = getComputedStyle;
  var tabs = document.querySelector('.tabs');
  var tabsCS = tabs ? cs(tabs) : null;
  var panels = document.querySelector('.panels');
  var panelCS = panels ? cs(panels) : null;
  var row = document.querySelector('.table-wrap tbody tr');
  var navR = tabs ? tabs.getBoundingClientRect() : null;
  var firstBtn = document.querySelector('.tabs button');
  var btnR = firstBtn ? firstBtn.getBoundingClientRect() : null;
  var ta = document.querySelector('.panel textarea');
  return {
    mobileClass: b.classList.contains('mobile-app'),
    uiAttr: document.documentElement.getAttribute('data-ui'),
    themeColor: (document.querySelector('meta[name=theme-color]') || {}).content || null,
    navPosition: tabsCS ? tabsCS.position : null,
    navBottom: navR ? Math.round(window.innerHeight - navR.bottom) : null,
    navLeft: navR ? Math.round(navR.left) : null,
    navRight: navR ? Math.round(window.innerWidth - navR.right) : null,
    navHeight: navR ? Math.round(navR.height) : null,
    navScrollW: tabs ? tabs.scrollWidth : null,
    navClientW: tabs ? tabs.clientWidth : null,
    btnHeight: btnR ? Math.round(btnR.height) : null,
    panelsCols: panelCS ? panelCS.gridTemplateColumns : null,
    textareaHeight: ta ? Math.round(ta.getBoundingClientRect().height) : null,
    textareaFontSize: ta ? cs(ta).fontSize : null,
    rowDisplay: row ? cs(row).display : null,
    rowBorderRadius: row ? cs(row).borderRadius : null,
    theadDisplay: document.querySelector('.table-wrap thead') ? cs(document.querySelector('.table-wrap thead')).display : null,
    contentPadBottom: cs(document.querySelector('.content')).paddingBottom,
    fabBottom: (function(){
      var f = document.querySelector('.lc-fab');
      if (!f) return null;
      return Math.round(window.innerHeight - f.getBoundingClientRect().bottom);
    })(),
    innerWidth: window.innerWidth,
    docScrollWidth: document.documentElement.scrollWidth,
    horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
    wordCount: (b.innerText.match(/词库\\s*(\\d+)\\s*条/) || [])[1] || null,
  };
})()`;

async function shot(cdp, name) {
  const res = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(path.join(SHOT_DIR, name + '.png'), Buffer.from(res.data, 'base64'));
  console.log('  截图 →', path.relative(ROOT, path.join(SHOT_DIR, name + '.png')));
}

async function switchView(cdp, label) {
  return cdp.evaluate(`(function(){
    var btns = Array.from(document.querySelectorAll('.tabs button'));
    var b = btns.find(function(x){ return x.textContent.trim() === ${JSON.stringify(label)}; });
    if (!b) return 'not-found:' + btns.map(function(x){return x.textContent.trim();}).join('/');
    b.click();
    return 'ok';
  })()`);
}

/* 等应用真正就绪再测量。
 * 不能只 sleep(6000)：本地静态服务 1~2 秒就绪，但线上冷启动要 8~12 秒
 * （sql.js wasm + 1.39MB 持久化数据 + 云 SDK），固定等待会拍到还没挂载的
 * {{ }} 模板，把「页面正常」误判成「适配没生效」。 */
async function waitReady(cdp, timeoutMs = 45000) {
  const t0 = Date.now();
  let last = null;
  while (Date.now() - t0 < timeoutMs) {
    last = await cdp.evaluate(`(function(){
      var app = document.querySelector('#app');
      var tabs = document.querySelectorAll('.tabs button').length;
      return {
        vue: !!(app && app.__vue_app__),
        tabs: tabs,
        db: !!(window.linyuDb && window.linyuDb.getWords),
        mobile: document.body.classList.contains('mobile-app'),
        w: window.innerWidth,
      };
    })()`);
    if (last && last.vue && last.tabs >= 7 && last.db) return last;
    await sleep(700);
  }
  return last;
}

async function main() {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  const srv = REMOTE ? null : await serve();
  console.log(REMOTE ? '目标站点 ' + BASE : '静态服务 http://127.0.0.1:' + HTTP_PORT);

  const userDataDir = path.join(os.tmpdir(), 'linyu-mobile-' + Date.now());
  fs.mkdirSync(userDataDir, { recursive: true });

  const child = spawn(
    EDGE,
    [
      '--headless=new',
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      '--hide-scrollbars',
      'about:blank',
    ],
    { stdio: 'ignore', detached: false },
  );

  const results = {};
  try {
    await waitForDevtools();
    const created = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' });
    const target = await created.json();
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((res, rej) => {
      ws.onopen = res;
      ws.onerror = rej;
    });

    const cdp = makeCdp(ws);
    await cdp.send('Runtime.enable');
    await cdp.send('Network.enable');
    await cdp.send('Page.enable');

    /* ---------------- 1. 手机 UA + 视口 ---------------- */
    console.log('\n[1] 手机模拟 390×844 dpr3 / iPhone UA');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      mobile: true,
    });
    await cdp.send('Emulation.setUserAgentOverride', { userAgent: IPHONE_UA });
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });

    await cdp.send('Page.navigate', { url: BASE });
    console.log("  等待应用就绪…", JSON.stringify(await waitReady(cdp)));

    results.mobile = await cdp.evaluate(SNAP);
    console.log(JSON.stringify(results.mobile, null, 2));
    await shot(cdp, '01-translate');

    /* ---------------- 2. 逐页截图 ---------------- */
    console.log('\n[2] 逐页切换截图');
    for (const [label, file] of [
      ['词库', '02-words'],
      ['词卡', '03-cards'],
      ['人物传', '04-heroes'],
      ['名言', '05-quotes'],
      ['历史', '06-history'],
    ]) {
      const r = await switchView(cdp, label);
      if (r !== 'ok') {
        console.log('  切换失败', label, r);
        continue;
      }
      await sleep(900);
      await shot(cdp, file);
    }

    /* ---------------- 3. 设置抽屉 ---------------- */
    console.log('\n[3] 设置底部抽屉');
    await cdp.evaluate(`(function(){ var g=document.querySelector('.gear:last-of-type'); if(g) g.click(); return 1; })()`);
    await sleep(700);
    results.sheet = await cdp.evaluate(`(function(){
      var m = document.querySelector('.modal');
      if (!m) return { open: false };
      var cs = getComputedStyle(m);
      return {
        open: true,
        radius: cs.borderTopLeftRadius,
        maxHeight: cs.maxHeight,
        width: Math.round(m.getBoundingClientRect().width),
        bottomGap: Math.round(window.innerHeight - m.getBoundingClientRect().bottom),
        maskAlign: cs_(document.querySelector('.modal-mask')).alignItems,
      };
      function cs_(el){ return getComputedStyle(el); }
    })()`);
    console.log(JSON.stringify(results.sheet, null, 2));
    await shot(cdp, '07-settings-sheet');

    /* ---------------- 4. 桌面 UA 对照 ---------------- */
    console.log('\n[4] 桌面 UA 对照（应为桌面布局）');
    await cdp.send('Emulation.clearDeviceMetricsOverride');
    await cdp.send('Emulation.setUserAgentOverride', { userAgent: DESKTOP_UA });
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false });
    await cdp.send('Page.navigate', { url: BASE });
    console.log("  等待应用就绪…", JSON.stringify(await waitReady(cdp)));
    results.desktop = await cdp.evaluate(SNAP);
    console.log(JSON.stringify(results.desktop, null, 2));
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await sleep(600);
    await shot(cdp, '08-desktop-control');

    /* ---------------- 5. 经典粉紫主题（App 的标志性皮肤） ---------------- */
    console.log('\n[5] 经典粉紫主题');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
    await cdp.send('Emulation.setUserAgentOverride', { userAgent: IPHONE_UA });
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await cdp.send('Page.navigate', { url: WITH_MOBILE_FLAG });
    console.log("  等待应用就绪…", JSON.stringify(await waitReady(cdp)));

    const themed = await cdp.evaluate(`(function(){
      var g = document.querySelector('.gear:last-of-type');
      if (!g) return 'no-gear';
      g.click();
      var opts = Array.from(document.querySelectorAll('.theme-opt'));
      var pink = opts.find(function(o){ return o.textContent.indexOf('粉紫') >= 0; });
      if (!pink) return 'no-pink:' + opts.map(function(o){return o.textContent.trim();}).join('/');
      pink.click();
      return 'ok';
    })()`);
    console.log('  切换主题:', themed);
    await sleep(800);
    await cdp.evaluate(`(function(){ var c=document.querySelector('.modal-head .link'); if(c) c.click(); return 1; })()`);
    await sleep(600);
    results.pink = await cdp.evaluate(SNAP);
    await shot(cdp, '09-pink-translate');

    await switchView(cdp, '词库');
    await sleep(900);
    await shot(cdp, '10-pink-words');

    await switchView(cdp, '翻译');
    await sleep(600);
    await cdp.evaluate(`(function(){
      var ta = document.querySelector('.panel textarea');
      if (!ta) return 0;
      ta.value = '你今天真好看，我好开心！';
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      return 1;
    })()`);
    await sleep(400);
    await cdp.evaluate(`(function(){ var b=document.querySelector('.go'); if(b) b.click(); return 1; })()`);
    await sleep(1500);
    await shot(cdp, '11-pink-result');

    /* ---------------- 6. 断言 ---------------- */
    console.log('\n=== 断言 ===');
    const m = results.mobile;
    const d = results.desktop;
    const checks = [
      ['手机端挂上 mobile-app 类', m.mobileClass === true],
      ['底部导航 position:fixed', m.navPosition === 'fixed'],
      ['底部导航距屏幕底 10px（安全区外）', Math.abs(m.navBottom - 10) <= 1],
      ['底部导航左右各留 10px', Math.abs(m.navLeft - 10) <= 1 && Math.abs(m.navRight - 10) <= 1],
      ['导航按钮触控高度 ≥ 40px', m.btnHeight >= 40],
      ['翻译页双栏 → 单栏', !m.panelsCols.includes(' ') || m.panelsCols.split(' ').length === 1],
      ['输入框字号 16px（iOS 不缩放）', m.textareaFontSize === '16px'],
      ['词库表格行 display:block（卡片化）', m.rowDisplay === 'block'],
      ['表头隐藏', m.theadDisplay === 'none'],
      ['无横向溢出', m.horizontalOverflow <= 0],
      ['云悬浮球让开导航', m.fabBottom === null || m.fabBottom > m.navHeight + 10],
      ['设置变成底部抽屉（顶部圆角 22px）', String(results.sheet.radius).startsWith('22px')],
      ['设置抽屉贴底', Math.abs(results.sheet.bottomGap) <= 1],
      ['桌面 UA 不挂 mobile-app', d.mobileClass === false],
      ['桌面导航不是 fixed', d.navPosition !== 'fixed'],
      ['桌面仍是双栏', d.panelsCols.split(' ').length === 2],
      ['桌面表格仍是 table-row', d.rowDisplay === 'table-row'],
    ];

    let pass = 0;
    for (const [name, ok] of checks) {
      console.log(`  ${ok ? '✓' : '✗'} ${name}`);
      if (ok) pass++;
    }
    console.log(`\n  ${pass}/${checks.length} 通过`);

    if (cdp.logs.length) {
      console.log('\n=== 控制台 / 网络异常 ===');
      cdp.logs.slice(0, 40).forEach((l) => console.log('  ' + l));
    } else {
      console.log('\n=== 控制台 / 网络异常 ===\n  (无)');
    }

    ws.close();
    if (pass !== checks.length) process.exitCode = 1;
  } finally {
    try {
      child.kill();
    } catch {
      /* 已退出 */
    }
    if (srv) srv.close();
    await sleep(600);
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch {
      /* 占用中忽略 */
    }
  }
}

main().catch((err) => {
  console.error('probe-mobile 失败：', err.message);
  process.exitCode = 1;
});
