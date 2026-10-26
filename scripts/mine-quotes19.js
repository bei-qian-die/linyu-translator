'use strict';

// 第十九轮名言挖掘：从 corpus/*.txt 里捞出「瓦罗语境 + 有观点／有情绪」的句子。
//
// 与 18 号的关键区别：**按视频分块**判定语境，而不是逐行判。
// 只要视频本身属于瓦罗区（标题／简介里有瓦罗特征），它评论区里的句子就都算瓦罗语境——
// 瓦区最有梗的话（「这期片头艺术成分有点过高了」）往往一个瓦罗字都不带，
// 逐行判会全漏；反过来只看关键词又会把「皮肤」「超模」这类跨游戏通用词全捞进来。
//
// 产出 evidence/cand19-quotes.json / .txt，供 build-quotes19.js 取用。
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MIN = 8;
const MAX = 64;

const VAGUE = /无畏契约|瓦罗兰特|瓦罗淋特|瓦罗|valorant|VALORANT|大沙田契约|淋格/i;
const AGENT =
  /捷风|婕提|夜露|夜戮|芮娜|蕾娜|瑞纳|苪娜|锐纳|猎枭|苏法|黑梦|菲德|贤者|圣祈|奇乐|恺宙|尚勃勒|钱博尔|钱包|瑟符|保安|炼狱|布史东|不死鸟|菲尼克斯|火男|雷兹|炸弹妹|星礈|黑妹|蝰蛇|薇蝮|暮蝶|克洛芙|慕蝶|幽影|海神|铁臂|斯凯|盖可|盖克|钛狐|钛湖|壹决|一决|一绝|幻棱|维斯|钢锁|霓虹|遐思/;
const TERM =
  /爆能器|狂徒|幻影|獠犬|戍卫|骇灵|蜂刺|雄鹿|奥丁|莽侠|标配|鬼魅|狂怒|正义|大狙|鸟狙|一突|二突|烟位|哨位|信息位|先锋位|报点|报位|点位|对枪|架枪|爆弹|默认|静步|补枪|大拉|干拉|残局|antieco|下包|拆包|假拆|半甲|全甲|大甲|长枪|短枪|源工重镇|亚海悬城|日落之城|霓虹町|森寒冬港|极地寒港|微风岛屿|裂变峡谷|深海明珠|幽邃地窟|隐世修所|盐海矿镇|莲华古城|意境空岛|天枢云阙|赋能|神话|超凡|铂金|黑铁|瓦学弟|冠军赛|VCT|世一|国一|炸鱼|带妹|瘤子|唐人|超模/;

// 别的游戏：句子里只有这些、没有瓦罗特征的一律排除，避免分区串味
const OTHER =
  /灵砂|崩铁|星穹|原神|钟离|雷电将军|第五人格|洛克|明日方舟|永劫|王者荣耀|英雄联盟|LOL|APEX|apex|三角洲|鸣潮|绝区零|阴阳师|黎明杀机|DOTA|守望先锋|炉石|屠夫|求生者|监管者|珊瑚宫|心海|宝可梦|雪天队|虫队|四魂|守望|OVERWATCH|崩坏|罗德岛|提瓦特|尘歌壶|芙宁娜|雷电|散兵/;

// 其它游戏的淋语系列名：这些视频的评论区不是瓦罗语境，整块跳过
const VIDEO_OTHER = /第五淋格|淋明杀鸡|淋明杀机|淋神|淋盟|淋耀|淋德之门|守望淋锋|淋日方舟|绝区淋|阴淋师|洛克淋国|淋威争锋/;

const MARK =
  /惹|噜|素|厚|靴靴|鼠|淋|婆|贝|姐|妹|daddy|Daddy|我不行了|是可以说的|秒了|有点像|淡淡的|笑鼠|本可|仙女|绝美|slay|Slay|美美|阴阴的|好美|艺术|离谱|抽象/;

const HERO_WORDS = [
  '捷风', '夜露', '夜戮', '芮娜', '蕾娜', '瑞纳', '苪娜', '锐纳', '猎枭', '苏法', '黑梦', '菲德',
  '贤者', '圣祈', '奇乐', '恺宙', '尚勃勒', '钱博尔', '钱包', '瑟符', '保安', '炼狱', '布史东',
  '不死鸟', '菲尼克斯', '火男', '雷兹', '炸弹妹', '星礈', '黑妹', '蝰蛇', '薇蝮', '暮蝶', '克洛芙',
  '慕蝶', '幽影', '海神', '铁臂', '斯凯', '盖可', '盖克', '钛狐', '钛湖', '壹决', '一决', '一绝',
  '幻棱', '维斯', '钢锁', '霓虹', '遐思',
];

