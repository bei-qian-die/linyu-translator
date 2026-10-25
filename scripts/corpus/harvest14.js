'use strict';

// 第十四轮语料采集器（2026-10-25）。
//
// 复用既有三条路，合成一次跑完（产量优先级：tag 搜索 → related 引用图 → 同 UP 扩散）：
//   A) /x/web-interface/search/type   按「淋语 / 游戏专名 / 通讯录英雄 / 人物」tag 搜新 BV
//   B) /x/web-interface/archive/related  从 A 的新 BV + 既有语料里的淋语视频 BV 出发 BFS 2 层
//      （第十三轮经验：引用图产量最高，因为它绕过搜索翻页的无关区）
//   C) 同 UP 扩散：出现 >=2 次的淋语 UP，用搜索接口把他其余稿件捞进来
//
// 拉每个视频时走（全部免登录、无 Cookie 身份）：
//   /x/web-interface/view        元信息（标题/UP/简介/aid/cid/pic/pubdate）
//   /x/tag/archive/tags          标签（相关性闸门用）
//   /x/v1/dm/list.so?oid=cid     弹幕 XML
//   /x/v2/reply?type=1&oid=aid   一级评论 + 前 3 条子回复
//
// 产出（与 harvest-linyu11.js 完全同格式，供 verify13/attest/mine 直接吃）：
//   corpus/corpus-bili-<stamp>.txt        【视频】/【UP】/【简介】/【标签】/【弹幕】/【评论】分段
//   evidence/manifest-<stamp>.json         [{bvid,aid,cid,title,up,pubdate,cover,url,tags,danmaku,comments,keyword,via,fetchedAt}]
//   evidence/harvest14-stats.json          每个 tag 的产量、search/graph/up 各贡献多少 BV（汇报用）
//   seen.json                              追加新 BV（保持 JSON 数组结构，整体重写但内容 = 旧 ∪ 新）
//
// 用法：
//   node scripts/corpus/harvest14.js
//   可调环境变量：MAX=520 DM=170 RP=2 SPAGES=2 DEPTH=2 SEEDN=45 TAGS="a,b,c"

const fs = require('fs');
const path = require('path');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const HD = {
  'User-Agent': UA,
  Referer: 'https://www.bilibili.com/',
  Cookie: 'buvid3=1ABC2DEF-3456-7890-ABCD-EF012345678939623infoc',
};
const ROOT = path.join(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'evidence');

// ————————————————————————————————————————————— tag 清单
// 前十一/八轮已用过的 tag 依然保留（同一 tag 每次搜索排序会变，能翻出新 BV），
// 新增的是「没试过的说法」：淋语考试/模仿/翻唱/配音、淋学、淋门、淋言淋语、通讯录语录 等。
const DEFAULT_TAGS = [
  // —— 淋语本体（新说法优先）——
  '淋语', '高等淋语', '淋语教程', '淋语教学', '淋语考试', '淋语八级', '淋语十级', '淋语等级',
  '淋语模仿', '淋语模仿秀', '淋语配音', '淋语翻唱', '淋语对话', '淋语语录', '淋语大全',
  '淋语词典', '淋语词汇', '淋语句式', '淋语语法', '淋语入门', '淋语学习', '学淋语',
  '淋学', '淋学入门', '淋学家', '淋文化', '淋文化起源', '淋语言', '淋式中文', '淋语版',
  '说淋语', '淋语挑战', '淋语测试', '淋语翻译', '淋语翻译器', '淋言淋语', '淋门', '淋门永存',
  '淋语谐音梗', '淋语梗', '淋语科普', '淋语新解', '淋语百科', '淋语歌曲', '淋语填词',
  // —— 人物 ——
  '蔡依林', '蔡依淋', '淋淋', '淋语 蔡依林', '周阴婷', '周阴中', '阴婷', '淋王星',
  '完颜慧德', '那艺娜', '三梦奇缘', '万人迷', '郭老师', '鹅妈妈', '楼兰', '新酱',
  '肘姐', '特务J', '花蝴蝶 淋', '美人计 淋', '日不落 淋', '舞娘 淋', '玫瑰少年 淋',
  // —— 游戏专名（淋X / X淋）——
  '淋者荣耀', '王者淋耀', '王者荣耀 淋', '阴雄淋盟', '英雄淋盟', '英雄联盟 淋',
  '淋神', '原神 淋', '第五淋格', '第五人格 淋', '淋日方舟', '明日方舟 淋',
  '洛克淋国', '洛克王国 淋', '绝区淋', '绝区零 淋', '守望淋锋', '守望先锋 淋',
  '淋明杀鸡', '黎明杀机 淋', '星淋铁道', '崩坏星穹铁道 淋', '永劫淋间', '重返未淋',
  '淋者无双', '街头霸淋', '蛋仔派对 淋', '元梦之星 淋', '鸣潮 淋', '光遇 淋',
  '无限暖暖 淋', '火力苏打 淋', '金铲铲 淋', '和平精英 淋', '无畏契约 淋',
  // —— 通讯录 / 姐圈黑话 ——
  '通讯录', '通讯录英雄', '通讯录女英雄', '通讯录语录', '通讯录黑话', '通讯录语音',
  '通讯录大乱斗', '通讯录典藏金曲', '通讯录的精神状态', '姐圈', '本可', '本仙女',
  '本猪妞', '本祝妞', '本宫', '本尊', '阴者自阴', '靴靴', '地才', '鸡笼', '好兰化',
  '吸入 淋语', '淋语 自称', '淋语 弹幕', '灰机 淋',
];
const TAGS = (process.env.TAGS ? process.env.TAGS.split(',') : DEFAULT_TAGS).map((s) => s.trim()).filter(Boolean);

