'use strict';

// 第八轮扩充专用采集器（2026-10-25）。
// 与 scripts/harvest-bili.js 的区别：本轮要的不仅是标题和评论，还有**弹幕**——
// 淋语的高频词、句式、语录绝大多数都只在弹幕里出现，只抓评论区会漏掉大半语料。
// 同时把每个视频的封面 (pic) 记进 manifest，作为人物传 / 英雄配图的合规来源
// （B 站淋语相关视频封面是本轮配图的首选，其次是百度百科词条图）。
//
// 只用 B 站公开接口，不带任何账号 Cookie 或 API Key：
//   /x/web-interface/search/type  按关键词搜视频
//   /x/web-interface/view          取元信息（含 pic 封面、cid、tag）
//   /x/v1/dm/list.so               取弹幕（XML）
//   /x/v2/reply/main               取一级评论
//
// 产出：
//   corpus/corpus-bili-<stamp>.txt     逐字语料，供 scripts/attest.js 判定是否真出现
//   evidence/manifest-<stamp>.json      每个视频 bvid/标题/UP/发布时间/封面/标签/弹幕数/评论数
const fs = require('fs');
const path = require('path');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const HD = {
  'User-Agent': UA,
  Referer: 'https://www.bilibili.com/',
  Cookie: 'buvid3=1ABC2DEF-3456-7890-ABCD-EF012345678939623infoc',
};
const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'evidence');
fs.mkdirSync(OUT_DIR, { recursive: true });

// 淋语生态 tag 表：游戏区淋化名 + 圈层人物 + 通用淋语词
const KEYWORDS = (process.argv[2] ? process.argv[2].split(',') : [
  // 通用
  '淋语', '淋语教程', '高等淋语', '淋语词典', '淋文化', '淋语吧', '淋淋', '本可', '阴者自阴', '通讯录英雄', '姐圈',
  // 游戏区淋化名
  '淋神', '洛克淋国', '英雄淋盟', '王者淋耀', '淋者荣耀', '第五淋格', '淋明杀鸡', '淋日方舟',
  '阴雄淋盟', '星淋铁道', '守望淋锋', '永劫淋间', '重返未淋', '淋者无双', '淋系铁道',
  // 人物 / 圈层
  '蔡依林 淋语', '那艺娜', '三梦奇缘', '万人迷 淋语', '梵谷 淋语', '周阴婷', '郭老师 淋语',
  '完颜慧德', '开心姐', '地才 淋语', '淋语翻译器', '淋语 弹幕', '淋语 梗',
]).filter(Boolean);
const MAX_NEW = Number(process.argv[3] || 160);
const COMMENT_PAGES = Number(process.argv[4] || 2);
const SEARCH_PAGES = Number(process.argv[5] || 2);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stripTags = (s) => String(s || '').replace(/<[^>]+>/g, '');
const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();

async function api(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(url, { headers: HD });
      if (r.status === 412 || r.status === 429) {
        await sleep(4000 * (attempt + 1));
        continue;
      }
      return await r.json();
    } catch {
      await sleep(1500 * (attempt + 1));
    }
  }
  return null;
}

async function dmXml(cid) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch(`https://api.bilibili.com/x/v1/dm/list.so?oid=${cid}`, { headers: HD });
      const t = await r.text();
      if (t && t.includes('<d p=')) return t;
    } catch {
      /* fallthrough */
    }
    await sleep(1200);
  }
  return '';
}

function parseDm(xml) {
  const out = [];
  const re = /<d p="[^"]*"[^>]*>([^<]*)<\/d>/g;
  let m;
  while ((m = re.exec(xml))) out.push(m[1]);
  return out
    .map((s) =>
      String(s)
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter((s) => s.length >= 2 && s.length <= 60);
}

