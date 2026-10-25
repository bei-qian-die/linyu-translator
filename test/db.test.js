'use strict';

// 数据层可靠性测试：原子落盘、启动滚动备份、撤销、偏好白名单、历史上限、
// 内容体检、五板块导出/导入（含计划与回滚）。纯 Node 跑，不需要 Electron。
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { createDb } = require('../src/core/db');

const ROOT = path.join(os.tmpdir(), 'ly-db-test');
const DB = path.join(ROOT, 'linyu.db');

let failed = 0;
function ok(name) {
  console.log('PASS ' + name);
}
function fail(name, err) {
  failed++;
  console.log(`FAIL ${name} -> ${(err && err.message) || err}`);
}
function test(name, fn) {
  try {
    fn();
    ok(name);
  } catch (err) {
    fail(name, err);
  }
}
async function atest(name, fn) {
  try {
    await fn();
    ok(name);
  } catch (err) {
    fail(name, err);
  }
}

const seed = {
  words: [
    { zh: '我', linyu: '本仙女' },
    { zh: '开心', linyu: '开熏' },
    { zh: '无效词', linyu: '无效词' },
    { zh: '同译甲', linyu: '撞车淋' },
    { zh: '同译乙', linyu: '撞车淋' },
  ],
  rules: [{ pattern: '太(.{1,8}?)了', template: '难道不觉得超$1滴嘛', note: '感叹句式' }],
};
const lore = {
  flashcards: [{ term: '豪嗨心', type: 'slang', meaning: '好开心', source: '歌词', hero: '淋淋' }],
  quotes: [{ text: '我要吃洋菜', author: '淋淋', hero: '淋淋', src: '视频' }],
  heroes: [
    { name: '淋淋', group: 'real', words: ['我', '已消失词'] },
    { name: '游戏角色', group: 'game', words: ['不存在的词'] },
  ],
  pruned: { cards: ['废弃梗'], quotes: ['废弃名言'] },
};

function bakFiles() {
  return fs.readdirSync(ROOT).filter((n) => n.startsWith('linyu.db.bak')).sort();
}

