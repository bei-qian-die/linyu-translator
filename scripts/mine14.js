'use strict';

// 第十四轮语料开采器（由 scripts/mine13.js 改造）。
//
// 目标：从 corpus/*.txt 里捞出「还没进 seed.json 的真实淋语写法」和「高频固定套话」，
//       输出 evidence/lexicon-cand14.json 供 scripts/curated-linyu14.js 人工采纳。
//
// 硬约束：候选必须**逐字存在于语料**，所以全部从语料行里取，绝不凭空造词。
//        本脚本只统计、只写 evidence/，不碰 seed.json。
//
// 四类高精度抽取器（比单纯 n-gram 扫描准得多，泛用网络词会被挡在外面）：
//   A subst   —— 从现有 seed 的 zh↔淋语写法里学出「单字替换表」（心→熏、子→柱、死→鼠、
//                是→素、真→珍、欢→翻、谢→靴…），再拿 1144 个中文词头去套，
//                生成「本该存在但库里还没收」的变体，回语料里验真。
//   B dict    —— 直接解析词典型语料块（萌娘百科「淋语堂」用语表、百度百科、热梗百科、
//                贴吧《各位婊贝，这些貌似素现在嘟淋语词么？》的引号词表、淋吧英雄绰号科普）。
//                这些块的【来源】行自带真实 HTTP 出处。
//   C struct  —— 结构形态：「本X」自称、「淋X」专名、叠词、句尾语气词黏着（惹/噜/厚/熏/滴/酱/哒…）、
//                游戏分区「阴X/淋X/母X/X婆/X酱」英雄绰号。
//   D ngram   —— 兜底：全量 2~7 gram 频次统计（供上面三类查次数、也用来发现漏网特征词）。
//
// —— 本轮相对 mine13 的改动（词库饱和的教训）——
//   1) 新增 lineCount：同一个 gram 出现在多少条**不同语料行**里（原 count 是出现次数，
//      一条刷屏弹幕里能重复几十次，会把假变体顶到榜首）。采纳门槛改为 lineCount>=2。
//   2) 新增 wholeWord：该写法是否本身就是一个完整词段（前后是标点/空白/表情）。
//      单字替换派生出的「加班→家班」这类只能以子串形式出现在长句里，wholeWord=false，
//      这类一律不进 curated。curated 只收 wholeWord && lineCount>=2。
//   3) NEW_BATCH 改成环境变量传入（本轮 = harvest14 产出的语料），并输出 freshOnlyNewBatch
//      计数，方便判断「这轮新语料到底贡献了多少新写法」。
//
// 用法: node scripts/mine14.js [corpus/a.txt,corpus/b.txt] [--top=520] NEWBATCH="f1,f2"
//   默认扫 corpus/ 下全部 corpus*.txt。

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const opt = (name, dft) => {
  const hit = argv.find((a) => a.startsWith('--' + name + '='));
  return hit ? hit.split('=').slice(1).join('=') : dft;
};
const TOP = Number(opt('top', '420'));
const positional = argv.filter((a) => !a.startsWith('--'));

// 本轮 harvest14 产出的原始语料（增量主要看这里）；默认 = corpus-bili-20261025*.txt，可用 NEWBATCH= 覆盖
const NEW_BATCH = new Set(
  (
    process.env.NEWBATCH ||
    fs
      .readdirSync(path.join(ROOT, 'corpus'))
      .filter((f) => /^corpus-bili-20261025/.test(f))
      .join(',')
  )
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
);

const CORPUS_DIR = path.join(ROOT, 'corpus');
const files = (
  positional[0]
    ? positional[0].split(',')
    : fs
        .readdirSync(CORPUS_DIR)
        .filter((f) => /^corpus.*\.txt$/.test(f))
        .map((f) => 'corpus/' + f)
).map((f) => path.join(ROOT, f)).filter((p) => fs.existsSync(p));
if (!files.length) {
  console.error('没有可用语料文件');
  process.exit(1);
}

// ---------------------------------------------------------------- seed 去重集合
const seed = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/core/seed.json'), 'utf8'));
const norm = (s) => String(s || '').replace(/\s+/g, '').toLowerCase();
const variantsOf = (s) =>
  String(s || '')
    .split(/[、,，;；]/)
    .map((x) => x.trim())
    .filter(Boolean);

