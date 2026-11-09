// 从百度百科移动端词条页的「图集」（index_imageItem）批量取图，用于给主图不合格的角色挑更好的官方图。
// 用法: node scripts/fetch-baike-gallery.mjs 坚果墙 磁力菇 ...
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT_DIR = path.join(ROOT, 'evidence/pvz-baike-gallery');
const UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';

const names = process.argv.slice(2);
if (!names.length) {
  console.log('用法: node scripts/fetch-baike-gallery.mjs 坚果墙 磁力菇');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function sniff(buf) {
  if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50) return 'png';
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8) return 'jpg';
  return '';
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const report = [];
for (const name of names) {
  const url = 'https://wapbaike.baidu.com/item/' + encodeURIComponent(name);
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) {
    console.log(name, 'http', r.status);
    continue;
  }
  const html = await r.text();
  const urls = [...new Set((html.match(/https:\/\/bkimg\.cdn\.bcebos\.com\/[^"?]+/g) || []))].slice(0, 8);
  console.log(name, '图集', urls.length, '张');
  let i = 0;
  for (const u of urls) {
    try {
      const img = await fetch(u, { headers: { 'User-Agent': UA, Referer: 'https://baike.baidu.com/' } });
      const buf = Buffer.from(await img.arrayBuffer());
      const kind = sniff(buf);
      if (!kind || buf.length < 8000) continue;
      const file = `${name}-${i}.${kind}`;
      fs.writeFileSync(path.join(OUT_DIR, file), buf);
      report.push({ name, file, src: u, bytes: buf.length });
      i++;
      console.log('  ok', file, Math.round(buf.length / 1024) + 'KB');
    } catch {
      /* ignore */
    }
    await sleep(350);
  }
}

fs.writeFileSync(
  path.join(ROOT, 'evidence/pvz-baike-gallery.json'),
  JSON.stringify({ harvestedAt: new Date().toISOString(), report }, null, 1),
  'utf8'
);
console.log('合计', report.length);
