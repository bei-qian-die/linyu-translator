'use strict';
// 顺着"相关视频 + 同一UP主"两个图扩散抓语料：
// 关键词搜索翻到第 2 页往后基本是无关内容（实测），而淋语生态视频互相引用很强，
// 用 archive/related（免登录可用）从已知淋语视频出发扩散，再用视频自己的 tag 列表卡相关性。
const fs = require('fs');
const path = require('path');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const HD = { 'User-Agent': UA, Referer: 'https://www.bilibili.com/', Cookie: 'buvid3=1ABC2DEF-3456-7890-ABCD-EF012345678939623infoc' };
const ROOT = path.join(__dirname, '..', '..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function json(url) {
  for (let i = 0; i < 2; i++) {
    try {
      const r = await fetch(url, { headers: HD });
      return JSON.parse(await r.text());
    } catch {
      await sleep(1500 * (i + 1));
    }
  }
  return null;
}
async function raw(url) {
  try {
    const r = await fetch(url, { headers: HD });
    return Buffer.from(await r.arrayBuffer()).toString('utf8');
  } catch {
    return '';
  }
}

const WANT = new Set(
  (process.env.WANT || '淋语,淋神,淋淋,高等淋语,王者淋耀,英雄淋盟,第五淋格,洛克淋国,姐圈,通讯录,淋语教学,阴语,淋国,惹,噜,厚,靴靴')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
);
const MARK = /(淋|阴婷|阴后|通讯录|姐圈|可人儿|本可|靴靴|噜|惹$|厚$|地才|花蝴蝶|特务J|蔡依林|jolin|舞娘|日不落|玫瑰|锁姐|豪姐|肘姐)/i;

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