const score = (t) => {
  let s = 2;
  if (MARK.test(t)) s += 4;
  if (/瓦罗淋特|女特务|尸油|赔钱货|我🐍|我梦|我🔒|蓝色小丑|瘤子|唐人|超模|炸鱼|带妹|瓦学弟/.test(t)) s += 3;
  if (/我不行了|是可以说的|秒了|有点像|淡淡的|笑鼠|救命|离谱|抽象|心疼|建议|艺术/.test(t)) s += 2;
  if (/我觉得|真的|怎么|为什么|能不能|不会|居然|要是|如果|难道/.test(t)) s += 1;
  if (t.length >= 10 && t.length <= 42) s += 1;
  if (/攻略|配装|天赋推荐|强度排行|下载|安装|教程|换肤|外挂|代练|托管|报价|私信/.test(t)) s -= 8;
  if (/^(回复|@|【|\[|#|\d+[.、])/.test(t)) s -= 2;
  if ((t.match(/[a-zA-Z]/g) || []).length > t.length / 2) s -= 3;
  return s;
};

const heroOf = (t) => {
  for (const h of HERO_WORDS) if (t.includes(h)) return h;
  return '';
};

const cand = [];
const seen = new Set();

const push = (text, up, title, kind, bonus = 0) => {
  const t = String(text || '').trim();
  if (t.length < MIN || t.length > MAX) return;
  if (seen.has(t)) return;
  if (OTHER.test(t) && !VAGUE.test(t) && !AGENT.test(t)) return;
  const sc = score(t) + bonus;
  if (sc < 4) return;
  seen.add(t);
  cand.push({ text: t, up: up || '', title: title || '', hero: heroOf(t), kind, score: sc });
};

for (const f of fs.readdirSync(path.join(ROOT, 'corpus')).filter((x) => x.endsWith('.txt')).sort()) {
  const raw = fs.readFileSync(path.join(ROOT, 'corpus', f), 'utf8');

  // 分块语料：【视频】/【UP】/【简介】/【评论】
  let curVideo = null;
  let isVa = false;
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    const mv = t.match(/^【视频】\s*(.*)$/);
    if (mv) {
      curVideo = { title: mv[1].trim(), up: '', desc: '' };
      isVa = (VAGUE.test(curVideo.title) || AGENT.test(curVideo.title) || TERM.test(curVideo.title)) && !VIDEO_OTHER.test(curVideo.title);
      continue;
    }
    const mu = t.match(/^【UP】\s*(.*)$/);
    if (mu && curVideo) {
      curVideo.up = mu[1].trim();
      continue;
    }
    const md = t.match(/^【简介】\s*(.*)$/);
    if (md && curVideo) {
      curVideo.desc = md[1].trim();
      if (!isVa && /淋/.test(curVideo.desc)) isVa = true;
      continue;
    }
    const mc = t.match(/^【评论】\s*(.*)$/);
    if (!mc) continue;
    if (!curVideo || !isVa) continue;
    push(mc[1].replace(/\[[^\]]{1,8}\]/g, '').trim(), curVideo.up, curVideo.title, '评论');
  }
}

// 标题：从 manifest 取所有瓦罗相关视频的标题（B 站瓦区标题本身就是金句密度最高的文本）
for (const f of fs.readdirSync(path.join(ROOT, 'evidence')).filter((x) => /^manifest-2026/.test(x))) {
  let arr;
  try {
    arr = JSON.parse(fs.readFileSync(path.join(ROOT, 'evidence', f), 'utf8'));
  } catch {
    continue;
  }
  for (const v of Array.isArray(arr) ? arr : []) {
    const rawTitle = String(v.title || '');
    if (!(VAGUE.test(rawTitle) || AGENT.test(rawTitle) || TERM.test(rawTitle))) continue;
    if (VIDEO_OTHER.test(rawTitle)) continue;
    const t = rawTitle.replace(/[【】［］]/g, '').replace(/\s*#\S+.*$/, '').trim();
    push(t, v.up || '', rawTitle, '标题', 1);
  }
}

cand.sort((a, b) => b.score - a.score || a.text.length - b.text.length);

fs.writeFileSync(
  path.join(ROOT, 'evidence/cand19-quotes.json'),
  JSON.stringify({ generatedAt: new Date().toISOString(), total: cand.length, items: cand }, null, 2)
);
fs.writeFileSync(
  path.join(ROOT, 'evidence/cand19-quotes.txt'),
  cand.map((c, i) => `${i}\t${c.score}\t${c.kind}\t${c.hero}\t${c.up || '-'}\t${c.text}`).join('\n')
);

console.log(`[mine19] 候选 ${cand.length} 条（标题 ${cand.filter((c) => c.kind === '标题').length} / 评论 ${cand.filter((c) => c.kind === '评论').length}）`);
console.log(`[mine19] 带 hero ${cand.filter((c) => c.hero).length} 条`);
