'use strict';
// 取 B 站「淋语」相关视频封面（用户允许的图片来源之一）。
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

(async () => {
  for (const kw of process.argv.slice(2)) {
    const u = `https://api.bilibili.com/x/web-interface/search/type?search_type=video&keyword=${encodeURIComponent(kw)}&page=1`;
    const r = await fetch(u, {
      headers: { 'User-Agent': UA, Referer: 'https://www.bilibili.com/', Cookie: 'buvid3=1ABC2DEF-3456-7890-ABCD-EF012345678939623infoc' },
    });
    const j = await r.json();
    const list = (j.data && j.data.result) || [];
    console.log('\n=== ' + kw + ' (' + list.length + ') ===');
    for (const v of list.slice(0, 8)) {
      const t = String(v.title || '').replace(/<[^>]+>/g, '');
      console.log(`  ${v.bvid}  ${t.slice(0, 60)}`);
      console.log(`     pic=${v.pic}`);
    }
  }
})();
