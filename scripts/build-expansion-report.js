'use strict';
// 生成「语义位 × 变体矩阵」清单与未收录样例清单（交付用报告）。
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const seed = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/core/seed.json'), 'utf8'));
const lore = require(path.join(ROOT, 'src/core/lore'));

const SLOT_CANON = [
  '第一人称自称', '第二人称', '第三人称', '群体自称', '群体称呼',
  '疑问', '否定', '惊讶', '认同', '催促', '调侃/戏谑', '告别',
  '称呼类', '程度', '语气词', '祈使', '情绪',
];
const slotOf = (w) => {
  const s = String(w.slot || '');
  if (!s) return '（未标注）';
  if (SLOT_CANON.includes(s)) return s;
  return s.split('/')[0].trim();
};
const variants = (w) =>
  String(w.alias || '').split(/[、,，]/).map((x) => x.trim()).filter(Boolean);

const bySlot = {};
for (const w of seed.words) (bySlot[slotOf(w)] = bySlot[slotOf(w)] || []).push(w);

const out = [];
out.push('# 语义位 × 变体矩阵清单');
out.push('');
out.push(`生成时间：${new Date().toISOString()}`);
out.push(`数据源：src/core/seed.json（词库 ${seed.words.length} 条）、src/core/lore.js（词卡 ${lore.flashcards.length} / 名言 ${lore.quotes.length} / 人物 ${lore.heroes.length}）`);
out.push('');
out.push('> 规则：同一条目不重复——同一语义位下的不同淋语译法全部挂在同一条目的 alias 集合里，互不合并；');
out.push('> 不同条目之间如果语义位相同但用法不同（例如「我」与「本可」），仍然是两条独立条目，各自带自己的变体。');
out.push('');

out.push('## 一、核心语义位矩阵（15 个）');
out.push('');
out.push('| 语义位 | 条目数 | 变体总数 | 达标(≥8) | 变体示例 |');
out.push('|---|---|---|---|---|');
const CORE = ['第一人称自称', '第二人称', '第三人称', '群体自称', '疑问', '否定', '惊讶', '认同', '催促', '调侃/戏谑', '告别', '称呼类', '程度', '语气词', '情绪'];
for (const s of CORE) {
  const list = bySlot[s] || [];
  const all = list.flatMap(variants);
  const ex = [];
  for (const w of list) {
    for (const v of variants(w)) {
      if (ex.length < 8 && !ex.includes(v)) ex.push(v);
    }
    if (ex.length >= 8) break;
  }
  out.push(`| ${s} | ${list.length} | ${all.length} | ${all.length >= 8 ? 'OK' : 'GAP'} | ${ex.join('、')} |`);
}
out.push('');

out.push('## 二、全量语义位分布');
out.push('');
out.push('| 语义位 | 条目数 | 变体数 |');
out.push('|---|---|---|');
for (const s of Object.keys(bySlot).sort((a, b) => bySlot[b].length - bySlot[a].length)) {
  const all = bySlot[s].flatMap(variants);
  out.push(`| ${s} | ${bySlot[s].length} | ${all.length} |`);
}
out.push('');

out.push('## 三、每个语义位下的条目与全部变体');
out.push('');
for (const s of Object.keys(bySlot).sort((a, b) => bySlot[b].length - bySlot[a].length)) {
  out.push(`### ${s}（${bySlot[s].length} 条目）`);
  out.push('');
  for (const w of bySlot[s].sort((a, b) => variants(b).length - variants(a).length)) {
    const v = variants(w);
    out.push(`- **${w.zh}**（${v.length} 变体）${v.join('、')}`);
  }
  out.push('');
}

out.push('## 四、待确认 / 未收录样例清单');
out.push('');
out.push('以下条目在检索中出现，但因来源不足、语料逐字命中存疑或需要人工判断，本轮**没有**入库，列此备查：');
out.push('');
const NOT_IN = [
  ['本鱼 / 本喵 / 本狗', '「第一人称自称」语义位下未见真实语料逐字命中，只有构词法推演', '等下一轮抓到实际弹幕再收录，不自造译法'],
  ['「本婊贝」的完整变体集', '「本婊贝」已作为独立条目存在（4 个变体），但没能凑齐成套变体', '不补造，等语料'],
  ['「赛淋」的固定搭配', '目前只有「赛淋…淋味最强」这一条实例，句式模板还未成型', '样本不足，暂不入句式库'],
  ['「阴厚」的准确释义', '《淋形针》评论区出现「配阴厚」，但没找到解释该词本身的出处', '释义存疑，只在名言里原样收录，不做词条'],
  ['抖音端一手语料', '`REDFOX_API_KEY` 未配置，douyin-search-plugin 不可用；抖音 web 接口返回 0 条', '有 key 后可补'],
  ['知乎端正文', '知乎直接 fetch 403、search_v3 返回 400', '改用 web_search 间接覆盖'],
  ['百度 site: 跨站发现', '百度对 site: 操作符触发「安全安全验证」', '改用 web_search + 内置浏览器'],
];
out.push('| 候选 | 为什么没收 | 备注 |');
out.push('|---|---|---|');
for (const [a, b, c] of NOT_IN) out.push(`| ${a} | ${b} | ${c} |`);
out.push('');

