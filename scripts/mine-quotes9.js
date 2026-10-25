'use strict';

// 第九轮名言回收（2026-10-25）：从 corpus/ 下全部语料里挑评论 / 简介 / 字幕 / 弹幕原行，
// 逐字保留，不做改写；带 B 站视频出处或站内检索直链，保证 attest 可回源。
// 输出 scripts/quotes9.json，由 gen-lore9.js 合并进 lore-extra10.js。

const fs = require('fs');
const path = require('path');
const lore = require('../src/core/lore.js');

const ROOT = path.join(__dirname, '..');
const SEARCH = (q) => 'https://search.bilibili.com/all?keyword=' + encodeURIComponent(String(q).slice(0, 30));

const BLOCK = /(强奸|迷奸|恋童|未成年|自杀|毒品|冰毒|海洛因|阴茎|阴道|性交|鸡巴|操你|约炮|裸聊|开房|包养|卖淫|嫖娼)/;
const CREDIT = /(原视频来自|BGM\s*[:：]|粉丝群|商务合作|转载请|本视频|素材来源|纯属娱乐|简介\s*[:：]|展开|收起)/i;
const NOISE = /^(支持|来了|打卡|第一|沙发|好耶|哈哈+|笑死|典|绷|泪目|关注|三连|求|谢谢|晚安|早安|加油|爱了|喜欢|太强了|牛|666|1+|？+|\?+|啊+|awsl|绝了|可以|不可以|同意|确实|真的|是的|好的|收到|已阅|前排|路过|mark|码住|收藏|转发|分享|点赞|投币|关注了|更新了|来了来了|哈哈哈哈+)[。！？!?~～]*$/i;
const EMOJI = /\[[^\]\n]{1,14}\]/g;

