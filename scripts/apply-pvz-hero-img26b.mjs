// 第二十六轮配图落地：把人工核对过、确认是对应角色的图统一裁成 256×256，
// 按 hero-958 起的连续序号写入 src/renderer/img，并回填英雄的 img 与「配图来源」链接。
//
// 图源规则（全部为真实网络图片，无任何生成/绘制）：
//   baike      → 百度百科词条主图（wapbaike 移动端，图床 bkimg.cdn.bcebos.com）
//   baike-gal  → 百度百科「植物大战僵尸」词条图集
//   so         → 360 图片检索到的公开图片（图床 *.qhimg.com / *.qhimgs1.com）
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const IMG_DIR = path.join(ROOT, 'src/renderer/img');
const TMP = path.join(ROOT, 'evidence/_stage26');

const readJ = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const baikeA = readJ('evidence/pvz-baike26.json');
const baikeB = readJ('evidence/pvz-baike26b.json');
const baikeC = readJ('evidence/pvz-baike26c.json');
const baikeD = readJ('evidence/pvz-baike26d.json');
const gallery = readJ('evidence/pvz-baike-gallery.json');
const soB = readJ('evidence/pvz-img-so26b.json');
const soC = readJ('evidence/pvz-img-so26c.json');

function soPick(meta, name, file) {
  const r = meta.report.find((x) => x.name === name);
  if (!r) return null;
  const list = r.picked || r.cands || [];
  return list.find((p) => p.file === file) || list[0];
}
function baikePick(_meta, name) {
  // 三份抓取结果合并查（v1 全量、v2 必应定位、v3 别名）
  for (const m of [baikeA, baikeB, baikeC]) {
    const list = Array.isArray(m) ? m : m.report;
    const r = list.find((x) => x.name === name);
    if (r && r.file) return r;
  }
  return null;
}
function galPick(file) {
  return gallery.report.find((r) => r.file === file);
}

// [英雄名, {dir, file, src, page, type}]
const PLAN = [
  ['豌豆射手', { dir: 'pvz-baike26', ...baikePick(baikeB, '豌豆射手'), type: '百度百科词条主图' }],
  ['向日葵', { dir: 'pvz-baike26', ...baikePick(baikeB, '向日葵'), type: '百度百科词条主图' }],
  ['坚果墙', (() => { const g = galPick('植物大战僵尸-6.png'); return { dir: 'pvz-baike-gallery', file: g.file, src: g.src, page: 'https://baike.baidu.com/item/植物大战僵尸', type: '百度百科词条图集' }; })()],
  ['樱桃炸弹', (() => { const g = galPick('植物大战僵尸-5.png'); return { dir: 'pvz-baike-gallery', file: g.file, src: g.src, page: 'https://baike.baidu.com/item/植物大战僵尸', type: '百度百科词条图集' }; })()],
  ['寒冰射手', { dir: 'pvz-baike26', ...baikePick(baikeB, '寒冰射手'), type: '百度百科词条主图' }],
  ['大嘴花', { dir: 'pvz-baike26', ...baikePick(baikeB, '大嘴花'), type: '百度百科词条主图' }],
  ['大喷菇', { dir: 'pvz-baike26', ...baikePick(baikeB, '大喷菇'), type: '百度百科词条主图' }],
  ['土豆雷', { dir: 'pvz-baike26', file: baikeD.file, src: baikeD.src, page: baikeD.page, type: '百度百科词条图集' }],
  ['火爆辣椒', { dir: 'pvz-baike26', ...baikePick(baikeB, '火爆辣椒'), type: '百度百科词条主图' }],
  ['地刺', { dir: 'pvz-baike26', ...baikePick(baikeB, '地刺'), type: '百度百科词条主图' }],
  ['磁力菇', (() => { const g = galPick('磁力菇-2.png'); return { dir: 'pvz-baike-gallery', file: g.file, src: g.src, page: 'https://baike.baidu.com/item/磁力菇', type: '百度百科词条图集' }; })()],
  ['模仿者', (() => { const p = soPick(soB, '模仿者', 'imitater-2.png'); return { dir: 'pvz-raw26b', file: p.file, src: p.url, page: p.link || p.url, type: '360图片检索' }; })()],
  ['三线射手', { dir: 'pvz-baike26', ...baikePick(baikeB, '三线射手'), type: '百度百科词条主图' }],
  ['杨桃', { dir: 'pvz-baike26', ...baikePick(baikeC, '杨桃'), type: '百度百科词条主图' }],
  ['睡莲', (() => { const p = soPick(soC, '睡莲', 'lilypad-5.png'); return { dir: 'pvz-raw26c', file: p.file, src: p.url, page: p.link || p.url, type: '360图片检索' }; })()],
  ['墓碑吞噬者', { dir: 'pvz-baike26', ...baikePick(baikeB, '墓碑吞噬者'), type: '百度百科词条主图' }],
  ['香蒲', (() => { const p = soPick(soB, '香蒲', 'cattail-3.png'); return { dir: 'pvz-raw26b', file: p.file, src: p.url, page: p.link || p.url, type: '360图片检索' }; })()],
  ['疯狂戴夫', { dir: 'pvz-baike26', ...baikePick(baikeB, '疯狂戴夫'), type: '百度百科词条主图' }],
  ['撑杆跳僵尸', { dir: 'pvz-baike26', ...baikePick(baikeC, '撑杆跳僵尸'), type: '百度百科词条主图' }],
  ['蹦极僵尸', { dir: 'pvz-baike26', ...baikePick(baikeB, '蹦极僵尸'), type: '百度百科词条主图' }],
  ['矿工僵尸', { dir: 'pvz-baike26', ...baikePick(baikeB, '矿工僵尸'), type: '百度百科词条主图' }],
];

// 已用序号：取当前最大 hero-NNN
const used = fs
  .readdirSync(IMG_DIR)
  .map((f) => (f.match(/^hero-(\d+)\.png$/) || [])[1])
  .filter(Boolean)
  .map(Number);
let next = Math.max(...used) + 1;
console.log('现有图', used.length, '张 | 最大序号', Math.max(...used), '→ 新图从', next, '开始');

fs.mkdirSync(TMP, { recursive: true });

const out = [];
for (const [name, s] of PLAN) {
  const srcPath = path.join(ROOT, 'evidence', s.dir, s.file);
  if (!fs.existsSync(srcPath)) {
    console.log('✗ 缺文件', name, s.dir + '/' + s.file);
    continue;
  }
  const num = String(next).padStart(3, '0');
  const dst = path.join(IMG_DIR, `hero-${num}.png`);
  // 图鉴卡是竖版，用 fit 居中裁切会把主体切掉，统一走 contain 保留完整画面
  execFileSync('python', [path.join(ROOT, 'scripts/crop-hero.py'), srcPath, dst, 'contain']);
  out.push({ name, file: `hero-${num}.png`, num: next, type: s.type, src: s.src, page: s.page, origin: `${s.dir}/${s.file}` });
  console.log('✓', name, '→', `hero-${num}.png`, '|', s.type);
  next++;
}

fs.writeFileSync(
  path.join(ROOT, 'evidence/pvz-hero-images26-final.json'),
  JSON.stringify({ builtAt: new Date().toISOString(), report: out }, null, 1),
  'utf8'
);
console.log('\n共落地', out.length, '张');