const knownLinyu = new Map(); // 归一化淋语写法 -> 所属 zh（用于「这个写法属于哪个语义位」）
const knownZh = new Map(); // 归一化中文词头 -> 该条 word
for (const w of seed.words) {
  for (const f of [w.linyu, ...variantsOf(w.alias)]) {
    const n = norm(f);
    if (n && !knownLinyu.has(n)) knownLinyu.set(n, w);
  }
  for (const f of [w.zh, ...variantsOf(w.zh)]) {
    const n = norm(f);
    if (n && !knownZh.has(n)) knownZh.set(n, w);
  }
}
const knownSubstr = new Set();
for (const k of knownLinyu.keys()) {
  for (let n = 2; n <= k.length; n++) for (let i = 0; i + n <= k.length; i++) knownSubstr.add(k.slice(i, i + n));
}
const knownPatterns = new Set(seed.rules.map((r) => r.pattern));

// ------------------------------------------------------------ 特征位（换字后必然是淋语）
// 数据推不出来就人工兜底：这批字在普通中文里几乎不会这样用，一旦命中就是淋语信号。
const STRONG =
  '淋惹噜厚靴熏柱鼠珍尊翻滴酱哒咪灰阴菌娼茶婊蕉蒜嘤喵捏呗蕾兽薯饺糕吱哩喔唔嘻吸洗猪可银丸康缩鸡莓橘锅吼惊艳蓝兰花华肥芙杯糕茶肾肯狠狠';
const MARK = new Set(STRONG.split(''));
// 只认这批「换了必然是淋语」的核心替换字，用于单字替换表兜底（可/鸡/猪 这种泛用字不算）
const CORE_SUB = new Set('熏柱鼠珍尊翻滴酱哒咪靴淋惹噜厚灰阴菌蕉蒜嘤喵蕾薯糕婷芷聚杯糕'.split(''));
const LIN_PHRASE =
  /(本可|本仙女|本仙子|本小仙女|本猪|本祝|本宫|本尊|本座|本淋|伦家|淋淋|淋语|淋耀|淋盟|淋格|淋明|淋日|淋者|淋系|淋形|淋菜|淋王星|婊贝|集美|靴靴|天啦噜|好兰化|鸡笼|地才|吸入|补唇蜜|灰机|尊素|珍素|塔素|就素|淋薇|淋13|淋贝塔|阴者自阴|通讯录|本质骑士|伪骑士)/;
const LIN_VIDEO =
  /(淋|蔡依林|蔡依淋|周阴|那艺娜|三梦奇缘|万人迷|完颜慧德|郭老师|通讯录|本可|阴雄|姐圈|地才|洛克|霉霉|梵谷|鸡你|ikun|蔡徐坤|楼兰|新酱|何老师|埃及艳后|凤仙子|开心姐|埋汰姐|施柔儿|老地瓜|玛莎|肘姐|指南杰斯猫|无限暖暖|光遇|绝区零|蛋仔|元梦)/;
const LY_FILES = new Set(['corpus-tieba-9747326338.txt', 'corpus-web-search.txt']);

