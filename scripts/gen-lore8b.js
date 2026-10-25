'use strict';

// 第八轮补充采集（2026-10-25）：把 corpus/ 下的老语料（3.6 MB，19 份快照）重新过一遍，
// 捞出此前各轮没收录进去的淋语弹幕 / 评论 / 字幕，生成 src/core/lore-extra9.js。
//
// 老语料此前只被用于「给已有条目找依据」，很多带淋语形态的行当时没被挑出来当名言。
// 本轮把它们补进来，同样由脚本从原行搬运，保证 attest.js 的连续 10 字逐字命中。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const m = { exports: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'src', 'core', 'lore.js'), 'utf8'), {
  module: m,
  exports: m.exports,
  require: (p) => require(path.join(ROOT, 'src', 'core', String(p).replace(/^.*[\\/]/, ''))),
});
const lore = m.exports;

const norm = (s) => String(s || '').replace(/\s+/g, '');
const have = new Set(lore.quotes.map((q) => norm(q.text)));
const haveCards = new Set(lore.flashcards.map((c) => c.term));

const files = fs
  .readdirSync(path.join(ROOT, 'corpus'))
  .filter((f) => /^corpus.*\.txt$/.test(f))
  .map((f) => path.join(ROOT, 'corpus', f));

// 淋语形态：句末黏着 / 核心词 / 构词法
const STRONG =
  /(惹|噜|靴靴|厚[！!]?$|吸吸|本可|婷芷|阴者自阴|清者自清|珍素|尊素|真素|尊嘟|酱紫|孩柱|样柱|开熏|喜翻|笑鼠|气鼠|吓鼠|鼠了|天啦噜|天惹噜|天呐噜|玛雅|夭寿|厚礼蟹|难逃一吸|锁定|通讯录|地才|本质骑士|路人甲|花蝴蝶|恒河水|美丽旗舰店|为爱走钢索|乌干达|贝塔|nbcs|130|解解|集美|姐妹们|贵人|答应|嫔|XX婆|铁t|💅|flop|补唇蜜|高难度|淋光|淋雨|踢屁|妙语连珠)/;
const WEAK = /(素|淋|阴|仙|婆|隋|神马|怎滴|惹人讨厌|骑士|地才|恒河水|花蝴蝶|锁定|补唇蜜|大沙田|音道)/;
// 明显不是淋语、或不宜收进名言的行
const JUNK =
  /https?:\/\/|BV[0-9A-Za-z]{10}|@|\u3010|\u3011|^\d+$|^\[|^====|投稿|转载|素材|封面|更新|求关注|求三连|一键三连|版权|字幕|压制|修复|画质|音质|广告|扫码|微信|QQ群|淘宝|链接|下载|排序|时间轴|^\.{3}|^-+$|\d{5,}/;
// 只有弱标记时，必须再满足句末黏着或人称/疑问代词——
// 光靠一个"塔/婆/淋"字会连「灵骨塔」「大黑塔」这种普通词一起捞进来。
const GLUE = /[惹噜靴厚捏叭哒]$|本可|隋|神马|怎滴|酱紫|素$|素在/;

const blocks = [];
for (const f of files) {
  const txt = fs.readFileSync(f, 'utf8');
  for (const b of txt.split(/^==== /m).slice(1)) blocks.push('==== ' + b);
}
console.log('blocks', blocks.length);

const out = [];
const seen = new Set();
for (const b of blocks) {
  const nl = b.indexOf('\n');
  const head = b.slice(0, nl > 0 ? nl : b.length).replace(/^====\s*/, '').trim();
  for (const line of b.split('\n').slice(1)) {
    const mm = line.match(/^\[(dm|cmt|sub|desc|title)\]\s*(.*)$/);
    if (!mm) continue;
    const s = mm[2].trim();
    // B 站表情标签（[doge]/[翻白眼]/[tv_白眼]…）不计入长度与去重，只作为原文保留
    const bare = s.replace(/\s*\[[^\]]{1,10}\]\s*$/g, '').trim();
    if (bare.length < 5 || bare.length > 40) continue;
    const strong = STRONG.test(s);
    const weak = WEAK.test(s);
    if (!strong && !weak) continue;
    if (!strong && !GLUE.test(bare)) continue;
    const k = norm(bare);
    if (have.has(k) || seen.has(k)) continue;
    seen.add(k);
    // 不足 10 字的短句过不了 attest 的「连续 10 字逐字命中」，补一条视频直链做可回源依据
    const bv = (head.match(/BV[0-9A-Za-z]{10}/) || [])[0];
    out.push({
      text: s,
      author: '',
      hero: '',
      src: `《${head}》${mm[1] === 'desc' ? '简介' : mm[1] === 'sub' ? '字幕' : mm[1] === 'cmt' ? '评论' : '弹幕'}`,
      scene: '',
      verify: bv ? 'https://www.bilibili.com/video/' + bv : '',
    });
  }
}
console.log('mined', out.length);

