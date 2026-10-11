'use strict';
// 过滤语料：只保留含足量淋语特征行的视频块，避免无关视频制造伪佐证
const fs = require('fs');

const IN = process.argv[2];
const OUT = process.argv[3];
const MIN = Number(process.env.MIN || 3);

const LY = /(淋|通讯录|可人儿|本可|靴靴|噜$|惹$|厚$|素惹|美cry|地才|贝塔|乌干达|13|姐妹|仙女|阴雄|姐圈|蔡依林|Jolin|jolin|特务J|舞娘|日不落|花蝴蝶|恒河水|天惹|天啦噜|惊咽|精咽|喜翻|开熏|恶熏|扯头花|风姿|王钦朕|婷芷|锁定|吸入|解解|孝死|全体起立|事业第二春|flop|母体|渊下宫)/;

const txt = fs.readFileSync(IN, 'utf8');
const blocks = txt.split(/(?=^==== )/m);
const keep = [];
const drop = [];
for (const b of blocks) {
  const head = (b.match(/^==== \[[^\]]+\] (BV\w+) ([^=]+)====/) || [])[0];
  if (!head) continue;
  const lines = b.split('\n').filter((l) => /^\[(dm|cmt|sub)\]/.test(l));
  const hits = lines.filter((l) => LY.test(l)).length;
  if (hits >= MIN) keep.push({ head, hits, n: lines.length, b });
  else drop.push({ head, hits, n: lines.length });
}
keep.sort((a, b) => b.hits - a.hits);
fs.writeFileSync(OUT, keep.map((k) => k.b).join('\n'), 'utf8');
console.log('kept', keep.length, 'dropped', drop.length);
console.log('--- KEPT (hits/lines)');
keep.forEach((k) => console.log(k.hits + '/' + k.n + ' ' + k.head.replace('==== ', '').slice(0, 90)));
console.log('--- DROPPED');
drop.forEach((k) => console.log(k.hits + '/' + k.n + ' ' + k.head.replace('==== ', '').slice(0, 80)));
