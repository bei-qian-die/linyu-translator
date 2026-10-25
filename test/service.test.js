'use strict';

// 业务层（src/core/service.js）测试：桌面主进程与移动端 api.js 共用这一份实现，
// 门禁、撤销槽位、导入暂存过期、登录失败锁定都必须在这里验证——
// 改一处就影响两端，没有测试兜不住。纯 Node 跑，不需要 Electron。
const os = require('os');
const path = require('path');
const assert = require('assert');
const { createDb } = require('../src/core/db');
const { createAuth } = require('../src/core/auth');
const { createService } = require('../src/core/service');
const { translateText } = require('../src/core/translator');

const ROOT = path.join(os.tmpdir(), 'ly-service-test');

let failed = 0;
function ok(name) {
  console.log('PASS ' + name);
}
function fail(name, err) {
  failed++;
  console.log(`FAIL ${name} -> ${(err && err.message) || err}`);
}
async function atest(name, fn) {
  try {
    await fn();
    ok(name);
  } catch (err) {
    fail(name, err);
  }
}

let seq = 0;
async function freshStore() {
  seq += 1;
  const fs = require('fs');
  const dir = path.join(ROOT, 'run' + seq + '-' + Date.now());
  fs.rmSync(dir, { recursive: true, force: true });
  const db = await createDb({
    filePath: path.join(dir, 'linyu.db'),
    seed: { words: [{ zh: '我', linyu: '本仙女' }, { zh: '开心', linyu: '开熏' }], rules: [] },
    lore: { cards: [], quotes: [], heroes: [], pruned: {} },
  });
  const auth = createAuth({
    getSetting: (k) => db.getSetting(k),
    setSetting: (k, v) => db.setSetting(k, v),
  });
  auth.ensureInit();
  const svc = createService({
    db,
    auth,
    translator: { translateText },
    version: '1.13.0',
    config: { attemptLimit: 3, lockMs: 60000 },
  });
  return { db, auth, svc };
}

