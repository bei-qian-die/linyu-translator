'use strict';

// 第十一轮扩充专用采集器（2026-10-25）：
// 与 scripts/harvest-linyu8.js 的区别：
//   1) 关键词大幅扩容——除通用淋语词外，铺开「通讯录英雄 tag」「游戏区淋语 tag」
//      「人物 tag」「圈层黑话 tag」「变体译法 tag」四类，用来挖之前没覆盖到的视频。
//   2) 每个关键词多翻页（默认 3 页），弹幕全量拉取，评论拉 2 页并跟随 next 游标深挖。
//   3) 封面图（pic）连同 bvid 一起写进 manifest，直接作为后续人物传/词卡配图候选。
//
// 仍只使用 B 站公开接口，不带任何账号 Cookie 或 API Key。
//   /x/web-interface/search/type  按关键词搜视频
//   /x/web-interface/view          取单个视频完整元信息（含 pic 封面、cid、aid、tag）
//   /x/v1/dm/list.so               取弹幕（XML）
//   /x/v2/reply/main               取一级评论
//
// 产出：
//   corpus/corpus-bili-<stamp>.txt     逐字语料，供 scripts/attest.js 判定是否真出��
//   evidence/manifest-<stamp>.json      每个视频的 bvid/标题/UP/发布日期/封面/标签/抓取时间
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

const KEYWORDS = (process.argv[2] ? process.argv[2].split(',') : [
  // —— 通用淋语 ——
  '淋语', '淋语教程', '高等淋语', '淋语词汇', '淋语新解', '淋语梗', '淋语科普',
  '淋语八级', '淋语等级', '淋语教材', '淋语用法', '淋语怎么用', '学淋语',
  '淋神', '淋神作', '蔡依林', '蔡依淋', '淋淋', '新酱', '新酱爱追剧',
  // —— 游戏区淋语 tag ——
  '淋语 洛克', '洛克淋国', '洛克王国 淋', '英雄淋盟', '英雄联盟 淋语',
  '王者淋耀', '王者荣耀 淋语', '第五淋格', '第五人格 淋语', '淋明杀鸡', '黎明杀机 淋语',
  '淋者荣耀', '绝区淋', '绝区零 淋语', '淋日方舟', '明日方舟 淋语',
  '阴雄淋盟', '街头霸淋', '火力苏打 淋语', '无限暖暖 淋语', '光遇 淋语',
  '崩坏 星穹铁道 淋语', '鸣潮 淋语', '蛋仔派对 淋语', '元梦之星 淋语',
  // —— 通讯录人物 tag ——
  '通讯录', '通讯录英雄', '通讯录女英雄', '通讯录典藏金曲', '通讯录大乱斗',
  '完颜慧德', '周阴婷', '那艺娜', '三梦奇缘', '万人迷', '郭老师',
  '指南杰斯猫', '霉霉', '鹅妈妈', '肘姐', '梵谷', '玛莎', '何老师',
  '埃及艳后', '老地瓜', '开心姐', '埋汰姐', '施柔儿', '凤仙子',
  // —— 变体 / 自称 / 黑话 tag ——
  '本可', '本仙女', '本祝妞', '本猪妞', '本宫', '本尊', '本淋王',
  '通讯录 灰机', '淋语 自称', '淋语 句式', '琳琅', '楼兰语',
  '地才', '鸡笼', '好兰化', '吸入 淋语', '尊素', '本直女',
]).filter(Boolean);

const MAX_NEW = Number(process.argv[3] || 320);
const COMMENT_PAGES = Number(process.argv[4] || 2);
const SEARCH_PAGES = Number(process.argv[5] || 3);

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
  fs.mkdirSync(OUT_DIR, { recursive: true });
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
      await sleep(850);
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
      await sleep(450);
    }

    let replyCount = 0;
    let next = 0;
    for (let p = 0; p < COMMENT_PAGES; p++) {
      const cj = await api(
        `https://api.bilibili.com/x/v2/reply/main?oid=${d.aid}&type=1&mode=3&next=${next}`
      );
      const rs = (cj && cj.data && cj.data.replies) || [];
      for (const r of rs) {
        const msg = clean((r.content && r.content.message) || '');
        if (msg) {
          out.push(`【评论】${msg}`);
          replyCount++;
        }
      }
      if (!rs.length) break;
      const cursor = (cj.data && cj.data.cursor) || {};
      if (cursor.is_end) break;
      next = cursor.next;
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
    console.error(`[ok ${ok}/${targets.length}] ${bvid} 弹幕 ${dmCount} 评论 ${replyCount} ${title.slice(0, 34)}`);
    await sleep(750);
  }

  const header = [
    '# B 站公开数据抓取快照（第十一轮扩充 · 淋语 tag + 通讯录英雄 tag 高强度检索）',
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
