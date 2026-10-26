// 一次性内容修订（v1.19.0）：
//   1) 15 条「游戏分区」句式：模板去掉「，启动！」，只留游戏名；pattern 顺带吃掉用户输入里的「，启动！」
//   2) 词库同步 PC 端用户改动：我→本可、你们→婊宝们、满分女/煮饭 的分类归并
// 只改 src/core/seed.json（唯一源），其余端由构建脚本生成。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEED = path.join(ROOT, 'src', 'core', 'seed.json');

const START_SUFFIX = '(?:[，,、]?\\s*启动[！!]?)?';

// 旧 pattern -> 新游戏名模板
const GAME_RULES = [
  ['(?:淋日方舟|淋日方舟终末地)', '淋日方舟', '淋日方舟终末地'],
  ['(?:阴淋师|阴淋师协斗)', '阴淋师', '阴淋师协斗'],
  ['(?:绝区淋|撅区淋|绝区零)', '绝区淋', ''],
  ['(?:洛克淋国|洛克王国)', '洛克淋国', ''],
  ['(?:星淋铁道|β坏|星穹铁道)', '星淋铁道', ''],
  ['(?:瓦罗淋特|瓦罗兰特|无畏契约)', '瓦罗淋特', ''],
  ['(?:淋安京|决战平安京)', '淋安京', ''],
  ['(?:三角淋行动|淋角洲行动|三角洲行动)', '三角淋行动', ''],
  ['(?:第五淋格|第五人格)', '第五淋格', ''],
  ['(?:淋明杀鸡|淋明杀机|黎明杀机)', '淋明杀鸡', ''],
  ['(?:英雄淋盟|阴雄淋盟|英雄联盟)', '英雄淋盟', ''],
  ['(?:王者淋耀|淋者荣耀|王者荣耀|淋耀)', '王者淋耀', ''],
  ['(?:淋神|原神)', '淋神', ''],
  ['(?:守望淋锋|守望先锋)', '守望淋锋', ''],
  ['(?:街头霸淋|街头霸王)', '街头霸淋', ''],
];

const seed = JSON.parse(fs.readFileSync(SEED, 'utf8'));
let ruleHits = 0;
const log = [];

for (const [oldPattern, name] of GAME_RULES) {
  const r = seed.rules.find((x) => x.pattern === oldPattern);
  if (!r) {
    console.log('!! 未找到句式', oldPattern);
    continue;
  }
  const before = r.template;
  r.pattern = oldPattern + START_SUFFIX;
  r.template = name;
  r.note = String(r.note || '').replace(/启动/g, '') || `${name}分区`;
  if (!r.examples || r.examples.includes('启动')) {
    r.examples = `${name}；${name}启动！`;
  }
  ruleHits++;
  log.push(`  ${name}: ${JSON.stringify(before)} -> ${JSON.stringify(r.template)}`);
}

// 词库：把 PC 端改过的译文同步成新基准（兄弟/哭 视为误删，保留原译）
const WORD_PATCH = { 我: { linyu: '本可' }, 你们: { linyu: '婊宝们' } };
const SLOT_ADD = { 满分女: '淋者荣耀', 煮饭: '阴雄淋盟' };
let wordHits = 0;
for (const w of seed.words) {
  const patch = WORD_PATCH[w.zh];
  if (patch) {
    for (const [k, v] of Object.entries(patch)) {
      if (w[k] !== v) {
        log.push(`  词 ${w.zh}: ${k} ${JSON.stringify(w[k])} -> ${JSON.stringify(v)}`);
        w[k] = v;
        wordHits++;
      }
    }
  }
  const extra = SLOT_ADD[w.zh];
  if (extra) {
    const parts = String(w.slot || '')
      .split('/')
      .map((x) => x.trim())
      .filter(Boolean);
    if (!parts.includes(extra)) {
      parts.unshift(extra);
      log.push(`  词 ${w.zh}: slot ${JSON.stringify(w.slot)} -> ${JSON.stringify(parts.join('/'))}`);
      w.slot = parts.join('/');
      wordHits++;
    }
  }
}

fs.writeFileSync(SEED, JSON.stringify(seed, null, 2) + '\n', 'utf8');
console.log(`句式修订 ${ruleHits} 条，词库修订 ${wordHits} 处`);
console.log(log.join('\n'));