(async () => {
  // ---- 开发者门禁 ----
  await atest('未登录时写操作一律被挡，读操作不受影响', async () => {
    const { svc } = await freshStore();
    assert.deepStrictEqual(svc.crud.words.list().length, 2, '列表可读');
    assert.throws(() => svc.crud.words.add({ zh: '偷偷加', linyu: '不行' }), /开发者模式/);
    assert.throws(() => svc.crud.words.remove(1), /开发者模式/);
    assert.throws(() => svc.syncSeed(), /开发者模式/);
    assert.throws(() => svc.clearHistory(), /开发者模式/);
    assert.strictEqual(svc.crud.words.list().length, 2, '被挡下后没有写进去');
  });

  await atest('登录后才能写，登出立刻重新上锁', async () => {
    const { svc } = await freshStore();
    svc.login('linyu', 'linyu130');
    assert.strictEqual(svc.isDevUnlocked(), true);
    svc.crud.words.add({ zh: '登录后加', linyu: '可以' });
    assert.strictEqual(svc.crud.words.list().length, 3);
    svc.logout();
    assert.strictEqual(svc.isDevUnlocked(), false);
    assert.throws(() => svc.crud.words.add({ zh: '再试', linyu: '不行' }), /开发者模式/);
  });

  await atest('lockDev 关窗即锁，撤销槽位一起清掉', async () => {
    const { svc } = await freshStore();
    svc.login('linyu', 'linyu130');
    svc.crud.words.remove(1);
    assert.strictEqual(svc.undoState().available, true);
    svc.lockDev();
    assert.strictEqual(svc.isDevUnlocked(), false);
    assert.strictEqual(svc.undoState().available, false, '锁上后撤销槽位不再可用');
  });

  // ---- 登录失败锁定 ----
  await atest('连续输错到上限就锁定，正确密码也要等解锁', async () => {
    const { svc } = await freshStore();
    for (let i = 0; i < 3; i++) {
      assert.throws(() => svc.login('linyu', 'wrong' + i), /账号或密码错误/);
    }
    assert.throws(() => svc.login('linyu', 'linyu130'), /尝试过于频繁/, '锁定期内正确密码也被挡');
    assert.ok(svc.authStatus().lockLeft > 0, '界面能拿到剩余秒数');
  });

  await atest('登录成功后失败计数清零', async () => {
    const { svc } = await freshStore();
    assert.throws(() => svc.login('linyu', 'bad'));
    svc.login('linyu', 'linyu130');
    assert.strictEqual(svc.isDevUnlocked(), true);
    svc.logout();
    assert.throws(() => svc.login('linyu', 'bad'), /还可尝试/, '重新计数，没接着上次算');
  });

  // ---- 撤销槽位 ----
  await atest('删除后撤销可用，撤销一次后槽位清空', async () => {
    const { svc } = await freshStore();
    svc.login('linyu', 'linyu130');
    svc.crud.words.remove(1);
    assert.strictEqual(svc.undoState().available, true);
    svc.undoDelete();
    assert.strictEqual(svc.undoState().available, false);
    assert.strictEqual(svc.crud.words.list().length, 2, '删掉的回来了');
    assert.throws(() => svc.undoDelete(), /没有可撤销的操作/);
  });

  await atest('未登录时撤销不可用也不可调', async () => {
    const { svc } = await freshStore();
    svc.login('linyu', 'linyu130');
    svc.crud.words.remove(1);
    svc.logout();
    assert.strictEqual(svc.undoState().available, false, '登出后槽位应视为不可用');
    assert.throws(() => svc.undoDelete(), /开发者模式/);
  });

  await atest('撤销超时窗口到点就作废', async () => {
    const { svc } = await freshStore();
    svc.login('linyu', 'linyu130');
    svc.crud.words.remove(1);
    // 直接把槽位时间往前推：不依赖真实等待
    const realNow = Date.now;
    Date.now = () => realNow() + 120000;
    try {
      assert.strictEqual(svc.undoState().available, false);
      assert.throws(() => svc.undoDelete(), /撤销时间已过/);
    } finally {
      Date.now = realNow;
    }
  });

  // ---- 导入暂存 ----
  await atest('没选过文件时导入直接报错，不会碰库', async () => {
    const { svc } = await freshStore();
    svc.login('linyu', 'linyu130');
    assert.throws(() => svc.replanImport('merge'), /请先重新选择导入文件/);
    assert.throws(() => svc.applyImport('merge'), /请先重新选择导入文件/);
  });

  await atest('暂存后能重新计划，应用完暂存即清空', async () => {
    const { svc } = await freshStore();
    svc.login('linyu', 'linyu130');
    const payload = {
      app: 'linyu-translator',
      format: 1,
      data: { words: [{ zh: '导入词', linyu: '导入淋' }], rules: [], cards: [], quotes: [], heroes: [] },
    };
    svc.stashImport(payload, 'in.json');
    assert.ok(svc.peekImport(), '暂存可读');
    const replan = svc.replanImport('merge');
    assert.strictEqual(replan.file, 'in.json');
    const applied = svc.applyImport('merge');
    assert.strictEqual(applied.file, 'in.json');
    assert.strictEqual(svc.peekImport(), null, '应用后暂存清空');
    assert.ok(svc.crud.words.list().some((w) => w.zh === '导入词'), '内容真的进库了');
  });

  await atest('暂存过期后作废，避免拿很久以前的文件误导入', async () => {
    const { svc } = await freshStore();
    svc.login('linyu', 'linyu130');
    svc.stashImport({ app: 'linyu-translator', format: 1, data: { words: [], rules: [], cards: [], quotes: [], heroes: [] } }, 'old.json');
    const realNow = Date.now;
    Date.now = () => realNow() + 20 * 60 * 1000;
    try {
      assert.strictEqual(svc.peekImport(), null);
      assert.throws(() => svc.applyImport('merge'), /请先重新选择导入文件/);
    } finally {
      Date.now = realNow;
    }
  });

  // ---- 翻译与历史 ----
  await atest('预览翻译不写历史，正式翻译写一条', async () => {
    const { svc } = await freshStore();
    svc.translate('我开心', 'preview');
    assert.strictEqual(svc.listHistory().length, 0, '预览不落历史');
    svc.translate('我开心');
    assert.strictEqual(svc.listHistory().length, 1);
    assert.ok(svc.listHistory()[0].dst.includes('本仙女'), '译文已存');
  });

  await atest('普通用户不回传命中链路，开发者模式下才回传', async () => {
    const { svc } = await freshStore();
    const plain = svc.translate('我开心');
    assert.strictEqual(plain.trace, null, '普通使用不带 trace，省 IPC 体积');
    svc.login('linyu', 'linyu130');
    const traced = svc.translate('我开心');
    assert.ok(Array.isArray(traced.trace) && traced.trace.length > 0, '开发者模式带命中链路');
  });

  // ---- 偏好 ----
  await atest('偏好白名单外的键写不进去，且能读回', async () => {
    const { svc } = await freshStore();
    svc.setPref('ui.live', 'true');
    assert.strictEqual(svc.readPref('ui.live', false), true, '读回时按 JSON 解析');
    assert.throws(() => svc.setPref('__not_allowed__', 'x'), /不支持的偏好项/, '白名单外被拒');
  });

  // ---- 元信息 ----
  await atest('meta 带上版本号与默认口令状态', async () => {
    const { svc } = await freshStore();
    const m = svc.meta();
    assert.strictEqual(m.version, '1.13.0');
    assert.strictEqual(m.defaultUser, 'linyu');
    assert.strictEqual(m.defaultPassword, 'linyu130', '没改过口令时把默认口令给界面');
    svc.login('linyu', 'linyu130');
    svc.changePassword('linyu130', 'newpass123');
    assert.strictEqual(svc.meta().defaultPassword, '', '改过之后藏起来');
  });

  await atest('改口令需要旧口令正确', async () => {
    const { svc } = await freshStore();
    svc.login('linyu', 'linyu130');
    assert.throws(() => svc.changePassword('wrong', 'newpass123'), /原密码不正确/);
    assert.throws(() => svc.changePassword('linyu130', '123'), /至少 6 位/);
  });

  console.log('');
  if (failed) {
    console.log(`${failed} 项失败`);
    process.exitCode = 1;
  } else {
    console.log('业务层全部通过');
  }
})();
