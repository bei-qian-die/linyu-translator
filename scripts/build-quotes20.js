'use strict';

// 第二十轮名言落地：从 evidence/cand20-quotes.json 取分最高的一批，产出
// scripts/curated-quotes20.json（curated-lore20.js 会直接 require 它）。
//
// 取用规则（写死在这里，避免每轮口径漂移）：
//   1) score >= 7 的全部收（本轮语料质量高，门槛比 19 轮高一档）
//   2) 不够目标条数时，从 score 5-6 里补「含淋威专属词」的
//   3) hero 只认精确别名映射，映射不上就不挂人物，绝不猜
//   4) 屏蔽广告／攻略／引战私货，宁缺勿滥
//
// 用法：node scripts/build-quotes20.js [目标条数，默认 420]
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TARGET = Number(process.argv[2] || 420);

const VAGUE = /淋威争锋|漫威争锋|漫威|Marvel|争锋|复仇者|X战警|银河护卫队/i;
const HERO_RE =
  /美国队长|奇异博士|格鲁特|浩克|万磁王|潘妮·帕克|索尔|毒液|石头人|白皇后|安吉拉|小淘气|恶魔恐龙|红兜帽|黑寡妇|黑豹|鹰眼|海拉|铁拳|钢铁侠|魔剑客|神奇先生|月光骑士|纳摩|灵蝶|猩红女巫|蜘蛛侠|松鼠女|星爵|暴风女|惩罚者|冬兵|金刚狼|霹雳火|凤凰女|刀锋战士|夜魔侠|艾尔莎|血石|黑猫|雷光眼|格尔|亚当术士|斗篷与匕首|隐形女|杰夫|洛基|冰月花雪|曼蒂斯|火箭浣熊|奥创|牌皇|白狐|百光花火|死侍/;
const LY_RE = /我[冰红基匕冬烈星风月光]|你[冰红基匕冬烈星风磁摩苏珊拳]|只是一位母亲|有母亲|daddy|鲨鲨|鲨狗|铁皮人|美队|寡姐|树人|雷神|橡皮人|哈哈男/;

// 别名 → 人物传里的正式 name（必须与 curated-heroes20.js 的 HEROES[].name 完全一致）
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
  你磁: '万磁王', 你摩: '纳摩',
  鲨鲨: '陆行鲨杰夫', 鲨狗: '陆行鲨杰夫',
  铁皮人: '钢铁侠', 铁人: '钢铁侠', 铁男: '钢铁侠',
  美队: '美国队长',
  寡姐: '黑寡妇', 寡妇: '黑寡妇',
  哈哈男: '神奇先生', 橡皮人: '神奇先生',
  树人: '格鲁特',
  雷神: '索尔',
  母石头人: '石头人',
  你痞: '甜甜痞颜', 我痞: '甜甜痞颜', 痞颜: '甜甜痞颜',
};

const OFFICIAL = [
  '美国队长', '奇异博士', '格鲁特', '浩克', '万磁王', '潘妮·帕克', '索尔', '毒液', '石头人',
  '白皇后', '安吉拉', '小淘气', '恶魔恐龙', '红兜帽', '黑寡妇', '黑豹', '鹰眼', '海拉',
  '铁拳', '钢铁侠', '魔剑客', '神奇先生', '月光骑士', '纳摩', '灵蝶', '猩红女巫', '蜘蛛侠',
  '松鼠女', '星爵', '暴风女', '惩罚者', '冬兵', '金刚狼', '霹雳火', '凤凰女', '刀锋战士',
  '夜魔侠', '艾尔莎·血石', '黑猫', '雷光眼', '屠神者格尔', '亚当术士', '斗篷与匕首', '隐形女',
  '陆行鲨杰夫', '洛基', '冰月花雪', '曼蒂斯', '火箭浣熊', '奥创', '牌皇', '白狐',
  '百光花火', '死侍',
];
const UPS = [
  '甜甜痞颜', '鑫河万点', '良心洗脚妹', '地才女特务', '地才蓝灬频道', '鲁迅欺负周树人',
  'Wooden依末', '赫斯特特特', 'Z_Magnus', '一小罐啤酒', 'Haker没有C',
];

const heroOf = (t) => {
  for (const [alias, hero] of Object.entries(ALIAS2HERO)) if (t.includes(alias)) return hero;
  for (const h of OFFICIAL) if (t.includes(h)) return h;
  for (const u of UPS) if (t.includes(u)) return u;
  return '';
};

