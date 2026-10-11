'use strict';
// 探测：相关视频 / 相关推荐 / UP主稿件 三个"顺着找同类视频"的接口能不能免登录用
const HD = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
  Referer: 'https://www.bilibili.com/',
  Cookie: 'buvid3=1ABC2DEF-3456-7890-ABCD-EF012345678939623infoc',
};
const BV = process.argv[2] || 'BV1RNSQYNEJA';

async function j(u) {
  try {
    const r = await fetch(u, { headers: HD });
    const t = await r.text();
    try {
      return JSON.parse(t);
    } catch {
      return { NOTJSON: t.slice(0, 60) };
    }
  } catch (e) {
    return { NETERR: e.message };
  }
}

(async () => {
  const a = await j('https://api.bilibili.com/x/web-interface/archive/related?bvid=' + BV);
  console.log('related code=' + a.code, 'n=' + (Array.isArray(a.data) ? a.data.length : 0), Array.isArray(a.data) && a.data[0] ? a.data[0].bvid + ' ' + a.data[0].title.slice(0, 30) : JSON.stringify(a).slice(0, 100));

  const view = await j('https://api.bilibili.com/x/web-interface/view?bvid=' + BV);
  const mid = view.data && view.data.owner.mid;
  console.log('owner mid', mid, view.data && view.data.owner.name);

  const s1 = await j(`https://api.bilibili.com/x/space/arc/search?mid=${mid}&ps=30&pn=1`);
  console.log('space/arc/search code=' + s1.code, s1.message, 'n=' + (s1.data && s1.data.list ? s1.data.list.vlist.length : 0));

  const s2 = await j(`https://api.bilibili.com/x/series/archives?mid=${mid}&series_id=0&ps=30`);
  console.log('series/archives code=' + s2.code, s2.message);

  const up = await j('https://api.bilibili.com/x/web-interface/dynamic/series/list?mid=' + mid);
  console.log('series/list code=' + up.code, up.message);
})();
