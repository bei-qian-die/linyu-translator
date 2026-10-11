'use strict';
const fs = require('fs');
const BVS = process.argv.slice(2);
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36';
async function get(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Referer: 'https://www.bilibili.com/' } });
  return r;
}
function parseXmlText(xml) {
  const out = [];
  const re = /<d p="([^"]*)"[^>]*>([^<]*)<\/d>/g;
  let m;
  while ((m = re.exec(xml))) out.push(m[2]);
  return out;
}
function xmlUnesc(s) {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}
(async () => {
  const lines = [];
  for (const bv of BVS) {
    try {
      const vr = await get(`https://api.bilibili.com/x/web-interface/view?bvid=${bv}`);
      const vj = await vr.json();
      if (vj.code !== 0) { console.error(bv, 'view fail', vj.code); continue; }
      const { aid, cid, title, desc, stat } = vj.data;
      lines.push(`\n==== ${bv} ${title} ====`);
      if (desc && desc.trim()) lines.push('[desc] ' + desc.trim().replace(/\n/g, ' '));
      // danmaku
      try {
        const dr = await get(`https://api.bilibili.com/x/v1/dm/list.so?oid=${cid}`);
        const buf = Buffer.from(await dr.arrayBuffer());
        const xml = buf.toString('utf8');
        const dms = parseXmlText(xml).map(xmlUnesc);
        dms.slice(0, 300).forEach((d) => lines.push('[dm] ' + d));
      } catch (e) { console.error(bv, 'dm fail', e.message); }
      // replies (2 pages x 20)
      for (const pn of [1, 2]) {
        try {
          const rr = await get(`https://api.bilibili.com/x/v2/reply?type=1&oid=${aid}&sort=2&ps=20&pn=${pn}`);
          const rj = await rr.json();
          if (rj.code === 0 && rj.data && rj.data.replies) {
            for (const c of rj.data.replies) lines.push('[cmt] ' + c.content.message.replace(/\n/g, ' '));
          }
        } catch (e) { console.error(bv, 'reply fail', e.message); }
        await new Promise((r) => setTimeout(r, 400));
      }
      console.error(bv, 'ok', title.slice(0, 30));
      await new Promise((r) => setTimeout(r, 400));
    } catch (e) { console.error(bv, 'FAIL', e.message); }
  }
  fs.writeFileSync(process.env.OUT || 'corpus3.txt', lines.join('\n'), 'utf8');
  console.log('lines:', lines.length);
})();
