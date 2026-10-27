'use strict';

// 第二十四轮：给「淋安京」系列的 25 个视频补两类更密的语料——
//   1) 弹幕：/x/v1/dm/list.so?oid=cid（公开 XML，无需 Cookie）
//   2) 全量评论：/x/v2/reply/main 翻到第 N 页（默认 6 页 ≈ 120 条/视频）
// 标题本身是淋语成句，弹幕与评论区才是真正的高频口语，两者合起来才够抽样。
//
// 用法: node scripts/harvest-dm24.js [bvid 清单 json] [评论页数]
const fs = require('fs');
const path = require('path');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const ROOT = path.join(__dirname, '..');
const LIST_FILE = path.join(ROOT, process.argv[2] || 'evidence/ow-bvids.json');
const COMMENT_PAGES = Number(process.argv[3] || 6);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stripTags = (s) => String(s || '').replace(/<[^>]+>/g, '');

async function get(url, referer, json = true) {
  for (let a = 0; a < 3; a++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, Referer: referer || 'https://www.bilibili.com/' } });
      if (r.status === 412 || r.status === 429) {
        await sleep(6000 * (a + 1));
        continue;
      }
      return json ? await r.json() : await r.text();
    } catch (e) {
      await sleep(2000 * (a + 1));
    }
  }
  return null;
}

(async () => {
  const list = JSON.parse(fs.readFileSync(LIST_FILE, 'utf8'));
  const out = [];
  const manifest = [];
  let dms = 0;
  let comments = 0;

  for (let i = 0; i < list.length; i++) {
    const bvid = list[i].bvid;
    const ref = `https://www.bilibili.com/video/${bvid}`;
    const vj = await get(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`, ref);
    const d = vj && vj.data;
    if (!d) {
      console.error(`[skip] ${bvid} 元信息取不到`);
      await sleep(1500);
      continue;
    }
    out.push(`【视频】${stripTags(d.title)}`);
    if (d.owner && d.owner.name) out.push(`【UP】${d.owner.name}`);
    if (d.desc) out.push(`【简介】${String(d.desc).trim()}`);

    // ---- 弹幕 ----
    const xml = await get(`https://api.bilibili.com/x/v1/dm/list.so?oid=${d.cid}`, ref, false);
    let n = 0;
    if (xml) {
      const re = /<d p="[^"]*"[^>]*>([^<]+)<\/d>/g;
      let m;
      const seenDm = new Set();
      while ((m = re.exec(xml)) !== null) {
        const t = String(m[1]).trim();
        if (t.length < 2 || seenDm.has(t)) continue;
        seenDm.add(t);
        out.push(`【弹幕】${t}`);
        n++;
      }
    }
    dms += n;

    // ---- 评论（多页） ----
    const seenC = new Set();
    let c = 0;
    for (let p = 0; p < COMMENT_PAGES; p++) {
      const cj = await get(`https://api.bilibili.com/x/v2/reply/main?oid=${d.aid}&type=1&mode=3&next=${p}`, ref);
      const rs = (cj && cj.data && cj.data.replies) || [];
      if (!rs.length) break;
      for (const r of rs) {
        const msg = String((r.content && r.content.message) || '').trim();
        if (!msg || seenC.has(msg)) continue;
        seenC.add(msg);
        out.push(`【评论】${msg}`);
        c++;
      }
      // 楼中楼
      for (const r of rs) {
        for (const sr of r.replies || []) {
          const msg = String((sr.content && sr.content.message) || '').trim();
          if (!msg || seenC.has(msg)) continue;
          seenC.add(msg);
          out.push(`【评论】${msg}`);
          c++;
        }
      }
      await sleep(1100);
    }
    comments += c;
    manifest.push({
      bvid, aid: d.aid, cid: d.cid, title: stripTags(d.title), up: (d.owner && d.owner.name) || '',
      pubdate: d.pubdate ? new Date(d.pubdate * 1000).toISOString().slice(0, 10) : '',
      cover: d.pic || '', url: ref, danmaku: n, comments: c, fetchedAt: new Date().toISOString(),
    });
    console.error(`[ok ${i + 1}/${list.length}] ${bvid} 弹幕 ${n} 评论 ${c} | ${stripTags(d.title).slice(0, 30)}`);
    await sleep(1200);
  }

  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const corpusFile = path.join(ROOT, 'corpus', `corpus-dm24-${stamp}.txt`);
  const header = [
    '# B 站「淋安京」视频弹幕与评论快照（第二十四轮）',
    `# 抓取时间: ${new Date().toISOString()}`,
    `# 视频数: ${manifest.length}  弹幕: ${dms}  评论: ${comments}`,
    `# 逐条出处见 evidence/manifest-dm24-${stamp}.json`,
    '',
  ].join('\n');
  fs.writeFileSync(corpusFile, header + out.join('\n') + '\n', 'utf8');
  fs.writeFileSync(path.join(ROOT, 'evidence', `manifest-dm24-${stamp}.json`), JSON.stringify(manifest, null, 2), 'utf8');
  console.error(`\n[done] 视频 ${manifest.length} 弹幕 ${dms} 评论 ${comments}`);
  console.error(`  语料 ${path.basename(corpusFile)} ${(fs.statSync(corpusFile).size / 1024).toFixed(0)} KB`);
})();