// ------------------------------------------------------------ 语料解析（三种格式都吃下）
const lines = [];
let blocks = 0;
function isLinyuLine(text, cur, file) {
  if (LY_FILES.has(path.basename(file))) return true;
  if (LIN_PHRASE.test(text)) return true;
  let n = 0;
  for (const ch of text) if (MARK.has(ch)) n++;
  if (n >= 2) return true;
  if (cur && (LIN_VIDEO.test(cur.title || '') || LIN_VIDEO.test(String(cur['标签'] || '') + String(cur['简介'] || '')))) return true;
  return false;
}
const push = (text, cur, file, kind) => {
  const t = String(text || '').trim();
  if (!t) return;
  lines.push({
    text: t,
    file: path.basename(file),
    title: cur ? cur.title || '' : '',
    bv: cur ? cur.bv || '' : '',
    up: cur ? cur.up || '' : '',
    url: cur ? cur.url || '' : '',
    kind,
    ly: isLinyuLine(t, cur, file),
  });
};
const SKIP_LINE = /^(#|\[附加字段|{"|==+\s*$|---+$)/;

for (const file of files) {
  let cur = null;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const l = raw.trim();
    if (!l || SKIP_LINE.test(l)) continue;

    // 格式 A：harvest-bili.js ——【视频】/【UP】/【简介】/【标签】/【弹幕】/【评论】
    const mv = l.match(/^【(视频|UP|简介|标签|弹幕|评论)】(.*)$/);
    if (mv) {
      if (mv[1] === '视频') {
        cur = { title: mv[2].trim() };
        blocks++;
      } else if (cur) {
        if (mv[1] === 'UP') cur.up = mv[2].trim();
        else if (mv[1] === '简介' || mv[1] === '标签') cur[mv[1]] = mv[2].trim();
        else push(mv[2], cur, file, mv[1]);
      }
      continue;
    }

    // 格式 B：早期脚本 —— ==== [tag] BV… ==== up:… 头 + [desc]/[cmt]/[sub]/[dm]
    if (/^={4,}/.test(l)) {
      const rest = l.replace(/^={4,}\s*/, '');
      const head = rest.split(/\s={4,}\s/)[0];
      const bv = (head.match(/BV\w+/) || ['', ''])[0];
      const title = head.replace(/^\[[^\]]*\]\s*/, '').replace(bv, '').trim();
      cur = { title, bv, up: (rest.match(/up:(\S+)/) || ['', ''])[1] };
      blocks++;
      continue;
    }
    const mp = l.match(/^\[(desc|cmt|sub|dm)\]\s*(.+)$/);
    if (mp) {
      push(mp[2], cur, file, mp[1]);
      continue;
    }

    // 格式 C：网页/贴吧检索 —— 【来源】站点｜域名｜标题｜URL
    const ms = l.match(/^【来源】([^｜]*)｜([^｜]*)｜([^｜]*)｜(\S*)$/);
    if (ms) {
      cur = { title: ms[3].trim(), url: ms[4], bv: '' };
      blocks++;
      continue;
    }
    if (/^【回复】/.test(l)) {
      push(l.replace(/^【回复】/, ''), cur, file, 'reply');
      continue;
    }
    if (cur && (cur.title || cur.url)) push(l, cur, file, 'raw');
  }
}
console.log(`语料文件 ${files.length} 份 | 内容块 ${blocks} | 可解析行 ${lines.length}（淋语语境 ${lines.filter((l) => l.ly).length}）`);

// ---------------------------------------------------------------- 分词与频次表
/* eslint-disable no-useless-escape -- 这两个正则里 [] 连写会被解析成空字符类，保持显式转义更好读 */
const PUNCT = /[\s，。！？、；：,.!?;:"'“”‘’()（）【】\[\]~～^*#@$%&+=|\\/_\-→«»·…\u3000\r\t「」『』《》〈〉]/;
const EMOJI = /\[[^\[\]【】]{1,16}\]|【[^【】]{1,16}】/g;
/* eslint-enable no-useless-escape */
const clean = (t) =>
  String(t)
    .replace(EMOJI, '#')
    .replace(/https?:\/\/\S+/g, '#')
    .replace(/@[\w\u4e00-\u9fa5]{1,20}/g, '#')
    .replace(new RegExp(PUNCT.source, 'g'), '#');

/** 汉字串（连续片段）切出来做 gram 统计 */
const hanSeg = (t) => clean(t).split('#').filter((s) => s.length >= 2 && /[\u4e00-\u9fa5]/.test(s));

/** 全量 gram 频次表（2~7 字），key -> {c, s:[行号…], lc:不同行数, vc:不同视频数, lyc:淋语语境行数}；
 *  seg 表只统计「完整词段」（前后是标点/空白/表情，精度最高，用来挡「加班→家班」这类子串假变体） */
const G = new Map();
const SEG = new Map();
function sput(g, li, vid, ly) {
  let e = SEG.get(g);
  if (!e) SEG.set(g, (e = { c: 0, s: [], lc: 0, vc: 0, lyc: 0, _l: -1, _v: '' }));
  e.c++;
  if (e._l !== li) {
    e._l = li;
    e.lc++;
    if (ly) e.lyc++;
    if (e.s.length < 3) e.s.push(li);
  }
  if (vid && e._v !== vid) {
    e._v = vid;
    e.vc++;
  }
}
function gput(g, li, vid, ly) {
  let e = G.get(g);
  if (!e) G.set(g, (e = { c: 0, s: [], lc: 0, vc: 0, lyc: 0, _l: -1, _v: '' }));
  e.c++;
  if (e._l !== li) {
    e._l = li;
    e.lc++;
    if (ly) e.lyc++;
    if (e.s.length < 3) e.s.push(li);
  }
  if (vid && e._v !== vid) {
    e._v = vid;
    e.vc++;
  }
  return e;
}
for (let li = 0; li < lines.length; li++) {
  const vid = lines[li].bv || lines[li].title || lines[li].url || lines[li].file;
  const ly = lines[li].ly;
  for (const seg of hanSeg(lines[li].text)) {
    if (seg.length <= 7) sput(seg, li, vid, ly);
    for (let n = 2; n <= Math.min(7, seg.length); n++) {
      for (let i = 0; i + n <= seg.length; i++) gput(seg.slice(i, i + n), li, vid, ly);
    }
  }
}
console.log(`全量 gram 表 ${G.size} 条`);

const freq = (s) => (G.has(norm(s)) ? G.get(norm(s)).c : 0);
const lineCount = (s) => (G.has(norm(s)) ? G.get(norm(s)).lc : 0);
const hits = (s) => {
  const e = G.get(norm(s));
  if (!e) return null;
  const sampleLines = e.s.slice(0, 3).map((i) => lines[i]);
  const titles = new Map();
  for (const i of e.s) {
    const l = lines[i];
    const label = l.bv || l.title || l.url || l.file;
    titles.set(label, (titles.get(label) || 0) + 1);
  }
  return {
    count: e.c,
    lineCount: e.lc,
    videoCount: e.vc,
    linyuLineCount: e.lyc,
    wholeWord: SEG.has(norm(s)),
    samples: sampleLines.map((l) => ({ text: l.text.slice(0, 90), file: l.file, bv: l.bv, title: l.title, url: l.url, kind: l.kind, ly: !!l.ly })),
    titles: [...titles.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t, h]) => ({ label: t, hit: h })),
    onlyNewBatch: sampleLines.some((l) => NEW_BATCH.has(l.file)),
  };
};