// 跨区屏蔽词：人物传里已有的其他分区人物名（洛克／瓦罗／第五／王者／原神…）。
// 「蜘蛛」「鲨鲨」这类和本区重名／重外号的要放行，否则会误杀「蜘蛛侠」「我鲨鲨」。
const MY = require(path.join(ROOT, 'scripts/curated-heroes20.js'));
const MY_NAMES = MY.HEROES.map((h) => h.name);
const MY_WORDS = new Set(MY.HEROES.flatMap((h) => h.words || []));
let OTHER;
try {
  OTHER = JSON.parse(fs.readFileSync(path.join(ROOT, 'evidence/other-heroes.json'), 'utf8'));
} catch {
  OTHER = [];
}
const BLOCK_OTHER = OTHER.filter(
  (n) =>
    n.length >= 2 &&
    !/^[我你][^\s]{1,6}$/.test(n) &&                 // 淋语自称跨区通用，不拦
    !MY_NAMES.some((m) => m.includes(n)) &&          // 蜘蛛 ⊂ 蜘蛛侠
    !MY_WORDS.has(n)                                 // 鲨鲨 → 陆行鲨杰夫
);

// 广告／攻略／引战：一律不要
const JUNK =
  /攻略|配装|天赋推荐|强度排行|下载|安装|教程|换肤|外挂|代练|托管|报价|私信我|淘宝|闲鱼|加微信|扫码|领福利|点我|直播间|商务合作/;

// 串味闸门：本轮只收淋威争锋，别区的梗一律剔除，哪怕它也很淋
const BLEED =
  /第五人格|庄园|求生者|监管者|密码机|修机|狂欢之椅|洛克王国|迪莫|英雄联盟|德玛西亚|王者荣耀|原神|钟离|雷电将军|永劫|三角洲|鸣潮|绝区零|阴阳师|黎明杀机|守望先锋|炉石|星穹铁道|崩铁|无畏契约|瓦罗兰特|捷风|芮娜|爆能器|甄嬛|曹琴默|卡普|莱因哈特|索利兹|伊戈尔|高建利|弹簧daddy|我维托里奥/;

// 清洗：去掉楼中楼前缀与 B 站表情占位符
const clean = (t) =>
  String(t || '')
    .replace(/^回复\s*@[^\s:]+\s*[:：]\s*/, '')
    .replace(/\[[^\]]{1,24}\]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

// 标题 → BV 号索引：名言要能点回原视频，否则 src 全是站首页等于没有出处
const TITLE2BV = new Map();
for (const f of fs.readdirSync(path.join(ROOT, 'evidence')).filter((x) => /^manifest-.*\.json$/.test(x))) {
  let arr;
  try {
    arr = JSON.parse(fs.readFileSync(path.join(ROOT, 'evidence', f), 'utf8'));
  } catch {
    continue;
  }
  for (const v of Array.isArray(arr) ? arr : []) {
    if (v.bvid && v.title) TITLE2BV.set(String(v.title).trim(), v.bvid);
  }
}
// 清洗后的正文（去掉【】与 #tag 尾巴）也要能命中
for (const [t, bv] of [...TITLE2BV]) {
  const c = t.replace(/[【】［］]/g, '').replace(/\s*#\S+.*$/, '').trim();
  if (c && !TITLE2BV.has(c)) TITLE2BV.set(c, bv);
}
const bvOf = (t) => {
  if (!t) return '';
  if (TITLE2BV.has(t)) return TITLE2BV.get(t);
  for (const [k, v] of TITLE2BV) if (t.includes(k) || k.includes(t)) return v;
  return '';
};

const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'evidence/cand20-quotes.json'), 'utf8'));
const all = (data.items || [])
  .map((x) => ({ ...x, text: clean(x.text) }))
  .filter((x) => x.text.length >= 8 && x.text.length <= 60)
  .filter((x) => !JUNK.test(x.text))
  .filter((x) => !BLEED.test(x.text))
  .filter((x) => (x.text.match(/[一-龥]/g) || []).length >= 4);

// 淋味硬指标：句末语气词 或 淋语词汇 或 淋系自称 或 淋语通用说法
const LY_TAIL = /(惹|噜|厚|靴靴|素|嘻嘻|笑鼠|呢|嘛)[!！。~～💅💋🙄]*$/;
const LY_WORD =
  /只素|素在|NBCS|nbcs|玛雅|soon|again|喜翻|降淋|赔钱货|靴靴|惨遭削弱|母亲|[dD]addy|淋威|淋语|淋系|淋文化|淋群|淋game|我[冰红基匕冬烈星风月光]|你[冰红基匕冬烈星风磁摩苏珊拳]|艺术|秒了|狠狠|无所谓|可以说的吗|狠狠访问/;

