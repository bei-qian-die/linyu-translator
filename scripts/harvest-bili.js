'use strict';

// B 站公开数据采集（无需 Key / Cookie）：
//   1) /x/web-interface/search/type  按关键词搜视频
//   2) /x/web-interface/view          取单个视频的完整元信息（含封面 pic、标签、发布时间）
//   3) /x/v2/reply/main               取一级评论
//
// 产出两份东西：
//   corpus-bili-*.txt   逐字语料，供 scripts/attest.js 判定「是否真在语料里出现」
//   evidence/manifest-*.json  每个视频的 bvid / 标题 / UP / 发布时间 / 封面 / 抓取时间 / 评论条数
// manifest 是「可回源快照」：任何一条被 attest 判为 OK 的内容都能顺着它找到原始出处。
const fs = require('fs');
const path = require('path');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'evidence');
fs.mkdirSync(OUT_DIR, { recursive: true });

const KEYWORDS = process.argv[2]
  ? process.argv[2].split(',')
  : ['淋语', '淋神', '淋语教程', '洛克淋国', '英雄淋盟', '王者淋耀', '第五淋格', '通讯录英雄', '淋语吧'];
const MAX_NEW = Number(process.argv[3] || 60);
const COMMENT_PAGES = Number(process.argv[4] || 1);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stripTags = (s) => String(s || '').replace(/<[^>]+>/g, '');

async function api(url, referer) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, Referer: referer || 'https://www.bilibili.com/' } });
      if (r.status === 412 || r.status === 429) {
        await sleep(4000 * (attempt + 1));
        continue;
      }
      const j = await r.json();
      return j;
    } catch (e) {
      await sleep(1500 * (attempt + 1));
    }
  }
  return null;
}

(async () => {
  const seen = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, 'seen.json'), 'utf8')));
  const found = new Map(); // bvid -> {keyword, searchHit}

  for (const kw of KEYWORDS) {
    for (let page = 1; page <= 2; page++) {
      const u = `https://api.bilibili.com/x/web-interface/search/type?search_type=video&keyword=${encodeURIComponent(kw)}&page=${page}`;
      const j = await api(u);
      const list = (j && j.data && j.data.result) || [];
      for (const v of list) {
        if (!v.bvid) continue;
        if (!found.has(v.bvid)) found.set(v.bvid, { keyword: kw, title: stripTags(v.title) });
      }
      console.error(`[search] ${kw} p${page}: ${list.length} 条，累计 ${found.size}`);
      await sleep(900);
    }
  }

  const fresh = [...found.keys()].filter((b) => !seen.has(b));
  console.error(`[search] 命中 ${found.size} 个视频，其中 ${fresh.length} 个此前未采集过`);
  const targets = fresh.slice(0, MAX_NEW);
  if (!targets.length) {
    console.error('[done] 没有新视频可采');
    process.exitCode = 0;
    return;
  }

  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const corpusFile = path.join(ROOT, 'corpus', `corpus-bili-${stamp}.txt`);
  const manifestFile = path.join(OUT_DIR, `manifest-${stamp}.json`);
  const manifest = [];
  const out = [];
  let ok = 0;
  let comments = 0;

  for (const bvid of targets) {
    const vj = await api(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`);
    const d = vj && vj.data;
    if (!d) { console.error(`[skip] ${bvid} 元信息取不到`); await sleep(600); continue; }
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
        if (msg) { out.push(`【评论】${msg}`); replyCount++; }
      }
      await sleep(700);
    }

    manifest.push({
      bvid, aid: d.aid, title, up: owner, pubdate, cover: d.pic || '',
      url: ref, tags, comments: replyCount, fetchedAt: new Date().toISOString(),
    });
    seen.add(bvid);
    ok++;
    comments += replyCount;
    console.error(`[ok ${ok}/${targets.length}] ${bvid} ${title.slice(0, 40)} 评论 ${replyCount}`);
    await sleep(800);
  }

  const header = [
    '# B 站公开数据抓取快照',
    `# 抓取时间: ${new Date().toISOString()}`,
    `# 关键词: ${KEYWORDS.join(', ')}`,
    `# 视频数: ${manifest.length}  评论数: ${comments}`,
    `# 逐条出处见 evidence/manifest-${stamp}.json（bvid / 标题 / UP / 发布日期 / 封面 / 抓取时间）`,
    '# 全部来自 bilibili.com 公开接口，未使用任何账号 Cookie 或 API Key',
    '',
  ].join('\n');
  fs.mkdirSync(path.dirname(corpusFile), { recursive: true });
  fs.writeFileSync(corpusFile, header + out.join('\n') + '\n', 'utf8');
  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2), 'utf8');
  fs.writeFileSync(path.join(ROOT, 'seen.json'), JSON.stringify([...seen]), 'utf8');
  console.error(`\n[done] 视频 ${manifest.length}，评论 ${comments}`);
  console.error(`  语料 ${path.basename(corpusFile)} ${(fs.statSync(corpusFile).size / 1024).toFixed(0)} KB`);
  console.error(`  清单 ${path.basename(manifestFile)}`);
})();
