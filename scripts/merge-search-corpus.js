'use strict';
// 把 web_search 落盘的 artifact 全部解析成统一的语料行 + 出处清单。
//
// web_search 的每条 result 自带 title / link / snippet / content / source，
// content 里往往就是整篇帖子正文（NGA 楼层、贴吧楼层、百科正文、萌百正文）。
// 这里把每条 result 拆成：
//   【来源】平台｜标题｜链接
//   正文行（content 与 snippet 里的句子按行切）
// 供后续挖词脚本消费。
const fs = require('fs');
const path = require('path');

const ART_DIR = process.argv[2];
const OUT_CORPUS = process.argv[3] || path.join(process.cwd(), 'corpus', 'corpus-web-search.txt');
const OUT_MANIFEST = process.argv[4] || path.join(process.cwd(), 'evidence', 'manifest-web-search.json');

function unesc(s) {
  return String(s)
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\\//g, '/')
    .replace(/\\"/g, '"')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t');
}

function concatArtifact(raw) {
  let text = '';
  for (const ln of raw.split('\n').filter(Boolean)) {
    let o;
    try {
      o = JSON.parse(ln);
    } catch {
      continue;
    }
    if (o.type === 'chunk' && typeof o.text === 'string') text += o.text;
  }
  return text;
}

function parseArtifact(text) {
  const rows = [];
  // title/link/snippet/content 四件套可能顺序不同，所以分两轮抓
  const reLink = /"link"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  const reTitle = /"title"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  const reSnip = /"snippet"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  const reContent = /"content"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  const reSource = /"source"\s*:\s*"((?:[^"\\]|\\.)*)"/g;

  const links = [];
  let m;
  while ((m = reLink.exec(text))) links.push(unesc(m[1]));
  const titles = [];
  while ((m = reTitle.exec(text))) titles.push(unesc(m[1]));
  const snippets = [];
  while ((m = reSnip.exec(text))) snippets.push(unesc(m[1]));
  const contents = [];
  while ((m = reContent.exec(text))) contents.push(unesc(m[1]));
  const sources = [];
  while ((m = reSource.exec(text))) sources.push(unesc(m[1]));

  const n = Math.max(links.length, titles.length);
  for (let i = 0; i < n; i++) {
    rows.push({
      title: titles[i] || '',
      link: links[i] || '',
      snippet: snippets[i] || '',
      content: contents[i] || '',
      source: sources[i] || '',
    });
  }
  return rows;
}

function platformOf(url) {
  if (/tieba\.baidu\.com/.test(url)) return '百度贴吧';
  if (/nga/.test(url)) return 'NGA';
  if (/zhihu\.com/.test(url)) return '知乎';
  if (/douban\.com/.test(url)) return '豆瓣';
  if (/douyin\.com/.test(url)) return '抖音';
  if (/xiaohongshu/.test(url)) return '小红书';
  if (/bilibili\.com/.test(url)) return '哔哩哔哩';
  if (/moegirl/.test(url)) return '萌娘百科';
  if (/wikipedia/.test(url)) return '维基百科';
  if (/regengbaike/.test(url)) return '热梗百科';
  if (/weibo/.test(url)) return '微博';
  if (/pvp\.qq\.com/.test(url)) return '王者荣耀官网';
  if (/toutiao/.test(url)) return '今日头条';
  return '其他';
}

const files = fs.readdirSync(ART_DIR).filter((f) => f.endsWith('.readable.v1.jsonl'));
const allRows = [];
const seen = new Set();
for (const f of files) {
  const raw = fs.readFileSync(path.join(ART_DIR, f), 'utf8');
  const text = concatArtifact(raw);
  const rows = parseArtifact(text);
  for (const r of rows) {
    if (!r.link && !r.content) continue;
    const key = (r.link || '') + '|' + (r.title || '');
    if (seen.has(key)) continue;
    seen.add(key);
    r.platform = platformOf(r.link);
    r.artifact = f;
    allRows.push(r);
  }
}

// 输出语料：一行一条可挖的句子，带出处前缀
const lines = [];
const manifest = [];
for (const r of allRows) {
  const head = `【来源】${r.platform}｜${r.source || ''}｜${r.title}｜${r.link}`;
  lines.push(head);
  const body = String(r.content || r.snippet || '');
  const parts = body
    .split(/\n+/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s.length >= 2);
  for (const p of parts) lines.push(p);
  manifest.push({
    platform: r.platform,
    source: r.source,
    title: r.title,
    url: r.link,
    chars: body.length,
  });
}

fs.mkdirSync(path.dirname(OUT_CORPUS), { recursive: true });
fs.writeFileSync(OUT_CORPUS, lines.join('\n') + '\n', 'utf8');
fs.writeFileSync(OUT_MANIFEST, JSON.stringify({ fetchedAt: new Date().toISOString(), rows: manifest }, null, 2), 'utf8');

const byPlatform = {};
for (const r of manifest) byPlatform[r.platform] = (byPlatform[r.platform] || 0) + 1;
console.error(`[files] ${files.length}`);
console.error(`[rows] ${manifest.length}`);
console.error(`[lines] ${lines.length}`);
console.error('[platform] ' + JSON.stringify(byPlatform));
console.error(`-> ${OUT_CORPUS}`);
console.error(`-> ${OUT_MANIFEST}`);
