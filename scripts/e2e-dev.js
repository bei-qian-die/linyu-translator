'use strict';

// 端到端验证真实 Electron 里的开发者模式门禁：
// 用独立 user-data-dir 启动应用，通过 CDP 在渲染层直接调用 window.api，
// 确认「未登录写操作被主进程拒绝 → 登录后可写 → 重启窗口后重新锁定」。
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const PORT = 9345;
const PROFILE = path.join(os.tmpdir(), 'ly-e2e-profile');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function targets() {
  const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
  return res.json();
}

async function main() {
  // KEEP=1 时保留上次的库，用来验证写入是否跨重启存活
  if (!process.env.KEEP) fs.rmSync(PROFILE, { recursive: true, force: true });
  const appDir = path.join(__dirname, '..');
  const child = spawn(
    path.join(appDir, 'node_modules', 'electron', 'dist', 'electron.exe'),
    ['.', `--user-data-dir=${PROFILE}`, `--remote-debugging-port=${PORT}`, '--no-sandbox'],
    { cwd: appDir, stdio: 'ignore' }
  );

  try {
    let page = null;
    for (let i = 0; i < 60 && !page; i++) {
      await sleep(500);
      try {
        const list = await targets();
        page = list.find((t) => t.type === 'page' && t.url.includes('index.html'));
      } catch {
        /* 调试端口还没起来 */
      }
    }
    if (!page) throw new Error('没能连上 Electron 调试端口');

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
      const expression = '(async () => { return (' + body + '); })();';
      const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) {
        const ex = r.exceptionDetails.exception || {};
        return 'EX: ' + String(ex.description || r.exceptionDetails.text).slice(0, 200);
      }
      return r.result.value;
    }

    await sleep(1500);
    const out = {};
    out.statusLocked = await js('JSON.stringify(await window.api.authStatus())');
    out.addWhileLocked = await js('JSON.stringify(await window.api.addWord("E2E词","E2E惹"))');
    out.listWhileLocked = await js('(async()=>{const r=await window.api.listWords();return r.ok+"/"+r.data.length})()');
    out.pickWhileLocked = await js('JSON.stringify(await window.api.pickImage())');
    out.badLogin = await js('JSON.stringify(await window.api.login("linyu","wrong"))');
    out.goodLogin = await js('JSON.stringify(await window.api.login("linyu","linyu130"))');
    out.addAfterLogin = await js('JSON.stringify(await window.api.addWord("E2E词","E2E惹"))');
    out.translateNew = await js('(async()=>{const r=await window.api.translate("E2E词测试");return r.data})()');
    out.dupAdd = await js('JSON.stringify(await window.api.addWord("E2E词","又一遍"))');
    out.rename = await js('(async()=>{const l=await window.api.listWords();const w=l.data.find(x=>x.zh==="E2E词");return JSON.stringify(await window.api.updateWord(w.id,"E2E噜","E2E词2"))})()');
    out.cardAdd = await js('JSON.stringify(await window.api.addCard({term:"E2E卡",meaning:"端到端验证",type:"meme",hero:"淋淋"}))');
    out.heroAdd = await js('JSON.stringify(await window.api.addHero({name:"E2E英雄",group:"up",tags:["a"],links:[{label:"l",url:"https://b.com"}]}))');
    out.quoteAdd = await js('JSON.stringify(await window.api.addQuote({text:"E2E名言",hero:"E2E英雄"}))');
    out.ruleAdd = await js('JSON.stringify(await window.api.addRule("E2E句式(.{1,3})","E2E$1噜","e2e"))');
    out.badRule = await js('JSON.stringify(await window.api.addRule("坏(???","x",""))');
    out.counts = await js('(async()=>{const w=await window.api.listWords();const c=await window.api.listCards();const h=await window.api.listHeroes();const q=await window.api.listQuotes();const r=await window.api.listRules();return [w.data.length,c.data.length,h.data.length,q.data.length,r.data.length].join("/")})()');
    out.logout = await js('JSON.stringify(await window.api.logout())');
    out.deleteAfterLogout = await js('(async()=>{const l=await window.api.listWords();const w=l.data.find(x=>x.zh==="E2E词2");return JSON.stringify(await window.api.deleteWord(w.id))})()');
    out.mediaBad = await js('JSON.stringify(await window.api.mediaData("media:../../evil.png"))');
    out.externalBad = await js('JSON.stringify(await window.api.openExternal("javascript:alert(1)"))');
    fs.writeFileSync(path.join(PROFILE, 'e2e.json'), JSON.stringify(out, null, 2));
    console.log(JSON.stringify(out, null, 2));
    ws.close();
  } finally {
    child.kill();
    for (let i = 0; i < 20; i++) {
      if (fs.existsSync(path.join(PROFILE, 'linyu.db'))) break;
      await sleep(300);
    }
  }

  const dbFile = path.join(PROFILE, 'linyu.db');
  console.log('\n库文件：' + dbFile + (fs.existsSync(dbFile) ? ' (' + fs.statSync(dbFile).size + ' B)' : ' 缺失'));
}

main().catch((err) => {
  console.error('E2E 失败：' + err.message);
  process.exitCode = 1;
});
