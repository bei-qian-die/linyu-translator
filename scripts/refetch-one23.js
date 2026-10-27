// 单英雄定向重抓（baidu 图库），追加进 evidence/qc23-cand.json 并下载到 qc23-cand/<name>/
// 用法：node scripts/refetch-one23.js <name> <query>
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_JSON = path.join(ROOT, 'evidence', 'qc23-cand.json');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const BAD = /第五人格|identity v|无畏契约|valorant|瓦罗兰特|守望|王者荣耀|原神|明日方舟|三国|表情包|梗图|排行榜|强度|手绘|同人|绘画|教程|攻略|cos|真人|ai还原|ai生成|aigc/i;
const BAD_REAL = /手绘|同人|绘画|ai还原|ai生成|aigc|表情包|梗图|cos/i;
const ONLY = {
  无畏契约: /无畏契约|瓦罗兰特|valorant|立绘|皮肤|图鉴|头像|技能/i,
  第五人格: /第五人格|identity v|监管者|求生者|庄园|立绘|皮肤|头像|图鉴/i,
  守望: /守望先锋|overwatch|立绘|皮肤|图鉴|头像|英雄/i,
  原神: /原神|genshin|立绘|皮肤|图鉴|头像|角色/i,
  王者: /王者荣耀|王者|皮肤|立绘|图鉴|头像|英雄/i,
  英雄联盟: /英雄联盟|lol|皮肤|立绘|图鉴|头像/i,
  DOTA: /dota|刀塔|立绘|头像/i,
  星铁: /星穹铁道|崩坏|立绘|头像/i,
  阴阳师: /阴阳师|式神|立绘|头像/i,
  黎明杀机: /黎明杀机|杀鸡|dbd|立绘|头像/i,
  三角洲: /三角洲|delta/i,
  FGO: /fate|fgo|杀生院|立绘/i,
  平安京: /平安京|决战|射手|立绘/i,
  洛克: /洛克王国|宠物|图鉴|精灵/i,
};
const GAME_OF = (q) => {
  if (q.startsWith('无畏契约')) return '无畏契约';
  if (q.startsWith('第五人格')) return '第五人格';
  if (q.startsWith('守望先锋')) return '守望';
  if (q.startsWith('原神')) return '原神';
  if (q.startsWith('王者荣耀')) return '王者';
  if (q.startsWith('英雄联盟')) return '英雄联盟';
  if (q.startsWith('DOTA')) return 'DOTA';
  if (q.startsWith('星穹铁道') || q.startsWith('崩坏星穹铁道')) return '星铁';
  if (q.startsWith('阴阳师')) return '阴阳师';
  if (q.startsWith('黎明杀机')) return '黎明杀机';
  if (q.startsWith('三角洲')) return '三角洲';
  if (q.startsWith('FGO')) return 'FGO';
  if (q.startsWith('决战平安京')) return '平安京';
  if (q.startsWith('洛克王国')) return '洛克';
  return '真人';
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function grab(url, ref) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Referer: ref } });
    if (!r.ok) return null;
    return Buffer.from(await r.arrayBuffer());
  } catch { return null; }
}

function clean(s) {
  return String(s || '').replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
}

async function baiduCand(word, n = 8) {
  const u = 'https://image.baidu.com/search/acjson?tn=resultjson_com&ipn=rj&ct=201326592&is=&fp=result&word=' +
    encodeURIComponent(word) + '&pn=0&rn=40&gsm=1e';
  let j;
  try {
    const r = await fetch(u, { headers: { 'User-Agent': UA, Referer: 'https://image.baidu.com/' } });
    j = JSON.parse((await r.text()).replace(/[\u0000-\u001f]/g, ' '));
  } catch { return []; }
  const only = ONLY[GAME_OF(word)];
  const bad = GAME_OF(word) === '真人' ? BAD_REAL : BAD;
  const out = [];
  for (const x of (j.data || []).filter((v) => v && (v.middleURL || v.thumbURL))) {
    const title = clean(x.fromPageTitle || x.fromPageTitleEnc || '');
    if (bad.test(title)) continue;
    if (only && !only.test(title + ' ' + word)) continue;
    if (x.width && x.width < 300) continue;
    const buf = await grab(x.middleURL || x.thumbURL, 'https://image.baidu.com/');
    if (!buf) continue;
    out.push({ buf, url: x.middleURL || x.thumbURL, title: title.slice(0, 90), w: x.width || 0, h: x.height || 0, from: 'baidu' });
    if (out.length >= n) break;
    await sleep(80);
  }
  return out;
}

(async () => {
  const name = process.argv[2];
  const word = process.argv[3];
  if (!name || !word) { console.error('用法: node scripts/refetch-one23.js <name> <query>'); process.exit(1); }
  const j = JSON.parse(fs.readFileSync(OUT_JSON, 'utf8'));
  const it = j.items.find((x) => x.name === name);
  if (!it) { console.error('qc23-cand.json 中没有该名字:', name); process.exit(1); }
  const dir = path.join(ROOT, 'evidence', 'qc23-cand', name);
  fs.mkdirSync(dir, { recursive: true });
  const cands = await baiduCand(word, 8);
  if (!cands.length) { console.log(name, '0 结果'); return; }
  let next = 0;
  for (const f of fs.readdirSync(dir)) {
    const m = f.match(/^baidu_(\d+)\./);
    if (m) next = Math.max(next, +m[1] + 1);
  }
  const added = [];
  for (const c of cands) {
    const file = `baidu_${next}.jpg`;
    fs.writeFileSync(path.join(dir, file), c.buf);
    const rec = { url: c.url, title: c.title, from: 'baidu', file, w: c.w, h: c.h, good: false };
    it.cands.push(rec);
    added.push(rec);
    next++;
  }
  j.total = j.items.reduce((s, x) => s + x.cands.length, 0);
  fs.writeFileSync(OUT_JSON, JSON.stringify(j, null, 1));
  console.log(name, 'added', added.length, added.map((a) => a.file + '|' + a.title.slice(0, 40)).join('\n'));
})();
