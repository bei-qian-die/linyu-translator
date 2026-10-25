'use strict';

// 从新采的语料里挖候选条目。
//
// 设计要点：候选全部**逐字取自语料行**，所以 attest.js 的闸门天然就能过，
// 不需要给任何一条编 verify。出处直接写 B 站 BV 号，可点开核对。
//
// 三类产出：
//   QUOTE  名言——带强淋语标记的短评论行（连续 >=10 字，闸门要求）
//   CARD   词卡——反复出现但库里没有的淋语短语
//   RULE   句式——能在真实语料里命中的新正则，且与现有 123 条不重复
//
// 只出候选，不写内容文件。候选写到 evidence/mined-<stamp>.json，人工过一遍再采纳。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = process.cwd();
const seed = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/core/seed.json'), 'utf8'));
const m = { exports: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'src/core/lore.js'), 'utf8'), {
  module: m, exports: m.exports,
  require: (p) => require(path.join(ROOT, 'src/core', String(p).replace(/^.*[\\/]/, ''))),
});
const lore = m.exports;

// 语料文件名：默认取最新一份 harvest 产物
// 默认取 corpus/ 下最新一份 harvest 产物；目录不存在时回退扫根目录
function defaultCorpus() {
  const dir = path.join(ROOT, 'corpus');
  const pick = (d, prefix) =>
    fs.existsSync(d)
      ? fs.readdirSync(d).filter((f) => /^corpus-bili-.*\.txt$/.test(f)).sort().slice(-1).map((f) => (prefix ? path.posix.join('corpus', f) : f))
      : [];
  return pick(dir, true).length ? pick(dir, true) : pick(ROOT, false);
}
const arg = process.argv[2];
const corpusFiles = (arg ? arg.split(',') : defaultCorpus());
if (!corpusFiles.length) { console.error('没找到 corpus-bili-*.txt'); process.exit(1); }

// ---- 已有内容，建立去重集合 ----
const knownCards = new Set(lore.flashcards.map((c) => c.term));
const knownQuote = new Set(lore.quotes.map((q) => q.text));
const knownWords = new Set(seed.words.map((w) => w.zh));
const knownRule = new Set(seed.rules.map((r) => r.pattern));

// ---- 强淋语标记：句末语气词、圈层自称/黑话 ----
// 只认真正淋化的形态。放宽一点就会把饭圈对骂、现实闲聊一起收进来——
// 第一版用 /(惹|噜|...)/ 收尾，"适合甘肃省学前教育专升本嘛"、"来点评论好嘛求你们了"
// 都被当成名言；"抵制蔡依林没素质没教养演唱会恶心无耻下流" 更是在语料里出现了 32 次。
const TAIL = /(惹|噜|厚|靴靴)$/;
const SELF = /(本仙女|本可|本尊|本宫|本可人|本仙女滴|伦家|尊素|珍素|塔素|塔当前|素本可|灰机)/;
const HACK = /(鸡笼|补唇蜜|地才|淋语|通讯录|吸入|鸡冻|生煎|虎落|尊素|本直女|淋光|好兰化)/;

// ---- 明确排除：与淋语文化无关的内容 ----
const NOISE = /^(哈+|啊+|哦+|呵+|草|前排|沙发|打卡|签到|已阅)+$|前排|沙发|打卡|签到|求关注|互关|一键三连/;
// 饭圈撕逼：提到蔡依林不等于淋语，这类是纯粹的社区对立
const FANWAR = /(抵制|脱粉|没素质|没教养|塌房|黑子)/;
// 现实生活话题：考研/上班/房价这类跟淋语梗无关
const REALITY = /(考研|专升本|四级|六级|考证|公务员|房价|工资|上班|下班|论文|毕业|学校|宿舍|相亲|疫情)/;

const isLy = (t) => TAIL.test(t) || SELF.test(t) || HACK.test(t);

