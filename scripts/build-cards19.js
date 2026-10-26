'use strict';

// 第十九轮词卡生成：把 curated-linyu19.js 里已验真的词条转成词卡，
// example 一律取 corpus 里的**真实原句**（不是把 sense 抄一遍），保证 attest 能过。
//
// 为什么不用手写：词条已经有 zh / linyu / sense / source / slot，
// 词卡只是换一种组织方式（按 term 检索、带类型、带例句）。手写 150 张必然出现
// example 编造或与词条脱节，脚本化反而更可控。
//
// 用法：node scripts/build-cards19.js [目标张数，默认 150]
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TARGET = Number(process.argv[2] || 150);

const norm = (s) => String(s || '').replace(/[\s，。、！？；：""''（）()【】[\]…~～·—\-_/\\|,.:;!?"']/g, '').toLowerCase();

// 语料按句切分（保留原句用于落库）
let blob = '';
for (const f of fs.readdirSync(path.join(ROOT, 'corpus')).filter((x) => x.endsWith('.txt')).sort()) {
  blob += fs.readFileSync(path.join(ROOT, 'corpus', f), 'utf8') + '\n';
}
const lines = [
  ...new Set(
    blob
      .split(/\r?\n/)
      .map((l) => l.replace(/^【(评论|弹幕|视频|UP|简介)】\s*/, '').replace(/\[[^\]]{1,8}\]/g, '').trim())
      .filter((t) => t.length >= 8 && t.length <= 70)
  ),
];
const NL = lines.map((t) => ({ raw: t, n: norm(t) }));

// 瓦罗语境词：例句里带上这些，词卡才贴题（否则容易抓到别的游戏的同名词）
const VA = /无畏契约|瓦罗兰特|瓦罗淋特|瓦罗|特工|爆能器|报点|点位|一突|二突|烟位|哨位|皮肤|炫彩|冠军|赋能|神话|夜露|芮娜|捷风|猎枭|黑梦|贤者|奇乐|尚勃勒|钱包|瑟符|保安|炼狱|不死鸟|火男|雷兹|星礈|黑妹|蝰蛇|暮蝶|幽影|海神|铁臂|斯凯|盖可|盖克|钛狐|壹决|幻棱|维斯|钢锁|霓虹|遐思|戍卫|獠犬|骇灵|蜂刺|雄鹿|奥丁|莽侠|鬼魅|标配|狂怒|正义|大狙|鸟狙|喷子|半甲|全甲|大甲|轻甲|重甲|eco|半起|强起|残局|对枪|架枪|压枪|拉枪|开镜|爆弹|默认|补枪|大拉|干拉|下包|拆包|假拆|静步|拉扯|timing/;

/** 找一句包含 kid 的原文：优先「含瓦罗语境」，其次长度接近 24 字 */
const findExample = (kids) => {
  const cands = [];
  for (const k of kids) {
    const nk = norm(k);
    if (!nk) continue;
    for (const item of NL) {
      if (item.n.includes(nk)) cands.push(item.raw);
      if (cands.length > 80) break;
    }
    if (cands.length) break;
  }
  if (!cands.length) return '';
  // 第一轮：只要含瓦罗语境的句子；一条都没有才放宽（宁可少一张卡，也不拿别的游戏的句子充数）
  const vaHits = cands.filter((t) => VA.test(t));
  const pool = vaHits.length ? vaHits : cands;
  pool.sort((a, b) => {
    const sa = (VA.test(a) ? 4 : 0) + (a.length <= 40 ? 2 : 0) - Math.abs(a.length - 24) / 40;
    const sb = (VA.test(b) ? 4 : 0) + (b.length <= 40 ? 2 : 0) - Math.abs(b.length - 24) / 40;
    return sb - sa;
  });
  return pool[0];
};

const { WORDS } = require(path.join(ROOT, 'scripts/curated-linyu19.js'));

// term 类型判定
const PARTICLE = /淡淡的|美美的|阴阴的|素|惹|噜|靴靴|苟$/;
const MEME = /尸油|秋裤|汗脚|屁股|蓝色小丑|瘤子|独B|压力怪|炸鱼|带妹|唐人|唐福|贝多芬|颗秒|大姐|小姐姐|女士|姐姐|老妈|仙女|守点|冠军|亚军|康纳|康康|瓦学弟|大哥|接盘侠|这弔游戏|猎天使|珊瑚宫|规则怪谈|乙女|同人图|梗图|联名|录播|破防|演员|挂机|开挂|环境|建模|皮蛋|丢丢|鲨鲨|机器人|狗|嘎达嘎达|铁臂阿童木|汗脚|钢锁这大姐|女王|带派|超模|加强|削弱|回调|重做/;
const LYRIC = /^$.^/; // 本轮词库里没有「句式」类词条，lyric 只留给名言，不误判

const typeOf = (w) => {
  const s = w.zh + w.linyu + (w.sense || '');
  if (PARTICLE.test(w.linyu) || PARTICLE.test(w.zh)) return 'particle';
  if (LYRIC.test(s)) return 'lyric';
  if (MEME.test(w.zh) || MEME.test(w.linyu)) return 'meme';
  return 'slang';
};

// term 用淋语译法做检索键（用户想查的是「这个词在淋语里怎么说」）
// 语境不成立、又找不到贴题例句的词：不出卡（词条本身保留在词库里）
const BLOCK = new Set(['女王', '本可', '姐姐', '古神', '探头', '我梦', '狂怒', '掉分', '时机', '拉满', '拉扯']);

// 个别词在语料里有更贴题的句子，直接指定（避免被通用句挤掉）
const OVERRIDE = {
  正义: 'eco正义五杀，真得给一个',
};

const out = [];
const seenTerm = new Set();

// 先按 slot 轮转，避免某一类把额度吃满
const groups = new Map();
for (const w of WORDS) {
  const key = String(w.slot || '').split('/')[1] || '-';
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(w);
}

// 排序权重：带 hero 关联价值的（特工/自称/整活）优先，纯枪械数值靠后
const WEIGHT = {
  瓦罗特工位分: 10,
  瓦罗自称体系: 10,
  瓦罗整活梗: 9,
  瓦罗报点术语: 7,
  瓦罗战术术语: 7,
  瓦罗赛事梗: 6,
  瓦罗地图: 5,
  瓦罗枪械经济: 5,
  瓦罗皮肤经济: 4,
  分区: 3,
};

const keys = [...groups.keys()].sort((a, b) => (WEIGHT[b] || 0) - (WEIGHT[a] || 0));
let round = 0;
while (out.length < TARGET) {
  let added = 0;
  for (const k of keys) {
    const arr = groups.get(k);
    const w = arr[round];
    if (!w) continue;
    const term = w.linyu;
    if (BLOCK.has(term)) continue;
    if (seenTerm.has(term)) continue;
    const ex = OVERRIDE[term] || findExample([w.linyu, w.zh]);
    if (!ex) continue;
    seenTerm.add(term);
    out.push({
      term,
      zh: w.zh,
      type: typeOf(w),
      meaning: w.sense,
      example: ex,
      source: w.source,
      slot: w.slot,
      score: (WEIGHT[k] || 0) + (ex.length <= 40 ? 1 : 0),
    });
    added += 1;
    if (out.length >= TARGET) break;
  }
  round += 1;
  if (!added) break;
}

fs.writeFileSync(path.join(ROOT, 'scripts/curated-cards19.json'), JSON.stringify(out, null, 2) + '\n');

const byType = {};
for (const c of out) byType[c.type] = (byType[c.type] || 0) + 1;
console.log(`[build-cards19] 生成词卡 ${out.length} 张（目标 ${TARGET}）`);
console.log('[build-cards19] 类型分布：' + Object.entries(byType).map(([k, v]) => `${k}:${v}`).join('  '));
console.log('[build-cards19] 无例句跳过 ' + (WORDS.length - out.length) + ' 条');
