'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');
const MP = path.join(ROOT, 'miniprogram');

// 小程序运行时依赖全局 wx / Page / getApp，先铺一层最小桩再 require 业务模块
const storage = new Map();
let lastPageConfig = null;
let lastClipboard = '';

global.wx = {
  getStorageSync(key) {
    return storage.has(key) ? storage.get(key) : '';
  },
  setStorageSync(key, value) {
    storage.set(key, value);
  },
  removeStorageSync(key) {
    storage.delete(key);
  },
  setNavigationBarColor() {},
  setBackgroundColor() {},
  setTabBarStyle() {},
  setNavigationBarTitle() {},
  hideShareMenu() {},
  switchTab() {},
  setClipboardData(options) {
    lastClipboard = options.data;
    if (options.success) options.success();
  },
  showToast() {},
  hideToast() {},
};
global.Page = (config) => {
  lastPageConfig = config;
};
global.getApp = () => ({
  globalData: { theme: 'white', version: '1.0.0', live: true, historyLimit: 200, pendingInput: '' },
});

const seed = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'core', 'seed.json'), 'utf8'));
const history = require('../miniprogram/services/history');
const prefs = require('../miniprogram/services/prefs');
const content = require('../miniprogram/services/content');
const loreService = require('../miniprogram/services/lore');
const weappTranslator = require('../miniprogram/core/translator');
const coreTranslator = require('../src/core/translator');

let failed = 0;
const pending = [];

function run(name, fn) {
  try {
    fn();
    console.log(`PASS [${name}]`);
  } catch (err) {
    failed += 1;
    console.log(`FAIL [${name}] ${err.message}`);
  }
}

function runAsync(name, fn) {
  pending.push(
    Promise.resolve()
      .then(fn)
      .then(() => console.log(`PASS [${name}]`))
      .catch((err) => {
        failed += 1;
        console.log(`FAIL [${name}] ${err.message}`);
      })
  );
}

