'use strict';
// 拉取百度百科开放接口里与淋语相关的词条正文，作为可引用的 verify 来源。
// 只用公开接口，不带任何凭据；抓到的正文落盘成证据文件，可逐字回查。
const fs = require('fs');
const path = require('path');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const OUT = path.join(process.cwd(), 'evidence');
fs.mkdirSync(OUT, { recursive: true });

const KEYS = ['淋语', '淋文化', '蔡依林', '网络用语', '谐音梗', '咯咯咯', '你币有了', '耶啵', '蚂蚁辣么', '剥注', 'nea', '只因你太美'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const strip = (s) => String(s || '')
  .replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#\d+;/g, ' ');

(async () => {
  const saved = [];
  for (const key of KEYS) {
    const u = `https://baike.baidu.com/api/openapi/BaikeLemmaCardApi?scope=103&format=json&appid=379020&bk_key=${encodeURIComponent(key)}&bk_length=12000`;
    let j = null;
    for (let a = 0; a < 3 && !j; a++) {
      try { j = await (await fetch(u, { headers: { 'User-Agent': UA } })).json(); } catch { await sleep(1200); }
    }
    if (!j || !j.key) { console.error(`[miss] ${key}`); continue; }
    const body = [];
    body.push(`# 百度百科词条《${j.key}》`);
    body.push(`# lemmaId ${j.id}  url https://baike.baidu.com/item/${encodeURIComponent(j.key)}/${j.newLemmaId || j.id}`);
    body.push(`# 抓取时间 ${new Date().toISOString()}  来源：百度百科开放接口 BaikeLemmaCardApi（公开，无需凭据）`);
    body.push(`摘要：${strip(j.desc || '')}`);
    for (const c of j.card || []) {
      const vals = (c.value || []).map((v) => strip(v)).filter(Boolean);
      if (vals.length) body.push(`${c.name}：${vals.join(' | ')}`);
    }
    if (j.content) body.push(strip(j.content));
    const file = path.join(OUT, `baike-${key.replace(/[\\/:*?"<>|]/g, '_')}.txt`);
    fs.writeFileSync(file, body.join('\n'), 'utf8');
    saved.push({ key, id: j.id, chars: body.join('\n').length, file: path.basename(file) });
    console.error(`[ok] ${key}  id=${j.id}  ${(body.join('\n').length / 1024).toFixed(1)} KB`);
    await sleep(800);
  }
  fs.writeFileSync(path.join(OUT, 'baike-index.json'), JSON.stringify({ fetchedAt: new Date().toISOString(), items: saved }, null, 2), 'utf8');
  console.error(`\n[done] ${saved.length} 个词条`);
})();
