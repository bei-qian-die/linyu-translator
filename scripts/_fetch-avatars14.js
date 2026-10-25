'use strict';
// 第十四轮人物配图(第一部分):UP 头像。
// 用各 UP 的已知视频 BV 走 view API 拿 owner.face,下载后裁成 256x256 PNG。
// 输出 evidence/hero-images14.json(name → {img, source}),由 apply-lore14.js 回填。
// 用法: node scripts/_fetch-avatars14.js
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const RAW = path.join(ROOT, 'evidence', 'hero-img-raw14');
const OUT = path.join(ROOT, 'evidence', 'hero-images14.json');
const PY = process.env.PY || 'py';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
fs.mkdirSync(RAW, { recursive: true });

// [人物名, 用于反查头像的 BV, 视频标题]
const PLAN = [
  ['芒果君101号', 'BV1Bu4y1N7my', '属于通讯录英雄们自己的BGM'],
  ['一个安东尼', 'BV1PjJ86kEFP', '【淋者荣耀】君问归期未有期'],
  ['零时序', 'BV1CqGK6sEkW', '【洛克淋国】雪天女子处理火狼队中'],
  ['不是地才素天才', 'BV1fG41197xy', '【阴淋师】一切都素我孔做的'],
  ['松下丶Aoki', 'BV1AWPxzqEu5', '【第五淋格】不是你记忆中的大副'],
  ['阴TV', 'BV1Mh4y1u75v', '婊时代13：笼里时代'],
  ['poke萌虻', 'BV1ub4y1D7gR', '王者淋系英雄盘点-鸡圈甜菜'],
  ['xx辰丶', 'BV1VkeizFEom', '【阴雄淋盟】素材基础，文案就不基础'],
  ['郭门小神童', 'BV1bSJr6UEiX', '【全程爆笑】胡艺莲大战柔博士欧文（6）'],
];

const map = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
let nextIdx = 261;
const used = new Set();
for (const f of fs.readdirSync(path.join(ROOT, 'src/renderer/img'))) {
  const m = f.match(/^hero-(\d+)\.png$/);
  if (m) used.add(Number(m[1]));
}
while (used.has(nextIdx)) nextIdx++;

(async () => {
  for (const [name, bv, title] of PLAN) {
    try {
      const r = await fetch('https://api.bilibili.com/x/web-interface/view?bvid=' + bv, {
        headers: { 'User-Agent': UA, Referer: 'https://www.bilibili.com/' },
      });
      const j = await r.json();
      if (j.code !== 0) {
        console.log('FAIL view', name, j.code, j.message);
        continue;
      }
      const up = j.data.owner.name;
      const face = j.data.owner.face;
      const raw = path.join(RAW, name + '-avatar.' + (face.includes('.png') ? 'png' : 'jpg'));
      const ir = await fetch(face, { headers: { 'User-Agent': UA, Referer: 'https://www.bilibili.com/' } });
      if (!ir.ok) {
        console.log('FAIL img', name, ir.status);
        continue;
      }
      fs.writeFileSync(raw, Buffer.from(await ir.arrayBuffer()));
      const idx = nextIdx++;
      const dst = path.join(ROOT, 'src/renderer/img', 'hero-' + idx + '.png');
      execFileSync(PY, [path.join(ROOT, 'scripts/crop-hero.py'), raw, dst, 'fit']);
      map[name] = {
        img: 'img/hero-' + idx + '.png',
        source: 'B站 UP「' + up + '」头像（BV' + bv.slice(2) + '《' + title + '》作者）',
      };
      console.log('OK', name, '←', up, face, '→ hero-' + idx + '.png');
    } catch (e) {
      console.log('ERR', name, e.message);
    }
  }
  fs.writeFileSync(OUT, JSON.stringify(map, null, 2) + '\n');
  console.log('written', OUT);
})();
