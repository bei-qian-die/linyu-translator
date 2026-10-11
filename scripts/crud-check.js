'use strict';

// 五板块 CRUD 契约：每一条都必须真的落库、真的查得到、真的改得动、真的删得掉。
// 这个脚本曾经只 console.log 不 assert、也从不让进程失败，于是 check.js 里的
// 「五板块 CRUD 契约」永远是绿的——等于没测。现在任何一条不成立都会置 exitCode=1。
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { createDb } = require('../src/core/db');
const seed = require('../src/core/seed.json');
const lore = require('../src/core/lore');

let failed = 0;
let renamedZh = '';
let renamedLinyu = '';
// 词卡的列清单，与 db.js 里 CARD_COLS 保持一致；改一边就必须改另一边
const CARD_COLS_EXPECTED = 'id,term,type,meaning,example,source,hero,aliases,detail,rel';
const checks = [];
function t(name, fn) {
  try {
    fn();
    checks.push('PASS ' + name);
  } catch (err) {
    failed++;
    checks.push('FAIL ' + name + ' -> ' + ((err && err.message) || err));
  }
}
function ok(r, what) {
  assert.ok(r && r.ok === true, (what || '操作') + ' 应返回 {ok:true}，实际 ' + JSON.stringify(r));
}

(async () => {
  const f = path.join(os.tmpdir(), 'crud5-test.db');
  for (const n of ['', '.bak1', '.bak2']) {
    try {
      fs.unlinkSync(f + n);
    } catch {
      /* 首次运行本来就没有 */
    }
  }

  let st = await createDb({ filePath: f, seed, lore });

  // ---------- 播种 ----------
  t('空库播种后五个板块都非空', () => {
    for (const [label, n] of [
      ['words', st.getWords().length],
      ['rules', st.getRules().length],
      ['cards', st.getCards().length],
      ['quotes', st.getQuotes().length],
      ['heroes', st.getHeroes().length],
    ]) {
      assert.ok(n > 0, label + ' 播种后仍是 0 条');
    }
  });

  t('英雄行把 JSON 列正确解析成数组', () => {
    const h = st.getHeroes().find((x) => x.name === '淋淋') || st.getHeroes()[0];
    assert.ok(Array.isArray(h.tags), 'tags 应是数组，实际 ' + typeof h.tags);
    assert.ok(Array.isArray(h.links), 'links 应是数组，实际 ' + typeof h.links);
    assert.ok(h.group === 'real' || h.group === 'game' || h.group === 'up', 'group 取值异常：' + h.group);
  });

  // ---------- 词库 words：增 / 查 / 改 / 删 ----------
  t('words 增查改删闭环', () => {
    ok(st.addWord({ zh: '契约测试词', linyu: '契约淋' }), 'addWord');
    const w = st.getWords().find((x) => x.zh === '契约测试词');
    assert.ok(w, '新增词条查不到');
    ok(st.updateWord(w.id, { zh: '契约测试词', linyu: '契约淋改' }), 'updateWord(改译)');
    assert.strictEqual(st.getWords().find((x) => x.id === w.id).linyu, '契约淋改', '译文没落库');
    ok(st.updateWord(w.id, { zh: '契约测试词改', linyu: '契约淋改名' }), 'updateWord(改主键)');
    assert.ok(st.getWords().some((x) => x.zh === '契约测试词改'), '改主键后查不到');
    assert.ok(!st.getWords().some((x) => x.zh === '契约测试词'), '旧主键还在');
    ok(st.deleteWord(w.id), 'deleteWord');
    assert.ok(!st.getWords().some((x) => x.id === w.id), '删除后仍在');
  });

  t('words 新字段（别名/解释/出处/流行度/关联词条）能存能读', () => {
    ok(st.addWord({
      zh: '契约字段词', linyu: '契约字段淋', alias: '契约别名',
      sense: '契约释义', source: 'B 站 BV1xx411c7mD', pop: '高', rel: ['可爱'],
    }), 'addWord 带新字段');
    const w = st.getWords().find((x) => x.zh === '契约字段词');
    assert.strictEqual(w.alias, '契约别名', 'alias 没落库');
    assert.strictEqual(w.sense, '契约释义', 'sense 没落库');
    assert.strictEqual(w.source, 'B 站 BV1xx411c7mD', 'source 没落库');
    assert.strictEqual(w.pop, '高', 'pop 没落库');
    assert.deepStrictEqual(w.rel, ['可爱'], 'rel 没落库，实际 ' + JSON.stringify(w.rel));
    ok(st.updateWord(w.id, { zh: '契约字段词', linyu: '契约字段淋', pop: '低', rel: '阔爱、可人儿' }), 'updateWord 改新字段');
    const after = st.getWords().find((x) => x.id === w.id);
    assert.strictEqual(after.pop, '低', 'pop 没更新');
    assert.deepStrictEqual(after.rel, ['阔爱', '可人儿'], '顿号串没被收成数组，实际 ' + JSON.stringify(after.rel));
    st.deleteWord(w.id);
  });

  t('流行度只认高/中/低，别的值一律归零', () => {
    ok(st.addWord({ zh: '契约评级词', linyu: 'x', pop: '超高' }), 'addWord');
    const w = st.getWords().find((x) => x.zh === '契约评级词');
    assert.strictEqual(w.pop, '', '越界流行度应被清空，实际 ' + JSON.stringify(w.pop));
    st.deleteWord(w.id);
  });

  t('words 改主键后旧键不会被补种复活', () => {
    const builtin = st.getWords().find((x) => x.zh === '淋淋') || st.getWords()[0];
    const oldZh = builtin.zh;
    renamedZh = oldZh + '_改名';
    renamedLinyu = '契约改的淋';
    ok(st.updateWord(builtin.id, { zh: renamedZh, linyu: renamedLinyu }), 'updateWord 改内置词条主键');
    st.syncFromSeed();
    assert.ok(!st.getWords().some((x) => x.zh === oldZh), '刚改掉的旧主键被补种加回来了：' + oldZh);
    assert.ok(st.getWords().some((x) => x.zh === renamedZh), '改名后的新主键反而没了');
  });

  // ---------- 句式 rules：增 / 查 / 改 / 删 ----------
  t('rules 增查改删闭环', () => {
    ok(st.addRule({ pattern: '(?:契约句式)', template: '契约模板' }), 'addRule');
    const r = st.getRules().find((x) => x.pattern === '(?:契约句式)');
    assert.ok(r, '新增句式查不到');
    ok(st.updateRule(r.id, { pattern: '(?:契约句式)', template: '契约模板改', note: '备注' }), 'updateRule(改模板)');
    assert.ok(st.getRules().some((x) => x.pattern === '(?:契约句式)' && x.template === '契约模板改'), '改完查不到');
    assert.ok(st.updateRule(r.id, { pattern: '(?:[', template: 't' }).error, '非法正则必须被挡下');
    assert.ok(st.updateRule(r.id, { pattern: '(?:契约句式改)', template: 't' }), 'updateRule(改主键)');
    assert.ok(st.getRules().some((x) => x.pattern === '(?:契约句式改)'), '改主键后查不到');
    ok(st.deleteRule(r.id), 'deleteRule');
    assert.ok(!st.getRules().some((x) => x.id === r.id), '删除后仍在');
  });

  t('rules 新字段（使用场景/例句/出处）能存能读', () => {
    ok(st.addRule({ pattern: '(?:契约场景)', template: '契约$1', scene: '感叹句', examples: '契约123；契约456', src: '豆瓣小组' }), 'addRule 带新字段');
    const r = st.getRules().find((x) => x.pattern === '(?:契约场景)');
    assert.strictEqual(r.scene, '感叹句', 'scene 没落库');
    assert.strictEqual(r.examples, '契约123；契约456', 'examples 没落库');
    assert.strictEqual(r.src, '豆瓣小组', 'src 没落库');
    st.deleteRule(r.id);
  });

  // ---------- 词卡 cards：增 / 查 / 改 / 删 ----------
  t('cards 增查改删闭环', () => {
    ok(st.addCard({ term: '契约测试卡', meaning: '契约释义' }), 'addCard');
    const c = st.getCards().find((x) => x.term === '契约测试卡');
    assert.ok(c, '新增词卡查不到');
    assert.ok(st.addCard({ term: '契约测试卡', meaning: 'dup' }).error, '同名词卡必须被挡下');
    assert.ok(st.addCard({ term: '契约空释义' }).error, '空释义必须被挡下');
    ok(st.updateCard(c.id, { term: '契约测试卡改', type: 'meme', meaning: '新释义', hero: '淋淋' }), 'updateCard');
    const after = st.getCards().find((x) => x.id === c.id);
    assert.strictEqual(after.term, '契约测试卡改', '词名没落库');
    assert.strictEqual(after.meaning, '新释义', '释义没落库');
    ok(st.deleteCard(c.id), 'deleteCard');
    assert.ok(!st.getCards().some((x) => x.id === c.id), '删除后仍在');
  });

  t('cards 新字段（详细解释/关联词条/别名）能存能读', () => {
    ok(st.addCard({
      term: '契约字段卡', meaning: '简介', detail: '详细解释',
      rel: ['可爱'], aliases: ['契约别名卡'],
    }), 'addCard 带新字段');
    const c = st.getCards().find((x) => x.term === '契约字段卡');
    assert.strictEqual(c.detail, '详细解释', 'detail 没落库');
    assert.deepStrictEqual(c.rel, ['可爱'], 'rel 没落库，实际 ' + JSON.stringify(c.rel));
    assert.deepStrictEqual(c.aliases, ['契约别名卡'], 'aliases 没落库');
    st.deleteCard(c.id);
  });

  // ---------- 名言 quotes：增 / 查 / 改 / 删 ----------
  t('quotes 增查改删闭环', () => {
    const orig = st.getQuotes()[0];
    ok(st.addQuote({ text: '契约测试名言', author: 'A', hero: '淋淋', src: 'BV' }), 'addQuote');
    const q = st.getQuotes().find((x) => x.text === '契约测试名言');
    assert.ok(q, '新增名言查不到');
    assert.ok(st.addQuote({ text: orig.text }).error, '重复名言必须被挡下');
    ok(st.updateQuote(q.id, { text: '契约测试名言改', author: 'B' }), 'updateQuote');
    assert.strictEqual(st.getQuotes().find((x) => x.id === q.id).text, '契约测试名言改', '名言没落库');
    ok(st.deleteQuote(q.id), 'deleteQuote');
    assert.ok(!st.getQuotes().some((x) => x.id === q.id), '删除后仍在');
    assert.ok(st.getQuotes().some((x) => x.id === orig.id), '删测试名言把原名言误删了');
  });

  t('quotes 新字段（出处场景/关联词条）能存能读', () => {
    ok(st.addQuote({ text: '契约场景名言', scene: '直播间连麦', rel: '可爱、阔爱' }), 'addQuote 带新字段');
    const q = st.getQuotes().find((x) => x.text === '契约场景名言');
    assert.strictEqual(q.scene, '直播间连麦', 'scene 没落库');
    assert.deepStrictEqual(q.rel, ['可爱', '阔爱'], 'rel 没落库，实际 ' + JSON.stringify(q.rel));
    st.deleteQuote(q.id);
  });

  // ---------- 人物传 heroes：增 / 查 / 改 / 删 ----------
  t('heroes 增查改删闭环', () => {
    ok(st.addHero({ name: '契约测试英雄', group: 'game', tags: ['a', 'b'], words: ['我'] }), 'addHero');
    const h = st.getHeroes().find((x) => x.name === '契约测试英雄');
    assert.ok(h, '新增英雄查不到');
    assert.strictEqual(h.group, 'game', 'group 没落库，实际 ' + h.group);
    assert.deepStrictEqual(h.tags, ['a', 'b'], 'tags 没落库');
    ok(st.updateHero(h.id, { name: '契约测试英雄改', group: 'up', tags: ['c'], img: 'media:x.png' }), 'updateHero');
    const after = st.getHeroes().find((x) => x.id === h.id);
    assert.strictEqual(after.name, '契约测试英雄改', '英雄名没落库');
    assert.strictEqual(after.group, 'up', '改后的 group 没落库');
    assert.strictEqual(after.img, 'media:x.png', 'img 没落库');
    ok(st.deleteHero(h.id), 'deleteHero');
    assert.ok(!st.getHeroes().some((x) => x.id === h.id), '删除后仍在');
  });

  // ---------- 契约边界：非法输入必须被挡 ----------
  t('非法输入一律被挡而不是崩', () => {
    assert.ok(st.addWord({ zh: '', linyu: 'x' }).error, '空中文应被挡');
    assert.ok(st.addWord({ zh: 'x', linyu: '' }).error, '空淋语应被挡');
    assert.ok(st.updateWord(1, { zh: '契约留名', linyu: '' }).error, '改词条时空淋语应被挡');
    assert.ok(st.addCard({ term: '' }).error, '空词名应被挡');
    assert.ok(st.addQuote({ text: '' }).error, '空名言应被挡');
    assert.ok(st.addHero({ name: '' }).error, '空英雄名应被挡');
    assert.ok(st.addRule({ pattern: '', template: 't' }).error, '空正则应被挡');
    assert.ok(st.addRule({ pattern: 'p', template: '' }).error, '空模板应被挡');
  });

  // ---------- 归属引用必须是真存在的人物 ----------
  t('词卡/名言的归属不会指向查无此人的人物', () => {
    const names = new Set(st.getHeroes().map((h) => h.name));
    const bad = [...st.getCards(), ...st.getQuotes()].filter((x) => x.hero && !names.has(x.hero));
    assert.strictEqual(bad.length, 0, '有 ' + bad.length + ' 条归属指向不存在的人物：' +
      [...new Set(bad.map((b) => b.hero))].slice(0, 8).join('、'));
  });

  t('老库补列后新字段可写，不会静默丢数据', () => {
    // 模拟 1.9.0 之前建出来的窄表，走 ensureColumns 迁移
    assert.ok(st.addRule({ pattern: '(?:契约迁移)', template: 't', scene: '迁移场景' }), '迁移后写句式');
    const r = st.getRules().find((x) => x.pattern === '(?:契约迁移)');
    assert.strictEqual(r.scene, '迁移场景', '迁移后新字段写不进去');
    st.deleteRule(r.id);
  });

  // 上面那条「写入即落盘」查不出来的故障，根因就是某条 INSERT 的列数跟 cardArgs 对不上，
  // 而 addCard 当时是无脑 catch，把 SQL 结构错误一并报成「已存在」。删列改表最容易踩这个坑，
  // 这里把「写入的列必须与库里实际的列一致」钉成契约。
  t('写入语句的列必须与实际表结构一致', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'db.js'), 'utf8');
    // 每个 `INTO xxx (...) VALUES (...)` 的列数与占位符数必须相等
    for (const m of src.matchAll(/INTO (\w+) \(([^)]*)\) VALUES \(([^)]*)\)/g)) {
      const cols = m[2].split(',').map((c) => c.trim()).filter(Boolean);
      const q = m[3].split(',').map((c) => c.trim()).filter(Boolean);
      assert.strictEqual(cols.length, q.length, `${m[1]} 的列数(${cols.length})与占位符数(${q.length})对不上：${m[0]}`);
    }
    // SCHEMA 里声明的列，与实际 SELECT 出来的行必须对得上
    for (const [key, cols] of [['cards', CARD_COLS_EXPECTED]]) {
      const row = st.sectionRows(key)[0];
      const declared = cols.split(',').map((c) => c.trim());
      const actual = Object.keys(row);
      assert.deepStrictEqual(declared, actual, `${key} 的列清单与库里实际列不一致`);
    }
  });

  // ---------- 删除的内置条目不能被补种复活 ----------
  t('删除内置词卡后补种不会复活', () => {
    const before = st.getCards().length;
    const victim = st.getCards().find((c) => c.term === '地才蓝');
    if (!victim) {
      failed++;
      checks.push('FAIL 删除内置词卡后补种不会复活 -> 找不到内置词卡「地才蓝」，样本已改名');
      return;
    }
    st.deleteCard(victim.id);
    st.syncFromSeed();
    assert.strictEqual(st.getCards().length, before - 1, '补种把删掉的词卡又加回来了');
    assert.ok(!st.getCards().some((c) => c.term === '地才蓝'), '「地才蓝」复活了');
  });

  // ---------- 开发者账号流程 ----------
  t('开发者账号：默认口令 -> 改密 -> 旧口令失效 -> 重置恢复', () => {
    const { createAuth, DEFAULT_USER, DEFAULT_PASSWORD } = require('../src/core/auth');
    const a = createAuth({ getSetting: (k) => st.getSetting(k), setSetting: (k, v) => st.setSetting(k, v) });
    a.ensureInit();
    assert.ok(a.verify(DEFAULT_USER, DEFAULT_PASSWORD), '默认口令应可登录');
    assert.ok(a.usesDefaultPassword(), '此刻应还在用默认口令');
    assert.ok(!a.verify(DEFAULT_USER, 'nope'), '错口令不该通过');
    assert.ok(!a.verify('other', DEFAULT_PASSWORD), '错用户名不该通过');
    assert.ok(a.changePassword(DEFAULT_PASSWORD, '123').error, '过短新口令应被挡');
    ok(a.changePassword(DEFAULT_PASSWORD, 'newpass6'), 'changePassword');
    assert.ok(!a.verify(DEFAULT_USER, DEFAULT_PASSWORD), '改密后旧口令应失效');
    assert.ok(a.verify(DEFAULT_USER, 'newpass6'), '改密后新口令应生效');
    ok(a.resetToDefault(), 'resetToDefault');
    assert.ok(a.verify(DEFAULT_USER, DEFAULT_PASSWORD), '重置后默认口令应恢复');
  });

  st.close();

  // ---------- 落盘持久化 ----------
  st = await createDb({ filePath: f, seed, lore });
  t('关闭重开后改动仍在库里', () => {
    assert.ok(st.getWords().some((w) => w.zh === renamedZh), '改主键后的词条没持久化');
    assert.ok(st.getWords().some((w) => w.linyu === renamedLinyu), '译文没持久化');
    assert.ok(!st.getWords().some((w) => w.zh === renamedZh.replace(/_改名$/, '')), '旧主键又冒出来了');
  });
  st.close();

  checks.forEach((c) => console.log(c));
  console.log(failed ? `\n${failed} 项失败` : '\n五板块 CRUD 契约全部通过');
  try {
    fs.unlinkSync(f);
  } catch {
    /* 临时库留着也不影响 */
  }
  process.exitCode = failed ? 1 : 0;
})().catch((err) => {
  console.error('crud-check 自身崩了：', err && err.stack ? err.stack : err);
  process.exitCode = 1;
});
