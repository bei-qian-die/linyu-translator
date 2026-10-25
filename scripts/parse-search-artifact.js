'use strict';
// 从 web_search 的 JSONL artifact 里抽出 {title, link, snippet} 与长 content。
// artifact 的 chunk 之间会切断 JSON 字符串，所以先把转义的 \n 还原成真换行再匹配。
const fs = require('fs');

const src = process.argv[2];
const outFile = process.argv[3] || null;
const raw = fs.readFileSync(src, 'utf8');

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
// artifact 里 \n 是转义序列，匹配前统一换回真换行，避免正则被反斜杠卡住
text = text.replace(/\\n/g, '\n').replace(/\\t/g, '\t');

function unesc(s) {
  return String(s)
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\\//g, '/')
    .replace(/\\"/g, '"');
}

const results = [];
const re =
  /"title"\s*:\s*"((?:[^"\\]|\\.)*)"[\s\S]{0,120}?"link"\s*:\s*"((?:[^"\\]|\\.)*)"[\s\S]{0,120}?"snippet"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
let m;
while ((m = re.exec(text))) {
  results.push({ title: unesc(m[1]), link: unesc(m[2]), snippet: unesc(m[3]) });
}

// 有些结果里 snippet 缺失，补一次只取 title+link 的扫描
if (!results.length) {
  const re2 = /"link"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  while ((m = re2.exec(text))) results.push({ title: '', link: unesc(m[1]), snippet: '' });
}

// 长正文：萌娘百科等整段内容
const contents = [];
const cre = /"content"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
while ((m = cre.exec(text))) {
  const c = unesc(m[1]);
  if (c.length > 200) contents.push(c);
}

const seen = new Set();
const uniq = [];
for (const r of results) {
  if (!r.link || seen.has(r.link)) continue;
  seen.add(r.link);
  uniq.push(r);
}

console.error(`results=${results.length} uniq=${uniq.length} contents=${contents.length}`);
if (outFile) {
  fs.writeFileSync(outFile, JSON.stringify({ results: uniq, contents }, null, 2), 'utf8');
  console.error(`-> ${outFile}`);
}
for (const r of uniq) {
  console.log(`* ${r.title}\n  ${r.link}\n  ${r.snippet.slice(0, 200)}\n`);
}
