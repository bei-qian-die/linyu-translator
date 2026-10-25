'use strict';

// 第十四轮候选整理（只读 evidence/lexicon-cand14.json + 本轮 manifest → 写一张人工可直接照抄的核对表）。
// 输出：
//   evidence/cand14-review.txt    每条候选一行：写法 | 命中行 | 命中视频 | 来源方式 | 语义位(concept/zh) | 出处 BV | 样例原文
//   evidence/cand14-merge.txt     库里已有中文词头、但本轮出现了新淋写法的（优先往 alias 补）
// 排序：优先「只在新语料里出现」的（本轮真增量），其次命中行数高的。
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const EV = path.join(ROOT, 'evidence');

const data = JSON.parse(fs.readFileSync(path.join(EV, 'lexicon-cand14.json'), 'utf8'));
const NEW = new Set(data.newBatch || []);

// title -> bvid（本轮优先，其次全量 manifest）
const idx = new Map();
for (const g of fs.readdirSync(EV)) {
  if (!/^manifest-.*\.json$/.test(g)) continue;
  let arr;
  try {
    arr = JSON.parse(fs.readFileSync(path.join(EV, g), 'utf8'));
  } catch {
    continue;
  }
  if (!Array.isArray(arr)) continue;
  for (const v of arr) {
    if (v && v.title && v.bvid && !idx.has(v.title)) idx.set(v.title, v);
  }
}

const variantsOf = (s) =>
  String(s || '')
    .split(/[、,，;；]/)
    .map((x) => x.trim())
    .filter(Boolean);
const norm = (s) => String(s || '').replace(/\s+/g, '').toLowerCase();
const knownZh = new Set(data.corpusFiles ? undefined : undefined);
// 用 seed 判断 concept 是否已收录
const seed = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/core/seed.json'), 'utf8'));
const zhSet = new Map();
for (const w of seed.words) zhSet.set(norm(w.zh), w);

// 样例行所在视频必须是淋语生态视频（标题/UP/标签命中），否则「淋病/英语/医学科普」这类
// 蹭到同一个字的无关区会被当成候选来源——本轮检索把它们也抓进来了，必须在这一步挡掉。
const LIN_TITLE =
  /(淋|阴雄|阴婷|阴中|通讯录|姐圈|本可|本仙女|本猪|靴靴|地才|杯糕|酱肘子|完颜|那艺娜|三梦|万人迷|郭老师|鹅妈妈|楼兰|新酱|肘姐|蔡依林|蔡依淋|jolin|Daddy|daddy|淋耀|淋盟|淋格|淋神|淋日|淋明|淋国|绝区淋|守望淋锋|星淋铁道|永劫淋间|重返未淋|街头霸淋|淋者|阴淋|淋化|淋语|淋学|淋文|淋味|淋门|可淋|吸惹|吸入|惹$|噜$)/;
function linyuVideo(rec) {
  const t = String((idx.get(rec.title) || {}).title || rec.title || '') + ' ' + String((idx.get(rec.title) || {}).up || '');
  return LIN_TITLE.test(t);
}

const fmt = (r) => {
  const s = (r.samples || [])[0] || {};
  const m = idx.get(s.title) || idx.get(r.cand) || null;
  const bv = s.bv || (m && m.bvid) || '';
  const title = (s.title || (m && m.title) || '').slice(0, 40);
  const inFile = NEW.has(s.file) ? '*' : ' ';
  return `${String(r.lineCount).padStart(3)}行 ${String(r.count).padStart(4)}次 ${String(r.videoCount).padStart(3)}片 淋境${String(r.linyuLineCount || 0).padStart(3)} ${inFile} ${r.cand.padEnd(8, '　')} | ${r.via.join(',')} | concept=${(r.meta && r.meta.concept) || ''}${r.meta && r.meta.linyu ? '(' + r.meta.linyu + ')' : ''} | ${bv} ${title} | ${(s.text || '').slice(0, 64)}`;
};

const goldAll = (data.gold || []).filter((r) => r.gold);
const gold = goldAll.filter((r) => linyuVideo((r.samples || [])[0] || {}));
const offTopic = goldAll.filter((r) => !linyuVideo((r.samples || [])[0] || {}));
const usable = (data.usable || []).filter((r) => r.usable && !r.gold && linyuVideo((r.samples || [])[0] || {}));
// 只在新语料出现的排前面
const sorter = (a, b) => {
  const an = a.onlyNewBatch ? 0 : 1;
  const bn = b.onlyNewBatch ? 0 : 1;
  if (an !== bn) return an - bn;
  return b.lineCount - a.lineCount || b.videoCount - a.videoCount;
};
gold.sort(sorter);
usable.sort(sorter);

const lines = [];
lines.push(`### GOLD 候选（整词 + 命中行>=2 + >=2 行淋语语境 + 含淋语特征字 + 样例视频属淋语生态）共 ${gold.length}，新语料独占 ${gold.filter((r) => r.onlyNewBatch).length}`);
lines.push(`### 被视频标题闸门挡掉的（大概率是医学/语言学习等蹭字区）${offTopic.length} 条，见 cand14-offtopic.txt`);
lines.push(`### （* = 样例行来自本轮新语料）`);
gold.slice(0, 900).forEach((r) => lines.push(fmt(r)));
lines.push('');
lines.push(`### 次级 usable（整词 + >=2 行，但没有淋语特征字，只能作补变体参考）共 ${usable.length}`);
usable.slice(0, 260).forEach((r) => lines.push(fmt(r)));
fs.writeFileSync(path.join(EV, 'cand14-review.txt'), lines.join('\n'), 'utf8');
fs.writeFileSync(path.join(EV, 'cand14-offtopic.txt'), offTopic.map(fmt).join('\n'), 'utf8');

// 可并 alias：库里已有这个中文词头，本轮冒出新写法
const merge = (data.mergeable || []).filter((r) => r.usable);
const ml = [];
ml.push(`### mergeable（库里已有 zh 词头、本轮出现新淋写法，往 alias 补）共 ${merge.length}`);
for (const r of merge) {
  const own = zhSet.get(norm(r.cand));
  ml.push(fmt(r) + ` || 既有词条=${own ? own.zh + '→' + own.linyu + '/' + variantsOf(own.alias).join(',') : ''}`);
}
fs.writeFileSync(path.join(EV, 'cand14-merge.txt'), ml.join('\n'), 'utf8');

console.log(`usable=${usable.length} merge=${merge.length} stats=${JSON.stringify(data.stats)}`);