// ================================================================ A. 替换位反推生成
// 从 seed 现有 zh↔淋语写法里学单字替换表
const votes = new Map(); // a -> Map(b -> {n, eg})
for (const w of seed.words) {
  const zh = String(w.zh || '');
  if (!zh || zh.length < 2 || zh.length > 6) continue;
  for (const f of [w.linyu, ...variantsOf(w.alias)]) {
    if (!f || f.length !== zh.length) continue;
    const diffs = [];
    for (let i = 0; i < zh.length; i++) if (zh[i] !== f[i]) diffs.push([zh[i], f[i]]);
    if (!diffs.length || diffs.length > 2) continue;
    for (const [a, b] of diffs) {
      if (!/[\u4e00-\u9fa5]/.test(a) || !/[\u4e00-\u9fa5]/.test(b)) continue;
      let m = votes.get(a);
      if (!m) votes.set(a, (m = new Map()));
      const e = m.get(b) || { n: 0, eg: zh + '→' + f };
      e.n++;
      m.set(b, e);
    }
  }
}
const charMap = new Map(); // a -> [b…] 只要出现 >=2 次、或目标字本身就是特征字
for (const [a, m] of votes) {
  const bs = [...m.entries()]
    .filter(([b, e]) => e.n >= 2 || CORE_SUB.has(b))
    .sort((x, y) => y[1].n - x[1].n)
    .slice(0, 4)
    .map(([b, e]) => ({ b, n: e.n, eg: e.eg }));
  if (bs.length) charMap.set(a, bs);
}
const subTable = [...charMap.entries()].map(([a, bs]) => ({ from: a, to: bs.map((x) => `${x.b}×${x.n}(${x.eg})`) }));

const found = new Map(); // 归一化候选 -> 记录
function emit(cand, via, meta) {
  const key = norm(cand);
  if (!key || key.length < 2) return;
  const h = hits(key);
  if (!h) return; // 必须逐字在语料里
  let rec = found.get(key);
  if (!rec) {
    rec = {
      cand,
      via: new Set(),
      ...h,
      in_seed_exact: knownLinyu.has(key),
      in_seed_as_zh: knownZh.has(key),
      in_seed_partial: knownSubstr.has(key) && !knownLinyu.has(key),
      seed_owner: knownLinyu.has(key) ? knownLinyu.get(key).zh : knownZh.has(key) ? knownZh.get(key).zh : '',
    };
    found.set(key, rec);
  }
  rec.via.add(via);
  // subst 抽取器会给出「这个变体属于哪个中文词头」，概念信息优先保留
  if (meta && meta.concept && (!rec.meta || !rec.meta.concept)) rec.meta = { ...(rec.meta || {}), ...meta };
  else if (meta && !rec.meta) rec.meta = meta;
}