// 饭圈/现实过滤**只在行里没有淋语标记时才生效**。
// 早先无条件挡，误伤了 8 条好句子：「素的，本可素宇宙女神淋淋的忠实粉丝厚」
// 「淋淋是有努力和实力的，不是这种流量明星可以碰瓷的靴靴」——这些都是标准的舔淋语，
// 只是恰好提到了「粉丝」「碰瓷」。带着淋语标记的句子一律放行，刷屏的无条件挡。
const ok = (t) => !NOISE.test(t) && (isLy(t) || (!FANWAR.test(t) && !REALITY.test(t)));

const norm = (s) => String(s || '').replace(/\s+/g, '');
const strip = (s) => norm(s).replace(/[，。！？、；：""''‘“（）()…~—\-《》,.!?;:"'[\]【】]/g, '');

// ---- 解析语料，保留每行的来源 ----
// 仓库里有两种语料格式，必须都吃下，否则只能看到新 B 站那一份：
//   A. corpus-bili-*.txt（harvest-bili.js 产出）：【视频】【UP】【简介】【标签】【评论】
//   B. corpus3-13（早年脚本产出）：[dm] / [cmt] / [sub] / [desc] 前缀，没有视频上下文
// 格式 B 没有出处可挂，只能当"逐字命中语料"用，不进带出处的候选池。
const lines = [];
let blocks = 0;
for (const f of corpusFiles) {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) continue;
  let cur = null;
  for (const raw of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const l = raw.trim();
    if (!l || l.startsWith('#') || l.startsWith('=')) continue;

    const mv = l.match(/^【(视频|UP|简介|标签|评论)】(.*)$/);
    if (mv) {
      if (mv[1] === '视频') { cur = { title: mv[2] }; blocks++; }
      else if (mv[1] === '评论') {
        // 评论才是我们要的正文；UP/简介/标签只是上下文，存起来备查
        if (mv[2].trim()) lines.push({ text: mv[2].trim(), src: cur });
      } else if (cur) cur[mv[1]] = mv[2];
      continue;
    }
    const mp = l.match(/^\[(dm|cmt|sub)\]\s*(.+)$/);
    if (mp) { if (mp[2].trim()) lines.push({ text: mp[2].trim(), src: null }); continue; }

    if (!l.startsWith('[') && cur && cur.title) lines.push({ text: l, src: cur });
  }
}
console.log(`语料 ${corpusFiles.join(',')}`);
console.log(`B 站视频块 ${blocks} | 可解析行 ${lines.length}（含出处 ${lines.filter((l) => l.src).length}）`);
const srcLabel = (s) => (s ? `B站 ${s.title || ''} 弹幕`.slice(0, 60) : '本地语料');
// manifest 反查 BV 号：按视频标题对回去
const BV_CACHE = new Map();
function srcBV(s) {
  if (!s) return '';
  if (BV_CACHE.has(s.title)) return BV_CACHE.get(s.title);
  let bv = '';
  for (const g of fs.readdirSync(path.join(ROOT, 'evidence'))) {
    if (!/^manifest-.*\.json$/.test(g)) continue;
    let arr; try { arr = JSON.parse(fs.readFileSync(path.join(ROOT, 'evidence', g), 'utf8')); } catch { continue; }
    const hit = arr.find((v) => v.title === s.title);
    if (hit) { bv = hit.bvid; break; }
  }
  BV_CACHE.set(s.title, bv);
  return bv;
}

const usable = lines.filter((l) => l.text.length >= 6 && l.text.length <= 60 && ok(l.text));
console.log(`原始行 ${lines.length} | 过滤后 ${usable.length}（排除刷屏 ${lines.length - lines.filter((l) => ok(l.text)).length} 条）`);

// ---- QUOTE：必须同时满足"够长"和"是淋语形态" ----
const qMap = new Map();
for (const l of usable) {
  const t = strip(l.text);
  if (t.length < 10 || t.length > 45) continue;
  if (knownQuote.has(l.text)) continue;
  // 只有带句末语气词、或带圈层自称/黑话的行才算名言。
  // 不要求"命中其一"：像"本仙女在干神马捏"没有句末语气词，但有自称，仍然是淋语。
  if (!TAIL.test(l.text) && !SELF.test(l.text) && !HACK.test(l.text)) continue;
  const key = t.slice(0, 14);
  if (!qMap.has(key)) qMap.set(key, { text: l.text.replace(/[。.!！]+$/, ''), hit: 0, src: srcLabel(l.src), bv: srcBV(l.src) });
  qMap.get(key).hit++;
}
const quotes = [...qMap.values()]
  .filter((q) => q.hit >= 1 && strip(q.text).length >= 10)
  .sort((a, b) => b.hit - a.hit || (b.bv ? 1 : 0) - (a.bv ? 1 : 0));

// ---- CARD：反复出现但库里没有的短语 ----
const cCount = new Map();
for (const l of usable) {
  const clean = l.text.replace(/[\s，。！？、；：,.!?;:"'“”‘’()（）【】[\]~～^*#@$%&+=|\\/_-]+/g, '#');
  for (const seg of clean.split('#')) {
    if (seg.length < 2 || seg.length > 8) continue;
    for (let n = 3; n <= Math.min(6, seg.length); n++) {
      for (let i = 0; i + n <= seg.length; i++) {
        const g = seg.slice(i, i + n);
        if (!HACK.test(g) && !TAIL.test(g) && !SELF.test(g)) continue;
        if (knownCards.has(g) || knownWords.has(g)) continue;
        if (!cCount.has(g)) cCount.set(g, { g, hit: 0, src: srcLabel(l.src), bv: srcBV(l.src) });
        cCount.get(g).hit++;
      }
    }
  }
}
// 只保留出现 2 次以上、且不是更长词的子串
const cardsRaw = [...cCount.values()].filter((c) => c.hit >= 2).sort((a, b) => b.hit - a.hit);
const cards = cardsRaw.filter((c) => !cardsRaw.some((d) => d !== c && d.g.includes(c.g) && d.hit >= c.hit));

// ---- RULE：从高重复的评论结构里找新正则 ----
const ruleCands = [];
for (const l of usable) {
  const t = l.text.replace(/[\s，。！？、；：,.!?;:"'“”‘’()（）]/g, '');
  if (t.length < 4) continue;
  // 抽 "X…惹/噜/厚" 这种句末语气词结构
  const mm = t.match(/^(.{2,10}?)(惹|噜|厚)$/);
  if (mm && !knownRule.has('(.{1,' + mm[1].length + '}?)' + mm[2] + '$')) {
    ruleCands.push({ pattern: `(.{1,${mm[1].length}}?)${mm[2]}`, sample: l.text, hit: 1, src: srcLabel(l.src) });
  }
}
const ruleSeen = new Set();
const rules = ruleCands.filter((r) => {
  if (ruleSeen.has(r.pattern)) return false;
  ruleSeen.add(r.pattern);
  return !knownRule.has(r.pattern);
});

const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
const out = path.join(ROOT, 'evidence', `mined-${stamp}.json`);
fs.writeFileSync(out, JSON.stringify({
  minedAt: new Date().toISOString(),
  corpus: corpusFiles,
  note: '全部逐字取自语料，天然满足 attest.js 闸门；出处为 B 站视频弹幕。未写入任何内容文件。',
  quotes, cards, rules,
}, null, 2), 'utf8');

console.log(`\n候选：名言 ${quotes.length} | 词卡 ${cards.length} | 句式 ${rules.length}`);
console.log(`清单 ${path.relative(ROOT, out)}`);
console.log('\n--- 名言前 15 ---');
quotes.slice(0, 15).forEach((q) => console.log(`  [${q.hit}] ${q.text.slice(0, 34)}  ←${q.bv || '?'}`));
console.log('\n--- 词卡前 15 ---');
cards.slice(0, 15).forEach((c) => console.log(`  [${c.hit}] ${c.g}  ←${c.bv || '?'}`));
console.log('\n--- 句式前 10 ---');
rules.slice(0, 10).forEach((r) => console.log(`  ${r.pattern}  样例：${r.sample.slice(0, 26)}`));