out.push('## 五、人物配图清单');
out.push('');
const withImg = lore.heroes.filter((h) => h.img && h.img.trim());
const noImg = lore.heroes.filter((h) => !h.img || !h.img.trim());
out.push(`- 人物总数：**${lore.heroes.length}**`);
out.push(`- 已有配图：**${withImg.length}**`);
out.push(`- 待补图：**${noImg.length}**${noImg.length ? '（' + noImg.map((h) => h.name).join('、') + '）' : '（无）'}`);
const grp = {};
for (const h of lore.heroes) grp[h.group || 'real'] = (grp[h.group || 'real'] || 0) + 1;
out.push(`- 分区：${Object.entries(grp).map(([k, v]) => `${k} ${v}`).join(' / ')}`);
out.push('');

out.push('## 六、来源平台分布');
out.push('');
const PLATFORMS = [
  ['bilibili', /bilibili\.com|hdslb\.com/i],
  ['百度贴吧', /tieba\.baidu\.com/i],
  ['萌娘百科', /moegirl/i],
  ['维基百科', /wikipedia\.org/i],
  ['百度百科', /baike\.baidu\.com/i],
  ['NGA', /nga\.cn|ngabbs\.com/i],
  ['知乎', /zhihu\.com/i],
  ['豆瓣', /douban\.com/i],
  ['抖音', /douyin\.com/i],
  ['小红书', /xiaohongshu|xhslink/i],
  ['米游社', /miyoushe\.com/i],
  ['百度图库', /image\.baidu\.com|img\d+\.baidu\.com/i],
];
const plat = {};
let total = 0;
const collect = (s) => {
  for (const m of String(s || '').matchAll(/https?:\/\/[^\s"'）)】]+/g)) {
    total++;
    let hit = '其他';
    for (const [n, re] of PLATFORMS) if (re.test(m[0])) { hit = n; break; }
    plat[hit] = (plat[hit] || 0) + 1;
  }
};
for (const w of seed.words) collect(w.source);
for (const r of seed.rules) collect(r.src);
for (const c of lore.flashcards) { collect(c.source); collect(c.verify); }
for (const q of lore.quotes) { collect(q.src); collect(q.verify); }
for (const h of lore.heroes) for (const l of h.links || []) collect(l.url);
out.push(`出处链接总数 **${total}**`);
out.push('');
out.push('| 平台 | 链接数 | 占比 |');
out.push('|---|---|---|');
for (const [k, v] of Object.entries(plat).sort((a, b) => b[1] - a[1])) {
  out.push(`| ${k} | ${v} | ${((v / total) * 100).toFixed(1)}% |`);
}
out.push('');

out.push('## 七、来源标注率');
out.push('');
const hasSrc = (x) => {
  const s = x.source || x.src || '';
  return s && s.trim().length > 0 && !/^未知$/.test(s.trim());
};
const heroSrc = (h) => hasSrc(h) || (h.links || []).some((l) => l && l.url && l.url.trim());
out.push('| 板块 | 有来源 | 总数 | 标注率 |');
out.push('|---|---|---|---|');
out.push(`| 词库 | ${seed.words.filter(hasSrc).length} | ${seed.words.length} | ${((seed.words.filter(hasSrc).length / seed.words.length) * 100).toFixed(1)}% |`);
out.push(`| 句式 | ${seed.rules.filter(hasSrc).length} | ${seed.rules.length} | ${((seed.rules.filter(hasSrc).length / seed.rules.length) * 100).toFixed(1)}% |`);
out.push(`| 词卡 | ${lore.flashcards.filter(hasSrc).length} | ${lore.flashcards.length} | ${((lore.flashcards.filter(hasSrc).length / lore.flashcards.length) * 100).toFixed(1)}% |`);
out.push(`| 名言 | ${lore.quotes.filter(hasSrc).length} | ${lore.quotes.length} | ${((lore.quotes.filter(hasSrc).length / lore.quotes.length) * 100).toFixed(1)}% |`);
out.push(`| 人物（出处记在 links[]） | ${lore.heroes.filter(heroSrc).length} | ${lore.heroes.length} | ${((lore.heroes.filter(heroSrc).length / lore.heroes.length) * 100).toFixed(1)}% |`);
out.push('');

const FILE = path.join(ROOT, 'evidence', 'expansion-report.md');
fs.writeFileSync(FILE, out.join('\n'), 'utf8');
console.log('已写入', FILE, '|', out.length, '行');
