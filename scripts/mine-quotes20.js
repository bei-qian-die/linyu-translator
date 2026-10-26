'use strict';

// 第二十轮名言挖掘：从 corpus/*.txt 里捞出「淋威争锋语境 + 有淋味／有观点」的句子。
//
// 与逐行判定版的关键区别：**按视频分块**判定语境（scripts/_mrctx20.js）。
// 本区最有淋语的句子往往一个游戏字都不带（「淋威人太少找不到人」「减少点游戏术语，多点淋语」），
// 逐行判会全漏；反过来只看关键词又会把别的游戏区的同名词全捞进来。
//
// 产出 evidence/cand20-quotes.json / .txt，供 build-quotes20.js 取用。
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const { load: loadCtx } = require('./_mrctx20.js');
const MIN = 10;
const MAX = 60;

const LW = /淋威|淋语|淋系|淋度|淋群|淋game|淋文化|素在|只素|NBCS|nbcs|玛雅|daddy|soon|again|喜翻|降淋|淋吸|赔钱货|我冰|你冰|我红|你红|我基|你基|我匕|匕匕|我冬|冬冬|我烈|你烈|你痞|我痞|我星|我风|你磁|你摩|你苏珊|苏珊|鲨鲨|鲨狗|铁皮人|美队|寡姐|哈哈男|有母亲|母亲/;

const HERO_WORDS = [
  '美国队长', '奇异博士', '格鲁特', '浩克', '万磁王', '潘妮·帕克', '索尔', '毒液', '石头人', '白皇后',
  '安吉拉', '小淘气', '恶魔恐龙', '红兜帽', '黑寡妇', '黑豹', '鹰眼', '海拉', '铁拳', '钢铁侠',
  '魔剑客', '神奇先生', '月光骑士', '纳摩', '灵蝶', '猩红女巫', '蜘蛛侠', '松鼠女', '星爵', '暴风女',
  '惩罚者', '冬兵', '金刚狼', '霹雳火', '凤凰女', '刀锋战士', '夜魔侠', '艾尔莎·血石', '黑猫',
  '雷光眼', '屠神者格尔', '亚当术士', '斗篷与匕首', '隐形女', '陆行鲨杰夫', '洛基', '冰月花雪',
  '曼蒂斯', '火箭浣熊', '奥创', '牌皇', '白狐', '百光花火', '死侍',
];
const UP_WORDS = ['甜甜痞颜', '鑫河万点', '良心洗脚妹', '地才女特务', '地才蓝灏频道', '地才蓝灬频道', '鲁迅欺负周树人', 'Wooden依末', '赫斯特特特', 'Z_Magnus', '一小罐啤酒', 'Haker没有C'];

// 名字 → 人物传里的正式 name
const ALIAS2HERO = {
  我红: '猩红女巫', 你红: '猩红女巫', 旺达: '猩红女巫',
  我基: '洛基', 你基: '洛基', 淋基: '洛基',
  我冰: '冰月花雪', 你冰: '冰月花雪', 露娜: '冰月花雪',
  我匕: '斗篷与匕首', 匕匕: '斗篷与匕首', 斗匕: '斗篷与匕首',
  我冬: '冬兵', 冬冬: '冬兵', 巴基: '冬兵',
  我月光骑士: '月光骑士',
  我烈: '铁拳', 你烈: '铁拳', 你拳: '铁拳', 林烈: '铁拳',
  我星: '星爵', 你星: '星爵',
  我风: '暴风女', 你风: '暴风女',
  你苏珊: '隐形女', 苏珊: '隐形女',
  你磁: '万磁王', 万磁王daddy: '万磁王',
  你摩: '纳摩',
  鲨鲨: '陆行鲨杰夫', 鲨狗: '陆行鲨杰夫',
  铁皮人: '钢铁侠', 铁人: '钢铁侠', 铁男: '钢铁侠',
  美队: '美国队长',
  寡姐: '黑寡妇', 寡妇: '黑寡妇',
  哈哈男: '神奇先生', 橡皮人: '神奇先生',
  树人: '格鲁特',
  雷神: '索尔',
  母石头人: '石头人',
  虎: '',
  你痞: '甜甜痞颜', 我痞: '甜甜痞颜', 痞颜: '甜甜痞颜',
};