// A1：拿每个中文词头去套替换表，生成的变体回语料验真
let substGen = 0;
for (const w of seed.words) {
  const zh = String(w.zh || '');
  if (!zh || zh.length < 2 || zh.length > 6) continue;
  for (let i = 0; i < zh.length; i++) {
    const bs = charMap.get(zh[i]);
    if (!bs) continue;
    for (const { b } of bs) {
      const cand = zh.slice(0, i) + b + zh.slice(i + 1);
      if (cand === zh) continue;
      substGen++;
      emit(cand, 'subst', { concept: zh, slot: w.slot || '', linyu: w.linyu || '' });
    }
  }
}
console.log(`A 替换位反推：生成 ${substGen} 个候选形态`);

// ================================================================ B. 词典型语料块
// 萌娘百科「淋语堂」用语表 / 百度百科 / 热梗百科 / 贴吧引号词表 / 淋吧英雄绰号科普
const dictLines = lines.filter((l) => l.url && /moegirl|baike|regengbaike|tieba|sohu|toutiao|nga|kknews|sydneytoday|stdans|7chaxun|yglsr|fbrowser/i.test(l.url));
const dictItems = new Set();
for (const l of dictLines) {
  const t = l.text;
  // 「」/“”/《》里引的东西基本都是词条名
  for (const m of t.matchAll(/[「“《]([^」”》]{2,14})[」”》]/g)) dictItems.add(m[1]);
  // 贴吧词表那一段是 "词","词" 形式
  for (const m of t.matchAll(/["']([^"'，。;；]{2,12})["']/g)) dictItems.add(m[1]);
  // 英雄绰号「X-Y」「X-Y 本名」形式（sydneytoday / 淋吧科普）
  for (const m of t.matchAll(/([\u4e00-\u9fa5A-Za-z0-9·]{2,8})[-–]([\u4e00-\u9fa5A-Za-z0-9]{2,8})/g)) dictItems.add(m[1]);
}
let dictHit = 0;
for (const it of dictItems) {
  const s = it.replace(/\s+/g, '').trim();
  if (s.length < 2 || s.length > 8) continue;
  if (!/[\u4e00-\u9fa5]/.test(s)) continue;
  if (/^(我|你|他|她|的|了|是|在|和|与|或|着|过)$/.test(s)) continue;
  if (knownLinyu.has(norm(s)) || knownZh.has(norm(s))) {
    emit(s, 'dict', { concept: '', note: '词典块已收录' });
    continue;
  }
  if (freq(s) >= 1) {
    emit(s, 'dict', { concept: '' });
    dictHit++;
  }
}
console.log(`B 词典块：${dictLines.length} 行 → 抽出 ${dictItems.size} 个词条名，其中语料可验真且库里没有 ${dictHit} 个`);

// ================================================================ C. 结构形态
const NOISE = /^[哈啊呵哦噢唔哇呜嘶草笑嘻嘿]+$/;
const STOP_SELF = /^(本身|本来|本人|本地|本科|本业|本书|本案|本轮|本届|本部|本钱|本金|本钱|本地|本土|本年|本季|本批|本页|本章|本案|体本|回本|成本|标本|剧本|绘本|根本|副本|一本|这本|那本|每本|书本)$/;
const STOP_LIN = /^(淋雨|淋浴|淋漓|淋湿|淋了|淋到|淋上|淋水|淋病|淋漓尽致|雨淋|水淋|日晒雨淋)$/;

const structural = new Map();
for (const [key, e] of G) {
  if (key.length < 2 || key.length > 7) continue;
  if (e.c < 2) continue;
  const g = key;
  if (NOISE.test(g)) continue;
  let via = '';
  if (/^本[\u4e00-\u9fa5]{1,4}$/.test(g) && !STOP_SELF.test(g)) via = 'selfref';
  else if (/^淋[\u4e00-\u9fa5\d]{1,4}$/.test(g) && !STOP_LIN.test(g)) via = 'linname';
  else if (/^(.)\1$/.test(g) || /^(..)\1$/.test(g)) via = 'redup';
  else if (/[惹噜厚熏滴酱哒咪靴]$/.test(g)) via = 'tail';
  else if (/^(阴|母|淋|猪|鸡|佛|婊|姐)[\u4e00-\u9fa5]{1,3}(婆|女|姐|妹|王|酱|宝|神)$/.test(g)) via = 'hero';
  else if (/^[\u4e00-\u9fa5]{1,4}(话|语|文)$/.test(g) && /^淋/.test(g)) via = 'linname';
  if (!via) continue;
  emit(g, via, {});
  structural.set(g, via);
}
console.log(`C 结构形态：命中 ${structural.size} 个候选`);

