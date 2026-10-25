'use strict';
// 把 evidence/hero-images11.json 里核验过的配图回填进 src/core/lore-extra11.js：
//   - heroes[].img 填成 'img/hero-N.png'
//   - 把「配图来源（百度图库）」这类占位链接换成核验过的真实来源（百度图库检索页 / 百科词条 /
//     B 站视频页 / 贴吧页），保证每张图都能回源核对。
// 幂等：可重复执行。
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TARGET = path.join(ROOT, 'src', 'core', 'lore-extra11.js');
const EVI = JSON.parse(fs.readFileSync(path.join(ROOT, 'evidence', 'hero-images11.json'), 'utf8'));

const byName = new Map();
for (const r of EVI.report || []) if (r.file) byName.set(r.name, r);

// 人工确认过的图与人物对照表（图片文件 → 人物名）
const HERO_FILE = {
  'hero-200.png': '罗玉凤',
  'hero-201.png': '英中啊英中',
  'hero-202.png': 'FLY组合',
  'hero-203.png': '张元英',
  'hero-204.png': '杨玉环',
  'hero-205.png': '孙尚香',
  'hero-206.png': '百里守约',
  'hero-207.png': '青行灯',
  'hero-208.png': '黑天鹅',
  'hero-209.png': '陈',
  'hero-210.png': '青子',
  'hero-211.png': '琴女',
  'hero-212.png': '本吧英雄绰号大科普',
  'hero-213.png': '聊赠一枝竹',
};

let src = fs.readFileSync(TARGET, 'utf8');
let changed = 0;

for (const [file, name] of Object.entries(HERO_FILE)) {
  const rec = byName.get(name);
  const rel = 'img/' + file;

  // 1) 回填 img 字段：定位该人物对象，替换其 "img": ""
  const nameIdx = src.indexOf(`"name": "${name}"`);
  if (nameIdx < 0) {
    console.error('[miss] 未找到人物条目: ' + name);
    continue;
  }
  const imgIdx = src.indexOf('"img": ""', nameIdx);
  const imgEnd = src.indexOf('"', nameIdx + 10);
  if (imgIdx < 0 || (imgEnd > 0 && imgIdx > imgEnd + 400)) {
    console.error('[miss] 未找到 img 字段: ' + name);
    continue;
  }
  if (!src.slice(nameIdx, imgIdx).includes('"name": "' + name + '"')) {
    console.error('[miss] img 字段不属于该人物: ' + name);
    continue;
  }
  src = src.slice(0, imgIdx) + `"img": "${rel}"` + src.slice(imgIdx + '"img": ""'.length);
  changed += 1;

  // 2) 替换「配图来源（...）」占位链接为核验过的真实来源
  const heroBlockEnd = src.indexOf('\n  },', nameIdx);
  const block = src.slice(nameIdx, heroBlockEnd > 0 ? heroBlockEnd : nameIdx + 4000);
  const linkRe = /\{\s*"label": "配图来源[^"]*",\s*"url": "[^"]*"\s*\}/;
  if (linkRe.test(block)) {
    const srcUrl = (rec && (rec.pageUrl || rec.url)) || '';
    const label = '配图来源（' + ((rec && rec.how) || '百度图库').split('·')[0].trim() + '）：' + (rec && rec.how ? rec.how.split('·').slice(1).join('·').trim() : '') + '｜命中标题：' + ((rec && rec.title) || '').slice(0, 60);
    const repl = '{\n        "label": ' + JSON.stringify(label) + ',\n        "url": ' + JSON.stringify(srcUrl) + '\n      }';
    const newBlock = block.replace(linkRe, repl);
    src = src.slice(0, nameIdx) + newBlock + src.slice(nameIdx + block.length);
    changed += 1;
  } else {
    console.error('[note] 未找到配图来源占位链接: ' + name);
  }
}

fs.writeFileSync(TARGET, src, 'utf8');
console.log('[backfill] 回填完成，改动 ' + changed + ' 处 →', path.relative(ROOT, TARGET));