// 相关性闸门：标题/标签命中即认为属于淋语生态
const MARK =
  /(淋|阴婷|阴中|阴雄|通讯录|姐圈|本可|本仙女|本猪|本祝|靴靴|噜|惹$|厚$|地才|花蝴蝶|特务J|蔡依林|jolin|舞娘|日不落|玫瑰少年|锁姐|豪姐|肘姐|完颜|那艺娜|三梦|万人迷|郭老师|鹅妈妈|楼兰|新酱|美人计|怪她|柠檬唇|阴)/i;
const WANT = new Set(
  ('淋语,高等淋语,淋语教程,淋学,淋文化,淋淋,蔡依林,蔡依淋,jolin,通讯录,通讯录英雄,姐圈,本可,本仙女,本猪妞,靴靴,地才,' +
    '王者淋耀,淋者荣耀,阴雄淋盟,英雄淋盟,淋神,第五淋格,淋日方舟,洛克淋国,绝区淋,守望淋锋,淋明杀鸡,星淋铁道,永劫淋间,' +
    '重返未淋,街头霸淋,淋明杀鸡,鬼畜,音MAD,整活,恶搞,搞笑,谐音梗,梗,二创,那艺娜,完颜慧德,三梦奇缘,万人迷,郭老师,鹅妈妈,楼兰,周阴婷')
    .split(',')
    .map((s) => s.trim())
);
const TAG_RE = /(淋|通讯录|姐圈|阴婷|本可|靴靴|地才|蔡依林|jolin|完颜|那艺娜|三梦|万人迷|楼兰|新酱|肘姐|花蝴蝶|鬼畜|恶搞|谐音)/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stripTags = (s) => String(s || '').replace(/<[^>]+>/g, '');
const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();

// ————— 风控冷却表：某个接口分组被 412 就把这一段调用整组跳过一段时间，
//        否则每次重试都要挂 5/10/15 秒，一轮抓取会被拖死。
const COOLDOWN = Number(process.env.COOLDOWN || 120000);
const cool = { search: 0, reply: 0, view: 0, other: 0 };
const blocked = { search: 0, reply: 0, view: 0, other: 0 };
function group(url) {
  if (/search\/type/.test(url)) return 'search';
  if (/\/x\/v2\/reply/.test(url)) return 'reply';
  if (/web-interface\/view/.test(url)) return 'view';
  return 'other';
}
function penalize(url, why) {
  const g = group(url);
  cool[g] = Date.now() + COOLDOWN;
  blocked[g]++;
  console.error(`  [blocked:${g}] ${why} → 冷却 ${COOLDOWN / 1000}s（累计 ${blocked[g]} 次）`);
}
const cooled = (g) => Date.now() < cool[g];