// ================================================================ D. n-gram 兜底（只留强特征）
let ng = 0;
for (const [key, e] of G) {
  if (e.c < 3) continue;
  if (key.length < 2 || key.length > 6) continue;
  if (NOISE.test(key) || knownLinyu.has(key)) continue;
  const marks = [...key].filter((ch) => MARK.has(ch)).length;
  if (marks < 2) continue;
  emit(key, 'ngram', {});
  ng++;
}
console.log(`D n-gram 兜底：补 ${ng} 个候选`);

// ================================================================ E. 完整词段（精度最高）
// 候选必须自己就是一个完整的汉字词段（不是从长句里切出来的子串），
// 这样能直接排除「蔡依林+美人」拼成「淋美」这类假命中。
const STRONG_T = new Set('淋惹噜厚靴熏柱鼠珍尊翻滴酱哒咪灰阴菌蕉蒜嘤喵捏呗蕾薯糕吱哩喔唔嘻吸洗银丸康缩莓橘锅吼婷芷聚杯糕仙婊');
let tk = 0;
for (const [seg, e] of SEG) {
  if (seg.length < 2 || seg.length > 7) continue;
  if (e.c < 2) continue;
  if (NOISE.test(seg)) continue;
  if (knownLinyu.has(seg) || knownZh.has(seg)) continue;
  const marks = [...seg].filter((ch) => STRONG_T.has(ch)).length;
  if (!marks) continue;
  emit(seg, 'token', {});
  tk++;
}
console.log(`E 完整词段：${tk} 个候选`);

// ------------------------------------------------------------------ 句式骨架候选
const gramCount = new Map();
for (let li = 0; li < lines.length; li++) {
  const l = lines[li];
  if (!l.ly) continue;
  for (const seg of hanSeg(l.text)) {
    for (let n = 5; n <= Math.min(9, seg.length); n++) {
      for (let i = 0; i + n <= seg.length; i++) {
        const g = seg.slice(i, i + n);
        let f = gramCount.get(g);
        if (!f) gramCount.set(g, (f = { frame: g, count: 0, samples: [], files: new Set(), titles: new Map() }));
        f.count++;
        if (f.samples.length < 2 && l.text.length <= 90 && !f.samples.includes(l.text)) f.samples.push(l.text);
        f.files.add(l.file);
        const label = l.bv || l.title || l.url || '';
        if (label) f.titles.set(label, (f.titles.get(label) || 0) + 1);
      }
    }
  }
}
const frames = [...gramCount.values()].filter((f) => f.count >= 4 && !/^\d+$/.test(f.frame));
const framesHead = frames.sort((a, b) => b.count - a.count || b.frame.length - a.frame.length).slice(0, 6000);
const framesDedup = framesHead.filter((f) => !framesHead.some((d) => d !== f && d.count >= f.count && d.frame.includes(f.frame) && d.frame.length > f.frame.length));
const framesTop = framesDedup
  .sort((a, b) => b.count - a.count || b.frame.length - a.frame.length)
  .slice(0, 340)
  .map((f) => ({
    frame: f.frame,
    count: f.count,
    files: [...f.files].sort(),
    samples: f.samples,
    titles: [...f.titles.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t, h]) => ({ label: t, hit: h })),
  }));

// 前缀/后缀桶（批量复读的同款句式：宫斗体、启动语、夸夸体都会落在这里）
function bucket(keyFn, minDistinct, minTotal) {
  const map = new Map();
  for (const l of lines) {
    if (!l.ly) continue;
    const s = clean(l.text).replace(/#/g, '');
    if (s.length < 6 || s.length > 60) continue;
    const k = keyFn(s);
    if (!k || k.length < 4) continue;
    let b = map.get(k);
    if (!b) map.set(k, (b = { key: k, count: 0, distinct: new Set(), samples: [], titles: new Map() }));
    b.count++;
    if (b.distinct.size < 200) b.distinct.add(s);
    if (b.samples.length < 8 && !b.samples.includes(l.text)) b.samples.push(l.text);
    const label = l.bv || l.title || l.url || '';
    if (label) b.titles.set(label, (b.titles.get(label) || 0) + 1);
  }
  return [...map.values()]
    .filter((b) => b.count >= minTotal && b.distinct.size >= minDistinct)
    .sort((a, b) => b.count - a.count)
    .slice(0, 150)
    .map((b) => ({
      key: b.key,
      count: b.count,
      variants: b.distinct.size,
      samples: b.samples.slice(0, 6),
      titles: [...b.titles.entries()].sort((a, c) => c[1] - a[1]).slice(0, 3).map(([t, h]) => ({ label: t, hit: h })),
    }));
}
const prefixBuckets = bucket((s) => s.slice(0, 5), 3, 6);
const suffixBuckets = bucket((s) => s.slice(-5), 3, 6);

// 整行复读（刷屏梗本体）
const repeatLines = new Map();
for (const l of lines) {
  if (!l.ly) continue;
  if (l.text.length < 4 || l.text.length > 60) continue;
  const key = norm(l.text);
  let r = repeatLines.get(key);
  if (!r) repeatLines.set(key, (r = { text: l.text, count: 0, titles: new Map() }));
  r.count++;
  const label = l.bv || l.title || l.url || '';
  if (label) r.titles.set(label, (r.titles.get(label) || 0) + 1);
}
const repeats = [...repeatLines.values()]
  .filter((r) => r.count >= 3 && /[\u4e00-\u9fa5]{3}/.test(r.text) && !NOISE.test(r.text.replace(/[^哈啊哦嗯]/g, '')))
  .sort((a, b) => b.count - a.count)
  .slice(0, 240)
  .map((r) => ({
    text: r.text,
    count: r.count,
    titles: [...r.titles.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t, h]) => ({ label: t, hit: h })),
  }));