function loadPage(name) {
  const file = require.resolve(`../miniprogram/pages/${name}/${name}.js`);
  delete require.cache[file];
  lastPageConfig = null;
  require(file);
  assert(lastPageConfig, `${name} 页面没有调用 Page()`);
  const instance = Object.assign({}, lastPageConfig, {
    data: JSON.parse(JSON.stringify(lastPageConfig.data || {})),
    setData(patch, cb) {
      Object.assign(this.data, patch);
      if (cb) cb();
    },
  });
  return instance;
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

run('小程序数据与 src/core/seed.json 一致', () => {
  const mpSeed = require('../miniprogram/data/seed');
  assert.deepStrictEqual(mpSeed, seed, '数据不同步，请先运行 npm run weapp:sync');
});

run('翻译引擎与词库/人物数据逐字同步', () => {
  const files = [
    ['core/tokenizer.js', 'tokenizer.js'],
    ['core/translator.js', 'translator.js'],
    ['data/lore.js', 'lore.js'],
    ['data/lore-extra3.js', 'lore-extra3.js'],
    ['data/lore-extra4.js', 'lore-extra4.js'],
    ['data/lore-extra5.js', 'lore-extra5.js'],
    ['data/lore-extra6.js', 'lore-extra6.js'],
    ['data/lore-extra7.js', 'lore-extra7.js'],
  ];
  for (const [mpFile, coreFile] of files) {
    const mpText = fs.readFileSync(path.join(MP, mpFile), 'utf8');
    const coreText = fs.readFileSync(path.join(ROOT, 'src', 'core', coreFile), 'utf8');
    assert.strictEqual(mpText, coreText, `${mpFile} 已过期，请运行 npm run weapp:sync`);
  }
});

run('翻译结果与桌面/安卓端一致', () => {
  const mpSeed = require('../miniprogram/data/seed');
  const samples = [
    '',
    '   ',
    '你今天真好看！',
    '我不知道呢。',
    '太可爱了吧哈哈哈哈',
    '我觉得很好。',
    '是不是你喜欢我？',
    '谢谢你！',
    '笑死我了',
    'hello world 123',
    '老板说要加班。',
    '今天很开心\n加油哦',
    '我的男朋友很厉害',
    '我是杰斯猫的粉丝',
    '晚安',
  ];
  const mpCtx = { words: mpSeed.words, rules: mpSeed.rules };
  const coreCtx = { words: seed.words, rules: seed.rules };
  for (const input of samples) {
    const got = weappTranslator.translateText(input, mpCtx);
    const want = coreTranslator.translateText(input, coreCtx);
    assert.strictEqual(got, want, `「${input}」翻译结果不一致：${got} !== ${want}`);
  }
  assert(
    weappTranslator.translateText('你今天真好看！', mpCtx).includes('小仙女'),
    '基础翻译用例未命中「小仙女」'
  );
});

run('500 字本地翻译平均耗时低于 100ms', () => {
  const input = '你今天真好看！我不知道呢，感觉很开心！'.repeat(25).slice(0, 500);
  const rounds = 20;
  const start = Date.now();
  for (let i = 0; i < rounds; i += 1) content.translate(input);
  const avg = (Date.now() - start) / rounds;
  assert(avg < 100, `500 字平均 ${avg}ms，超过 100ms 验收线`);
  console.log(`     500 字平均 ${avg.toFixed(2)}ms`);
});

run('内容条目数量与源数据一致', () => {
  const lore = require('../miniprogram/data/lore');
  assert.strictEqual(content.counts.words, seed.words.length);
  assert.strictEqual(content.counts.rules, seed.rules.length);
  assert.strictEqual(content.counts.cards, lore.flashcards.length);
  assert.strictEqual(content.counts.quotes, lore.quotes.length);
  assert.strictEqual(content.counts.heroes, lore.heroes.length);
  assert.strictEqual(loreService.heroes.length, lore.heroes.length);
  assert(loreService.cards.filter((c) => c.hero).length > 0, '推断后没有任何词卡归属人物');
  assert(loreService.quotes.filter((q) => q.hero).length > 0, '推断后没有任何名言归属人物');
  for (const card of loreService.cards) {
    assert(card.term, '词卡缺少词名');
    assert(card.typeLabel, `词卡「${card.term}」缺少分类名`);
  }
});

run('人物 id 与关联内容聚合', () => {
  for (let i = 0; i < loreService.heroes.length; i += 1) {
    const hero = loreService.getHero(i);
    assert(hero, `人物 id=${i} 取不到`);
    assert.strictEqual(hero.id, i);
    assert.strictEqual(loreService.getHero(String(i)).name, hero.name);
  }
  assert.strictEqual(loreService.getHero(-1), null);
  assert.strictEqual(loreService.getHero('abc'), null);

  const lin = loreService.heroByName['淋淋'];
  assert(lin, '缺少人物「淋淋」');
  const related = loreService.relatedForHero(lin);
  assert(related.words.length > 0, '淋淋没有关联词条');
  assert(related.cards.length > 0, '淋淋没有关联词卡');
  assert(related.quotes.length > 0, '淋淋没有关联名言');
  for (const word of related.words) assert(lin.words.includes(word.zh));
  for (const card of related.cards) assert.strictEqual(card.hero, lin.name);
  for (const quote of related.quotes) assert.strictEqual(quote.hero || quote.author, lin.name);

  const ruleHits = loreService.heroes.reduce(
    (total, hero) => total + loreService.relatedForHero(hero).rules.length,
    0
  );
  assert(ruleHits > 0, '所有人物都聚合不到相关句式');
});

run('历史新增、去重、删除与清空', () => {
  storage.clear();
  history.clearHistory();
  let rows = history.addHistory('  你今天真好看！ ', '小仙女，你今天真好看！♥');
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].input, '你今天真好看！');

  rows = history.addHistory('你今天真好看！', '小仙女，你今天真好看！♥');
  assert.strictEqual(rows.length, 1, '相同输入输出不应重复入库');

  rows = history.addHistory('晚安', '碗安惹♥');
  assert.strictEqual(rows.length, 2);
  assert.strictEqual(rows[0].input, '晚安', '新记录应排在最前');

  rows = history.removeHistory(rows[0].id);
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].input, '你今天真好看！');

  rows = history.clearHistory();
  assert.strictEqual(rows.length, 0);
  assert.strictEqual(history.readHistory().length, 0);
});

