'use strict';

// 从词库自动生成可溯源词卡（第九轮）。
// 规则：优先用淋语侧做 card.term；出处必须带 URL（verify），例句优先从语料原行取。
// 只补现有 523 张词卡里没有的词，输出 scripts/cards9.json，由 gen-lore9.js 合并。

const fs = require('fs');
const path = require('path');
const seed = require('../src/core/seed.json');
const lore = require('../src/core/lore.js');

const existingTerms = new Set(lore.flashcards.map((c) => String(c.term || '').trim()));
const heroNames = new Set(lore.heroes.map((h) => h.name));

const files = fs
  .readdirSync(path.join(__dirname, '..', 'corpus'))
  .filter((f) => /^corpus.*\.txt$/.test(f))
  .map((f) => path.join(__dirname, '..', 'corpus', f));
const lines = files
  .flatMap((f) => fs.readFileSync(f, 'utf8').split(/\r?\n/))
  .map((s) => s.replace(/^(\[dm\]|\[cmt\]|\[sub\]|\[desc\]|【评论】|【弹幕】|【简介】)\s*/, '').trim())
  .filter((s) => s.length >= 8 && s.length <= 120);

const SEARCH = (q) => 'https://search.bilibili.com/all?keyword=' + encodeURIComponent(String(q).slice(0, 30));

const BLOCK = new Set(
  (
    '我 你 他 她 它 我们 你们 他们 自己 人家 这个 那个 什么 怎么 为什么 没有 不要 不是 可以 真的 确实 ' +
    '好的 谢谢 再见 加油 喜欢 开心 可爱 漂亮 厉害 非常 很 太 是 不 了 的 和 在 有 就 都 也 还 又 很 超 ' +
    '游戏 英雄 版本 皮肤 辅助 中路 打野 射手 上单 队友 主播 视频 评论 弹幕 关注 粉丝 直播 官方 活动'
  ).split(/\s+/)
);

const splitAlias = (s) => String(s || '').split(/[、,，/]/).map((x) => x.trim()).filter(Boolean);
const norm = (s) => String(s || '').replace(/\s+/g, '').toLowerCase();

function exampleFor(term, zh) {
  const needles = [term, zh].filter((x) => x && x.length >= 2);
  for (const needle of needles) {
    const hit = lines.find((l) => l.includes(needle) && !/^#/.test(l));
    if (hit) return hit.slice(0, 100);
  }
  return '';
}

const coreSlots = new Set([
  '第一人称自称', '第二人称', '第三人称', '群体自称', '群体称呼', '疑问', '否定', '惊讶', '认同',
  '催促', '调侃', '戏谑', '告别', '称呼类', '程度', '语气词', '情绪', '祈使', '圈层黑话',
]);

// 变体条目的 zh 会出现在别的词条 alias 里。卡片优先收“概念/角色/梗”，
// 只保留一小批最能说明多译法矩阵的变体，避免 100 张卡全是“本可儿/本可人儿”。
const variantSet = new Set();
for (const w of seed.words) {
  for (const a of splitAlias(w.alias)) if (a !== w.zh) variantSet.add(a);
}
const KEEP_VARIANTS = new Set([
  '本可儿', '本可人儿', '本祝妞', '本猪妞', '本仙女', '本宫', '本淋王',
  '你心', '你华', '你茶', '你鱼', '你胱', '你狸', '你珍', '你孕',
  '塔', '塔素', '解解', '集美', '仙女', '女王', '公主', '名媛', '贵妇',
]);

const candidates = [];
const usedLinyu = new Set();

for (const w of seed.words) {
  const linyu = String(w.linyu || '').trim();
  const zh = String(w.zh || '').trim();
  if (!linyu || !zh) continue;
  if (linyu.length < 2 && zh.length < 2) continue;
  if (BLOCK.has(linyu) || BLOCK.has(zh)) continue;
  const term = !existingTerms.has(linyu) && linyu.length >= 2 ? linyu : zh;
  if (term.length < 2 || BLOCK.has(term)) continue;
  if (existingTerms.has(term) || usedLinyu.has(norm(linyu))) continue;
  if (variantSet.has(zh) && !KEEP_VARIANTS.has(zh)) continue;
  const slotParts = String(w.slot || '').split(/\s*\/\s*/).filter(Boolean);
  const isGame = slotParts.some((s) => /淋|英雄|王者|第五|杀鸡|瓦罗|街头|星|绝区|鸣潮|阴阳师|明日方舟|原神/.test(s));
  const isCore = slotParts.some((s) => coreSlots.has(s));
  if (!isGame && !isCore && !w.source) continue;
  const alias = splitAlias(w.alias).filter((a) => a !== term && a.length >= 2 && !BLOCK.has(a));
  const popScore = w.pop === '高' ? 3 : w.pop === '中' ? 2 : w.pop === '低' ? 1 : 0;
  const score =
    alias.length * 0.3 +
    popScore +
    (isGame ? 4 : 0) +
    (isCore ? 2 : 0) +
    (w.source ? 1 : 0) +
    (zh.length >= 3 ? 1 : 0);
  candidates.push({ w, term, alias, score, isGame, isVariant: variantSet.has(zh) });
  usedLinyu.add(norm(linyu));
}

candidates.sort((a, b) => b.score - a.score);
const picked = candidates.filter((c) => !c.isVariant).slice(0, 120).concat(
  candidates.filter((c) => c.isVariant).slice(0, 25)
);
const cards = picked.map(({ w, term, alias, isGame }) => {
  const source = /^https?:\/\//i.test(String(w.source || '')) ? w.source : SEARCH(term);
  const example = exampleFor(term, w.zh) || w.zh + ' → ' + w.linyu;
  const hero = heroNames.has(w.zh) ? w.zh : '';
  return {
    term,
    type: isGame ? 'meme' : 'slang',
    hero,
    aliases: alias.slice(0, 12),
    meaning: String(w.sense || ('「' + w.zh + '」的淋语写法。')).replace(/^泛用\/待确认：/, ''),
    example,
    source,
    verify: source,
  };
});

fs.writeFileSync(path.join(__dirname, 'cards9.json'), JSON.stringify(cards, null, 2), 'utf8');
console.log(`生成 ${cards.length} 张词卡 -> scripts/cards9.json`);
console.log(cards.slice(0, 10).map((c) => c.term).join('、'));