(async () => {
  const seenFile = path.join(ROOT, 'seen.json');
  const seen = new Set(fs.existsSync(seenFile) ? JSON.parse(fs.readFileSync(seenFile, 'utf8')) : []);
  const found = new Map();

  for (const kw of KEYWORDS) {
    for (let page = 1; page <= SEARCH_PAGES; page++) {
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
  let dms = 0;
  let comments = 0;

  for (const bvid of targets) {
    const vj = await api(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`);
    const d = vj && vj.data;
    if (!d) {
      console.error(`[skip] ${bvid} 元信息取不到`);
      await sleep(600);
      continue;
    }
    const ref = `https://www.bilibili.com/video/${bvid}`;
    const title = clean(stripTags(d.title));
    const desc = clean(String(d.desc || ''));
    const tags = (d.tags || []).map((t) => t.tag_name || t).filter(Boolean);
    const owner = (d.owner && d.owner.name) || '';
    const pubdate = d.pubdate ? new Date(d.pubdate * 1000).toISOString().slice(0, 10) : '';

    out.push(`【视频】${title}`);
    if (owner) out.push(`【UP】${owner}`);
    if (desc) out.push(`【简介】${desc}`);
    if (tags.length) out.push(`【标签】${tags.join(' ')}`);

    let dmCount = 0;
    if (d.cid) {
      const xml = await dmXml(d.cid);
      const list = parseDm(xml);
      for (const s of list) {
        out.push(`【弹幕】${s}`);
        dmCount++;
      }
      await sleep(500);
    }

    let replyCount = 0;
    for (let p = 0; p < COMMENT_PAGES; p++) {
      const cj = await api(`https://api.bilibili.com/x/v2/reply/main?oid=${d.aid}&type=1&mode=3&next=${p}`);
      const rs = (cj && cj.data && cj.data.replies) || [];
      for (const r of rs) {
        const msg = clean((r.content && r.content.message) || '');
        if (msg) {
          out.push(`【评论】${msg}`);
          replyCount++;
        }
      }
      if (!rs.length) break;
      await sleep(700);
    }

    manifest.push({
      bvid,
      aid: d.aid,
      cid: d.cid,
      title,
      up: owner,
      pubdate,
      cover: d.pic || '',
      url: ref,
      tags,
      danmaku: dmCount,
      comments: replyCount,
      keyword: (found.get(bvid) || {}).keyword || '',
      fetchedAt: new Date().toISOString(),
    });
    seen.add(bvid);
    ok++;
    dms += dmCount;
    comments += replyCount;
    console.error(`[ok ${ok}/${targets.length}] ${bvid} 弹幕 ${dmCount} 评论 ${replyCount} ${title.slice(0, 32)}`);
    await sleep(800);
  }

  const header = [
    '# B 站公开数据抓取快照（第八轮扩充 · 含弹幕）',
    `# 抓取时间: ${new Date().toISOString()}`,
    `# 关键词: ${KEYWORDS.join(', ')}`,
    `# 视频数: ${manifest.length}  弹幕数: ${dms}  评论数: ${comments}`,
    `# 逐条出处见 evidence/manifest-${stamp}.json（bvid / 标题 / UP / 发布日期 / 封面 / 标签 / 抓取时间）`,
    '# 全部来自 bilibili.com 公开接口，未使用任何账号 Cookie 或 API Key',
    '',
  ].join('\n');
  fs.mkdirSync(path.dirname(corpusFile), { recursive: true });
  fs.writeFileSync(corpusFile, header + out.join('\n') + '\n', 'utf8');
  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2), 'utf8');
  fs.writeFileSync(seenFile, JSON.stringify([...seen]), 'utf8');
  console.error(`\n[done] 视频 ${manifest.length}，弹幕 ${dms}，评论 ${comments}`);
  console.error(`  语料 corpus/corpus-bili-${stamp}.txt ${(fs.statSync(corpusFile).size / 1024).toFixed(0)} KB`);
  console.error(`  清单 evidence/manifest-${stamp}.json`);
})();