(async () => {
  fs.rmSync(ROOT, { recursive: true, force: true });
  fs.mkdirSync(ROOT, { recursive: true });

  let store = await createDb({ filePath: DB, seed, lore });

  await atest('写入即落盘，且不留 .tmp 残片', async () => {
    store.addWord({ zh: '测试词', linyu: '测试噜' });
    assert.ok(fs.existsSync(DB), '库文件没生成');
    assert.ok(fs.statSync(DB).size > 0, '库文件是空的');
    assert.ok(!fs.existsSync(DB + '.tmp'), '临时文件没清掉');
  });

  const probeId = store.getWords().find((w) => w.zh === '测试词').id;
  let deletedUndo = null;
  test('删除返回可撤销快照', () => {
    const r = store.deleteWord(probeId);
    assert.ok(!r.error, r.error);
    assert.strictEqual(r.undo.kind, 'word');
    assert.strictEqual(r.undo.rows[0].zh, '测试词');
    assert.ok(!store.getWords().find((w) => w.id === probeId));
    deletedUndo = r.undo;
  });
  test('撤销能原样恢复同一行', () => {
    const r = store.undoDelete({ undo: deletedUndo });
    assert.strictEqual(r.restored, 1);
    const back = store.getWords().find((w) => w.id === probeId);
    assert.deepStrictEqual(back, {
      id: probeId, zh: '测试词', linyu: '测试噜',
      alias: '', sense: '', source: '', pop: '', rel: [], slot: '',
    });
  });
  test('没有待撤销操作时报错而不是崩', () => {
    assert.ok(store.undoDelete(null).error);
  });

  test('偏好只认白名单，凭据键挡在外面', () => {
    assert.strictEqual(store.setPref('ui.theme', 'black').ok, true);
    assert.strictEqual(store.getPrefs()['ui.theme'], 'black');
    assert.ok(store.setPref('dev_hash', 'x').error);
    assert.ok(store.setPref('随便写的键', 'x').error);
  });
  test('历史条数按偏好收紧，越界值被夹紧', () => {
    for (let i = 0; i < 6; i++) store.addHistory('甲' + i, '乙' + i);
    assert.strictEqual(store.getHistory().length, 6);
    // 下限 50：填更小的值按 50 处理，不会把历史清空
    store.setPref('history.limit', 3);
    assert.strictEqual(store.historyLimit(), 50);
    assert.strictEqual(store.getHistory().length, 6);
    store.setPref('history.limit', 99999);
    assert.strictEqual(store.historyLimit(), 2000);
    store.setPref('history.limit', 'abc');
    assert.strictEqual(store.historyLimit(), 200);
    store.setPref('history.limit', 200);
    store.clearHistory();
    assert.strictEqual(store.getHistory().length, 0);
  });

  test('体检报出无效词、共用淋语与悬空引用', () => {
    store.updateCard(store.getCards().find((c) => c.term === '豪嗨心').id, {
      term: '豪嗨心',
      meaning: '好开心',
      hero: '查无此人',
    });
    store.addQuote({ text: '无名氏名言', hero: '查无此人' });
    const r = store.inspect();
    assert.strictEqual(r.totals.invalidWords, 1);
    assert.ok(r.totals.dupLinyu >= 2, '同译分组没识别');
    assert.strictEqual(r.totals.orphanCards, 1);
    assert.strictEqual(r.totals.orphanQuotes, 1);
    assert.ok(r.totals.orphanHeroWords >= 2);
    assert.ok(r.orphanHeroWords.find((x) => x.hero === '淋淋'));
  });
  test('一键清理只剪掉悬空的关联词', () => {
    const before = store.getHeroes().find((h) => h.name === '淋淋').words.slice();
    const r = store.cleanHeroWords([{ hero: '淋淋', missing: ['已消失词'] }]);
    assert.strictEqual(r.fixed, 1);
    const after = store.getHeroes().find((h) => h.name === '淋淋').words;
    assert.deepStrictEqual(after, before.filter((w) => w !== '已消失词'));
  });

  test('导入计划区分新增/更新/跳过，坏数据只记问题不入库', () => {
    const payload = {
      app: 'linyu-translator',
      format: 1,
      data: {
        words: [{ zh: '我', linyu: '本仙女' }, { zh: '新词', linyu: '新噜' }, { zh: '开心', linyu: '开熏呀' }],
        rules: [{ pattern: '太(.{1,8}?)了', template: '难道不觉得超$1滴嘛', note: '感叹句式' }, { pattern: '坏(???', template: 'x' }],
        cards: [],
        quotes: [],
        heroes: [],
      },
    };
    const plan = store.planImport(payload, 'merge');
    const w = plan.sections.find((s) => s.key === 'words');
    assert.strictEqual(w.add, 1);
    assert.strictEqual(w.update, 1);
    assert.strictEqual(w.skip, 1);
    assert.ok(plan.problems.length >= 1, '非法正则没被挑出来');
    const before = store.getWords().length;
    const applied = store.applyImport(payload, 'merge');
    assert.strictEqual(applied.add, 1);
    assert.strictEqual(store.getWords().length, before + 1);
    assert.ok(!store.getRules().find((r) => r.pattern === '坏(???'));
    const addOnly = store.planImport(payload, 'add-only');
    assert.strictEqual(addOnly.sections.find((s) => s.key === 'words').update, 0);
  });
  test('导入整体失败时回滚，库保持原样', () => {
    const before = JSON.stringify(store.exportAll().data);
    const boom = {
      app: 'linyu-translator',
      format: 1,
      data: {
        // 同一份文件里两条同名中文词条：第二条撞 UNIQUE 约束，整批必须回滚
        words: [{ zh: '回滚甲', linyu: '甲噜' }, { zh: '回滚甲', linyu: '甲噜2' }],
        rules: [],
        cards: [],
        quotes: [],
        heroes: [],
      },
    };
    const r = store.applyImport(boom, 'merge');
    assert.ok(r.error, '撞主键应当报错并回滚');
    assert.ok(/回滚/.test(r.error), '错误信息没说明回滚：' + r.error);
    assert.strictEqual(JSON.stringify(store.exportAll().data), before, '回滚后数据变了');
    assert.ok(!store.getWords().find((w) => w.zh === '回滚甲'));
  });
  test('坏数据只跳过并记账，不影响同批好数据', () => {
    const r = store.applyImport(
      {
        app: 'linyu-translator',
        format: 1,
        data: {
          words: [{ zh: '跳过甲', linyu: '' }, { zh: '', linyu: '缺主键' }],
          rules: [{ pattern: '坏(???', template: 'x' }],
          cards: [],
          quotes: [],
          heroes: [{ name: '导入英雄', group: 'up' }],
        },
      },
      'merge'
    );
    assert.ok(!r.error, r.error);
    assert.strictEqual(r.add, 1, '只有导入英雄该入库');
    assert.ok(r.problems.length >= 3, '问题条目没记全：' + JSON.stringify(r.problems));
    assert.ok(store.getHeroes().find((h) => h.name === '导入英雄'));
    assert.ok(!store.getWords().find((w) => w.zh === '跳过甲'));
  });
  test('导出信封带版本号与统计', () => {
    const e = store.exportAll();
    assert.strictEqual(e.app, 'linyu-translator');
    assert.strictEqual(e.format, 1);
    assert.ok(e.counts.words >= 1 && e.data.words.length === e.counts.words);
  });

  test('非法规则/空内容被挡住', () => {
    assert.ok(store.addRule({ pattern: '坏(???', template: 'x' }).error);
    assert.ok(store.addWord({ zh: '空淋语', linyu: '' }).error);
    assert.ok(store.addCard({ term: '缺释义' }).error);
    assert.ok(store.addHero({ name: '  ' }).error);
    assert.ok(store.addWord({ zh: '我', linyu: '又一遍' }).error);
  });

  store.close();
  assert.ok(bakFiles().length === 0, '首次运行不该有备份');

  // 第二次启动：滚动备份出现，上一次的数据还在
  store = await createDb({ filePath: DB, seed, lore });
  test('第二次启动滚动出 bak1，数据仍在', () => {
    assert.deepStrictEqual(bakFiles(), ['linyu.db.bak1']);
    assert.ok(store.getWords().find((w) => w.zh === '新词'));
  });

  test('把当前库换成读不通的内容，备份保持原样不动', () => {
    store.close();
    const bak1 = path.join(ROOT, 'linyu.db.bak1');
    const before = fs.readFileSync(bak1);
    fs.writeFileSync(DB, Buffer.from('这根本不是 sqlite 文件'.repeat(200), 'utf8'));
    assert.deepStrictEqual(fs.readFileSync(bak1), before, '坏文件被滚动进备份了');
  });
  await atest('损坏的库从 bak1 自动恢复，并留下 quarantine 原件', async () => {
    store = await createDb({ filePath: DB, seed, lore });
    const rec = store.recoveryInfo();
    assert.ok(rec, '损坏后没有触发恢复流程');
    assert.strictEqual(rec.fromBackup, 'linyu.db.bak1');
    assert.ok(rec.quarantine && fs.existsSync(path.join(ROOT, rec.quarantine)), '坏文件没留下来');
    assert.ok(store.getWords().find((w) => w.zh === '新词'), '备份里的数据没捞回来');
  });
  test('备份可列出、可恢复、可退回恢复前', () => {
    const list = store.listBackups();
    assert.ok(list.length >= 1, '备份列表是空的');
    store.addWord({ zh: '恢复前临时词', linyu: '临时噜' });
    const justBeforeRestore = store.getWords().map((w) => w.zh).join(',');
    const r = store.restoreBackup(list[0].name);
    assert.ok(!r.error, r.error);
    assert.ok(!store.getWords().find((w) => w.zh === '恢复前临时词'), '恢复后临时词还在');
    const back = store.restoreBefore();
    assert.ok(!back.error, back.error);
    assert.strictEqual(store.getWords().map((w) => w.zh).join(','), justBeforeRestore, '退回恢复前没回到原状态');
    assert.strictEqual(store.restoreBackup('linyu.db.bak9').error, '找不到这个备份');
  });
  store.close();
  await atest('库和备份全都不见了就重建空库，也不崩', async () => {
    for (const n of fs.readdirSync(ROOT)) {
      if (n.startsWith('linyu.db') || n === 'good-copy') fs.rmSync(path.join(ROOT, n), { force: true });
    }
    store = await createDb({ filePath: DB, seed, lore });
    assert.strictEqual(store.recoveryInfo(), null);
    assert.ok(store.getWords().find((w) => w.zh === '我'), '空库该按内置种子播种');
    store.close();
  });

  // 版本升级路径：老库三张内容表都非空，createDb 不会播种，新增/剔除只能靠 upgradeSeed
  await atest('upgradeSeed 清掉剔除名单、补进新增内容、句式排回 seed 顺序', async () => {
    const f = path.join(ROOT, 'upgrade.db');
    fs.rmSync(f, { force: true });
    const oldSeed = {
      words: [{ zh: '我', linyu: '本可' }, { zh: '真的假的', linyu: '珍哒假哒' }],
      rules: [{ pattern: '太(.{1,8}?)了', template: '旧模板' }, { pattern: '(?:笑死|笑翻|乐死)', template: '旧句式' }],
    };
    const oldLore = {
      flashcards: [{ term: '废弃梗', type: 'slang', meaning: '上一版还收着' }],
      quotes: [{ text: '废弃名言', author: '上一版', src: '视频' }],
      heroes: [{ name: '旧版英雄', group: 'real' }],
    };
    let s = await createDb({ filePath: f, seed: oldSeed, lore: oldLore });
    s.addWord({ zh: '用户自建词', linyu: '自建噜' });
    s.addCard({ term: '用户自建卡', meaning: '自己加的' });
    s.close();

    // 用新版本的内容重新打开：表都非空，所以这一步不该动任何数据
    s = await createDb({ filePath: f, seed, lore });
    assert.strictEqual(s.getWords().length, 3, 'createDb 不该给老库播种');

    const r = s.upgradeSeed();
    assert.strictEqual(r.removed, 4, '该删掉 1 词 1 句式 1 梗 1 名言：' + JSON.stringify(r));
    assert.strictEqual(r.added, 8, '补入数量对不上：' + JSON.stringify(r));
    assert.ok(!s.getWords().find((w) => w.zh === '真的假的'), '废弃词条没清掉');
    assert.ok(!s.getRules().find((x) => x.pattern === '(?:笑死|笑翻|乐死)'), '废弃句式没清掉');
    assert.ok(!s.getCards().find((c) => c.term === '废弃梗'), '剔除的梗还在');
    assert.ok(!s.getQuotes().find((q) => q.text === '废弃名言'), '剔除的名言还在');
    assert.ok(s.getWords().find((w) => w.zh === '开心'), '新增词条没补进来');
    assert.ok(s.getCards().find((c) => c.term === '豪嗨心'), '新增梗没补进来');
    assert.ok(s.getQuotes().find((q) => q.text === '我要吃洋菜'), '新增名言没补进来');
    assert.ok(s.getHeroes().find((h) => h.name === '淋淋'), '新增人物没补进来');
    assert.ok(s.getWords().find((w) => w.zh === '用户自建词'), '用户自建内容被碰了');
    assert.ok(s.getCards().find((c) => c.term === '用户自建卡'), '用户自建内容被碰了');
    assert.strictEqual(s.getRules()[0].pattern, '太(.{1,8}?)了', '句式没按 seed 顺序排到最前');
    const again = s.upgradeSeed();
    assert.deepStrictEqual(again, { ok: true, removed: 0, added: 0, patched: 0 }, '重复升级不该再改数据');
    s.close();
  });

  // 1.7.0 已入库的内置英雄在 1.8.0 补了图：topUpFromSeed 因同名会跳过，只能靠 upgradeSeed 回填
  await atest('upgradeSeed 给已入库但没配图的内置英雄回填图片，且不覆盖用户自传图', async () => {
    const f = path.join(ROOT, 'imgfill.db');
    fs.rmSync(f, { force: true });
    const v1 = JSON.parse(JSON.stringify(lore)); // 上一版：淋淋已入库，但没有配图
    let s = await createDb({ filePath: f, seed, lore: v1 });
    assert.strictEqual(s.getHeroes().find((h) => h.name === '淋淋').img, '', '前置条件：上一版该是空图');
    s.close();

    const v2 = JSON.parse(JSON.stringify(lore)); // 这一版：内置词条补上了配图
    v2.heroes[0].img = 'img/hero-1.png';
    s = await createDb({ filePath: f, seed, lore: v2 });
    const r = s.upgradeSeed();
    assert.strictEqual(r.patched, 1, '只该回填缺图的那一个：' + JSON.stringify(r));
    assert.strictEqual(s.getHeroes().find((h) => h.name === '淋淋').img, 'img/hero-1.png', '缺图英雄该拿到内置配图');

    const other = s.getHeroes().find((h) => h.name === '游戏角色');
    s.updateHero(other.id, { ...other, group: other.group, img: 'media:my-own.png' });
    assert.strictEqual(s.upgradeSeed().patched, 0, '已有图的行不该再被回填');
    assert.strictEqual(s.getHeroes().find((h) => h.id === other.id).img, 'media:my-own.png', '用户自传图被覆盖了');
    s.close();
  });

  // 路径不在磁盘上（内存库）时的行为
  await atest('内存库不落盘也不报错', async () => {
    const mem = await createDb({ seed, lore });
    mem.addWord({ zh: '内存词', linyu: '内存噜' });
    mem.close();
  });

  console.log(failed ? `\n${failed} 项失败` : '\n数据层全部通过');
  process.exitCode = failed ? 1 : 0;
})().catch((err) => {
  console.error('测试跑挂了：' + (err && err.stack));
  process.exitCode = 1;
});
