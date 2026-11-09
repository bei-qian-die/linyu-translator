// 第二十六轮补图·主路径：百度百科移动端词条主图。
// 用户指定的首选来源就是「百度词条相关图」；桌面版 baike 返回 403，移动版 wapbaike 正常。
// 每个角色按候选词条名依次尝试，命中后取 index_abstractImg 的 bcebos 主图。
// 全流程只下载真实网络图片，不生成、不绘制、不改画面内容。
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT_DIR = path.join(ROOT, 'evidence/pvz-baike26');
const UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';

// [展示名, 候选词条名（按序尝试）, 必须出现的关键词]
const TARGETS = [
  ['豌豆射手', ['豌豆射手'], ['植物大战僵尸', '豌豆']],
  ['向日葵', ['向日葵(植物大战僵尸)', '向日葵'], ['植物大战僵尸']],
  ['坚果墙', ['坚果墙', '坚果墙(植物大战僵尸)'], ['植物大战僵尸', '坚果']],
  ['樱桃炸弹', ['樱桃炸弹'], ['植物大战僵尸']],
  ['寒冰射手', ['寒冰射手(植物大战僵尸)', '寒冰射手'], ['植物大战僵尸']],
  ['大嘴花', ['大嘴花'], ['植物大战僵尸']],
  ['大喷菇', ['大喷菇'], ['植物大战僵尸']],
  ['土豆雷', ['土豆雷'], ['植物大战僵尸']],
  ['火爆辣椒', ['火爆辣椒'], ['植物大战僵尸']],
  ['地刺', ['地刺(植物大战僵尸)', '地刺'], ['植物大战僵尸']],
  ['磁力菇', ['磁力菇'], ['植物大战僵尸']],
  ['模仿者', ['模仿者(植物大战僵尸)', '模仿者'], ['植物大战僵尸']],
  ['三线射手', ['三线射手'], ['植物大战僵尸']],
  ['杨桃', ['杨桃(植物大战僵尸)', '杨桃'], ['植物大战僵尸']],
  ['睡莲', ['睡莲(植物大战僵尸)', '睡莲'], ['植物大战僵尸']],
  ['墓碑吞噬者', ['墓碑吞噬者'], ['植物大战僵尸', '墓碑']],
  ['香蒲', ['香蒲(植物大战僵尸)', '香蒲'], ['植物大战僵尸']],
  ['疯狂戴夫', ['疯狂戴夫', '戴夫(植物大战僵尸)'], ['植物大战僵尸', '戴夫']],
  ['撑杆跳僵尸', ['撑杆跳僵尸', '撑杆跳僵尸(植物大战僵尸)'], ['僵尸']],
  ['蹦极僵尸', ['蹦极僵尸'], ['僵尸']],
  ['矿工僵尸', ['矿工僵尸'], ['僵尸']],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function fmt(url) {
  // bcebos 的 x-bce-process 会把图压成 webp 小图，去掉后取原图更清晰
  return url.split('?')[0];
}

async function tryLemma(name, keywords) {
  const url = 'https://wapbaike.baidu.com/item/' + encodeURIComponent(name);
  const r = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'zh-CN,zh;q=0.9' },
    redirect: 'follow',
  });
  if (!r.ok) return { err: 'http ' + r.status };
  const html = await r.text();
  const desc = (html.match(/<meta name="description" content="(.*?)"/) || [])[1] || '';
  const title = (html.match(/id="J-lemma-title"[^>]*>(?:<[^>]+>)*([^<]{1,40})/) || [])[1] || '';
  if (!keywords.some((k) => desc.includes(k) || title.includes(k))) {
    return { err: '词条名不匹配: ' + (title || name) };
  }
  const m = html.match(/class="index_abstractImg__[^"]*"[^>]*src="([^"]+)"/) ||
    html.match(/<img src="(https:\/\/bkimg\.cdn\.bcebos\.com[^"]+)"/);
  if (!m) return { err: '未找到词条主图' };
  return { img: fmt(m[1].replace(/&amp;/g, '&')), title: title || name, desc: desc.slice(0, 60) };
}

function sniff(buf) {
  if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50) return 'png';
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8) return 'jpg';
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF') return 'webp';
  return '';
}

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const f of fs.readdirSync(OUT_DIR)) fs.unlinkSync(path.join(OUT_DIR, f));

const report = [];
for (const [zh, lemmas, kws] of TARGETS) {
  let got = null;
  const tried = [];
  for (const lm of lemmas) {
    try {
      const res = await tryLemma(lm, kws);
      tried.push(lm + ' → ' + (res.img ? 'OK' : res.err));
      if (res.img) {
        got = { ...res, lemma: lm };
        break;
      }
    } catch (e) {
      tried.push(lm + ' → ERR ' + e.message);
    }
    await sleep(500);
  }
  if (!got) {
    console.log(zh, '失败:', tried.join(' ; '));
    report.push({ name: zh, tried, file: '' });
    continue;
  }
  try {
    const r = await fetch(got.img, { headers: { 'User-Agent': UA, Referer: 'https://baike.baidu.com/' } });
    const buf = Buffer.from(await r.arrayBuffer());
    const kind = sniff(buf);
    const file = `${zh}.${kind || 'jpg'}`;
    fs.writeFileSync(path.join(OUT_DIR, file), buf);
    report.push({ name: zh, lemma: got.lemma, title: got.title, src: got.img, file, bytes: buf.length, kind });
    console.log(zh, '✓', got.lemma, Math.round(buf.length / 1024) + 'KB', kind);
  } catch (e) {
    console.log(zh, '下载失败', e.message);
    report.push({ name: zh, tried, file: '' });
  }
  await sleep(400);
}

fs.writeFileSync(
  path.join(ROOT, 'evidence/pvz-baike26.json'),
  JSON.stringify({ harvestedAt: new Date().toISOString(), source: 'wapbaike.baidu.com', report }, null, 1),
  'utf8'
);
console.log('\n成功', report.filter((r) => r.file).length, '/', TARGETS.length);