run('历史上限 100 生效且保留最新记录', () => {
  storage.clear();
  assert.strictEqual(history.setHistoryLimit(100), 100);
  for (let i = 0; i < 105; i += 1) {
    history.addHistory(`输入${i}`, `输出${i}`);
  }
  const rows = history.readHistory();
  assert.strictEqual(rows.length, 100);
  assert.strictEqual(rows[0].input, '输入104');
  assert.strictEqual(rows[99].input, '输入5');
  history.setHistoryLimit(200);
  history.clearHistory();
});

run('偏好设置归一化与主题应用', () => {
  storage.clear();
  let p = prefs.getPrefs();
  assert.deepStrictEqual(p, prefs.DEFAULT_PREFS);

  p = prefs.setPref('theme', 'pink');
  assert.strictEqual(p.theme, 'rose', '旧版 pink 主题应迁移为 rose');
  p = prefs.setPref('theme', 'rainbow');
  assert.strictEqual(p.theme, 'white', '非法主题应回落默认值');
  p = prefs.setPref('historyLimit', 999);
  assert.strictEqual(p.historyLimit, 200, '非法历史上限应回落 200');
  p = prefs.setPref('live', false);
  assert.strictEqual(p.live, false);
  assert.strictEqual(prefs.getPrefs().live, false);

  let chrome = null;
  global.wx.setNavigationBarColor = (opts) => {
    chrome = opts;
  };
  prefs.applyChrome('black');
  assert(chrome, '未调用 setNavigationBarColor');
  assert.strictEqual(chrome.frontColor, '#ffffff');
  assert.strictEqual(chrome.backgroundColor, '#111112');
  prefs.resetPrefs();
  storage.clear();
});

run('页面文件齐全且已注册', () => {
  const appJson = JSON.parse(fs.readFileSync(path.join(MP, 'app.json'), 'utf8'));
  const pages = ['index', 'lexicon', 'history', 'about', 'hero'];
  for (const name of pages) {
    const route = `pages/${name}/${name}`;
    assert(appJson.pages.includes(route), `${route} 未在 app.json 注册`);
    for (const ext of ['js', 'json', 'wxml', 'wxss']) {
      assert(fs.existsSync(path.join(MP, `${route}.${ext}`)), `缺少 ${route}.${ext}`);
    }
    JSON.parse(fs.readFileSync(path.join(MP, `${route}.json`), 'utf8'));
  }
  assert.strictEqual(appJson.tabBar.list.length, 4);
  for (const tab of appJson.tabBar.list) {
    assert(appJson.pages.includes(tab.pagePath), `tabBar 页面 ${tab.pagePath} 未注册`);
  }
  assert(!appJson.tabBar.list.some((t) => t.pagePath === 'pages/hero/hero'), '人物详情不应进 tabBar');
});

run('自定义 tabBar 与 app.json 声明一致（B7）', () => {
  const appJson = JSON.parse(fs.readFileSync(path.join(MP, 'app.json'), 'utf8'));
  const appTabs = appJson.tabBar.list.map((t) => t.pagePath.replace(/^pages\//, '/pages/'));
  const source = fs.readFileSync(path.join(MP, 'custom-tab-bar', 'index.js'), 'utf8');
  const match = source.match(/const TABS = \[([\s\S]*?)\];/);
  assert(match, 'custom-tab-bar/index.js 缺少 TABS 定义');
  const paths = [];
  const re = /path:\s*'([^']+)'/g;
  let m = re.exec(match[1]);
  while (m) {
    paths.push(m[1]);
    m = re.exec(match[1]);
  }
  assert.deepStrictEqual(paths, appTabs, 'custom-tab-bar TABS 与 app.json tabBar.list 不一致');
  const wxml = fs.readFileSync(path.join(MP, 'custom-tab-bar', 'index.wxml'), 'utf8');
  assert(wxml.includes('wx:for="{{tabs}}"'), 'custom-tab-bar 未渲染 TABS');
});

