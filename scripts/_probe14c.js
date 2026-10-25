'use strict';
// 只读探针 14c：弹幕的几种取法谁还活着（输出纯 ASCII 计数）。
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const HD = { 'User-Agent': UA, Referer: 'https://www.bilibili.com/' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function t(url, label) {
  try {
    const r = await fetch(url, { headers: HD });
    const buf = Buffer.from(await r.arrayBuffer());
    const txt = buf.toString('utf8');
    console.log(
      label.padEnd(20),
      'http',
      r.status,
      'bytes',
      buf.length,
      'dmTags',
      (txt.match(/<d p=/g) || []).length,
      'head',
      JSON.stringify(txt.slice(0, 40))
    );
  } catch (e) {
    console.log(label.padEnd(20), 'ERR', String(e.message).slice(0, 50));
  }
}

(async () => {
  const v = await (await fetch('https://api.bilibili.com/x/web-interface/view?bvid=BV1zK4y1T7d3', { headers: HD })).json();
  const cid = v.data.cid;
  const aid = v.data.aid;
  console.log('cid', cid, 'aid', aid);
  await t('https://api.bilibili.com/x/v1/dm/list.so?oid=' + cid, 'api/list.so');
  await sleep(400);
  await t('https://comment.bilibili.com/' + cid + '.xml', 'comment.bilibili');
  await sleep(400);
  await t('https://api.bilibili.com/x/v2/dm/web_api/segment?type=1&oid=' + cid + '&proto=2', 'api/web_api/segment');
  await sleep(400);
  await t('https://api.bilibili.com/x/v2/dm/web/seg.so?type=1&oid=' + cid + '&segment_index=1', 'api/web/seg.so');
  await sleep(400);
  const rp = await (await fetch(`https://api.bilibili.com/x/v2/reply?type=1&oid=${aid}&sort=2&ps=20&pn=1`, { headers: HD })).json();
  console.log('reply code', rp.code, 'n', rp.data && rp.data.replies && rp.data.replies.length);
  await sleep(400);
  const sj = await (await fetch('https://api.bilibili.com/x/web-interface/search/type?search_type=video&keyword=%E6%B2%8C%E8%AF%AD&page=1', { headers: HD })).json();
  console.log('search code', sj.code, 'n', sj.data && sj.data.result && sj.data.result.length);
})();
