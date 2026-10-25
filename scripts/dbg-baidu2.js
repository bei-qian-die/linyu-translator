'use strict';
const fs = require('fs');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 试几种不同的百度查询写法，找出不会被拦、又能限定站点的那一种
const variants = [
  ['plain', (k) => `https://www.baidu.com/s?wd=${encodeURIComponent(k)}&rn=20`],
  ['pn', (k) => `https://www.baidu.com/s?wd=${encodeURIComponent(k)}&rn=20&pn=0`],
  ['ie', (k) => `https://www.baidu.com/s?ie=utf-8&wd=${encodeURIComponent(k)}&rn=20`],
  ['tn', (k) => `https://www.baidu.com/s?tn=baidulocal&wd=${encodeURIComponent(k)}&rn=20`],
  ['news', (k) => `https://www.baidu.com/s?tn=news&word=${encodeURIComponent(k)}&rn=20`],
];

(async () => {
  const kw = process.argv[2] || '淋语';
  for (const [name, mk] of variants) {
    const u = mk(kw);
    try {
      const r = await fetch(u, { headers: { 'User-Agent': UA, 'Accept-Language': 'zh-CN,zh;q=0.9', Cookie: 'BAIDUID=1ABC:FG=1' } });
      const t = await r.text();
      console.log(
        name,
        'status', r.status,
        'len', t.length,
        'h3', (t.match(/<h3/g) || []).length,
        'c-container', (t.match(/c-container/g) || []).length,
        'captcha', t.includes('安全验证')
      );
    } catch (e) {
      console.log(name, 'ERR', e.message);
    }
    await sleep(900);
  }
})();