const strip = (s) =>
  String(s || '')
    .replace(EMOJI, '')
    .replace(/^回复\s*@[^:：]{1,30}\s*[:：]\s*/, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/BV[0-9A-Za-z]{10}/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const norm = (s) => strip(s).replace(/\s+/g, '').toLowerCase();
const cjk = (s) => (String(s).match(/[一-鿿]/g) || []).length;

// —— 人物别名表：取最长命中，避免「我」「你」这种通用词乱认亲 ——
const GENERIC = new Set(
  ('我 你 他 她 它 我们 你们 他们 自己 人家 本可 仙女 女王 公主 姐姐 妹妹 姐妹 集美 解解 家人 宝子 美美 ' +
    '贵人 娘娘 小主 皇后 太后 英雄 游戏 皮肤 版本 辅助 中路 打野 射手 上单 主播 淋语 淋神 通讯录 直男 直女 ' +
    '熊 猴 猪 体育生 白袜 黑袜 Daddy 老公 老婆 妈妈 爸爸 女儿 儿子 哥哥 弟弟 婆婆 老公 老婆 女一 男一')
    .split(/\s+/)
);
const tokenMap = [];
for (const h of lore.heroes) {
  const tokens = [h.name].concat(String(h.alias || '').split(/[/、,，]/)).map((s) => s.trim());
  for (const t of tokens) {
    if (t.length < 2 || t.length > 10 || GENERIC.has(t)) continue;
    if (/^[a-z0-9\s.]+$/i.test(t)) continue;
    tokenMap.push([t, h.name]);
  }
}
tokenMap.sort((a, b) => b[0].length - a[0].length);

function heroOf(text) {
  for (const [tok, name] of tokenMap) if (text.includes(tok)) return name;
  return '';
}

// —— 视频清单：title -> bvid ——
const evidenceDir = path.join(ROOT, 'evidence');
const titleToBv = new Map();
for (const f of fs.readdirSync(evidenceDir)) {
  if (!/^manifest-.*\.json$/.test(f)) continue;
  try {
    for (const v of JSON.parse(fs.readFileSync(path.join(evidenceDir, f), 'utf8'))) {
      if (v.title && v.bvid) titleToBv.set(String(v.title).trim(), v.bvid);
    }
  } catch {
    /* 坏 manifest 跳过 */
  }
}

// —— 语料解析 ——
const corpusDir = path.join(ROOT, 'corpus');
const files = fs.readdirSync(corpusDir).filter((f) => /^corpus.*\.txt$/.test(f));
const candidates = [];
let current = { title: '', bvid: '', up: '' };

const push = (text, kind) => {
  const clean = strip(text);
  if (clean.length < 15 || clean.length > 90) return;
  if (cjk(clean) < 8) return;
  if (BLOCK.test(clean)) return;
  if (CREDIT.test(clean)) return;
  if (NOISE.test(clean)) return;
  if (/回复\s*@|@\S+/.test(clean)) return;
  if (/^(#|====|【|\[)/.test(clean)) return;
  if ((clean.match(/[a-zA-Z0-9]/g) || []).length > clean.length * 0.6) return;
  const hero = heroOf(clean);
  const markers = /(惹|噜|厚|素|靴靴|本可|淋|阴婷|地才|女王|公主|仙女|通讯录|姐妹|解解|吸|锁|赔钱|倒贴|站街|洗脚婢|宫|嫔|妃|贵人|娘娘|小主|对食|掌嘴|杖毙|白绫|一丈红|β|鼠|孝|婷芷|开熏|喜翻|珍素|尊素|阴)/;
  let score = 0;
  if (kind === 'desc') score += 2;
  else if (kind === 'comment') score += 4;
  else if (kind === 'sub') score += 3;
  else score += 1;
  if (hero) score += 6;
  if (markers.test(clean)) score += 3;
  if (/[，。！？；：]/.test(clean)) score += 1;
  if (clean.length >= 20 && clean.length <= 55) score += 2;
  else if (clean.length >= 15) score += 1;
  if (/[你我他]/.test(clean)) score += 1;
  candidates.push({
    text: clean,
    kind,
    hero,
    score,
    title: current.title,
    bvid: current.bvid,
    up: current.up,
  });
};

for (const f of files) {
  const lines = fs.readFileSync(path.join(corpusDir, f), 'utf8').split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    let m = line.match(/^====\s*(?:\[[^\]]*\]\s*)?(BV[0-9A-Za-z]{10})\s+(.*?)\s*====/);
    if (m) {
      current = { bvid: m[1], title: m[2].replace(/\s*====.*$/, '').trim(), up: '' };
      const u = line.match(/\bup:([^\s]+)/);
      if (u) current.up = u[1];
      continue;
    }
    if (line.startsWith('【视频】')) {
      const t = line.slice(4).trim();
      current = { title: t, bvid: titleToBv.get(t) || (t.match(/BV[0-9A-Za-z]{10}/) || [''])[0], up: '' };
      continue;
    }
    if (line.startsWith('【UP】')) {
      current.up = line.slice(4).trim();
      continue;
    }
    if (line.startsWith('【简介】')) push(line.slice(4), 'desc');
    else if (line.startsWith('【评论】')) push(line.slice(4), 'comment');
    else if (line.startsWith('【弹幕】')) push(line.slice(5), 'danmaku');
    else if (line.startsWith('[desc]')) push(line.slice(6), 'desc');
    else if (line.startsWith('[cmt]')) push(line.slice(5), 'comment');
    else if (line.startsWith('[sub]')) push(line.slice(5), 'sub');
    else if (line.startsWith('[dm]')) push(line.slice(4), 'danmaku');
  }
}

// —— 去重：已有名言 + 本批 ——
const seen = new Set(lore.quotes.map((q) => norm(q.text)));
const perVideo = new Map();
const unique = [];
for (const c of candidates.sort((a, b) => b.score - a.score)) {
  const k = norm(c.text);
  if (!k || seen.has(k)) continue;
  const capKey = c.bvid || c.title;
  const n = perVideo.get(capKey) || 0;
  if (n >= 6) continue;
  seen.add(k);
  perVideo.set(capKey, n + 1);
  unique.push(c);
}

const take = (kindSet, max) => unique.filter((c) => kindSet.has(c.kind)).slice(0, max);
const primary = take(new Set(['comment', 'sub']), 240);
const danmaku = take(new Set(['danmaku']), 130);
const picked = primary.concat(danmaku);

const quotes = picked.map((c) => {
  const label = c.kind === 'desc' ? '简介' : c.kind === 'comment' ? '评论' : c.kind === 'sub' ? '字幕' : '弹幕';
  const src = c.title ? '《' + c.title.slice(0, 60) + '》' + label : label;
  const verify = c.bvid ? 'https://www.bilibili.com/video/' + c.bvid : SEARCH(c.text);
  return {
    text: c.text,
    author: c.up || '',
    hero: c.hero || '',
    src,
    scene: label,
    verify,
  };
});

fs.writeFileSync(path.join(__dirname, 'quotes9.json'), JSON.stringify(quotes, null, 2), 'utf8');
console.log(`候选 ${candidates.length}，去重后 ${unique.length}，写入 ${quotes.length} 条 -> scripts/quotes9.json`);
console.log('类型分布：' + quotes.reduce((m, q) => ((m[q.scene] = (m[q.scene] || 0) + 1), m), {}));
console.log(quotes.slice(0, 8).map((q) => q.hero + '｜' + q.text.slice(0, 40)).join('\n'));
