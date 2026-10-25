'use strict';
// 探针：看百度图库对某个词的候选图，用来人工挑「确实是本人/该角色」的图。
// 用法: node scripts/probe-baidu-img.js "王者荣耀 李华 官方立绘"
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

(async () => {
  const word = process.argv[2] || 'test';
  const u =
    'https://image.baidu.com/search/acjson?tn=resultjson_com&ipn=rj&ct=201326592&is=&fp=result&word=' +
    encodeURIComponent(word) +
    '&pn=0&rn=20&gsm=1e';
  const r = await fetch(u, { headers: { 'User-Agent': UA, Referer: 'https://image.baidu.com/' } });
  const j = await r.json();
  const list = (j.data || []).filter((x) => x && x.thumbURL);
  console.log('count', list.length);
  list.forEach((x, i) => {
    console.log(
      `${i}. ${String(x.fromPageTitleEnc || x.fromPageTitle || '').replace(/\s+/g, ' ').slice(0, 70)}\n   ${(x.middleURL || x.thumbURL).slice(0, 110)}`
    );
  });
})();
