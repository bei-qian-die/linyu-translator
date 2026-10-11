'use strict';
// 探测：1) 视频 tag 列表接口（用来判定"真的带淋语tag"）2) search 能否翻页
const HD = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
  Referer: 'https://www.bilibili.com/',
  Cookie: 'buvid3=1ABC2DEF-3456-7890-ABCD-EF012345678939623infoc',
};

async function get(url) {
  try {
    const r = await fetch(url, { headers: HD });
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
  const bv = process.argv[2] || 'BV1j37EzzEyx';
  const t = await get('https://api.bilibili.com/x/tag/archive/tags?bvid=' + bv);
  console.log('tags code=' + t.code, Array.isArray(t.data) ? t.data.map((x) => x.tag_name).join('|') : JSON.stringify(t).slice(0, 120));

  for (const pn of [2, 5]) {
    const s = await get(
      'https://api.bilibili.com/x/web-interface/search/type?search_type=video&page_size=30&keyword=' +
        encodeURIComponent('淋语') +
        '&page=' +
        pn
    );
    const n = s.data && s.data.result ? s.data.result.length : 0;
    console.log('search page' + pn, 'code=' + s.code, 'n=' + n, n ? String(s.data.result[0].title).replace(/<[^>]*>/g, '').slice(0, 40) : '');
  }
})();
