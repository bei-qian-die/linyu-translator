'use strict';
// 批量打印百度图库候选，供人工挑选（不下载）。
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const HD = { 'User-Agent': UA, Referer: 'https://image.baidu.com/' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const QUERIES = process.argv.slice(2);

async function grab(word) {
  const u =
    'https://image.baidu.com/search/acjson?tn=resultjson_com&ipn=rj&ct=201326592&is=&fp=result&word=' +
    encodeURIComponent(word) +
    '&pn=0&rn=20&gsm=1e';
  const r = await fetch(u, { headers: HD });
  const j = await r.json();
  return (j.data || []).filter((x) => x && x.thumbURL);
}

(async () => {
  for (const q of QUERIES) {
    console.log('\n========== ' + q + ' ==========');
    let list;
    try {
      list = await grab(q);
    } catch (e) {
      console.log('  [ERR] ' + e.message);
      continue;
    }
    list.slice(0, 12).forEach((x, i) => {
      const t = String(x.fromPageTitleEnc || x.fromPageTitle || '').replace(/\s+/g, ' ').trim();
      console.log(
        `  [${i}] ${x.width}x${x.height} ${t.slice(0, 70)}\n       ${String(x.middleURL || x.thumbURL).slice(0, 120)}`
      );
    });
    await sleep(800);
  }
})();