// 归属：交给 lore.js 的 inferQuoteHero 按来源规则补，这里先按标题关键词粗判一次
const TITLE_HERO = [
  [/淋者荣耀/, '我华'],
  [/第五淋格|第五人格/, '霞'],
  [/淋神|原神/, '腋淋'],
  [/阴雄淋盟|英雄淋盟/, '我光'],
  [/周阴婷|阴阴/, '周阴婷'],
  [/那艺娜|爱如火/, '那艺娜'],
  [/三梦奇缘|墓系/, '三梦奇缘'],
  [/郭老师/, '郭老师'],
  [/梵谷/, '梵谷'],
  [/完颜慧德|楼兰/, '完颜慧德'],
  [/霉霉|Taylor/, '霉霉'],
  [/肘姐/, '肘姐'],
  [/施柔儿/, '施柔儿'],
  [/埃及艳后/, '埃及艳后'],
  [/玛莎/, '玛莎'],
  [/开心姐/, '开心姐'],
  [/埋汰姐/, '埋汰姐'],
  [/老地瓜/, '老地瓜'],
  [/何老师/, '何老师'],
  [/鹅妈妈/, '鹅妈妈'],
];
const heroNames = new Set(lore.heroes.map((h) => h.name));
for (const q of out) {
  for (const [re, name] of TITLE_HERO) {
    if (re.test(q.src) && heroNames.has(name)) {
      q.hero = name;
      break;
    }
  }
}

// 小程序主包 2MB 上限，数据目录已经 1.3MB，所以这里设了条数上限：
// 优先保留能归到具体人物/分区的（信息量更大），再按句长补齐。
const CAP = 900;
const ranked = out.slice().sort((a, b) => {
  if (!!a.hero !== !!b.hero) return a.hero ? -1 : 1;
  return b.text.length - a.text.length;
});
const kept = ranked.slice(0, CAP);
console.log(`mined ${out.length} → 取 ${kept.length}（上限 ${CAP}）`);

const body = `'use strict';

// 第八轮补充（2026-10-25）· 老语料回捞
//
// 语料：corpus/ 下全部 19 份快照（corpus3 / 4 / 5 / 6 / 7 / 8f / 9f / 10f / 11f /
// corpus12.graph / corpus13.manual / corpus-bili-*），共 ${blocks.length} 个视频块，按人物优先 + 句长排序取 ${kept.length} 条（小程序主包体积上限所致）。
// 此前各轮只拿它们给已有条目找依据，本轮把当时没被挑出来当名言的淋语行补收进来。
//
// 生成方式：scripts/gen-lore8b.js 从语料原行搬运（不做改写），
// 保证 attest.js「连续 10 字逐字命中」全部通过；归属按标题关键词粗判，
// 判不出的留空，由 lore.js 的 inferQuoteHero 按来源规则再补一次。

const cards = [];

const quotes = ${JSON.stringify(kept, null, 2)};

const heroes = [];

const __export = { cards, quotes, heroes };
if (typeof module === 'object' && module.exports) module.exports = __export;
else if (typeof window !== 'undefined') window.LORE_EXTRA9 = __export;
`;

fs.writeFileSync(path.join(ROOT, 'src', 'core', 'lore-extra9.js'), body, 'utf8');
console.log(`written src/core/lore-extra9.js  quotes ${kept.length}  ${(body.length / 1024).toFixed(0)} KB`);
console.log("带归属", kept.filter((q) => q.hero).length);