const score = (t) => {
  let s = 2;
  if (LW.test(t)) s += 4;
  if (/惹|噜|靴|啾咪|厚|吸吸|笑鼠/.test(t)) s += 2;
  if (/我冰|你冰|我红|你红|我基|你基|我匕|我冬|我烈|你痞|你苏珊|有母亲|只是一位母亲/.test(t)) s += 3;
  if (/我不行了|是可以说的|秒了|有点像|淡淡的|笑鼠|救命|离谱|抽象|心疼|建议|艺术|康康|真的/.test(t)) s += 1;
  if (t.length >= 12 && t.length <= 40) s += 1;
  if (/攻略|配装|天赋推荐|强度排行|下载|安装|教程|换肤|外挂|代练|托管|报价|私信|淘宝|闲鱼/.test(t)) s -= 8;
  if (/^(回复|@|【|\[|#|\d+[.、])/.test(t)) s -= 2;
  if ((t.match(/[a-zA-Z]/g) || []).length > t.length / 2) s -= 3;
  return s;
};

const heroOf = (t) => {
  for (const [a, h] of Object.entries(ALIAS2HERO)) if (h && t.includes(a)) return h;
  for (const h of HERO_WORDS) if (t.includes(h)) return h;
  for (const u of UP_WORDS) if (t.includes(u)) return u;
  return '';
};

// ---- 收集候选 ----
const cand = [];
const seen = new Set();
const push = (text, up, title, kind, bonus = 0) => {
  const t = String(text || '').trim();
  if (t.length < MIN || t.length > MAX) return;
  if (seen.has(t)) return;
  const sc = score(t) + bonus;
  if (sc < 5) return;
  seen.add(t);
  cand.push({ text: t, up: up || '', title: title || '', hero: heroOf(t), kind, score: sc });
};

const { lines } = loadCtx();
// 语境行里凡是【弹幕】【评论】【视频】前缀都被 _mrctx20 去掉了，这里按原始文件重新走一遍拿到归属
for (const f of fs.readdirSync(path.join(ROOT, 'corpus')).filter((x) => /^corpus.*\.txt$/.test(x)).sort()) {
  const raw = fs.readFileSync(path.join(ROOT, 'corpus', f), 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    const mv = t.match(/^【视频】\s*(.*)$/);
    if (mv) {
      var curTitle = mv[1].trim(); // eslint-disable-line no-var
      var curUp = ''; // eslint-disable-line no-var
      continue;
    }
    const mu = t.match(/^【UP】\s*(.*)$/);
    if (mu) {
      curUp = mu[1].trim();
      continue;
    }
    const mc = t.match(/^【(评论|弹幕)】\s*(.*)$/);
    if (mc) push(mc[2].replace(/\[[^\]]{1,8}\]/g, '').trim(), curUp, curTitle, mc[1] === '弹幕' ? '弹幕' : '评论');
  }
}

// 标题：B 站本区标题本身就是金句密度最高的文本
for (const f of fs.readdirSync(path.join(ROOT, 'evidence')).filter((x) => /^manifest-(bili20-|dm20-|2026)/.test(x))) {
  let arr;
  try {
    arr = JSON.parse(fs.readFileSync(path.join(ROOT, 'evidence', f), 'utf8'));
  } catch {
    continue;
  }
  for (const v of Array.isArray(arr) ? arr : []) {
    const rawTitle = String(v.title || '');
    if (!/淋威|漫威|Marvel|争锋/i.test(rawTitle)) continue;
    const t = rawTitle.replace(/[【】［］]/g, '').replace(/\s*#\S+.*$/, '').trim();
    push(t, v.up || '', rawTitle, '标题', 2);
  }
}

cand.sort((a, b) => b.score - a.score || a.text.length - b.text.length);

fs.writeFileSync(
  path.join(ROOT, 'evidence/cand20-quotes.json'),
  JSON.stringify({ generatedAt: new Date().toISOString(), total: cand.length, items: cand }, null, 2)
);
fs.writeFileSync(
  path.join(ROOT, 'evidence/cand20-quotes.txt'),
  cand.map((c, i) => `${i}\t${c.score}\t${c.kind}\t${c.hero || '-'}\t${c.up || '-'}\t${c.text}`).join('\n')
);

console.log(
  `[mine20] 候选 ${cand.length} 条（标题 ${cand.filter((c) => c.kind === '标题').length} / 评论 ${cand.filter((c) => c.kind === '评论').length} / 弹幕 ${cand.filter((c) => c.kind === '弹幕').length}）`
);
console.log(`[mine20] 带 hero ${cand.filter((c) => c.hero).length} 条`);
