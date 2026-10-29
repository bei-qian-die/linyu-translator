'use strict';

// 语境选变体的回归测试：slot（领域）/ sense（风格家族）/ rel（共现）三个字段都要真的影响选词。
// 断言的重点不是"恰好等于某句"，而是"哪些形态该出现、哪些形态绝不该出现"——
// 后者才是这类算法最容易翻车的地方（乱挑一个花哨的 alias）。

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { translateText } = require('../src/core/translator');
const {
  buildVariantIndex,
  analyzeSource,
  createContext,
  chooseVariant,
  domainOf,
  mineFamilies,
} = require('../src/core/variant');

const seed = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'seed.json'), 'utf8'));
const base = { words: seed.words, rules: seed.rules };
const withDisam = Object.assign({ disambiguate: true }, base);
const index = buildVariantIndex(seed.words);

let failed = 0;

function ok(name, cond, detail) {
  if (cond) console.log(`PASS [${name}]`);
  else {
    failed++;
    console.log(`FAIL [${name}] ${detail || ''}`);
  }
}

function tr(text, options) {
  return translateText(text, options || withDisam);
}

// ---- 1) slot：领域名与语义位的切分 ----
assert.strictEqual(domainOf('瓦罗淋特/瓦罗枪械经济'), '瓦罗淋特');
assert.strictEqual(domainOf('守望淋锋/守望角色淋名'), '守望淋锋');
assert.strictEqual(domainOf('第一人称自称'), '');
assert.strictEqual(domainOf('圈层黑话 / 人物'), '');
ok('slot 分段：游戏名带「淋」判为领域，语义位不判', true);

// 标准游戏名与淋语化游戏名都能触发领域
assert.strictEqual(analyzeSource('守望先锋里谁最强', index).domain, '守望淋锋');
assert.strictEqual(analyzeSource('守望淋锋里谁最强', index).domain, '守望淋锋');
ok('领域识别：标准名与淋化名等价', true);

// ---- 2) sense：从释义里挖「X 系」家族并读风格 ----
const famWo = mineFamilies(index.entries.get('我').cands.length ? seed.words.find((w) => w.zh === '我').sense : '');
const famMap = new Map(famWo.map((f) => [f.family, f.style]));
assert.strictEqual(famMap.get('本可'), 'neutral', '「本可系最中性」→ neutral');
assert.strictEqual(famMap.get('本仙女'), 'meng', '「本仙女系卖萌」→ meng');
ok('sense 挖家族：本可=neutral / 本仙女=meng', famMap.get('本可') === 'neutral' && famMap.get('本仙女') === 'meng');

// 候选的风格标签要跟着家族走，而不是靠字面瞎猜
const wo = index.entries.get('我');
const woCand = new Map(wo.cands.map((c) => [c.text, c]));
assert.strictEqual(woCand.get('本可').style, 'neutral');
assert.strictEqual(woCand.get('本仙女').style, 'meng');
assert.strictEqual(woCand.get('本宫').style, 'qing', '「本宫」没写进 sense 的「X 系」，走形态兜底');
assert.strictEqual(woCand.get('本猪妞').style, 'zi');
ok('候选风格标签：本仙女=meng / 本宫=qing / 本猪妞=zi',
  woCand.get('本仙女').style === 'meng' && woCand.get('本宫').style === 'qing' && woCand.get('本猪妞').style === 'zi');

// ---- 3) 没语境证据时必须回基准译法 ----
assert.ok(tr('我今天很开心。').includes('本可'), tr('我今天很开心。'));
assert.ok(!tr('我今天很开心。').includes('本仙女'), '无风格线索不该自己升级成卖萌系');
ok('无语境证据 → 基准译法', tr('我今天很开心。').includes('本可'));

