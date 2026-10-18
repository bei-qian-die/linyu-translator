'use strict';
/* 本地调试用：服务 www/，并在 /harness.html 上把假的 Capacitor 原生桥注入真实 index.html，
 * 用来在没有 Android 设备的情况下验证「脚本加载顺序 + 播种 + 落盘」这条链路。 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', 'www');
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
};
const STUB = fs.readFileSync(path.join(__dirname, 'cap-stub.js'), 'utf8');

function page(harness) {
  let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  if (harness) html = html.replace('<body>', '<body>\n<script>' + STUB + '</script>');
  return html;
}

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/harness.html') {
    res.writeHead(200, { 'Content-Type': types['.html'] });
    res.end(page(true));
    return;
  }
  if (url === '/_cap-stub.js') {
    res.writeHead(200, { 'Content-Type': types['.js'] });
    res.end(STUB);
    return;
  }
  if (url === '/fit.html') {
    res.writeHead(200, { 'Content-Type': types['.html'] });
    res.end(fs.readFileSync(path.join(__dirname, 'fit-harness.html'), 'utf8'));
    return;
  }
  const file = path.join(root, url === '/' ? 'index.html' : url);
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404).end('404'); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
}).listen(8787, () => console.log('serving www at http://127.0.0.1:8787  (harness: /harness.html)'));
