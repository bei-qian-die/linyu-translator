'use strict';

// 第十九轮分区串味检查：瓦罗淋特分区的每条词条，其 linyu 必须至少在**一句瓦罗语境**里出现过。
//
// 为什么需要这道闸门：verify-qc19.js 只在全量语料里找字符串，
// 「静步」「女王」这种跨游戏通用词能轻松命中，但命中的可能是第五人格或 LOL 的句子。
// 那样词条虽然「验真通过」，分区归属却是错的（＝串味）。
//
// 判定口径：
//   - 瓦罗语境行 = 该行含 瓦罗专属词（游戏名／特工名／瓦罗独有术语）
//   - 若 linyu 在所有瓦罗语境行里都查不到，则判为串味，输出清单
//
// 用法：
//   node scripts/check-slot-bleed19.js            # 只报告
//   node scripts/check-slot-bleed19.js --write    # 从 curated-linyu19.js 剔除串味词条
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FILE = path.join(ROOT, 'scripts/curated-linyu19.js');
const WRITE = process.argv.includes('--write');

const norm = (s) => String(s || '').replace(/[\s，。、！？；：""''（）()【】[\]…~～·—\-_/\\|,.:;!?"']/g, '').toLowerCase();

// 瓦罗专属词：这些词出现在句子里，就能判定该句属于瓦罗语境
const VA_STRONG =
  /无畏契约|瓦罗兰特|瓦罗淋特|大沙田契约|爆能器|捷风|婕提|夜露|夜戮|芮娜|蕾娜|瑞纳|猎枭|苏法|黑梦|菲德|贤者|圣祈|奇乐|恺宙|尚勃勒|钱博尔|钱包|瑟符|炼狱|布史东|不死鸟|菲尼克斯|火男|雷兹|炸弹妹|星礈|黑妹|蝰蛇|薇蝮|暮蝶|克洛芙|慕蝶|幽影|海神|铁臂|斯凯|盖可|盖克|钛狐|钛湖|壹决|一决|一绝|幻棱|维斯|钢锁|霓虹|遐思|赋能|源能战魂|瓦学弟|VCT|冠军赛|瞭犬|獠犬|戍卫|骇灵|蜂刺|雄鹿|奥丁|莽侠|鬼魅|源工重镇|亚海悬城|日落之城|霓虹町|森寒冬港|极地寒港|微风岛屿|裂变峡谷|深海明珠|幽邃地窟|隐世修所|盐海矿镇|莲华古城|意境空岛|天枢云阙|一突|二突|烟位|哨位|信息位|打瓦|手瓦|瓦手|掌瓦|我🐍|我梦|我🔒|瓦的|瓦友|薇蝮|瓦罗/;

// 明确属于其它游戏的词：句子里有它、又没有瓦罗专属词，就判为别家语境
const OTHER_STRONG =
  /第五人格|庄园|求生者|监管者|屠夫|密码机|地窖|狂欢之椅|洛克王国|精灵|迪莫|魔力猫|明日方舟|罗德岛|原神|钟离|雷电将军|珊瑚宫|星穹|崩铁|王者荣耀|英雄联盟|LOL|永劫|三角洲|鸣潮|绝区零|阴阳师|黎明杀机|守望先锋|炉石/;

let lines = [];
for (const f of fs.readdirSync(path.join(ROOT, 'corpus')).filter((x) => x.endsWith('.txt')).sort()) {
  const raw = fs.readFileSync(path.join(ROOT, 'corpus', f), 'utf8');
  for (const l of raw.split(/\r?\n/)) {
    const t = l.replace(/^【(评论|弹幕|视频|UP|简介)】\s*/, '').replace(/\[[^\]]{1,8}\]/g, '').trim();
    if (t.length < 4) continue;
    if (!VA_STRONG.test(t)) continue;
    if (OTHER_STRONG.test(t) && !/无畏契约|瓦罗兰特|瓦罗淋特|大沙田契约/.test(t)) continue;
    lines.push(norm(t));
  }
}
const VA_BLOB = lines.join('\n');
console.log(`[bleed19] 瓦罗语境行 ${lines.length} 条，${(VA_BLOB.length / 10000).toFixed(1)} 万字`);

const { WORDS } = require(FILE);

const bleed = [];
const ok = [];
for (const w of WORDS) {
  const n = norm(w.linyu);
  if (!n) continue;
  if (VA_BLOB.includes(n)) ok.push(w.zh);
  else bleed.push(w);
}

console.log(`[bleed19] 词条 ${WORDS.length}：语境成立 ${ok.length}，疑似串味 ${bleed.length}`);
for (const w of bleed) console.log(`   ✗ ${w.zh} → ${w.linyu}  [${w.slot}]`);

fs.writeFileSync(
  path.join(ROOT, 'evidence/qc19-slot-bleed.json'),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      why: 'linyu 在瓦罗语境行里一次都没出现，判为跨游戏通用词，不应挂瓦罗淋特分区',
      vaLines: lines.length,
      items: bleed.map((w) => ({ zh: w.zh, linyu: w.linyu, slot: w.slot })),
    },
    null,
    2
  )
);

if (WRITE && bleed.length) {
  let s = fs.readFileSync(FILE, 'utf8');
  let removed = 0;
  for (const w of bleed) {
    const marker = `  {\n    zh: '${w.zh}',\n    linyu: '${w.linyu}',`;
    const start = s.indexOf(marker);
    if (start < 0) {
      // 兜底：只按 zh 定位
      const m2 = s.indexOf(`  {\n    zh: '${w.zh}',`);
      if (m2 < 0) continue;
      const e2 = s.indexOf('\n  },\n', m2);
      s = s.slice(0, m2) + s.slice(e2 + '\n  },\n'.length);
      removed += 1;
      continue;
    }
    const end = s.indexOf('\n  },\n', start);
    s = s.slice(0, start) + s.slice(end + '\n  },\n'.length);
    removed += 1;
  }
  fs.writeFileSync(FILE, s);
  console.log(`[bleed19] 已从源文件剔除 ${removed} 条`);
} else if (bleed.length) {
  console.log('[bleed19] 未加 --write，未改动源文件');
}
