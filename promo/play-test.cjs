'use strict';
const { spawn } = require('child_process');
const os = require('os'); const path = require('path'); const { pathToFileURL } = require('url');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const HTML = path.resolve(__dirname, 'linyu-promo-30s.html');
const port = 9950 + Math.floor(Math.random() * 40);
const profile = path.join(os.tmpdir(), 'ly-play-' + Date.now());
const browser = spawn(EDGE, ['--headless=new','--disable-gpu','--hide-scrollbars','--no-first-run',
  '--autoplay-policy=no-user-gesture-required','--remote-debugging-port=' + port,
  '--user-data-dir=' + profile, '--window-size=1080,1920', pathToFileURL(HTML).href], { stdio:'ignore' });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  let tgt;
  for (let i=0;i<90&&!tgt;i++){ try{ const l=await fetch('http://127.0.0.1:'+port+'/json/list').then(r=>r.json());
    tgt=l.find(x=>x.type==='page'&&x.url.includes('linyu-promo')); }catch{} if(!tgt) await sleep(150); }
  const ws = new WebSocket(tgt.webSocketDebuggerUrl);
  const pending = new Map(); let seq=0;
  const send=(m,p={})=>{const id=++seq;ws.send(JSON.stringify({id,method:m,params:p}));
    return new Promise((res,rej)=>pending.set(id,{res,rej}));};
  await new Promise(r=>ws.addEventListener('open',r));
  const errs=[];
  ws.addEventListener('message',ev=>{const m=JSON.parse(ev.data);
    if(m.id&&pending.has(m.id)){const{res,rej}=pending.get(m.id);pending.delete(m.id);
      m.error?rej(new Error(m.error.message)):res(m.result);}
    if(m.method==='Runtime.exceptionThrown') errs.push((m.params.exceptionDetails.exception||{}).description
      || m.params.exceptionDetails.text);
    if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')
      errs.push('console.error: '+JSON.stringify(m.params.args.map(a=>a.value||a.description)));});
  await send('Runtime.enable'); await sleep(900);
  // 模拟点击起始门，走真实播放路径（含 3-2-1 倒计时）
  await send('Runtime.evaluate',{expression:"document.getElementById('gate').click()"});
  await sleep(2600+3000);
  const a = await send('Runtime.evaluate',{expression:
    "JSON.stringify({t:Math.round(t),playing:typeof playing!=='undefined'?playing:null,scene:activeScene,audio:!!(window.Audio&&1)})",
    returnByValue:true});
  console.log('播放 5.6s 后状态:', a.result.value);
  await sleep(6000);
  const b = await send('Runtime.evaluate',{expression:
    "JSON.stringify({t:Math.round(t),scene:activeScene,active:[...document.querySelectorAll('.scene.active')].map(n=>n.id)})",
    returnByValue:true});
  console.log('12s 后状态:', b.result.value);
  console.log(errs.length?('异常:\n'+errs.join('\n')):'无运行时异常');
  browser.kill(); process.exit(0);
})().catch(e=>{console.error('FAIL',e.message);browser.kill();process.exit(1);});