run('页面脚本可加载并完成人物数据装配', () => {
  for (const name of ['index', 'lexicon', 'history', 'about', 'hero']) {
    const page = loadPage(name);
    assert.strictEqual(typeof page.onLoad, 'function', `${name} 缺少 onLoad`);
    assert.strictEqual(typeof page.onShow, 'function', `${name} 缺少 onShow`);
    page.onLoad({});
    page.onShow();
  }
  const heroPage = loadPage('hero');
  heroPage.onLoad({ id: '0' });
  assert(heroPage.data.hero, '人物详情未装配 hero');
  assert.strictEqual(heroPage.data.hero.name, loreService.heroes[0].name);
  assert(heroPage.data.stats.includes('词条'));
  const share = heroPage.onShareAppMessage();
  assert.strictEqual(share.path, '/pages/hero/hero?id=0');

  heroPage.onLoad({ id: '99999' });
  assert.strictEqual(heroPage.data.notFound, true);
});

run('WXML 事件处理函数均已实现', () => {
  for (const name of ['index', 'lexicon', 'history', 'about', 'hero']) {
    const wxml = fs.readFileSync(path.join(MP, `pages/${name}/${name}.wxml`), 'utf8');
    const handlers = new Set();
    const re = /\b(?:bind|catch)[a-z]+="([^"]+)"/g;
    let match = re.exec(wxml);
    while (match) {
      handlers.add(match[1]);
      match = re.exec(wxml);
    }
    const page = loadPage(name);
    for (const handler of handlers) {
      assert.strictEqual(typeof page[handler], 'function', `${name} 缺少事件处理函数 ${handler}`);
    }
  }
});

runAsync('复制与分享链路可用', async () => {
  const { copy } = require('../miniprogram/utils/ui');
  copy('小仙女♥', '已复制');
  assert.strictEqual(lastClipboard, '小仙女♥');

  const indexPage = loadPage('index');
  indexPage.onLoad({});
  indexPage.setData({
    input: '你今天真好看！',
    output: '小仙女，你今天真好看！♥',
    inputLength: 7,
    inputTrimmed: true,
  });
  // onShareAppMessage 走 Promise 链，这里模拟 doTranslate 已完成的内容安全校验
  indexPage._checked = { content: '小仙女，你今天真好看！♥', ok: true };
  const share = await indexPage.onShareAppMessage();
  assert(share.title.includes('淋语版'));
  assert(share.path.startsWith('/pages/index/index?text='));
  const sharedText = decodeURIComponent(share.path.split('text=')[1]);
  assert.strictEqual(sharedText, '你今天真好看！');
  const timeline = indexPage.onShareTimeline();
  assert.strictEqual(decodeURIComponent(timeline.query.split('=')[1]), '你今天真好看！');
});

run('公共组件齐全且已全局注册（C1）', () => {
  const appJson = JSON.parse(fs.readFileSync(path.join(MP, 'app.json'), 'utf8'));
  const names = ['nav-bar', 'empty-state', 'list-foot'];
  for (const name of names) {
    const dir = path.join(MP, 'components', name);
    for (const ext of ['js', 'json', 'wxml', 'wxss']) {
      assert(fs.existsSync(path.join(dir, `${name}.${ext}`)), `缺少 components/${name}/${name}.${ext}`);
    }
    const json = JSON.parse(fs.readFileSync(path.join(dir, `${name}.json`), 'utf8'));
    assert.strictEqual(json.component, true, `${name}.json 应声明 component: true`);
    assert(appJson.usingComponents[name], `${name} 未在 app.json 全局注册`);
  }
  const appWxss = fs.readFileSync(path.join(MP, 'app.wxss'), 'utf8');
  assert(appWxss.includes('@import "styles/theme.wxss"'), 'app.wxss 未引入主题文件');
  assert(fs.existsSync(path.join(MP, 'styles', 'theme.wxss')), '缺少 styles/theme.wxss');
  for (const name of ['index', 'lexicon', 'history', 'about']) {
    const wxml = fs.readFileSync(path.join(MP, `pages/${name}/${name}.wxml`), 'utf8');
    assert(wxml.includes('<nav-bar'), `${name} 页未使用 nav-bar 组件`);
  }
});