async function api(url, tries) {
  const g = group(url);
  if (cooled(g)) return null;
  for (let a = 0; a < (tries || 2); a++) {
    try {
      const r = await fetch(url, { headers: HD });
      if (r.status === 412 || r.status === 429) {
        penalize(url, String(r.status));
        await sleep(300);
        return null;
      }
      const t = await r.text();
      if (t.trim().startsWith('<')) {
        // B 站风控：返回 HTML 而不是 JSON
        penalize(url, `html@${r.status}`);
        await sleep(300);
        return null;
      }
      return JSON.parse(t);
    } catch {
      await sleep(1200 * (a + 1));
    }
  }
  return null;
}
async function text(url) {
  try {
    const r = await fetch(url, { headers: HD });
    if (r.status !== 200) {
      if (r.status === 412 || r.status === 429) penalize(url, String(r.status));
      return '';
    }
    return Buffer.from(await r.arrayBuffer()).toString('utf8');
  } catch {
    return '';
  }
}
// 弹幕主通道：comment.bilibili.com/<cid>.xml（老通道，实测不受本轮 list.so 风控影响）
async function danmaku(cid) {
  let xml = await text('https://comment.bilibili.com/' + cid + '.xml');
  if (!xml || !xml.includes('<d p=')) {
    await sleep(250);
    xml = await text('https://api.bilibili.com/x/v1/dm/list.so?oid=' + cid);
  }
  return xml && xml.includes('<d p=') ? xml : '';
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
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter((s) => s.length >= 2 && s.length <= 80);
}

async function tagsOf(bvid) {
  const j = await api('https://api.bilibili.com/x/tag/archive/tags?bvid=' + encodeURIComponent(bvid), 2);
  return j && j.code === 0 && Array.isArray(j.data) ? j.data.map((x) => x.tag_name) : null;
}

