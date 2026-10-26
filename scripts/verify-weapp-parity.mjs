// 三端一致性比对（B12）：桌面 / Android 共用 src/core，微信小程序用 miniprogram/core。
// 以 src/core/seed.json 为唯一数据源，跑 test/core.test.js 的全部用例 + 全量词条 + 组合句，
// 逐字符比对两套 translateText 的输出。任一条不一致直接失败。
import fs from 'node:fs';
import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const coreSeed = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'core', 'seed.json'), 'utf8'));
// 小程序端 seed 是列式编码（{__col:1, words:{keys,rows}}）以压主包，这里先还原再比对。
const decodeCol = (part) => {
  if (!part || !Array.isArray(part.rows)) return part;
  const { keys, rows } = part;
  return rows.map((row) => {
    const o = {};
    for (let i = 0; i < keys.length; i++) {
      const v = row[i];
      if (v !== null && v !== undefined) o[keys[i]] = v;
    }
    return o;
  });
};
const rawMpSeed = require('../miniprogram/data/seed.js');
const mpSeed = rawMpSeed.__col
  ? { words: decodeCol(rawMpSeed.words), rules: decodeCol(rawMpSeed.rules) }
  : rawMpSeed;
const coreTranslator = require('../src/core/translator.js');
const mpTranslator = require('../miniprogram/core/translator.js');

const coreCtx = { words: coreSeed.words, rules: coreSeed.rules };
const mpCtx = { words: mpSeed.words, rules: mpSeed.rules };

function decodeLiteral(value) {
  return value.replace(/\\(u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|n|r|t|b|f|v|0|'|"|\\|\n)/g, (match, esc) => {
    switch (esc) {
      case 'n':
        return '\n';
      case 'r':
        return '\r';
      case 't':
        return '\t';
      case 'b':
        return '\b';
      case 'f':
        return '\f';
      case 'v':
        return '\v';
      case '0':
        return '\0';
      case "'":
        return "'";
      case '"':
        return '"';
      case '\\':
        return '\\';
      case '\n':
        return '';
      default:
        if (esc[0] === 'u') return String.fromCharCode(parseInt(esc.slice(1), 16));
        if (esc[0] === 'x') return String.fromCharCode(parseInt(esc.slice(1), 16));
        return match;
    }
  });
}

function extractCoreCases() {
  const source = fs.readFileSync(path.join(ROOT, 'test', 'core.test.js'), 'utf8');
  const cases = [];
  const re = /check\(\s*'([^']*)'\s*,\s*'((?:[^'\\]|\\.)*)'/g;
  let match = re.exec(source);
  while (match) {
    cases.push(decodeLiteral(match[2]));
    match = re.exec(source);
  }
  const loop = source.match(/for \(const src of \[([\s\S]*?)\]\)/);
  if (loop) {
    const strRe = /'((?:[^'\\]|\\.)*)'/g;
    let s = strRe.exec(loop[1]);
    while (s) {
      cases.push(decodeLiteral(s[1]));
      s = strRe.exec(loop[1]);
    }
  }
  return cases;
}

function buildCases() {
  const cases = new Map();
  const add = (label, input) => {
    if (typeof input !== 'string') return;
    if (!cases.has(input)) cases.set(input, label);
  };

  for (const input of extractCoreCases()) add('core.test.js', input);

  for (const word of coreSeed.words) add('全量词条', word.zh);
  for (const rule of coreSeed.rules) {
    if (rule.examples) add('句式示例', rule.examples);
  }

  add('边界', '');
  add('边界', '   ');
  add('边界', '\n\n');
  add('边界', 'hello world 123');
  add('边界', '😀🎵💅 你 好 呀');
  add('边界', '今天很开心\n加油哦');
  add('边界', '你今天真好看！'.repeat(62).slice(0, 500));

  // 确定性组合句：覆盖词条之间的边界与长句
  let state = 20261025;
  const rand = (n) => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state % n;
  };
  const suffixes = ['', '！', '。', '呢', '吗？', '，真的好厉害', '\n加油哦', '哈哈哈哈'];
  for (let i = 0; i < 400; i += 1) {
    const count = 2 + rand(3);
    const parts = [];
    for (let j = 0; j < count; j += 1) {
      const word = coreSeed.words[rand(coreSeed.words.length)];
      if (word && word.zh) parts.push(word.zh);
    }
    add('组合句', parts.join('') + suffixes[rand(suffixes.length)]);
  }

  return Array.from(cases.entries()).map(([input, label]) => ({ input, label }));
}

const cases = buildCases();
const failures = [];
const started = Date.now();

for (const { input, label } of cases) {
  const want = coreTranslator.translateText(input, coreCtx);
  const got = mpTranslator.translateText(input, mpCtx);
  if (want !== got) failures.push({ input, label, want, got });
}

const elapsed = Date.now() - started;
console.log(`[parity] ${cases.length} 条用例，耗时 ${elapsed}ms`);

if (failures.length) {
  console.log(`FAIL [parity] ${failures.length} 条不一致`);
  for (const item of failures.slice(0, 10)) {
    console.log(`  - [${item.label}] 输入：${JSON.stringify(item.input)}`);
    console.log(`    桌面：${JSON.stringify(item.want)}`);
    console.log(`    小程序：${JSON.stringify(item.got)}`);
  }
  process.exit(1);
}

// 数据必须同源：即便翻译结果偶然一致，seed 不同步也会在下次数据更新时埋雷
// 用深比较而不是 JSON.stringify：小程序端是列式编码，解码回来的 key 顺序按「首次出现」排列，
// 与原 JSON 的书写顺序不一定相同，stringify 会比出假差异。
try {
  assert.deepStrictEqual(mpSeed, coreSeed);
} catch {
  console.log('FAIL [parity] 小程序 seed 与 src/core/seed.json 不一致，请先运行 npm run weapp:sync');
  process.exit(1);
}

console.log(
  `PASS [parity] 桌面 / 安卓与小程序翻译结果逐字符一致（词条 ${coreSeed.words.length} / 句式 ${coreSeed.rules.length}）`
);
console.log('      用例来源：test/core.test.js + 全量词条 + 句式示例 + 组合句 + 边界');
