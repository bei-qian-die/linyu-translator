'use strict';
// 精准 harvest：先按关键词翻页搜，再用视频自己的 tag 列表判定它是不是真·淋语生态内容，
// 只有带目标 tag（或标题/UP 名含淋味特征）的视频才抓弹幕+评论，避免无关视频制造伪佐证。
const fs = require('fs');
const path = require('path');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const HD = { 'User-Agent': UA, Referer: 'https://www.bilibili.com/', Cookie: 'buvid3=1ABC2DEF-3456-7890-ABCD-EF012345678939623infoc' };
const ROOT = path.join(__dirname, '..', '..');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function json(url, tries) {
  for (let i = 0; i <= (tries || 1); i++) {
    try {
      const r = await fetch(url, { headers: HD });
      const t = await r.text();
      return JSON.parse(t);
    } catch {
      await sleep(1200 * (i + 1));
    }
  }
  return null;
}

async function text(url) {
  try {
    const r = await fetch(url, { headers: HD });
    return Buffer.from(await r.arrayBuffer()).toString('utf8');
  } catch {
    return '';
  }
}

function searchPage(keyword, page) {
  const u =
    'https://api.bilibili.com/x/web-interface/search/type?search_type=video&page_size=30&keyword=' +
    encodeURIComponent(keyword) +
    '&page=' +
    page;
  return json(u);
}

// 判定"属于淋语生态"：命中目标 tag，或标题/UP 名有淋味特征
const WANT_TAGS = new Set(
  (process.env.WANT || '淋语,淋神,淋淋,高等淋语,王者淋耀,英雄淋盟,第五淋格,洛克淋国,姐圈,通讯录,淋语教学,淋国,阴语')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
);
const TITLE_MARK = /(淋|阴语|阴婷|通讯录|姐圈|可人儿|本可|靴靴|噜|惹|厚|素惹|地才|舞娘|玫瑰|日不落|花蝴蝶|特务J|蔡依林|jolin)/i;

async function tagsOf(bvid) {
  const j = await json('https://api.bilibili.com/x/tag/archive/tags?bvid=' + encodeURIComponent(bvid));
  if (!j || j.code !== 0 || !Array.isArray(j.data)) return null;
  return j.data.map((x) => x.tag_name);
}

function parseDm(xml) {
  const out = [];
  const re = /<d p="[^"]*"[^>]*>([^<]*)<\/d>/g;
  let m;
  while ((m = re.exec(xml))) out.push(m[1]);
  return out
    .join('\n')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .split('\n');
}

async function pull(v, kw, tags, dmN, pages) {
  const lines = [];
  const vr = await json('https://api.bilibili.com/x/web-interface/view?bvid=' + v.bvid);
  if (!vr || vr.code !== 0) return lines;
  const d = vr.data;
  lines.push(`\n==== [${kw}] ${v.bvid} ${d.title} ==== up:${d.owner.name} play:${d.stat.view} like:${d.stat.like} tags:${tags.join('/')}`);
  if (d.desc && d.desc.trim()) lines.push('[desc] ' + d.desc.trim().replace(/\s+/g, ' ').slice(0, 500));
  const xml = await text('https://api.bilibili.com/x/v1/dm/list.so?oid=' + d.cid);
  if (xml) parseDm(xml).slice(0, dmN).forEach((x) => x.trim() && lines.push('[dm] ' + x.replace(/\s+/g, ' ')));
  for (let pn = 1; pn <= pages; pn++) {
    const rj = await json(`https://api.bilibili.com/x/v2/reply?type=1&oid=${d.aid}&sort=2&ps=20&pn=${pn}`);
    if (!rj || rj.code !== 0 || !rj.data || !rj.data.replies) break;
    for (const c of rj.data.replies) {
      lines.push('[cmt] ' + String(c.content.message).replace(/\s+/g, ' ').slice(0, 300));
      for (const s of (c.replies || []).slice(0, 3)) lines.push('[sub] ' + String(s.content.message).replace(/\s+/g, ' ').slice(0, 200));
    }
    await sleep(500);
  }
  return lines;
}

(async () => {
  const KEYWORDS = (process.env.KW || '淋语,淋神,淋淋 语录,高等淋语,王者淋耀,英雄淋盟,第五淋格,洛克淋国,姐圈 语录,通讯录 语音包,阴婷,可淋')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const PAGES = Number(process.env.PAGES || 3);
  const DM = Number(process.env.DM || 300);
  const RP = Number(process.env.RP || 2);
  const MAX = Number(process.env.MAX || 220);
  const OUT = process.env.OUT || 'corpus12.tagged.txt';
  const SEEN = path.join(ROOT, 'seen.json');

  const seen = new Set(fs.existsSync(SEEN) ? JSON.parse(fs.readFileSync(SEEN, 'utf8')) : []);
  const lines = [];
  let kept = 0;
  let scanned = 0;

  for (const kw of KEYWORDS) {
    if (kept >= MAX) break;
    for (let pn = 1; pn <= PAGES; pn++) {
      const j = await searchPage(kw, pn);
      if (!j || j.code !== 0 || !j.data || !j.data.result) {
        console.error(`:: ${kw} p${pn} code=${j && j.code} ${j && j.message}`);
        break;
      }
      const hits = j.data.result.filter((v) => v.bvid && !seen.has(v.bvid));
      console.error(`:: ${kw} p${pn} hits=${j.data.result.length} fresh=${hits.length} kept=${kept}`);
      for (const v of hits) {
        seen.add(v.bvid);
        scanned++;
        const title = String(v.title || '').replace(/<[^>]*>/g, '');
        const tags = await tagsOf(v.bvid);
        await sleep(320);
        const tagHit = tags && tags.some((t) => WANT_TAGS.has(String(t)));
        const titleHit = TITLE_MARK.test(title) || TITLE_MARK.test(String(v.author || ''));
        if (!tagHit && !titleHit) {
          if (process.env.DEBUG) console.error('  skip', v.bvid, JSON.stringify(title.slice(0, 40)), '| author=' + String(v.author || '').slice(0, 16), '| tags=' + (tags || []).join(','));
          continue;
        }

        const l = await pull({ bvid: v.bvid }, `${kw}${tagHit ? '+tag' : ''}`, tags || [], DM, RP);
        if (l.length > 2) {
          lines.push(...l);
          kept++;
          fs.writeFileSync(path.join(ROOT, OUT), lines.join('\n'), 'utf8');
          fs.writeFileSync(SEEN, JSON.stringify([...seen]));
          console.error('  KEEP', v.bvid, title.slice(0, 34), '| tags=' + (tags || []).join(','));
        }
        if (kept >= MAX) break;
      }
      await sleep(900);
    }
  }
  fs.writeFileSync(path.join(ROOT, OUT), lines.join('\n'), 'utf8');
  fs.writeFileSync(SEEN, JSON.stringify([...seen]));
  console.log('scanned', scanned, 'kept', kept, 'bytes', lines.join('\n').length, '->', OUT);
})();
