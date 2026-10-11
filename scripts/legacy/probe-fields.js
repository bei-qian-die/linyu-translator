'use strict';
const HD = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
  Referer: 'https://www.bilibili.com/',
  Cookie: 'buvid3=1ABC2DEF-3456-7890-ABCD-EF012345678939623infoc',
};
(async () => {
  const j = await (await fetch('https://api.bilibili.com/x/web-interface/search/type?search_type=video&page_size=30&keyword=' + encodeURIComponent('高等淋语') + '&page=1', { headers: HD })).json();
  const r = j.data.result[0];
  console.log('keys', Object.keys(r).join(','));
  console.log('bvid', r.bvid, 'title', JSON.stringify(r.title), 'author', r.author);
  const t = await (await fetch('https://api.bilibili.com/x/tag/archive/tags?bvid=' + r.bvid, { headers: HD })).json();
  console.log('tags code', t.code, Array.isArray(t.data) ? t.data.map((x) => x.tag_name).join('|') : JSON.stringify(t).slice(0, 150));
})();
