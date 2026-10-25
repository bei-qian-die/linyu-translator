'use strict';
// 抓萌娘百科「淋语 / 淋文化 / 淋语化」词条正文——这是全网最系统的淋语词汇表。
// 萌娘百科有多个镜像站，逐个试；正文转成纯文本行，供后续挖词用。
const fs = require('fs');
const path = require('path');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const TARGETS = [
  ['淋语', 'https://moegirl.uk/index.php?title=%E6%B7%8B%E8%AF%AD'],
  ['淋语', 'https://zh.moegirl.tw/%E6%B7%8B%E5%AD%A6'],
  ['淋语', 'https://mzh.moegirl.tw/%E6%B7%8B%E8%AF%AD'],
  ['淋文化', 'https://moegirl.uk/index.php?title=%E6%B7%8B%E6%96%87%E5%8C%96'],
  ['淋文化', 'https://zh.moegirl.tw/%E6%B7%8B%E6%96%87%E5%8C%96'],
  ['淋语化', 'https://moegirl.uk/index.php?title=%E6%B7%8B%E8%AF%AD%E5%8C%96'],
  ['蔡依林', 'https://moegirl.uk/index.php?title=%E8%94%A1%E4%BE%9D%E6%9E%97'],
  ['通讯录', 'https://moegirl.uk/index.php?title=%E9%80%9A%E8%AE%AF%E5%BD%95'],
  ['蔡依林梗', 'https://moegirl.uk/index.php?title=%E8%94%A1%E4%BE%9D%E6%9E%97%E6%A2%97'],
  ['蔡依林黑称', 'https://moegirl.uk/index.php?title=%E8%94%A1%E4%BE%9D%E6%9E%97%E9%BB%91%E7%A7%B0'],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<sup[\s\S]*?<\/sup>/gi, '')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/\[\d+\]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

(async () => {
  const ROOT = process.cwd();
  const outDir = path.join(ROOT, 'corpus');
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const outFile = path.join(outDir, `corpus-moegirl-${stamp}.txt`);
  const all = [];
  const manifest = [];

  for (const [name, url] of TARGETS) {
    let html = '';
    let used = '';
    for (let a = 0; a < 3 && !html; a++) {
      try {
        const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'zh-CN,zh;q=0.9' } });
        const t = await r.text();
        if (r.status === 200 && t.length > 3000 && !t.includes('安全验证')) {
          html = t;
          used = url;
        } else {
          await sleep(1200 * (a + 1));
        }
      } catch {
        await sleep(1200);
      }
    }
    if (!html) {
      console.error(`[miss] ${name} ${url}`);
      continue;
    }
    const lines = stripTags(html);
    all.push(`【来源】${name}｜${used}`);
    all.push(...lines);
    manifest.push({ name, url: used, lines: lines.length });
    console.error(`[ok] ${name} ${lines.length} 行 ← ${used}`);
    await sleep(900);
  }

  fs.writeFileSync(outFile, all.join('\n') + '\n', 'utf8');
  fs.writeFileSync(
    path.join(ROOT, 'evidence', `manifest-moegirl-${stamp}.json`),
    JSON.stringify({ fetchedAt: new Date().toISOString(), targets: manifest }, null, 2),
    'utf8'
  );
  console.error(`\n[done] ${all.length} 行 -> corpus/corpus-moegirl-${stamp}.txt`);
})();
