'use strict';
// 部分视频用 /x/v2/reply/main（mode=3 热门）取不全评论，改走老接口 /x/v2/reply 按 pn 翻页。
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const HDR = {
  'User-Agent': UA,
  Referer: 'https://www.bilibili.com/',
  Cookie: 'buvid3=1ABC2DEF-3456-7890-ABCD-EF012345678939623infoc',
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const TARGETS = {
  BV18h4y1r7vu: ['我要淋明杀鸡啊啊啊啊啊啊啊', '淋明杀鸡都这样啦', '素这样惹 因为受众群体不多收益也很低'],
  BV1mRJa6WEHJ: ['本可岁月静好'],
};

(async () => {
  const out = {};
  for (const [bvid, snippets] of Object.entries(TARGETS)) {
    const info = await (
      await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`, { headers: HDR })
    ).json();
    const oid = info.data.aid;
    const list = [];
    for (let pn = 1; pn <= 8; pn++) {
      const u = `https://api.bilibili.com/x/v2/reply?type=1&oid=${oid}&pn=${pn}&ps=20&sort=2`;
      const j = await (await fetch(u, { headers: HDR })).json();
      const data = j.data || {};
      const replies = data.replies || [];
      for (const rp of replies) {
        list.push({
          author: (rp.member && rp.member.uname) || '',
          text: String(rp.content && rp.content.message ? rp.content.message : '')
            .replace(/\s+/g, ' ')
            .trim(),
          rpid: rp.rpid,
        });
      }
      const page = data.page || {};
      if (!replies.length || (page.count && list.length >= page.count)) break;
      await sleep(600);
    }
    console.log(`\n=== ${bvid} ${info.data.title} (${list.length} 评论) ===`);
    for (const s of snippets) {
      const hit = list.find((x) => x.text.includes(s));
      console.log(hit ? `  ✔ ${s}\n     作者: ${hit.author} rpid=${hit.rpid}` : `  ✘ ${s}`);
    }
    out[bvid] = { oid, title: info.data.title, up: info.data.owner && info.data.owner.name, replies: list };
    await sleep(600);
  }
  fs.writeFileSync(path.join(ROOT, 'evidence', 'quote-authors11b.json'), JSON.stringify(out, null, 2), 'utf8');
})();
