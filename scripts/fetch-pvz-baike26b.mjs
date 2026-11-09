// 第二十六轮补图·主路径 v2：必应定位「植物大战僵尸」专属百科词条（带词条 ID），
// 再用百度百科移动端取该词条主图。桌面版 baike 403、百科搜索页会弹验证码，只有
// 直接访问 wapbaike 的 /item/{名}/{id} 可用——所以先用必应拿到带 ID 的 URL。
// 全流程只下载真实网络图片，不生成、不绘制、不改画面内容。
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT_DIR = path.join(ROOT, 'evidence/pvz-baike26');
const UA_M =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';
const UA_D =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const NAMES = [
  '豌豆射手', '向日葵', '坚果墙', '樱桃炸弹', '寒冰射手', '大嘴花', '大喷菇',
  '土豆雷', '火爆辣椒', '地刺', '磁力菇', '模仿者', '三线射手', '杨桃', '睡莲',
  '墓碑吞噬者', '香蒲', '疯狂戴夫', '撑杆跳僵尸', '蹦极僵尸', '矿工僵尸',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function sniff(buf) {
  if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50) return 'png';
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8) return 'jpg';
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF') return 'webp';
  return '';
}

// 从必应网页结果里找带 ID 的百科词条链接
async function findLemmas(name) {
  const q = encodeURIComponent(`site:baike.baidu.com ${name} 植物大战僵尸`);
  const r = await fetch(`https://cn.bing.com/search?q=${q}`, {
    headers: { 'User-Agent': UA_D, 'Accept-Language': 'zh-CN,zh;q=0.9' },
  });
  if (!r.ok) return [];
  const h = await r.text();
  const re = new RegExp('https://baike' + '[.]' + 'baidu' + '[.]' + 'com/item/[^"&<>\\s]+', 'g');
  const urls = [...new Set((h.match(re) || []).map((u) => decodeURIComponent(u)))];
  const out = [];
  for (const u of urls) {
    const m = u.match(/baike\.baidu\.com\/item\/([^/]+)\/(\d+)/);
    if (!m) continue;
    if (!m[1].includes(name)) continue; // 词条名必须含角色名
    out.push({ lemma: m[1], id: m[2], url: u });
  }
  return out;
}

async function lemmaImage(lemma, id) {
  const url = `https://wapbaike.baidu.com/item/${encodeURIComponent(lemma)}/${id}`;
  const r = await fetch(url, { headers: { 'User-Agent': UA_M, 'Accept-Language': 'zh-CN,zh;q=0.9' } });
  if (!r.ok) return { err: 'http ' + r.status };
  const html = await r.text();
  if (html.includes('captchaview')) return { err: '验证码' };
  const desc = (html.match(/<meta name="description" content="(.*?)"/) || [])[1] || '';
  const ok = /植物大战僵尸|僵尸|戴夫|关卡|塔防/.test(desc);
  if (!ok) return { err: 'desc 不匹配: ' + desc.slice(0, 40) };
  const m =
    html.match(/class="index_abstractImg__[^"]*"[^>]*src="([^"]+)"/) ||
    html.match(/<img src="(https:\/\/bkimg\.cdn\.bcebos\.com[^"]+)"/);
  if (!m) return { err: '无主图' };
  return { img: m[1].split('?')[0].replace(/&amp;/g, '&'), desc: desc.slice(0, 80), page: url };
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const report = [];
for (const name of NAMES) {
  let done = null;
  try {
    const lemmas = await findLemmas(name);
    if (!lemmas.length) {
      console.log(name, '✗ 必应未找到专属词条');
      report.push({ name, err: 'no lemma' });
      continue;
    }
    for (const lm of lemmas.slice(0, 3)) {
      try {
        const res = await lemmaImage(lm.lemma, lm.id);
        if (res.img) {
          const r = await fetch(res.img, { headers: { 'User-Agent': UA_M, Referer: 'https://baike.baidu.com/' } });
          const buf = Buffer.from(await r.arrayBuffer());
          const kind = sniff(buf);
          if (!kind || buf.length < 8000) {
            console.log(name, '图片无效', buf.length, kind);
            continue;
          }
          const file = `${name}.${kind}`;
          fs.writeFileSync(path.join(OUT_DIR, file), buf);
          done = { name, file, kind, src: res.img, page: res.page, lemma: lm.lemma, id: lm.id, desc: res.desc, bytes: buf.length };
          console.log(name, '✓', lm.lemma + '/' + lm.id, Math.round(buf.length / 1024) + 'KB');
          break;
        } else {
          console.log(name, '  跳过', lm.lemma + '/' + lm.id, res.err);
        }
      } catch (e) {
        console.log(name, '  异常', lm.lemma, e.message);
      }
      await sleep(450);
    }
  } catch (e) {
    console.log(name, '✗', e.message);
  }
  report.push(done || { name, err: 'failed' });
  await sleep(400);
}

fs.writeFileSync(
  path.join(ROOT, 'evidence/pvz-baike26b.json'),
  JSON.stringify({ harvestedAt: new Date().toISOString(), source: 'wapbaike.baidu.com', report }, null, 1),
  'utf8'
);
console.log('\n成功', report.filter((r) => r.file).length, '/', NAMES.length);