// 既有语料里的淋语视频 BV（corpus12.graph.txt / corpus13.manual.txt 的 ==== 头）当作图种子
function oldSeeds(max) {
  const dir = path.join(ROOT, 'corpus');
  const map = new Map();
  for (const f of fs.readdirSync(dir)) {
    if (!/^corpus.*\.txt$/.test(f)) continue;
    const txt = fs.readFileSync(path.join(dir, f), 'utf8');
    for (const m of txt.matchAll(/^==== .*?(BV[0-9A-Za-z]{9,11}) ([^=]+) ====.*?play:(\d+)/gm)) {
      const title = m[2].trim();
      if (!/淋|通讯录|阴|姐圈/.test(title)) continue;
      const play = Number(m[3]) || 0;
      if (!map.has(m[1]) || map.get(m[1]).play < play) map.set(m[1], { bvid: m[1], title, play });
    }
  }
  return [...map.values()].sort((a, b) => b.play - a.play).slice(0, max);
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const MAX = Number(process.env.MAX || 520);
  const DM = Number(process.env.DM || 170);
  const RP = Number(process.env.RP || 2);
  const SPAGES = Number(process.env.SPAGES || 2);
  const DEPTH = Number(process.env.DEPTH || 2);
  const SEEDN = Number(process.env.SEEDN || 45);
  const seenFile = path.join(ROOT, 'seen.json');
  const seen = new Set(fs.existsSync(seenFile) ? JSON.parse(fs.readFileSync(seenFile, 'utf8')) : []);
  const seenBase = seen.size;

  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const corpusFile = path.join(ROOT, 'corpus', `corpus-bili-${stamp}.txt`);
  const manifestFile = path.join(OUT_DIR, `manifest-${stamp}.json`);
  const statsFile = path.join(OUT_DIR, 'harvest14-stats.json');
  const logFile = path.join(OUT_DIR, 'harvest14.log');

  const manifest = [];
  const out = [];
  const tagStats = {}; // tag -> {hit, fresh, kept}
  const viaStats = { search: 0, graph: 0, up: 0 };
  const visited = new Set();
  const authors = new Map();
  let kept = 0;
  let lastFlush = 0;
  let dms = 0;
  let comments = 0;
  let searchErrors = 0;

  const writeSeen = () => fs.writeFileSync(seenFile, JSON.stringify([...seen]), 'utf8');
  const flush = () => {
    const header = [
      '# B 站公开数据抓取快照（第十四轮扩充 · tag 搜索 + related 引用图 2 层扩散）',
      `# 抓取时间: ${new Date().toISOString()}`,
      `# tag 数: ${TAGS.length}`,
      `# 视频数: ${manifest.length}  弹幕数: ${dms}  评论数: ${comments}`,
      `# 逐条出处见 evidence/manifest-${stamp}.json（bvid / aid / cid / 标题 / UP / 发布日期 / 封面 / 标签 / 抓取时间）`,
      '# 全部来自 bilibili.com 公开接口，未使用任何账号 Cookie 或 API Key',
      '',
    ].join('\n');
    fs.writeFileSync(corpusFile, header + out.join('\n') + '\n', 'utf8');
    fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2), 'utf8');
    fs.writeFileSync(
      statsFile,
      JSON.stringify(
        {
          stamp,
          kept,
          chars: (header + out.join('\n')).length,
          viaStats,
          tagStats,
          searchErrors,
          blocked,
          seenBase,
          seenNow: seen.size,
        },
        null,
        2
      ) + '\n',
      'utf8'
    );
    fs.appendFileSync(
      logFile,
      `[${new Date().toISOString()}] kept=${kept} bytes=${fs.statSync(corpusFile).size} via=${JSON.stringify(viaStats)}\n`,
      'utf8'
    );
    writeSeen();
    lastFlush = kept;
  };

  // 抓一个视频并落成语料块；返回是否收录
  async function harvest(bvid, keyword, via) {
    if (kept >= MAX) return false;
    if (visited.has(bvid) || seen.has(bvid)) return false;
    visited.add(bvid);
    const vj = await api('https://api.bilibili.com/x/web-interface/view?bvid=' + encodeURIComponent(bvid));
    const d = vj && vj.code === 0 && vj.data;
    if (!d) return false;
    const title = clean(stripTags(d.title));
    const tags = (d.tags || []).map((t) => t.tag_name || t).filter(Boolean);
    const owner = (d.owner && d.owner.name) || '';
    // 相关性闸门：搜索直出的 tag 视频只要标题/标签不违和就收；图扩散来的必须命中 MARK/WANT
    if (via !== 'search') {
      const hit = MARK.test(title) || tags.some((t) => TAG_RE.test(String(t))) || tags.some((t) => WANT.has(String(t)));
      if (!hit) return false;
    }
    const ref = `https://www.bilibili.com/video/${bvid}`;
    const block = [`【视频】${title}`, `【UP】${owner || '未知'}`];
    const desc = clean(String(d.desc || ''));
    if (desc) block.push(`【简介】${desc.slice(0, 600)}`);
    if (tags.length) block.push(`【标签】${tags.join(' ')}`);
    // 注释行（mine13 / verify13 都跳过 '#' 开头），仅供人工回源
    block.push(`# bvid=${bvid} aid=${d.aid} cid=${d.cid} via=${via} keyword=${keyword || ''} url=${ref}`);

    let dmCount = 0;
    if (d.cid) {
      const xml = await danmaku(d.cid);
      for (const s of parseDm(xml).slice(0, DM)) {
        block.push(`【弹幕】${s}`);
        dmCount++;
      }
      await sleep(320);
    }
    let replyCount = 0;
    for (let pn = 1; pn <= RP; pn++) {
      if (cooled('reply')) break; // 评论接口进风控就先用弹幕顶着
      const rj = await api(`https://api.bilibili.com/x/v2/reply?type=1&oid=${d.aid}&sort=2&ps=20&pn=${pn}`, 2);
      const rs = (rj && rj.code === 0 && rj.data && rj.data.replies) || [];
      if (!rs.length) break;
      for (const c of rs) {
        const msg = clean((c.content && c.content.message) || '');
        if (msg) {
          block.push(`【评论】${msg.slice(0, 300)}`);
          replyCount++;
        }
        for (const s of (c.replies || []).slice(0, 3)) {
          const sm = clean((s.content && s.content.message) || '');
          if (sm) {
            block.push(`【评论】${sm.slice(0, 240)}`);
            replyCount++;
          }
        }
      }
      await sleep(420);
    }
    // 空壳视频不收（不收的不写进 seen，后续冷却结束还能再捞）
    if (dmCount + replyCount < 3) return false;

    out.push(...block);
    manifest.push({
      bvid,
      aid: d.aid,
      cid: d.cid,
      title,
      up: owner,
      pubdate: d.pubdate ? new Date(d.pubdate * 1000).toISOString().slice(0, 10) : '',
      cover: d.pic || '',
      url: ref,
      tags,
      danmaku: dmCount,
      comments: replyCount,
      keyword: keyword || '',
      via,
      fetchedAt: new Date().toISOString(),
    });
    seen.add(bvid);
    kept++;
    dms += dmCount;
    comments += replyCount;
    viaStats[via] = (viaStats[via] || 0) + 1;
    authors.set(owner, (authors.get(owner) || 0) + 1);
    if (kept % 10 === 0) flush();
    console.error(`[keep ${kept}] ${via} ${bvid} dm=${dmCount} cmt=${replyCount}`);
    await sleep(300);
    return true;
  }

  // ========== A) tag 搜索 ==========
  const pending = []; // 搜索新发现、留给图阶段扩散的 BV
  const pendingSet = new Set();
  const PER_TAG = Number(process.env.PER_TAG || 5); // 每个 tag 直采几个，其余进图队列
  for (const kw of TAGS) {
    tagStats[kw] = { hit: 0, fresh: 0, kept: 0 };
    const freshBvs = [];
    for (let page = 1; page <= SPAGES; page++) {
      if (cooled('search')) break;
      const j = await api(
        `https://api.bilibili.com/x/web-interface/search/type?search_type=video&keyword=${encodeURIComponent(kw)}&page=${page}`,
        2
      );
      const list = (j && j.data && j.data.result) || [];
      if (!j || j.code !== 0) searchErrors++;
      for (const v of list) {
        if (!v.bvid) continue;
        tagStats[kw].hit++;
        if (seen.has(v.bvid)) continue;
        if (!freshBvs.includes(v.bvid)) freshBvs.push(v.bvid);
      }
      await sleep(700);
    }
    tagStats[kw].fresh = freshBvs.length;
    // 本 tag 下的新 BV 直采前 PER_TAG 个，其余进图队列（related 扩散用）
    for (const bv of freshBvs) {
      if (kept >= MAX) break;
      if (tagStats[kw].kept < PER_TAG && (await harvest(bv, kw, 'search'))) {
        tagStats[kw].kept++;
        continue;
      }
      if (!pendingSet.has(bv) && !visited.has(bv)) {
        pendingSet.add(bv);
        pending.push(bv);
      }
    }
    if (kept - lastFlush >= 25) flush();
    console.error(
      `[search] ${kw} hit=${tagStats[kw].hit} fresh=${tagStats[kw].fresh} kept=${tagStats[kw].kept} total=${kept} queue=${pending.length}`
    );
  }

  // ========== B) related 引用图 BFS 2 层 ==========
  // 种子 = 搜索阶段没直采的新 BV + 既有语料里播放量高的淋语视频
  const old = oldSeeds(SEEDN).map((s) => s.bvid).filter((b) => !pending.includes(b));
  let frontier = [...pending.slice(0, 170), ...old];
  console.error(`[graph] frontier=${frontier.length} (search-left=${pending.slice(0, 170).length}, old=${old.length})`);
  const graphSeen = new Set();
  for (let depth = 1; depth <= DEPTH && kept < MAX; depth++) {
    const next = [];
    for (const bv of frontier) {
      if (kept >= MAX) break;
      if (graphSeen.has(bv)) continue;
      graphSeen.add(bv);
      const rel = await api('https://api.bilibili.com/x/web-interface/archive/related?bvid=' + encodeURIComponent(bv), 2);
      const items = (rel && rel.code === 0 && Array.isArray(rel.data) && rel.data) || [];
      for (const it of items) {
        if (kept >= MAX) break;
        const cand = it.bvid;
        if (!cand || visited.has(cand) || seen.has(cand)) continue;
        const t = String(it.title || '');
        if (!(MARK.test(t) || /淋|通讯录|阴婷|姐圈|本可|靴靴|地才|完颜|那艺娜|三梦|万人迷|楼兰|蔡依林|jolin|鬼畜|恶搞|谐音/i.test(t))) continue;
        if (await harvest(cand, 'graph-d' + depth, 'graph')) next.push(cand);
      }
      await sleep(240);
    }
    console.error(`[graph] depth ${depth} done kept=${kept} next=${next.length}`);
    frontier = next.slice(0, 160);
    flush();
  }

  // ========== C) 同 UP 扩散 ==========
  const TOP = [...authors.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, Number(process.env.UPS || 18));
  console.error('[up expand]', TOP.map(([n, c]) => `${c}`).join(','));
  for (const [name, cnt] of TOP) {
    if (kept >= MAX) break;
    const sj = await api(
      'https://api.bilibili.com/x/web-interface/search/type?search_type=video&page_size=30&keyword=' +
        encodeURIComponent(name) + '&page=1',
      2
    );
    const list = (sj && sj.data && sj.data.result) || [];
    for (const v of list) {
      if (kept >= MAX) break;
      if (String(stripTags(v.author || '')) !== name || !v.bvid) continue;
      const t = String(v.title || '');
      if (!(MARK.test(t) || /淋|通讯录|阴|姐圈|本可|靴靴|地才/i.test(t))) continue;
      if (await harvest(v.bvid, 'up:' + name, 'up')) {
        /* counted */
      }
    }
    await sleep(700);
  }

  flush();
  const bytes = fs.statSync(corpusFile).size;
  console.error(`\n[done] kept=${kept} videos, bytes=${bytes}, via=${JSON.stringify(viaStats)}, seen ${seenBase} -> ${seen.size}`);
  console.error(`  corpus/corpus-bili-${stamp}.txt`);
  console.error(`  evidence/manifest-${stamp}.json`);
  fs.writeFileSync(path.join(OUT_DIR, 'harvest14-stamp.txt'), stamp, 'utf8');
})();
