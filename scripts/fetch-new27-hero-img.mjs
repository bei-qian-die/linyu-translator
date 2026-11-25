// 第二十七轮配图抓取：只取真实公开图片，不生成、不绘制、不占位。
// 路径优先级：
//   1) B 站公开检索结果里该角色相关视频的封面（官方角色 PV / 攻略 / 二创），
//      标题必须同时含角色名与「星穹/星铁/崩坏/铁道」，避免张冠李戴
//   2) 百度百科移动端（wapbaike，桌面版 403）词条主图，页面正文必须命中关键词
// 每张图登记 来源 URL + 类型 + 获取时间 -> scripts/curated-new27-hero-images.json
// 用法：node scripts/fetch-new27-hero-img.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const RAW = path.join('.tmp', 'new27-img', 'raw');
fs.mkdirSync(RAW, { recursive: true });

const H_DESKTOP = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Referer: 'https://www.bilibili.com/',
  Accept: 'application/json, text/plain, */*',
};
const H_MOBILE = {
  'User-Agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
  Referer: 'https://wapbaike.baidu.com/',
};

const heroes = require('../scripts/curated-new27-heroes.js');
const targets = heroes.map((h) => ({
  num: Number(h.img.match(/hero-(\d+)/)[1]),
  name: h.name,
  expect: /星穹|星铁|崩坏|铁道/,
  kw: h.name + ' 星穹铁道',
}));

const legacy = [
  { num: 1011, name: '锤头鹳', expect: /洛克/, kw: '洛克王国 锤头鹳' },
  { num: 1012, name: '夜枭', expect: /洛克/, kw: '洛克王国 夜枭' },
  { num: 1013, name: '可丽希亚', expect: /洛克/, kw: '洛克王国 可丽希亚' },
  { num: 1014, name: '阿洛', expect: /洛克/, kw: '洛克王国 阿洛' },
  { num: 1015, name: '奇乐的机器人', expect: /无畏契约|瓦罗兰特|VALORANT|奇乐/, kw: '无畏契约 奇乐' },
  { num: 1016, name: '黑梦的狗', expect: /无畏契约|瓦罗兰特|VALORANT|黑梦/, kw: '无畏契约 黑梦' },
];

const all = targets.concat(legacy);
const report = [];
const sleep = (ms) => new Promise((s) => setTimeout(s, ms));

async function fetchJson(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    const r = await fetch(url, { headers: H_DESKTOP });
    const text = await r.text();
    if (text.trim().startsWith('{')) {
      try {
        return JSON.parse(text);
      } catch (e) {
        /* 落到重试 */
      }
    }
    // 412 / 反爬 HTML → 退避重试
    await sleep(1200 * (i + 1));
  }
  return null;
}

async function tryBili(kw, name, expect) {
  const url =
    'https://api.bilibili.com/x/web-interface/search/type?search_type=video&keyword=' +
    encodeURIComponent(kw) +
    '&page=1&page_size=20';
  const j = await fetchJson(url);
  if (!j || !j.data) return [];
  const list = j.data.result || [];
  const clean = (s) => String(s || '').replace(/<[^>]+>/g, '');
  const scored = list
    .map((v) => {
      const t = clean(v.title);
      let score = 0;
      if (t.includes(name)) score += 3;
      if (expect.test(t + ' ' + clean(v.description || ''))) score += 3;
      if (/角色PV|PV|立绘|官方|实机|演示|攻略/.test(t)) score += 2;
      if (/淋|通讯录|二创|梗/.test(t)) score += 1;
      return { v, t, score };
    })
    .filter((x) => x.score >= 3 && x.v.pic)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
  return scored.map(({ v, t }) => ({
    url: String(v.pic).startsWith('//') ? 'https:' + v.pic : v.pic,
    page: 'https://www.bilibili.com/video/' + v.bvid,
    type: 'B 站视频封面（公开检索）',
    title: t,
    author: v.author,
  }));
}

