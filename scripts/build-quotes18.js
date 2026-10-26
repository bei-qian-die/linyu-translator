'use strict';

// 第十八轮名言落地：把 evidence/cand18-quotes.json 里打分靠前的候选转成
// scripts/curated-quotes18.json，并按文本里出现的角色名自动挂 hero。
//
// 作者口径：
//   - 有 UP 名的（新格式语料块）→ author 直接写 UP 名，可回源到具体视频
//   - 没有的（旧格式语料）→ 写作品出处「B站第五人格相关视频评论区」，不编人名
// 用法: node scripts/build-quotes18.js [取前N条]
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TOP = Number(process.argv[2] || 110);
const CAND = JSON.parse(fs.readFileSync(path.join(ROOT, 'evidence/cand18-quotes.json'), 'utf8')).items;

// 角色名 → hero 名（用于挂关联，只认明确出现的名字）
const HERO_HINT = [
  ['红蝶', ['红蝶', '我蝶']],
  ['杰克', ['杰克']],
  ['盲女', ['盲女', '你盲', '盲人', '盲杖']],
  ['佣兵', ['佣兵', '奈布']],
  ['祭司', ['祭司']],
  ['调香师', ['调香师', '调马师']],
  ['大副', ['大副']],
  ['渔女', ['渔女']],
  ['小丑', ['小丑']],
  ['鹿头', ['鹿头']],
  ['宿伞之魂', ['宿伞']],
  ['机械师', ['机械']],
  ['愚人金', ['愚人金']],
  ['喧嚣', ['喧嚣']],
  ['时空之影', ['时空之影']],
  ['舞女', ['舞女']],
  ['魔术师', ['魔术师']],
  ['冒险家', ['冒险家']],
  ['勘探员', ['勘探员']],
  ['调酒师', ['调酒师']],
  ['杂技演员', ['杂技']],
  ['画家', ['画家']],
  ['病患', ['病患']],
  ['心理学家', ['心理']],
  ['玩具商', ['玩具商']],
  ['空军', ['空军']],
  ['咒术师', ['咒术师', '医咒']],
  ['前锋', ['前锋']],
  ['昆虫学者', ['昆虫']],
  ['囚徒', ['囚徒']],
  ['邮差', ['邮差']],
  ['入殓师', ['入殓师']],
  ['园丁', ['园丁']],
  ['雕刻家', ['雕刻家']],
  ['黄衣之主', ['黄占']],
];

function heroOf(text) {
  for (const [hero, keys] of HERO_HINT) {
    for (const k of keys) if (text.includes(k)) return hero;
  }
  return '';
}

const seen = new Set();
const out = [];

// 落库前再过一遍语料：只认逐字命中的句子。
// 候选池里混着几条因表情符号/全角标点差异而失真的句子，靠这一步挡掉，
// 免得 attes 阶段才发现「名言在语料里查不到」。
const norm = (s) => String(s || '').replace(/[\s，。、！？；：""''（）()【】\[\]…~～·—\-_/\\|,.:;!?"'“”‘’]/g, '').toLowerCase();
let corpus = '';
for (const f of fs.readdirSync(path.join(ROOT, 'corpus')).filter((x) => x.endsWith('.txt'))) {
  corpus += fs.readFileSync(path.join(ROOT, 'corpus', f), 'utf8') + '\n';
}
const NC = norm(corpus);
const hit = (t) => NC.includes(norm(t));

for (const c of CAND) {
  const t = String(c.text || '').trim();
  if (!t || seen.has(t)) continue;
  if (t.length < 8 || t.length > 62) continue;
  if (!hit(t)) continue;
  seen.add(t);
  const hero = heroOf(t);
  out.push({
    text: t,
    author: c.up ? c.up : 'B站第五人格相关视频评论区',
    hero,
    src: c.up ? `https://search.bilibili.com/all?keyword=${encodeURIComponent(c.title || t)}` : 'https://www.bilibili.com/',
    scene: c.kind === '标题' ? '第五淋格 / 标题' : '第五淋格 / 评论',
    score: c.score,
  });
  if (out.length >= TOP) break;
}

fs.writeFileSync(path.join(ROOT, 'scripts/curated-quotes18.json'), JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log(
  `[quotes18] ${out.length} 条，其中挂人物 ${out.filter((q) => q.hero).length} 条，带 UP 署名 ${out.filter((q) => q.author !== 'B站第五人格相关视频评论区').length} 条`
);