// ---- 4) slot + 点名：领域内挂角色的形态只在真提到该角色时启用 ----
const ow = tr('守望先锋里我最喜欢源氏。');
assert.ok(ow.includes('我源'), `守望句里「我」应挂到源氏上：${ow}`);
const plain = tr('我最喜欢吃饭。');
assert.ok(!plain.includes('我源') && plain.includes('本可'), `普通句不该冒出游戏形态：${plain}`);
ok('领域 + 点名：守望句用「我源」，普通句回「本可」', ow.includes('我源') && !plain.includes('我源'));

const xinhai = tr('心海真的很强，你觉得呢？');
assert.ok(xinhai.includes('你心'), `提到心海时「你」应写成「你心」：${xinhai}`);
ok('hook：提到心海时「你」→「你心」', xinhai.includes('你心'));

// ---- 5) rel 共现：同句已选的说法要能被后续词呼应 ----
const rel = tr('姐妹今天好漂亮！我们一起去吃饭吧。');
assert.ok(rel.includes('集美'), `姐妹应译成集美：${rel}`);
assert.ok(rel.includes('咱们集美'), `「我们」应呼应「集美」而不是另起「俺们仙女」：${rel}`);
ok('rel 共现：集美 → 咱们集美', rel.includes('集美') && rel.includes('咱们集美'));

// ---- 6) 风格语境：用户自己露了口风就跟 ----
const meng = tr('嘤嘤嘤我今天好开心。');
assert.ok(/本宝|本仙女|本小仙女/.test(meng), `嘤嘤嘤 → 卖萌系自称：${meng}`);
ok('风格语境：嘤嘤嘤 → 卖萌系自称', /本宝|本仙女|本小仙女/.test(meng));

// ---- 7) 装饰惩罚：不许挑堆叠形态 ----
const junk = ['本猪猪本可', '本可妹妹', '本淋王星人'];
const junkHits = ['我今天很开心。', '姐妹今天好漂亮！', '我真的喜欢你。'].filter((s) => // 逐句检查
  junk.some((j) => tr(s).includes(j)));
ok('装饰惩罚：不选堆叠形态', junkHits.length === 0, junkHits.join(' / '));

// ---- 8) 开关关闭时行为不变（不产生 why，且与默认参数一致） ----
const traceOff = [];
const off = translateText('我今天很开心。', Object.assign({ trace: traceOff }, base));
const def = translateText('我今天很开心。', base);
assert.strictEqual(off, def, 'disambiguate 缺省必须与显式 false 一致');
assert.ok(traceOff.every((t) => t.kind !== 'word' || t.why === undefined), '关闭时 trace 不该带 why');
ok('开关关闭：输出不变、trace 不带 why', off === def);

// ---- 9) 候选顺序确定：同一句连跑 5 次结果一致（不能有随机性） ----
const first = tr('姐妹们今天好漂亮！我们一起去吃饭吧。');
let stable = true;
for (let i = 0; i < 5; i++) if (tr('姐妹们今天好漂亮！我们一起去吃饭吧。') !== first) stable = false;
ok('确定性：同一输入多次结果一致', stable, first);

// ---- 10) 选变体不破坏字符级淋味（不能出现空结果 / 整句丢失） ----
const samples = ['我喜欢你。', '他昨天说他不来了。', '这个真的很难。', '我们明天见！'];
const solid = samples.every((s) => {
  const out = tr(s);
  return out.length >= s.length * 0.6;
});
ok('输出长度不塌陷', solid);

// ---- 11) 直接调 chooseVariant：风格 / 领域状态确实改变结果 ----
const ctx1 = createContext(index);
ctx1.source = '我今天很开心。';
const neutralPick = chooseVariant(wo, ctx1).text;
const ctx2 = createContext(index);
ctx2.source = '我今天很开心。';
ctx2.style = 'qing';
const qingPick = chooseVariant(wo, ctx2).text;
assert.strictEqual(neutralPick, '本可');
assert.strictEqual(qingPick, '本宫');
ok('chooseVariant：清宫语境下「我」→「本宫」', neutralPick === '本可' && qingPick === '本宫');

console.log(failed ? `\n${failed} 个用例失败` : '\n全部用例通过 ♥');
process.exit(failed ? 1 : 0);