// --------------------------------------------------------------------- 汇总落盘
const recs = [...found.values()].map((r) => ({ ...r, via: [...r.via].sort() }));
// usable = 本轮采纳门槛：整词级（本身就是完整词段）+ 语料命中行 >=2
//          —— 单字替换派生只能以子串形式出现在长句里的（如「加班→家班」）一律排除。
// gold   = usable + 命中行里至少 2 行是淋语语境 + 写法本身含淋语特征字
//          （挡掉「翻译/看看/中的」这类搭便车出现在淋视频里的普通中文词）
const hasStrongChar = (t) => [...String(t)].some((ch) => MARK.has(ch));
for (const r of recs) {
  r.usable = !!r.wholeWord && r.lineCount >= 2;
  r.gold = r.usable && r.linyuLineCount >= 2 && hasStrongChar(r.cand);
}
const fresh = recs.filter((r) => !r.in_seed_exact && !r.in_seed_as_zh);
const byConcept = new Map();
for (const r of fresh) {
  if (r.via.includes('ngram') && !r.via.includes('subst') && !r.via.includes('dict')) continue;
  const k = r.meta && r.meta.concept ? r.meta.concept : r.cand;
  if (!byConcept.has(k)) byConcept.set(k, []);
  byConcept.get(k).push(r);
}
fresh.sort((a, b) => b.lineCount - a.lineCount || b.count - a.count || a.cand.localeCompare(b.cand, 'zh'));

const out = {
  minedAt: new Date().toISOString(),
  corpusFiles: files.map((f) => path.relative(ROOT, f).replace(/\\/g, '/')),
  newBatch: [...NEW_BATCH],
  note:
    '候选全部逐字取自语料行，attest.js 的 WORD/RULE 闸门天然可过；本文件只做统计，不写 seed.json。' +
    'via=subst 替换位反推 / dict 词典块 / selfref|linname|redup|tail|hero 结构形态 / ngram 兜底；' +
    'in_seed_exact 已作为淋语写法收录；in_seed_as_zh 已作为中文词头收录（可考虑并 alias）；in_seed_partial 被更长已收录写法覆盖。' +
    'usable = wholeWord（完整词段）&& lineCount>=2（命中 >=2 条不同语料行），curated-linyu14 只从 usable 里取。',
  stats: {
    lines: lines.length,
    linyuLines: lines.filter((l) => l.ly).length,
    blocks,
    grams: G.size,
    candidates: recs.length,
    freshCandidates: fresh.length,
    usableCandidates: fresh.filter((r) => r.usable).length,
    goldCandidates: fresh.filter((r) => r.gold).length,
    usableOnlyNewBatch: fresh.filter((r) => r.usable && r.onlyNewBatch).length,
    goldOnlyNewBatch: fresh.filter((r) => r.gold && r.onlyNewBatch).length,
    inSeedAsZhMergeable: recs.filter((r) => r.in_seed_as_zh && r.usable).length,
    frames: framesTop.length,
    repeats: repeats.length,
    patternCount: knownPatterns.size,
    strongMarks: STRONG,
  },
  subTable,
  candidates: fresh.slice(0, TOP * 3),
  usable: fresh.filter((r) => r.usable).slice(0, TOP * 4),
  gold: fresh
    .filter((r) => r.gold)
    .sort((a, b) => b.lineCount - a.lineCount || b.videoCount - a.videoCount)
    .slice(0, TOP * 4),
  mergeable: recs.filter((r) => r.in_seed_as_zh && r.usable).slice(0, 400),
  alreadyInSeed: recs.filter((r) => r.in_seed_exact).slice(0, 40),
  frames: framesTop,
  prefixBuckets,
  suffixBuckets,
  repeats,
};
const outPath = path.join(ROOT, 'evidence/lexicon-cand14.json');
fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log(`-> ${path.relative(ROOT, outPath).replace(/\\/g, '/')}`);
console.log(
  `候选总计 ${recs.length}（库里没有的 ${fresh.length}，整词且>=2行可用的 ${out.stats.usableCandidates}，其中新语料贡献 ${out.stats.usableOnlyNewBatch}）| 可并 alias ${out.stats.inSeedAsZhMergeable} | 骨架 ${framesTop.length} | 复读 ${repeats.length}`
);

