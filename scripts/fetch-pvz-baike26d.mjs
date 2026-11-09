// 土豆雷：百度词条「土豆地雷」没有 index_abstractImg，但有图集（index_imageItem），取首图。
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT_DIR = path.join(ROOT, 'evidence/pvz-baike26');
const UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';

const r = await fetch('https://wapbaike.baidu.com/item/' + encodeURIComponent('土豆地雷'), {
  headers: { 'User-Agent': UA },
});
const html = await r.text();
const m = html.match(/class="index_imageItem__[^"]*"[^>]*src="([^"]+)"/);
if (!m) {
  console.log('未找到图集首图');
  process.exit(1);
}
const src = m[1].split('?')[0].replace(/&amp;/g, '&');
const img = await fetch(src, { headers: { 'User-Agent': UA, Referer: 'https://baike.baidu.com/' } });
const buf = Buffer.from(await img.arrayBuffer());
const kind = buf[0] === 0x89 ? 'png' : 'jpg';
fs.writeFileSync(path.join(OUT_DIR, `土豆雷.${kind}`), buf);
console.log('土豆雷 ✓', Math.round(buf.length / 1024) + 'KB', src);
fs.writeFileSync(
  path.join(ROOT, 'evidence/pvz-baike26d.json'),
  JSON.stringify({ name: '土豆雷', lemma: '土豆地雷', src, page: 'https://wapbaike.baidu.com/item/' + encodeURIComponent('土豆地雷'), file: `土豆雷.${kind}` }, null, 1)
);
