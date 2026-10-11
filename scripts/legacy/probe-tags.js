'use strict';
// 探测：B站 tag 视频列表接口能不能免登录用（tag/info 已验证可用）
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
      return { NOTJSON: t.slice(0, 100) };
    }
  } catch (e) {
    return { NETERR: e.message };
  }
}

const TAGS = ['淋语', '淋神', '通讯录', '高等淋语', '洛克淋国', '王者淋耀', '英雄淋盟', '第五淋格', '姐圈', '淋淋'];

(async () => {
  for (const name of TAGS) {
    const info = await get('https://api.bilibili.com/x/tag/info?tag_name=' + encodeURIComponent(name));
    const id = info.data && info.data.tag_id;
    const use = info.data && info.data.count && info.data.count.use;
    console.log('tag', name, 'id=' + id, 'use=' + use, info.code !== 0 ? 'code=' + info.code : '');
    if (!id) continue;
    const list = await get(`https://api.bilibili.com/x/tag/archive/videos?tag_id=${id}&pn=1&ps=20`);
    const arr = list.data && list.data.archives;
    console.log('   archive/videos code=' + list.code, 'n=' + (arr ? arr.length : 0), arr && arr[0] ? String(arr[0].title).slice(0, 40) : JSON.stringify(list).slice(0, 120));
    await new Promise((r) => setTimeout(r, 700));
  }
})();
