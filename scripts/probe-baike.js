'use strict';
// 百度百科 OpenAPI 卡片：取摘要 + 官方图片（游戏英雄立绘首选来源）。
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function card(key) {
  const u =
    'https://baike.baidu.com/api/openapi/BaikeLemmaCardApi?scope=103&format=json&appid=379020&bk_key=' +
    encodeURIComponent(key) +
    '&bk_length=600';
  const r = await fetch(u, { headers: { 'User-Agent': UA } });
  const j = await r.json();
  return j;
}

(async () => {
  for (const k of process.argv.slice(2)) {
    try {
      const j = await card(k);
      const c = j.content || {};
      const pic = j.image || c.image || (j.picUrl ? { picUrl: j.picUrl } : null);
      console.log('\n=== ' + k + ' ===');
      console.log('  desc:', String(c.desc || j.desc || '').slice(0, 200));
      if (j.imageUrl) console.log('  imageUrl:', j.imageUrl);
      if (j.picUrl) console.log('  picUrl:', j.picUrl);
      if (pic && pic.picUrl) console.log('  cardPic:', pic.picUrl);
      if (j.url) console.log('  url:', j.url);
      if (j.lemmaId) console.log('  lemmaId:', j.lemmaId);
      console.log('  keys:', Object.keys(j).join(','));
    } catch (e) {
      console.log('\n=== ' + k + ' === [ERR] ' + e.message);
    }
  }
})();