// 从已有语料的视频块头里挑种子：默认只要标题带"淋"的社区视频（官方MV的相关视频还是MV，扩散不出梗）
function deriveSeeds(max) {
  const explicit = (process.env.SEEDS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (explicit.length) return explicit.map((bvid) => ({ bvid, title: 'seed', play: 0 }));
  const files = fs.readdirSync(ROOT).filter((f) => /^corpus.*\.txt$/.test(f));
  const byPlay = new Map();
  const STRICT = process.env.SEED_STRICT === '1' ? /淋/ : MARK;
  for (const f of files) {
    const txt = fs.readFileSync(path.join(ROOT, f), 'utf8');
    for (const m of txt.matchAll(/^==== .*?(BV[0-9A-Za-z]{10}) ([^=]+) ====.*?play:(\d+)/gm)) {
      const title = m[2].trim();
      if (!STRICT.test(title)) continue;
      const play = Number(m[3]) || 0;
      if (!byPlay.has(m[1]) || byPlay.get(m[1]).play < play) byPlay.set(m[1], { bvid: m[1], title, play });
    }
  }
  return [...byPlay.values()].sort((a, b) => b.play - a.play).slice(0, max);
}

async function tagsOf(bvid) {
  const j = await json('https://api.bilibili.com/x/tag/archive/tags?bvid=' + encodeURIComponent(bvid));
  return j && j.code === 0 && Array.isArray(j.data) ? j.data.map((x) => x.tag_name) : null;
}

async function pull(d, from, tags, dmN, rpN) {
  const lines = [];
  lines.push(`\n==== [${from}] ${d.bvid} ${d.title} ==== up:${d.owner.name} play:${d.stat.view} like:${d.stat.like} tags:${(tags || []).join('/')}`);
  if (d.desc && d.desc.trim()) lines.push('[desc] ' + d.desc.trim().replace(/\s+/g, ' ').slice(0, 500));
  const xml = await raw('https://api.bilibili.com/x/v1/dm/list.so?oid=' + d.cid);
  if (xml) parseDm(xml).slice(0, dmN).forEach((x) => x.trim() && lines.push('[dm] ' + x.replace(/\s+/g, ' ')));
  for (let pn = 1; pn <= rpN; pn++) {
    const rj = await json(`https://api.bilibili.com/x/v2/reply?type=1&oid=${d.aid}&sort=2&ps=20&pn=${pn}`);
    if (!rj || rj.code !== 0 || !rj.data || !rj.data.replies || !rj.data.replies.length) break;
    for (const c of rj.data.replies) {
      lines.push('[cmt] ' + String(c.content.message).replace(/\s+/g, ' ').slice(0, 300));
      for (const s of (c.replies || []).slice(0, 3)) lines.push('[sub] ' + String(s.content.message).replace(/\s+/g, ' ').slice(0, 200));
    }
    await sleep(450);
  }
  return lines;
}

(async () => {
  const MAX = Number(process.env.MAX || 160);
  const DM = Number(process.env.DM || 260);
  const RP = Number(process.env.RP || 2);
  const SEEDN = Number(process.env.SEEDN || 26);
  const DEPTH = Number(process.env.DEPTH || 2);
  const OUT = process.env.OUT || 'corpus12.graph.txt';
  const SEEN_F = path.join(ROOT, 'seen.json');

  const seen = new Set(fs.existsSync(SEEN_F) ? JSON.parse(fs.readFileSync(SEEN_F, 'utf8')) : []);
  const lines = [];
  let kept = 0;
  const authors = new Map();

  const flush = () => {
    fs.writeFileSync(path.join(ROOT, OUT), lines.join('\n'), 'utf8');
    fs.writeFileSync(SEEN_F, JSON.stringify([...seen]));
  };

  const seedList = deriveSeeds(SEEDN);
  console.error('seeds', seedList.length, seedList.slice(0, 3).map((s) => s.bvid + ':' + s.title.slice(0, 16)).join(' | '));

  let frontier = seedList.map((s) => s.bvid);
  const visited = new Set(frontier);

  for (let depth = 1; depth <= DEPTH && kept < MAX; depth++) {
    const next = [];
    for (const bv of frontier) {
      if (kept >= MAX) break;
      const rel = await json('https://api.bilibili.com/x/web-interface/archive/related?bvid=' + bv);
      if (!rel || rel.code !== 0 || !Array.isArray(rel.data)) continue;
      for (const item of rel.data) {
        if (kept >= MAX) break;
        const cand = item.bvid;
        if (!cand || visited.has(cand)) continue;
        visited.add(cand);
        seen.add(cand);
        const title = String(item.title || '');
        const tagHit = MARK.test(title);
        const tags = tagHit ? null : await tagsOf(cand);
        if (!tags) await sleep(220);
        const wantTag = (tags || []).some((t) => WANT.has(String(t)));
        if (!tagHit && !wantTag) continue;
        const vr = await json('https://api.bilibili.com/x/web-interface/view?bvid=' + cand);
        if (!vr || vr.code !== 0) continue;
        const d = vr.data;
        const l = await pull(d, 'graph-d' + depth + (wantTag ? '+tag' : ''), tags || (tagHit ? ['标题命中'] : []), DM, RP);
        if (l.length > 3) {
          lines.push(...l);
          kept++;
          flush();
          console.error('KEEP', kept, cand, title.slice(0, 32));
          authors.set(d.owner.name, (authors.get(d.owner.name) || 0) + 1);
          if (depth < DEPTH) next.push(cand);
        }
        await sleep(600);
      }
    }
    frontier = next;
    console.error(`-- depth ${depth} done, kept=${kept}, next frontier=${next.length}`);
  }

  // 同一UP主扩散：出现 2 次以上的淋语UP，用搜索接口把他们其他稿件也捞一遍（搜索返回里按 author 精确过滤）
  const TOP = [...authors.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, Number(process.env.UPS || 12));
  console.error('authors to expand:', TOP.map(([n, c]) => n + '(' + c + ')').join(', '));
  for (const [name] of TOP) {
    if (kept >= MAX * 1.4) break;
    const sj = await json('https://api.bilibili.com/x/web-interface/search/type?search_type=video&page_size=30&keyword=' + encodeURIComponent(name) + '&page=1');
    if (!sj || sj.code !== 0 || !sj.data || !sj.data.result) continue;
    for (const v of sj.data.result) {
      if (kept >= MAX * 1.4) break;
      if (String(v.author || '') !== name || !v.bvid || visited.has(v.bvid)) continue;
      visited.add(v.bvid);
      seen.add(v.bvid);
      const tags = await tagsOf(v.bvid);
      await sleep(250);
      const title = String(v.title || '').replace(/<[^>]*>/g, '');
      if (!(MARK.test(title) || (tags || []).some((t) => WANT.has(String(t))))) continue;
      const vr = await json('https://api.bilibili.com/x/web-interface/view?bvid=' + v.bvid);
      if (!vr || vr.code !== 0) continue;
      const l = await pull(vr.data, 'up:' + name, tags || [], DM, RP);
      if (l.length > 3) {
        lines.push(...l);
        kept++;
        flush();
        console.error('KEEP-up', kept, v.bvid, title.slice(0, 30));
      }
      await sleep(600);
    }
  }

  flush();
  fs.writeFileSync(path.join(ROOT, 'harvest-authors.json'), JSON.stringify([...authors.entries()].sort((a, b) => b[1] - a[1]), null, 1), 'utf8');
  console.log('kept', kept, 'videos,', lines.join('\n').length, 'bytes ->', OUT);
})();
