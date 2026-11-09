// 剩余角色的别名尝试：百度百科对同一角色可能用「土豆地雷 / 撑杆僵尸 / 星星果 / 猫尾草」等别名，
// 逐个试 /item/{名} 拿主图；命中条件是该词条描述里出现植物大战僵尸相关词。
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT_DIR = path.join(ROOT, 'evidence/pvz-baike26');
const UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';

const PLAN = [
  ['樱桃炸弹', ['樱桃炸弹(植物大战僵尸)', '樱桃炸弹']],
  ['土豆雷', ['土豆地雷', '土豆雷(植物大战僵尸)']],
  ['模仿者', ['模仿者(植物大战僵尸)', '模仿者']],
  ['杨桃', ['星星果', '杨桃(植物大战僵尸)']],
  ['睡莲', ['睡莲(植物大战僵尸)', '荷叶(植物大战僵尸)']],
  ['香蒲', ['猫尾草', '香蒲(植物大战僵尸)']],
  ['撑杆跳僵尸', ['撑杆僵尸', '撑杆跳僵尸(植物大战僵尸)']],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function sniff(buf) {
  if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50) return 'png';
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8) return 'jpg';
  return '';
}

async function probe(lemma) {
  const url = 'https://wapbaike.baidu.com/item/' + encodeURIComponent(lemma);
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) return { err: 'http ' + r.status };
  const html = await r.text();
  if (html.includes('captchaview')) return { err: '验证码' };
  const desc = (html.match(/<meta name="description" content="(.*?)"/) || [])[1] || '';
  if (!/植物大战僵尸|僵尸|戴夫|塔防/.test(desc)) return { err: 'desc: ' + desc.slice(0, 30) };
  const m =
    html.match(/class="index_abstractImg__[^"]*"[^>]*src="([^"]+)"/) ||
    html.match(/<img src="(https:\/\/bkimg\.cdn\.bcebos\.com[^"]+)"/);
  if (!m) return { err: '无主图', desc };
  return { img: m[1].split('?')[0].replace(/&amp;/g, '&'), desc: desc.slice(0, 70), page: url };
}

const out = [];
for (const [name, alts] of PLAN) {
  for (const al of alts) {
    try {
      const res = await probe(al);
      if (!res.img) {
        console.log(name, '|', al, '✗', res.err);
        await sleep(450);
        continue;
      }
      const r = await fetch(res.img, { headers: { 'User-Agent': UA, Referer: 'https://baike.baidu.com/' } });
      const buf = Buffer.from(await r.arrayBuffer());
      const kind = sniff(buf);
      if (!kind || buf.length < 8000) {
        console.log(name, '|', al, '图片无效', buf.length);
        continue;
      }
      const file = `${name}.${kind}`;
      fs.writeFileSync(path.join(OUT_DIR, file), buf);
      out.push({ name, file, src: res.img, page: res.page, lemma: al, desc: res.desc, bytes: buf.length });
      console.log(name, '✓', al, Math.round(buf.length / 1024) + 'KB');
      break;
    } catch (e) {
      console.log(name, '|', al, 'ERR', e.message);
    }
    await sleep(450);
  }
}
console.log('\n命中', out.length, '/', PLAN.length);
fs.writeFileSync(path.join(ROOT, 'evidence/pvz-baike26c.json'), JSON.stringify(out, null, 1), 'utf8');
