'use strict';

// 第二十一轮（守望淋锋 / 守望先锋）专用 B 站采集。
// 与 scripts/harvest-bili20.js 同源，只改关键词集合与产出编号（21）。
// 守望淋锋是第 4 轮开的区，但存量语料里守望锚点极少（守望先锋仅 59 次、多数英雄 0 次），
// 所以本轮必须深翻，且逐英雄关键词都要跑一遍。
//
// 产出：
//   corpus/corpus-bili21-<时间戳>.txt  逐字语料
//   evidence/manifest-bili21-<时间戳>.json  可回源快照（bvid / 标题 / UP / 封面 / 发布时间）
//
// 用法: node scripts/harvest-bili21.js "<kw,kw,kw>" [PAGES] [MAX_NEW] [COMMENT_PAGES]
const fs = require('fs');
const path = require('path');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'evidence');
fs.mkdirSync(OUT_DIR, { recursive: true });

const KEYWORDS = (process.argv[2] || '守望淋锋').split(',').map((s) => s.trim()).filter(Boolean);
const PAGES = Number(process.argv[3] || 3);
const MAX_NEW = Number(process.argv[4] || 160);
const COMMENT_PAGES = Number(process.argv[5] || 1);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stripTags = (s) => String(s || '').replace(/<[^>]+>/g, '');

async function api(url, referer) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, Referer: referer || 'https://www.bilibili.com/' } });
      if (r.status === 412 || r.status === 429) {
        await sleep(5000 * (attempt + 1));
        continue;
      }
      return await r.json();
    } catch (e) {
      await sleep(1500 * (attempt + 1));
    }
  }
  return null;
}

(async () => {
  const seen = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, 'seen.json'), 'utf8')));
  const found = new Map();

  for (const kw of KEYWORDS) {
    for (let page = 1; page <= PAGES; page++) {
      const u = `https://api.bilibili.com/x/web-interface/search/type?search_type=video&keyword=${encodeURIComponent(kw)}&page=${page}`;
      const j = await api(u);
      const list = (j && j.data && j.data.result) || [];
      let n = 0;
      for (const v of list) {
        if (!v.bvid) continue;
        if (!found.has(v.bvid)) {
          found.set(v.bvid, { keyword: kw, title: stripTags(v.title) });
          n++;
        }
      }
      console.error(`[search] ${kw} p${page}: ${list.length} 条 / 新 ${n} / 累计 ${found.size}`);
      if (!list.length) break;
      await sleep(1200);
    }
  }

  const targets = [...found.keys()].filter((b) => !seen.has(b)).slice(0, MAX_NEW);
  console.error(`[search] 命中 ${found.size}，未采集过 ${targets.length} 个，本次处理 ${Math.min(targets.length, MAX_NEW)} 个`);
  if (!targets.length) {
    console.error('[done] 没有新视频');
    return;
  }

  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const corpusFile = path.join(ROOT, 'corpus', `corpus-bili21-${stamp}.txt`);
  const manifestFile = path.join(OUT_DIR, `manifest-bili21-${stamp}.json`);
  const manifest = [];
  const out = [];
  let ok = 0;
  let comments = 0;

  for (const bvid of targets) {
    const vj = await api(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`);
    const d = vj && vj.data;
    if (!d) {
      console.error(`[skip] ${bvid} 元信息取不到`);
      await sleep(700);
      continue;
    }
    const ref = `https://www.bilibili.com/video/${bvid}`;
    const title = stripTags(d.title);
    const desc = String(d.desc || '').trim();
    const tags = (d.tags || []).map((t) => t.tag_name || t).filter(Boolean);
    const owner = (d.owner && d.owner.name) || '';
    const pubdate = d.pubdate ? new Date(d.pubdate * 1000).toISOString().slice(0, 10) : '';

    out.push(`【视频】${title}`);
    if (owner) out.push(`【UP】${owner}`);
    if (desc) out.push(`【简介】${desc}`);
    if (tags.length) out.push(`【标签】${tags.join(' ')}`);

    let replyCount = 0;
    for (let p = 0; p < COMMENT_PAGES; p++) {
      const cj = await api(`https://api.bilibili.com/x/v2/reply/main?oid=${d.aid}&type=1&mode=3&next=${p}`, ref);
      const rs = (cj && cj.data && cj.data.replies) || [];
      for (const r of rs) {
        const msg = String((r.content && r.content.message) || '').trim();
        if (msg) {
          out.push(`【评论】${msg}`);
          replyCount++;
        }
      }
      await sleep(800);
    }

    manifest.push({
      bvid, aid: d.aid, title, up: owner, pubdate, cover: d.pic || '',
      url: ref, tags, keyword: found.get(bvid).keyword, comments: replyCount,
      fetchedAt: new Date().toISOString(),
    });
    seen.add(bvid);
    ok++;
    comments += replyCount;
    console.error(`[ok ${ok}/${targets.length}] ${bvid} ${title.slice(0, 40)} 评论 ${replyCount}`);
    await sleep(900);
  }

  const header = [
    '# B 站公开数据抓取快照（第二十一轮 · 守望淋锋）',
    `# 抓取时间: ${new Date().toISOString()}`,
    `# 关键词: ${KEYWORDS.join(', ')}`,
    `# 视频数: ${manifest.length}  评论数: ${comments}`,
    `# 逐条出处见 evidence/${path.basename(manifestFile)}（bvid / 标题 / UP / 封面 / 发布时间）`,
    '# 全部来自 bilibili.com 公开接口，未使用任何账号 Cookie 或 API Key',
    '',
  ].join('\n');
  fs.writeFileSync(corpusFile, header + out.join('\n') + '\n', 'utf8');
  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2), 'utf8');
  fs.writeFileSync(path.join(ROOT, 'seen.json'), JSON.stringify([...seen]), 'utf8');
  console.error(`\n[done] 视频 ${manifest.length}，评论 ${comments}`);
  console.error(`  语料 ${path.basename(corpusFile)} ${(fs.statSync(corpusFile).size / 1024).toFixed(0)} KB`);
  console.error(`  清单 ${path.basename(manifestFile)}`);
})();