run('词库搜索高亮片段（C6）', () => {
  const page = loadPage('lexicon');
  const vm = page.toViewModel(
    'words',
    { zh: '你今天真好看', linyu: '小仙女今天真好看', alias: '', sense: '', pop: '', source: '' },
    0,
    '你'
  );
  assert(vm.zhParts, '有关键词时应产出高亮片段');
  assert(vm.zhParts.some((p) => p.h), '片段中应有命中标记');
  assert.strictEqual(vm.zhParts.map((p) => p.t).join(''), '你今天真好看');
  const plain = page.toViewModel('words', { zh: '你好', linyu: '' }, 0, '');
  assert(!plain.zhParts, '无关键词时不应有片段');
});

run('历史长按复制译文与导出文本（C7）', () => {
  storage.clear();
  history.clearHistory();
  history.addHistory('你今天真好看！', '小仙女，你今天真好看！♥');
  const page = loadPage('history');
  page.onLoad({});
  page.onShow();
  const row = page._rows[0];
  page.copyRow({ currentTarget: { dataset: { id: row.id } } });
  assert.strictEqual(lastClipboard, '小仙女，你今天真好看！♥');
  page.exportText();
  assert(lastClipboard.includes('原文：你今天真好看！'), '导出文本应包含原文');
  assert(lastClipboard.includes('淋语：小仙女，你今天真好看！♥'), '导出文本应包含译文');
});

runAsync('历史批量选择删除流程（C7）', async () => {
  storage.clear();
  history.clearHistory();
  history.addHistory('记录一', '输出一');
  history.addHistory('记录二', '输出二');
  const page = loadPage('history');
  page.onLoad({});
  page.onShow();
  assert.strictEqual(page.data.total, 2);

  page.enterSelect();
  assert.strictEqual(page.data.selecting, true);
  const item = page.data.groups[0].items[0];
  page.toggleSelect({ currentTarget: { dataset: { id: item.id, gi: 0, ji: 0 } } });
  assert.strictEqual(page.data.selectedCount, 1);
  assert.strictEqual(page._selected.has(item.id), true);

  let modal = null;
  global.wx.showModal = (opts) => {
    modal = opts;
    opts.success({ confirm: true, cancel: false });
  };
  await page.deleteSelected();
  assert(modal, '未弹出确认框');
  assert.strictEqual(page.data.selecting, false);
  assert.strictEqual(page.data.total, 1);
  assert.strictEqual(history.readHistory().length, 1);
  assert.strictEqual(history.readHistory()[0].input, '记录一', '最新一条被选中删除，应剩下更早的记录');
});

run('主包体积小于 2MB 且不含人物图片', () => {
  const files = walk(MP);
  const bytes = files.reduce((total, file) => total + fs.statSync(file).size, 0);
  const mb = (bytes / 1024 / 1024).toFixed(2);
  assert(bytes < 2 * 1024 * 1024, `主包 ${mb}MB 超过 2MB`);
  const images = files.filter((file) => /\.(png|jpe?g|webp|gif)$/i.test(file));
  assert.strictEqual(images.length, 0, `主包不应包含图片：${images.join(', ')}`);
  console.log(`     主包体积 ${mb}MB / ${files.length} 个文件`);
});

run('小程序端不包含网络上传/下载调用', () => {
  const banned = ['wx.request', 'wx.uploadFile', 'wx.downloadFile'];
  for (const file of walk(MP).filter((f) => f.endsWith('.js'))) {
    const text = fs.readFileSync(file, 'utf8');
    for (const call of banned) {
      assert(!text.includes(call), `${path.relative(MP, file)} 含 ${call}`);
    }
  }
});

Promise.all(pending).then(() => {
  if (failed) {
    console.log(`\n${failed} 项小程序检查未通过`);
    process.exitCode = 1;
  } else {
    console.log('\n小程序检查全部通过');
  }
});
