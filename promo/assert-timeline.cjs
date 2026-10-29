'use strict';
/* 时间轴断言：逐点检查"只有一个场景激活"且关键字幕可见 */
const { spawn } = require('child_process');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const HTML = path.resolve(__dirname, 'linyu-promo-30s.html');
const port = 9900 + Math.floor(Math.random() * 90);
const profile = path.join(os.tmpdir(), 'ly-assert-' + Date.now());

const browser = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
  '--remote-debugging-port=' + port, '--user-data-dir=' + profile,
  '--window-size=1080,1920', pathToFileURL(HTML).href,
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* [时间点, 期望场景, 期望可见的元素 id] */
const CASES = [
  [1200,  's1', ['hookQuote']],
  [2300,  's1', ['hookAsk']],
  [4200,  's2', ['cap2', 'typedText']],
  [9000,  's3', ['cap3', 'mark3']],
  [13000, 's4', ['cutA', 'numA', 'capA']],
  [13600, 's4', ['cutB', 'numB', 'capB']],
  [16200, 's4', ['cutC', 'numC', 'capC']],
  [20000, 's5', ['winCard', 'pmA', 'cap5']],
  [25000, 's6', ['privIcon', 'privTitle', 'privList']],
  [29500, 's7', ['logoHeart', 'logoName', 'logoUrl']],
];

(async () => {
  let tgt;
  for (let i = 0; i < 90 && !tgt; i += 1) {
    try {
      const list = await fetch('http://127.0.0.1:' + port + '/json/list').then((r) => r.json());
      tgt = list.find((it) => it.type === 'page' && it.url.includes('linyu-promo'));
    } catch {}
    if (!tgt) await sleep(150);
  }
  const ws = new WebSocket(tgt.webSocketDebuggerUrl);
  const pending = new Map();
  let seq = 0;
  const send = (method, params = {}) => {
    const id = ++seq;
    ws.send(JSON.stringify({ id, method, params }));
    return new Promise((res, rej) => pending.set(id, { res, rej }));
  };
  await new Promise((r) => ws.addEventListener('open', r));
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id); pending.delete(m.id);
      m.error ? rej(new Error(m.error.message)) : res(m.result);
    }
  });

  const errs = [];
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.method === 'Runtime.exceptionThrown') {
      errs.push(m.params.exceptionDetails.text + ' ' + (m.params.exceptionDetails.exception || {}).description);
    }
  });
  await send('Runtime.enable');
  await sleep(900);

  let bad = 0;
  for (const [t, want, ids] of CASES) {
    await send('Runtime.evaluate', { expression: `window.__seek(${t})` });
    await sleep(1500);   /* 等 CSS 入场动画（含 delay）播完再判定 */
    const res = await send('Runtime.evaluate', {
      expression: `(() => {
        const act = [...document.querySelectorAll('.scene.active')].map(n => n.id);
        const vis = ${JSON.stringify(ids)}.map(id => {
          const el = document.getElementById(id);
          if (!el) return [id, 'MISSING'];
          const cs = getComputedStyle(el);
          const op = parseFloat(cs.opacity);
          const r = el.getBoundingClientRect();
          return [id, op > 0.85 && r.width > 0 ? 'ok' : ('op=' + op + ' w=' + Math.round(r.width))];
        });
        return JSON.stringify({ act, vis });
      })()`, returnByValue: true,
    });
    const { act, vis } = JSON.parse(res.result.value);
    const sceneOk = act.length === 1 && act[0] === want;
    const visBad = vis.filter(([, st]) => st !== 'ok');
    if (!sceneOk || visBad.length) {
      bad += 1;
      console.log('FAIL', t + 'ms', '期望', want, '实际', act.join(',') || '(无)',
        visBad.length ? '元素异常:' + JSON.stringify(visBad) : '');
    } else {
      console.log('ok  ', t + 'ms', want, '单幕激活，元素齐全');
    }
  }

  if (errs.length) {
    console.log('--- 运行时异常 ---');
    errs.forEach((e) => console.log(e));
  }
  console.log(bad === 0 && errs.length === 0 ? '\n全部通过' : `\n存在 ${bad} 处问题`);
  browser.kill();
  process.exit(0);
})().catch((e) => { console.error('FAIL', e.message); browser.kill(); process.exit(1); });
