'use strict';

// 端到端验证真实 Electron 里的数据可靠性与新数据能力：
// 单实例锁、原子写、启动滚动备份、日志落盘、撤销、偏好持久化、体检、命中链路。
// 用独立 user-data-dir 启动，不碰真实库。
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const PORT = Number(process.env.PORT || 9346);
const PROFILE = path.join(os.tmpdir(), 'ly-e2e-data');
const APP_DIR = path.join(__dirname, '..');
const EXE = path.join(APP_DIR, 'node_modules', 'electron', 'dist', 'electron.exe');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// 偏好从 IPC 取回来是原始字符串（主进程才 JSON.parse），所以这里要自己解析，别把 JSON 文本当对象读
const BOUNDS_JS =
  '(async()=>{const p=await window.api.getPrefs();const r=p.data["win.bounds"];' +
  'if(!r)return "none";const b=JSON.parse(r);return b.width+"x"+b.height})()';

// 从外部真挪一次窗口：渲染层没有改窗口的入口，window.resizeBy 在 Electron 里被浏览器策略挡住，
// 只有 OS 级 MoveWindow 才会触发主进程的 resize/move，从而验证防抖落盘那条路。
// PowerShell 一律走临时 .ps1（命令行内联的引号会被 Windows argv 解析吃掉），并且带硬超时，绝不把 E2E 挂住。
function moveWindow(pid, x, y, w, h) {
  const ps1 = path.join(os.tmpdir(), 'ly-move-window.ps1');
  const body = [
    "$ErrorActionPreference='Stop'",
    'Add-Type -MemberDefinition @"',
    '[System.Runtime.InteropServices.DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr h,int x,int y,int w,int hh,bool r);',
    '"@ -Name U32 -Namespace Win32',
    '$h=[IntPtr]0',
    'for($i=0;$i -lt 20;$i++){',
    '  $p=Get-Process -Id $args[0] -ErrorAction SilentlyContinue',
    '  if($p -and $p.MainWindowHandle -ne [IntPtr]0){ $h=$p.MainWindowHandle; break }',
    '  Start-Sleep -Milliseconds 300',
    '}',
    'if($h -eq [IntPtr]0){ Write-Output "NOHANDLE"; exit 0 }',
    '$r=[Win32.U32]::MoveWindow($h,[int]$args[1],[int]$args[2],[int]$args[3],[int]$args[4],$true)',
    'Write-Output ("moved=" + $r)',
  ].join('\r\n');
  fs.writeFileSync(ps1, body, 'ascii');
  return new Promise((resolve) => {
    let out = '';
    let err = '';
    let done = false;
    const res = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1, String(pid), String(x), String(y), String(w), String(h)], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    res.stdout.on('data', (d) => (out += d));
    res.stderr.on('data', (d) => (err += d));
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      res.kill();
      resolve({ out: 'TIMEOUT ' + (out.trim() || err.trim()), err: '' });
    }, 15000);
    res.on('close', () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve({ out: out.trim() || 'PS-ERR ' + err.trim().replace(/\s+/g, ' ').slice(0, 160), err: '' });
    });
  });
}

function launch(extraArgs) {
  const child = spawn(
    EXE,
    ['.', `--user-data-dir=${PROFILE}`, `--remote-debugging-port=${PORT}`, '--no-sandbox'].concat(extraArgs || []),
    { cwd: APP_DIR, stdio: 'ignore' }
  );
  return child;
}

async function findPage() {
  for (let i = 0; i < 60; i++) {
    await sleep(500);
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await res.json();
      const page = list.find((t) => t.type === 'page' && t.url.includes('index.html'));
      if (page) return page;
    } catch {
      /* 调试端口还没起来 */
    }
  }
  throw new Error('连不上调试端口');
}

async function connect(page) {
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let mid = 0;
  const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  });
  function send(method, params) {
    const id = ++mid;
    return new Promise((resolve, reject) => {
      pending.set(id, (m) => (m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result)));
      ws.send(JSON.stringify({ id, method, params: params || {} }));
    });
  }
  async function js(body) {
    const r = await send('Runtime.evaluate', {
      expression: '(async () => { return (' + body + '); })();',
      awaitPromise: true,
      returnByValue: true,
    });
    if (r.exceptionDetails) {
      const ex = r.exceptionDetails.exception || {};
      return 'EX: ' + String(ex.description || r.exceptionDetails.text).slice(0, 200);
    }
    return r.result.value;
  }
  return { ws, send, js };
}

function waitForExit(child, ms) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    child.once('exit', (code) => {
      clearTimeout(timer);
      resolve(code);
    });
  });
}