async function tryBaike(name, expect) {
  for (const q of [name, name + '（游戏角色）']) {
    try {
      const r = await fetch('https://wapbaike.baidu.com/item/' + encodeURIComponent(q), {
        headers: H_MOBILE,
        redirect: 'follow',
      });
      if (r.status !== 200) continue;
      const html = await r.text();
      const text = html.replace(/<[^>]+>/g, '');
      if (!expect.test(text) || !text.includes(name)) continue;
      const m = [...html.matchAll(/https?:\/\/[^"'\\ )]*bkimg[^"'\\ )]+/gi)].map((x) => x[0]);
      if (!m.length) continue;
      return {
        url: m[0],
        page: 'https://wapbaike.baidu.com/item/' + encodeURIComponent(q),
        type: '百度百科词条主图（移动端）',
      };
    } catch (e) {
      /* 下一个候选 */
    }
  }
  return null;
}

async function download(url, dst) {
  // 图床有防盗链：bkimg 只认百度系 Referer，hdslb 只认 B 站 Referer。
  const isBk = /bkimg|bcebos/.test(url);
  const refs = isBk
    ? ['https://wapbaike.baidu.com/', 'https://baike.baidu.com/', 'https://www.baidu.com/']
    : ['https://www.bilibili.com/', 'https://search.bilibili.com/'];
  let lastErr = '';
  for (const ref of refs) {
    try {
      const r = await fetch(url, {
        headers: {
          'User-Agent': H_DESKTOP['User-Agent'],
          Referer: ref,
          Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        },
      });
      if (!r.ok) {
        lastErr = 'HTTP ' + r.status;
        continue;
      }
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 3000) {
        lastErr = '文件过小 ' + buf.length;
        continue;
      }
      fs.writeFileSync(dst, buf);
      return buf.length;
    } catch (e) {
      lastErr = e.message;
    }
  }
  throw new Error(lastErr || '下载失败');
}

for (const t of all) {
  const row = {
    num: t.num,
    name: t.name,
    file: null,
    url: '',
    page: '',
    type: '',
    size: 0,
    fetchedAt: new Date().toISOString(),
  };
  // 候选按优先级排：B 站封面（官方 PV 优先）→ 百度百科词条主图
  let cands = await tryBili(t.kw, t.name, t.expect);
  if (!cands.length) {
    await sleep(400);
    cands = await tryBili(t.name, t.name, t.expect);
  }
  await sleep(300);
  const bk = await tryBaike(t.name, t.expect);
  if (bk) cands.push(bk);

  for (const got of cands) {
    row.url = got.url;
    row.page = got.page;
    row.type = got.type;
    if (got.title) row.title = got.title;
    if (got.author) row.author = got.author;
    const ext = (got.url.match(/\.(png|jpg|jpeg|webp)/i) || ['.jpg'])[0].toLowerCase();
    const dst = path.join(RAW, `hero-${t.num}${ext}`);
    try {
      row.size = await download(got.url, dst);
      row.file = path.basename(dst);
      row.error = undefined;
      break;
    } catch (e) {
      row.error = '下载失败：' + e.message;
      row.file = null;
    }
  }
  if (!cands.length) row.error = '未找到可用真实来源';
  report.push(row);
  console.log(
    String(t.num).padEnd(5),
    t.name.padEnd(10),
    (row.type || '—').padEnd(22),
    row.size ? Math.round(row.size / 1024) + 'KB' : row.error
  );
  await sleep(400);
}

fs.writeFileSync(
  'scripts/curated-new27-hero-images.json',
  JSON.stringify(
    {
      generated: new Date().toISOString(),
      note: '全部为真实网络图片：B 站公开视频封面 / 百度百科移动端词条主图。无 AI 生成图、无自绘、无占位图。',
      report,
    },
    null,
    1
  ),
  'utf8'
);

const ok = report.filter((r) => r.file).length;
console.log('\n成功', ok, '/', report.length, '| 失败', report.length - ok);