console.log('\n--- ★ 本轮可用整词候选（usable，按命中行数）TOP 400 ---');
out.usable
  .slice(0, 400)
  .forEach((r) =>
    console.log(
      `  [行${String(r.lineCount).padStart(3)}/次${String(r.count).padStart(4)}/片${String(r.videoCount).padStart(3)}] ${r.cand.padEnd(7, '　')} <${r.via.join(',')}> ${(r.samples[0] || {}).text || ''}`.slice(0, 150)
    )
  );

console.log('\n--- A 替换位反推（新变体，按语料频次）---');
fresh
  .filter((r) => r.via.includes('subst'))
  .slice(0, 120)
  .forEach((r) => console.log(`  [${String(r.count).padStart(4)}]${r.onlyNewBatch ? '*' : ' '} ${r.cand.padEnd(7, '　')} ← ${r.meta.concept}(${r.meta.linyu}) ${(r.samples[0] || {}).text || ''}`.slice(0, 120)));
console.log('\n--- B 词典块词条（库里没有）---');
fresh
  .filter((r) => r.via.includes('dict'))
  .slice(0, 160)
  .forEach((r) => console.log(`  [${String(r.count).padStart(4)}] ${r.cand.padEnd(8, '　')} ${(r.samples[0] || {}).text || ''}`.slice(0, 120)));
console.log('\n--- C 结构形态（本X/淋X/叠词/句尾/英雄绰号）---');
fresh
  .filter((r) => r.via.some((v) => ['selfref', 'linname', 'redup', 'tail', 'hero'].includes(v)))
  .slice(0, 180)
  .forEach((r) => console.log(`  [${String(r.count).padStart(4)}] ${r.cand.padEnd(8, '　')} <${r.via.join(',')}> ${(r.samples[0] || {}).text || ''}`.slice(0, 120)));
console.log('\n--- D 兜底 ngram（强特征 >=2 字）---');
fresh
  .filter((r) => r.via.length === 1 && r.via[0] === 'ngram')
  .slice(0, 80)
  .forEach((r) => console.log(`  [${String(r.count).padStart(4)}] ${r.cand.padEnd(8, '　')} ${(r.samples[0] || {}).text || ''}`.slice(0, 120)));
console.log('\n--- E 完整词段（精度最高，逐条可直接核对）---');
fresh
  .filter((r) => r.via.includes('token'))
  .slice(0, 300)
  .forEach((r) => console.log(`  [${String(r.count).padStart(4)}] ${r.cand.padEnd(7, '　')} <${r.via.join(',')}> ${(r.samples[0] || {}).text || ''}`.slice(0, 120)));
console.log('\n--- 高频骨架 TOP 80 ---');
framesTop.slice(0, 80).forEach((f) => console.log(`  [${String(f.count).padStart(4)}] ${f.frame}   ← ${(f.samples[0] || '').slice(0, 44)}`));
console.log('\n--- 复读句 TOP 80 ---');
repeats.slice(0, 80).forEach((r) => console.log(`  [${String(r.count).padStart(4)}] ${r.text.slice(0, 54)}`));
console.log('\n--- 前缀桶 TOP 45 ---');
prefixBuckets.slice(0, 45).forEach((b) => console.log(`  [${String(b.count).padStart(4)}/${b.variants}变体] ${b.key}   ← ${(b.samples[0] || '').slice(0, 40)}`));
console.log('\n--- 后缀桶 TOP 45 ---');
suffixBuckets.slice(0, 45).forEach((b) => console.log(`  [${String(b.count).padStart(4)}/${b.variants}变体] ${b.key}   ← ${(b.samples[0] || '').slice(0, 40)}`));
