'use strict';

// 多平台补充检索器（第十一轮扩充用）
//
// 目的：B 站之外的平台（贴吧 / 知乎 / 豆瓣 / 抖音 / 小红书）大多对裸 fetch 有反爬，
// 这里把各平台能稳定走通的公开接口收敛到一处：
//   1) 百度搜索（带 site: 限定）——用来定位各平台的具体帖子/文章 URL，可靠且无需登录。
//   2) 百度百科 OpenAPI——取词条摘要 + 词条图（人物/英雄配图候选）。
//   3) 豆瓣小组搜索页——取小组讨论标题与正文摘要。
//   4) 抖音搜索页（公开 web 接口）——取作品标题/作者。
//   5) 小红书搜索页——取笔记标题。
//
// 每个平台的结果都写进 evidence/manifest-web-<stamp>.json，
// 记录 url / 标题 / 摘要 / 平台 / 关键词，供后续逐条引用出处。
const fs = require('fs');
const path = require('path');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'evidence');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const QUERY = (process.argv[2] ? process.argv[2].split(',') : [
  '淋语', '淋语教程', '淋语词汇', '淋语梗', '高等淋语', '淋神',
  '洛克淋国', '英雄淋盟', '王者淋耀', '第五淋格', '淋明杀鸡',
  '淋者荣耀', '通讯录 淋语', '本可 淋语', '本仙女 淋语',
]).filter(Boolean);

const SITES = [
  { site: 'tieba.baidu.com', label: '百度贴吧' },
  { site: 'zhihu.com', label: '知乎' },
  { site: 'douban.com', label: '豆瓣' },
  { site: 'douyin.com', label: '抖音' },
  { site: 'xiaohongshu.com', label: '小红书' },
  { site: 'bilibili.com', label: '哔哩哔哩' },
];

function headers(extra) {
  return Object.assign(
    {
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9',
      Referer: 'https://www.baidu.com/',
    },
    extra || {}
  );
}

async function get(url, extraHeaders) {
  try {
    const r = await fetch(url, { headers: headers(extraHeaders) });
    const t = await r.text();
    return { status: r.status, text: t, url: r.url };
  } catch (e) {
    return { status: 0, text: '', url, err: e.message };
  }
}

