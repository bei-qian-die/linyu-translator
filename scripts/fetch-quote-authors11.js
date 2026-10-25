'use strict';
// 为本轮要收录的名言抓取「评论作者」：调 B 站评论接口，按文本匹配回原评论的作者与 oid，
// 保证每条名言都能追到具体是谁发的、哪条楼。
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
  BV18h4y1r7vu: [
    '我要淋明杀鸡啊啊啊啊啊啊啊',
    '淋明杀鸡都这样啦',
    '素这样惹 因为受众群体不多收益也很低',
  ],
  BV1s4411K7Dd: [
    '猪头凤都被封杀惹还敢出来蹭热度',
    '我觉得凤凤和小阴应该角色换一下',
  ],
  BV1zK4y1T7d3: [
    '第一次给这样的大制作配阴厚',
    '“厚”明明可以用在句尾',
  ],
  BV18W411k7j8: ['解解珍素努力噜', '姐姐珍素努力惹'],
  BV1yiHa6WEVQ: ['赛淋真的是这么多游戏里淋味最强的噜'],
  BV1TfmNYREjN: ['把好多经典都杯糕化了', '每次看到杯糕视频都笑得想死'],
  BV1UBpk6dEFV: ['杯糕姐来反对了'],
  BV1QWpK68Eg3: ['引茎据典'],
};

async function view(bvid) {
  const r = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`, { headers: HDR });
  const j = await r.json();
  return j.data || {};
}

async function replies(oid, type = 1) {
  const all = [];
  let cursor = 0;
  for (let page = 0; page < 6; page++) {
    const u =
      `https://api.bilibili.com/x/v2/reply/main?oid=${oid}&type=${type}&mode=3&next=${cursor}`;
    const r = await fetch(u, { headers: HDR });
    const j = await r.json();
    const data = j.data || {};
    const list = data.replies || [];
    for (const rp of list) {
      all.push({
        author: (rp.member && rp.member.uname) || '',
        text: String(rp.content && rp.content.message ? rp.content.message : '').replace(/\s+/g, ' ').trim(),
        rpid: rp.rpid,
        mid: rp.mid,
      });
    }
    const cur = data.cursor || {};
    if (!list.length || cur.is_end) break;
    const next = cur.next;
    if (typeof next !== 'number' || next === cursor) break;
    cursor = next;
    await sleep(700);
  }
  return all;
}

(async () => {
  const out = {};
  for (const [bvid, snippets] of Object.entries(TARGETS)) {
    const info = await view(bvid);
    const oid = info.aid;
    const list = await replies(oid, 1);
    out[bvid] = { oid, title: info.title, up: info.owner && info.owner.name, replies: list.length };
    console.log(`\n=== ${bvid} ${info.title} (${list.length} 评论) ===`);
    for (const s of snippets) {
      const hit = list.find((x) => x.text.includes(s));
      console.log(
        hit
          ? `  ✔ ${s}\n     作者: ${hit.author}  rpid=${hit.rpid}`
          : `  ✘ ${s}  (未在评论里匹配到)`
      );
      if (hit) {
        hit.snippet = s;
        hit.author_found = hit.author;
      }
    }
    await sleep(600);
  }
  fs.writeFileSync(path.join(ROOT, 'evidence', 'quote-authors11.json'), JSON.stringify(out, null, 2), 'utf8');
})();