// 第二档「淋味」：不带语气词，但用的确实是圈内那套审美口吻（可口 / 侍寝 / 菩萨 / 肉体…
// 这一档在泛漫威评论区里很常见，不收就会只剩语气词那几十条，分区名言凑不满。
const LY_VIBE = /可口|侍寝|菩萨|肉体|好大|精瘦|伤身体|亩|骚|婆|老公|饥渴|馋|香|色气|白月光|婆婆|妈妈|妈咪|掌掴|扇/;

// 漫威指涉硬指标：本轮是「淋威争锋」分区，泛淋语（洛克／瓦罗／第五的）一律不要。
// 语料来源 UP 是同一批淋系作者，光靠语境块会把她们别的游戏视频评论全捞进来。
const MR_MARK =
  /漫威|Marvel|marvel|争锋|复仇者|复联|X战警|银河护卫队|灭霸|阿斯加德|仙宫|瓦坎达|昆仑|九头蛇|克林塔|东京2099|神盾局|捍卫者|决斗家|策略家|连携|占点|推车|运货|时间流纠缠|超英|美队|美国队长|钢铁侠|铁皮人|蜘蛛侠|小蜘蛛|猩红女巫|洛基|冰月花雪|毒液|冬兵|暴风女|万磁王|纳摩|黑寡妇|寡姐|黑豹|鹰眼|海拉|铁拳|月光骑士|灵蝶|松鼠女|星爵|惩罚者|金刚狼|霹雳火|凤凰女|刀锋战士|夜魔侠|黑猫|雷光眼|格尔|亚当术士|斗篷与匕首|隐形女|苏珊|杰夫|鲨鲨|鲨狗|曼蒂斯|火箭浣熊|奥创|牌皇|白狐|百光花火|死侍|格鲁特|树人|浩克|绿巨人|索尔|雷神|石头人|白皇后|安吉拉|小淘气|恶魔恐龙|红兜帽|神奇先生|橡皮人|哈哈男|魔剑客|潘妮|甜甜痞颜|鑫河万点|良心洗脚妹|地才女特务|地才蓝灬频道|鲁迅欺负周树人|Wooden依末|赫斯特特特|Z_Magnus|一小罐啤酒|Haker没有C/;

// 纯资讯／攻略／MOD 展示：不是淋语，剔除
const INFO =
  /简介|攻略|教学|上分|版本答案|强度|排行|更新日志|补丁|前瞻|赛事|直播回放|mod|Mod|MOD|替换|皮肤展示|手感|操作|演示|实战|集锦|锦集|AI|ai电影|真人化|图鉴|打法|阵容|真人版|coser|演员|剧版|换脸|拼装|手办|周边|比赛|段位|保底|抽卡|手感/i;

const keep = (x) =>
  MR_MARK.test(x.text) &&
  (LY_TAIL.test(x.text) || LY_WORD.test(x.text) || LY_VIBE.test(x.text)) &&
  !INFO.test(x.text) &&
  !BLOCK_OTHER.some((n) => x.text.includes(n));

const hi = all.filter((x) => x.score >= 7 && keep(x));
const lo = all.filter((x) => x.score >= 5 && x.score < 7 && keep(x));

// 标题优先（作者精修过），其次长句（信息量更足），再按分数
const rank = (a, b) =>
  b.score - a.score ||
  (b.kind === '标题' ? 1 : 0) - (a.kind === '标题' ? 1 : 0) ||
  Math.abs(a.text.length - 30) - Math.abs(b.text.length - 30);

const pool = [...hi.sort(rank), ...lo.sort(rank)];
const picked = pool.slice(0, TARGET);

const out = picked.map((c) => {
  const text = c.text.trim();
  const bv = bvOf(c.title) || bvOf(text);
  return {
    text,
    author: c.up || 'B站淋威争锋相关视频评论区',
    hero: heroOf(text),
    src: bv ? `https://www.bilibili.com/video/${bv}` : 'https://www.bilibili.com/',
    scene: c.kind === '标题' ? '淋威争锋 / 标题' : c.kind === '弹幕' ? '淋威争锋 / 弹幕' : '淋威争锋 / 评论',
    score: c.score,
  };
});

fs.writeFileSync(path.join(ROOT, 'scripts/curated-quotes20.json'), JSON.stringify(out, null, 2) + '\n');

const withHero = out.filter((q) => q.hero);
console.log(`[build-quotes20] 候选池 ${pool.length}（score>=7 的 ${hi.length} + 补 ${Math.max(0, picked.length - hi.length)}）`);
console.log(`[build-quotes20] 落地 ${out.length} 条，其中挂人物 ${withHero.length} 条`);
const byHero = {};
for (const q of withHero) byHero[q.hero] = (byHero[q.hero] || 0) + 1;
console.log(
  '[build-quotes20] 人物分布：' +
    Object.entries(byHero).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join('  ')
);