function decodeEntities(s) {
  return String(s || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function stripTags(s) {
  return decodeEntities(String(s || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

// 百度搜索结果里的真链在 mu 属性或第一个 http 链接上
function baiduResults(html) {
  const out = [];
  const re = /<h3[^>]*>[\s\S]{0,600}?<\/h3>/g;
  let m;
  while ((m = re.exec(html))) {
    const block = m[0];
    const hrefM = block.match(/href="(https?:\/\/[^"]+)"/);
    const titleM = block.match(/<h3[^>]*>([\s\S]*?)<\/h3>/);
    if (!hrefM) continue;
    const u = decodeEntities(hrefM[1]);
    if (!/baidu\.com\/link\?url=/.test(u)) {
      // 有些结果直接给出目标站 URL
      if (/tieba|zhihu|douban|douyin|xiaohongshu|bilibili/.test(u)) {
        out.push({ url: u, title: stripTags(titleM ? titleM[1] : '') });
        continue;
      }
    }
    out.push({ url: u, title: stripTags(titleM ? titleM[1] : '') });
  }
  return out;
}

// 百度搜索结果块里常常带一段摘要文本
function baiduSnippets(html) {
  const out = [];
  const re = /<div[^>]*class="[^"]*c-abstract[^"]*"[^>]*>([\s\S]{0,2000}?)<\/div>/g;
  let m;
  while ((m = re.exec(html))) out.push(stripTags(m[1]).slice(0, 300));
  if (!out.length) {
    const re2 = /<span[^>]*class="[^"]*content-right_[^"]*"[^>]*>([\s\S]{0,1200}?)<\/span>/g;
    while ((m = re2.exec(html))) out.push(stripTags(m[1]).slice(0, 300));
  }
  return out;
}

// 跳转到百度 link 拿到真实 URL（HEAD/GET 一次即可）
async function resolve(u) {
  if (!/^https?:\/\/baidu\.com\/link/.test(u)) return u;
  const r = await get(u);
  return r.url && r.url !== u ? r.url : u;
}

async function baiduSiteSearch(site, kw) {
  const u = `https://www.baidu.com/s?wd=${encodeURIComponent(`site:${site} ${kw}`)}&rn=20`;
  const r = await get(u);
  if (r.status !== 200) return [];
  const res = baiduResults(r.text);
  const snips = baiduSnippets(r.text);
  const out = [];
  for (let i = 0; i < res.length; i++) {
    const real = await resolve(res[i].url);
    out.push({
      platform: site,
      keyword: kw,
      title: res[i].title,
      url: real,
      snippet: snips[i] || '',
    });
    await sleep(120);
  }
  return out;
}

// 百度百科：词条摘要 + 配图
async function baike(key) {
  const u = `https://baike.baidu.com/api/openapi/BaikeLemmaCardApi?scope=103&format=json&appid=379020&bk_key=${encodeURIComponent(key)}&bk_length=600`;
  const r = await get(u, { Referer: 'https://baike.baidu.com/' });
  if (r.status !== 200) return null;
  try {
    const j = JSON.parse(r.text);
    const d = j && j.data;
    if (!d || !d.title) return null;
    const imgs = [];
    if (d.image) imgs.push(d.image);
    return {
      title: d.title,
      desc: decodeEntities(String(d.desc || '')).replace(/<[^>]+>/g, '').trim(),
      url: d.url || `https://baike.baidu.com/item/${encodeURIComponent(d.title)}`,
      images: imgs,
    };
  } catch {
    return null;
  }
}

// 豆瓣小组搜索
async function doubanGroups(kw) {
  const u = `https://www.douban.com/group/search?q=${encodeURIComponent(kw)}&cat=1012`;
  const r = await get(u, { Referer: 'https://www.douban.com/' });
  if (r.status !== 200) return [];
  const out = [];
  const re = /<div class="channel-item">([\s\S]{0,3000}?)<\/div>\s*<\/div>/g;
  let m;
  while ((m = re.exec(r.text))) {
    const b = m[1];
    const t = b.match(/<h3>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!t) continue;
    out.push({
      platform: 'douban.com',
      keyword: kw,
      title: stripTags(t[2]),
      url: t[1],
      snippet: stripTags(b).slice(0, 300),
    });
  }
  return out;
}

// 抖音 web 搜索（公开接口，返回 JSON）
async function douyinSearch(kw, count) {
  const u = `https://www.douyin.com/aweme/v1/web/general/search/single/?device_platform=webapp&aid=6383&channel=channel_pc_web&search_channel=aweme_general&keyword=${encodeURIComponent(kw)}&search_source=normal_search&query_correct_type=1&is_filter_search=0&offset=0&count=${count}`;
  const r = await get(u, { Referer: 'https://www.douyin.com/' });
  if (r.status !== 200) return [];
  try {
    const j = JSON.parse(r.text);
    const list = (j && j.data && j.data.data) || [];
    return list
      .filter((x) => x && x.aweme_info)
      .map((x) => {
        const a = x.aweme_info;
        const cover = a.video && a.video.cover && a.video.cover.url_list ? a.video.cover.url_list[0] : '';
        return {
          platform: 'douyin.com',
          keyword: kw,
          title: stripTags(a.desc || ''),
          url: `https://www.douyin.com/video/${a.aweme_id}`,
          author: (a.author && a.author.nickname) || '',
          cover,
          snippet: stripTags(a.desc || '').slice(0, 300),
        };
      });
  } catch {
    return [];
  }
}

// 小红书搜索页
async function xhsSearch(kw) {
  const u = `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(kw)}`;
  const r = await get(u, { Referer: 'https://www.xiaohongshu.com/' });
  if (r.status !== 200) return [];
  const out = [];
  const re = /"title":"([^"]{2,120})"/g;
  let m;
  const seen = new Set();
  while ((m = re.exec(r.text))) {
    const t = m[1];
    if (seen.has(t)) continue;
    seen.add(t);
    out.push({ platform: 'xiaohongshu.com', keyword: kw, title: t, url: '', snippet: '' });
  }
  return out;
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const manifestFile = path.join(OUT_DIR, `manifest-web-${stamp}.json`);
  const all = [];

  for (const kw of QUERY) {
    for (const s of SITES) {
      const res = await baiduSiteSearch(s.site, kw);
      for (const r of res) {
        r.platformLabel = s.label;
        all.push(r);
      }
      console.error(`[baidu:${s.site}] ${kw}: ${res.length} 条`);
      await sleep(700);
    }

    const dy = await douyinSearch(kw, 20);
    all.push(...dy);
    console.error(`[douyin] ${kw}: ${dy.length} 条`);

    const db = await doubanGroups(kw);
    all.push(...db);
    console.error(`[douban] ${kw}: ${db.length} 条`);

    const xhs = await xhsSearch(kw);
    all.push(...xhs);
    console.error(`[xiaohongshu] ${kw}: ${xhs.length} 条`);

    await sleep(500);
  }

  // 百科词条：把出现的专有名词（人物 / 英雄 / 作品）也查一遍，拿到摘要与配图
  const baikeTerms = [
    '淋语', '洛克王国', '蔡依林', '王者荣耀', '原神', '第五人格', '明日方舟',
    '绝区零', '英雄联盟', '火力苏打', '光遇', '崩坏：星穹铁道', '蛋仔派对',
    '完颜慧德', '那艺娜', '周阴婷', '三梦奇缘',
  ];
  const baikeOut = [];
  for (const t of baikeTerms) {
    const b = await baike(t);
    if (b) {
      baikeOut.push(b);
      console.error(`[baike] ${t}: ${b.desc.slice(0, 40)}`);
    }
    await sleep(400);
  }

  fs.writeFileSync(manifestFile, JSON.stringify({ fetchedAt: new Date().toISOString(), web: all, baike: baikeOut }, null, 2), 'utf8');
  console.error(`\n[done] web ${all.length} 条，百科 ${baikeOut.length} 条 -> evidence/manifest-web-${stamp}.json`);
})();