async function main() {
  const out = {};
  fs.rmSync(PROFILE, { recursive: true, force: true });
  const dbFile = path.join(PROFILE, 'linyu.db');
  const logFile = path.join(PROFILE, 'logs', 'app.log');

  // ---- 第一轮：登录、撤销、偏好、体检、命中链路 ----
  let child = launch();
  const conn = await connect(await findPage());
  const { js, send, ws } = conn;
  await sleep(1200);

  out.version = await js('JSON.stringify((await window.api.meta()).data)');
  out.login = await js('(async()=>{const r=await window.api.login("linyu","linyu130");return r.ok})()');
  out.addProbe = await js('JSON.stringify(await window.api.addWord("可靠性试词","可靠性噜"))');
  const listWords = '(async()=>{const l=await window.api.listWords();return l.data.find(x=>x.zh==="可靠性试词").id})()';
  out.probeId = await js(listWords);
  out.deleteReturnsUndo = await js(`JSON.stringify(await window.api.deleteWord(${out.probeId}))`);
  out.undoState = await js('JSON.stringify(await window.api.undoState())');
  out.undo = await js('JSON.stringify(await window.api.undoDelete())');
  out.restored = await js('(async()=>{const l=await window.api.listWords();return Boolean(l.data.find(x=>x.zh==="可靠性试词"))})()');
  out.prefRoundtrip = await js('(async()=>{await window.api.setPref("ui.theme","black");const p=await window.api.getPrefs();return p.data["ui.theme"]})()');
  out.prefRejected = await js('JSON.stringify(await window.api.setPref("auth.passwordHash","x"))');
  out.inspect = await js('(async()=>{const r=await window.api.inspect();return JSON.stringify(r.data.totals)})()');
  out.traceOn = await js('(async()=>{const r=await window.api.translate("我很开心","normal");return JSON.stringify({dst:r.data.dst,trace:r.data.trace.length,unc:r.data.uncovered.length})})()');
  out.tracePreview = await js('(async()=>{const r=await window.api.translate("我很开心","preview");return JSON.stringify({dst:r.data.dst,preview:r.data.preview,trace:r.data.trace.length})})()');
  out.historyGrew = await js('(async()=>{const r=await window.api.listHistory();return r.data.length})()');
  out.limitClamped = await js('(async()=>{await window.api.setPref("history.limit",5);const r=await window.api.listHistory();return r.data.length})()');

  // ---- 窗口状态：改尺寸后防抖落盘（不依赖 close 事件，强杀也留得住） ----
  out.moveWindow = (await moveWindow(child.pid, 140, 120, 900, 700)).out || 'spawn-failed';
  await sleep(1800);
  out.geometrySaved = await js(BOUNDS_JS);

  const filesAfterRun1 = fs.readdirSync(PROFILE).filter((n) => n.startsWith('linyu.db'));
  out.filesRun1 = filesAfterRun1;
  out.tmpLeftovers = filesAfterRun1.filter((n) => n.endsWith('.tmp'));
  out.logExists = fs.existsSync(logFile);
  out.logHasEntries = out.logExists && fs.readFileSync(logFile, 'utf8').split('\n').filter(Boolean).length;

  // ---- 单实例锁：第二个进程必须自己退出，不能开新窗口 ----
  const second = launch();
  const secondCode = await waitForExit(second, 15000);
  out.secondInstanceExited = secondCode !== null;
  out.secondInstanceAlive = second.exitCode === null && second.signalCode === null;
  const pagesNow = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  out.pageCount = pagesNow.filter((t) => t.type === 'page').length;
  out.firstStillResponsive = await js('(async()=>{return (await window.api.listWords()).data.length})()');

  // ---- 正常关窗：窗口状态写进偏好，进程退出 ----
  await send('Runtime.evaluate', { expression: 'window.close()' });
  const exitCode = await waitForExit(child, 20000);
  out.gracefulExitCode = exitCode;
  ws.close();

  // ---- 第二轮：滚动备份 + 数据与偏好跨重启存活 ----
  await sleep(800);
  out.bakAfterRestart = fs.readdirSync(PROFILE).filter((n) => n.startsWith('linyu.db.'));
  child = launch();
  const c2 = await connect(await findPage());
  await sleep(1200);
  out.run2WordSurvived = await c2.js('(async()=>{const l=await window.api.listWords();return Boolean(l.data.find(x=>x.zh==="可靠性试词"))})()');
  out.run2Theme = await c2.js('(async()=>{const p=await window.api.getPrefs();return p.data["ui.theme"]})()');
  out.run2Bounds = await c2.js(BOUNDS_JS);
  out.boundsSurvived = /^\d+x\d+$/.test(out.run2Bounds) && out.run2Bounds === out.geometrySaved;
  out.run2UndoEmpty = await c2.js('JSON.stringify(await window.api.undoState())');
  out.run2Locked = await c2.js('(async()=>{return (await window.api.authStatus()).data.unlocked})()');
  out.run2Backups = await c2.js('JSON.stringify((await window.api.listBackups()).data.map(b=>b.name))');
  await c2.js('JSON.stringify(await window.api.login("linyu","linyu130"))');
  out.run2RestoreMissing = await c2.js('JSON.stringify(await window.api.restoreBackup("linyu.db.bak9"))');
  // 收尾自己关窗，别把带窗口的 electron 留在桌面上（用 send 而不是 js：js 会把内容包成表达式，多条语句会语法错）
  await c2.send('Runtime.evaluate', { expression: 'window.close()' });
  const run2Exit = await waitForExit(child, 20000);
  out.run2ExitCode = run2Exit === null ? 'stuck-killed' : run2Exit;
  if (child.exitCode === null && child.signalCode === null) child.kill();
  c2.ws.close();

  out.finalSize = fs.existsSync(dbFile) ? fs.statSync(dbFile).size : 0;
  out.filesRun2 = fs.readdirSync(PROFILE).filter((n) => n.startsWith('linyu.db'));
  console.log(JSON.stringify(out, null, 2));
}

main().catch((err) => {
  console.error('E2E 数据校验失败：' + err.message);
  process.exitCode = 1;
});
