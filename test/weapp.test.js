'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');
const MP = path.join(ROOT, 'miniprogram');

// 人物详情页已迁入分包 pkg-hero（配图轮次：详情图随分包走），其余四个页面在主包
const PAGE_ROUTES = { hero: 'pkg-hero/pages/hero/hero', browse: 'pkg-hero/pages/browse/browse' };

// 小程序运行时依赖全局 wx / Page / getApp，先铺一层最小桩再 require 业务模块
const storage = new Map();
const navigations = [];
let lastPageConfig = null;
let lastClipboard = '';
let lastToast = '';
let lastApp = null;
let privacyHandler = null;
const realtimeLogs = [];

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
  setStorage(options) {
    if (options.success) options.success();
  },
  getWindowInfo() {
    return { statusBarHeight: 20 };
  },
  setNavigationBarColor() {},
  setBackgroundColor() {},
  setTabBarStyle() {},
  setNavigationBarTitle() {},
  hideShareMenu() {},
  switchTab() {},
  navigateTo(options) {
    navigations.push(options.url);
  },
  pageScrollTo() {},
  reportEvent() {},
  vibrateShort() {},
  onNeedPrivacyAuthorization(handler) {
    privacyHandler = handler;
  },
  getRealtimeLogManager() {
    return {
      warn: (kind, value) => realtimeLogs.push({ level: 'warn', kind, value }),
      error: (kind, value) => realtimeLogs.push({ level: 'error', kind, value }),
    };
  },
  setClipboardData(options) {
    lastClipboard = options.data;
    if (options.success) options.success();
  },
  showToast(options) {
    lastToast = options.title;
  },
  hideToast() {},
  showModal(options) {
    if (options.success) options.success({ confirm: true, cancel: false });
  },
};
global.Page = (config) => {
  lastPageConfig = config;
};
global.App = (config) => {
  lastApp = config;
};
const fakeApp = {
  globalData: { theme: 'white', version: '1.0.0', live: true, historyLimit: 200, pendingInput: '' },
  errors: [],
  reportError(kind, err) {
    this.errors.push({ kind, err });
  },
  setHistoryLimit(limit) {
    this.globalData.historyLimit = Number(limit) || 200;
  },
  setLive(on) {
    this.globalData.live = Boolean(on);
  },
  applyTheme(theme) {
    this.globalData.theme = theme;
    return theme;
  },
  resetLocalData() {
    this.globalData.theme = 'white';
    this.globalData.live = true;
    this.globalData.historyLimit = 200;
    return { theme: 'white', live: true, historyLimit: 200 };
  },
};
global.getApp = () => fakeApp;

const seed = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'core', 'seed.json'), 'utf8'));
const history = require('../miniprogram/services/history');
const prefs = require('../miniprogram/services/prefs');
const content = require('../miniprogram/services/content');
const loreService = require('../miniprogram/pkg-hero/services/lore');
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
  pending.push({ name, fn });
}

function applyPath(target, key, value) {
  if (!key.includes('.') && !key.includes('[')) {
    target[key] = value;
    return;
  }
  const tokens = key.replace(/\[(\d+)\]/g, '.$1').split('.');
  let node = target;
  for (let i = 0; i < tokens.length - 1; i += 1) {
    const token = tokens[i];
    if (node[token] === undefined || node[token] === null) {
      node[token] = /^\d+$/.test(tokens[i + 1]) ? [] : {};
    }
    node = node[token];
  }
  node[tokens[tokens.length - 1]] = value;
}

function loadPage(name) {
  const route = PAGE_ROUTES[name] || `pages/${name}/${name}`;
  const file = require.resolve(`../miniprogram/${route}.js`);
  delete require.cache[file];
  lastPageConfig = null;
  require(file);
  assert(lastPageConfig, `${name} 页面没有调用 Page()`);
  const instance = Object.assign({}, lastPageConfig, {
    data: JSON.parse(JSON.stringify(lastPageConfig.data || {})),
    _patches: [],
    setData(patch, cb) {
      this._patches.push(patch);
      for (const [key, value] of Object.entries(patch)) applyPath(this.data, key, value);
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

// 小程序端的 seed / lore-extra 是「列式编码」（{__col:1, __sst:1, keys, rows}）以压主包体积，
// 主端仍是常规对象。一致性要按「解码后的内容」比，而不是按字节比——
// 字节比在这里会把两种合法的等价编码判成不同步。
// __sst=1 时表格单元存的是全局字符串表（data/_sst.js）的下标，要先还原。
const MP_SST = (() => {
  try {
    return require('../miniprogram/data/_sst');
  } catch (e) {
    return null;
  }
})();

function decodeCol(part, sst) {
  if (!part || !Array.isArray(part.rows)) return part;
  const { keys, rows } = part;
  const dec = (v) => {
    if (!sst) return v;
    if (v === null || v === undefined) return v;
    if (typeof v === 'number') return sst[v];
    if (typeof v === 'object') return 'n' in v ? v.n : v.a;
    return v;
  };
  return rows.map((row) => {
    const o = {};
    for (let i = 0; i < keys.length; i++) {
      const v = dec(row[i]);
      if (v !== null && v !== undefined) o[keys[i]] = v;
    }
    return o;
  });
}

function decodePacked(mod) {
  if (!mod || !mod.__col) return mod;
  const sst = mod.__sst ? MP_SST : null;
  const out = {};
  for (const [k, v] of Object.entries(mod)) {
    if (k === '__col' || k === '__sst') continue;
    out[k] = v && v.rows ? decodeCol(v, sst) : v;
  }
  return out;
}

run('小程序数据与 src/core/seed.json 一致', () => {
  const mpSeed = decodePacked(require('../miniprogram/data/seed'));
  assert.deepStrictEqual(mpSeed, seed, '数据不同步，请先运行 npm run weapp:sync');
});

run('翻译引擎与词库/人物数据逐字同步', () => {
  const files = [
    ['core/tokenizer.js', 'tokenizer.js'],
    ['core/translator.js', 'translator.js'],
    ['pkg-hero/data/lore.js', 'lore.js'],
    ['pkg-hero/data/lore-extra3.js', 'lore-extra3.js'],
    ['pkg-hero/data/lore-extra4.js', 'lore-extra4.js'],
    ['pkg-hero/data/lore-extra5.js', 'lore-extra5.js'],
    ['pkg-hero/data/lore-extra6.js', 'lore-extra6.js'],
    ['pkg-hero/data/lore-extra7.js', 'lore-extra7.js'],
    ['pkg-hero/data/lore-extra8.js', 'lore-extra8.js'],
    ['pkg-hero/data/lore-extra9.js', 'lore-extra9.js'],
    ['pkg-hero/data/lore-extra10.js', 'lore-extra10.js'],
    ['pkg-hero/data/lore-extra11.js', 'lore-extra11.js'],
    ['pkg-hero/data/lore-extra12.js', 'lore-extra12.js'],
    ['pkg-hero/data/lore-extra13.js', 'lore-extra13.js'],
    ['pkg-hero/data/lore-extra14.js', 'lore-extra14.js'],
  ];
  // lore-extraN.js：小程序端是列式编码，按解码后的内容比（等价编码不算不同步）
  // lore.js / tokenizer.js / translator.js：小程序端会裁掉整行注释与空行以省主包体积，
  // 比对时同样先做一次同样的裁剪，再逐字比。
  // 与 build-weapp-data.mjs 的 slim 口径一致：整行注释、空行、行首缩进都不参与比较
  // （缩进不影响语义；第 24 轮起小程序主包逼近 2MB，副本去缩进是正经的省体积手段）。
  const strip = (t) =>
    t
      .split('\n')
      .filter((line) => !/^\s*\/\//.test(line) && line.trim() !== '')
      .map((line) => line.replace(/^\s+/, ''))
      .join('\n')
      // 小程序端 lore.js 落在 pkg-hero 分包，require 字符串表要写 ../../data/_sst.js，
      // 主端是 ./_sst.js。这是分包布局决定的路径差异，不该算「内容不同步」。
      .replace(/require\('(?:\.\.\/\.\.\/data\/|\.\/)_sst\.js'\)/g, "require('__SST__')");
  for (const [mpFile, coreFile] of files) {
    const mpPath = path.join(MP, mpFile);
    if (/lore-extra\d+\.js$/.test(coreFile)) {
      // 两侧都要清缓存：lore.js 聚合时会 mutate core 侧的模块导出对象（aliasMerge 往 aliases 里追加），
      // 不清缓存就永远比的是被改过的运行时对象，而不是磁盘内容。
      for (const k of Object.keys(require.cache)) if (/lore-extra\d+\.js$/.test(k)) delete require.cache[k];
      const mpData = decodePacked(require(mpPath));
      const corePath = path.join(ROOT, 'src', 'core', coreFile);
      const coreData = require(corePath);
      assert.deepStrictEqual(mpData, coreData, `${mpFile} 已过期，请运行 npm run weapp:sync`);
      continue;
    }
    const mpText = strip(fs.readFileSync(mpPath, 'utf8'));
    const coreText = strip(fs.readFileSync(path.join(ROOT, 'src', 'core', coreFile), 'utf8'));
    assert.strictEqual(mpText, coreText, `${mpFile} 已过期，请运行 npm run weapp:sync`);
  }
});

run('翻译结果与桌面/安卓端一致', () => {
  const mpSeed = decodePacked(require('../miniprogram/data/seed'));
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
  const lore = require('../miniprogram/pkg-hero/data/lore');
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
  const pages = ['index', 'lexicon', 'history', 'about', 'hero', 'browse'];
  const subPages = (appJson.subPackages || []).flatMap((p) =>
    (p.pages || []).map((page) => `${p.root}/${page}`)
  );
  for (const name of pages) {
    const route = PAGE_ROUTES[name] || `pages/${name}/${name}`;
    const registered = appJson.pages.includes(route) || subPages.includes(route);
    assert(registered, `${route} 未在 app.json 注册`);
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
  // 人物详情必须在分包里，否则详情图无处安放（主包放不下 557 张图）
  assert(subPages.includes('pkg-hero/pages/hero/hero'), '人物详情页应注册在 pkg-hero 分包');
});

run('自定义 tabBar 与 app.json 声明一致（B7）', () => {
  const appJson = JSON.parse(fs.readFileSync(path.join(MP, 'app.json'), 'utf8'));
  const appTabs = appJson.tabBar.list.map((t) => t.pagePath.replace(/^pages\//, '/pages/'));
  const appLabels = appJson.tabBar.list.map((t) => t.text);
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
  const labels = [];
  const labelRe = /label:\s*'([^']+)'/g;
  let n = labelRe.exec(match[1]);
  while (n) {
    labels.push(n[1]);
    n = labelRe.exec(match[1]);
  }
  assert.deepStrictEqual(labels, appLabels, 'custom-tab-bar 文案与 app.json tabBar.list 不一致');
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
  assert.strictEqual(share.path, '/pkg-hero/pages/hero/hero?id=0');

  heroPage.onLoad({ id: '99999' });
  assert.strictEqual(heroPage.data.notFound, true);
});

run('WXML 事件处理函数均已实现', () => {
  for (const name of ['index', 'lexicon', 'history', 'about', 'hero']) {
    const wxml = fs.readFileSync(path.join(MP, `${PAGE_ROUTES[name] || `pages/${name}/${name}`}.wxml`), 'utf8');
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
    const wxml = fs.readFileSync(path.join(MP, `${PAGE_ROUTES[name] || `pages/${name}/${name}`}.wxml`), 'utf8');
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

run('包体预算：主包与各分包分别小于 2MB，图片按档位落位', () => {
  const appJson = JSON.parse(fs.readFileSync(path.join(MP, 'app.json'), 'utf8'));
  const subRoots = (appJson.subPackages || []).map((p) => p.root);
  const rel = (file) => path.relative(MP, file).split(path.sep);
  const isSub = (file) => subRoots.includes(rel(file)[0]);

  const files = walk(MP);
  const main = files.filter((f) => !isSub(f));
  // 微信的 2MB 限的是上传压缩后的代码包：图片压不动、JS 能压三分之二，
  // 所以必须按 gzip 后体积算，按原始字节算会把预算误判成超标。
  const size = (list) =>
    list.reduce((total, file) => {
      const raw = fs.readFileSync(file);
      const gz = /\.(png|jpe?g|webp|gif|mp4|mp3|wav)$/i.test(file)
        ? raw.length
        : zlib.gzipSync(raw, { level: 9 }).length;
      return total + gz;
    }, 0);
  const mb = (bytes) => (bytes / 1024 / 1024).toFixed(2);

  const mainBytes = size(main);
  assert(mainBytes < 2 * 1024 * 1024, `主包 ${mb(mainBytes)}MB 超过 2MB`);

  for (const root of subRoots) {
    const subFiles = files.filter((f) => rel(f)[0] === root);
    const subBytes = size(subFiles);
    assert(subBytes < 2 * 1024 * 1024, `分包 ${root} ${mb(subBytes)}MB 超过 2MB`);
    console.log(`     分包 ${root} ${mb(subBytes)}MB / ${subFiles.length} 个文件`);
  }

  // 557 张人物图只留一套，全部在 pkg-hero 分包：主包一张都不该有。
  // 以前是「主包 96px 列表图 + 分包 136px 详情图」两套并存，白占 1MB 主包预算。
  const mainImgs = main.filter((f) => /\.(png|jpe?g|webp|gif)$/i.test(f));
  const subImgs = files.filter((f) => isSub(f) && /\.(png|jpe?g|webp|gif)$/i.test(f));
  assert.strictEqual(mainImgs.length, 0, '主包不应保留人物图，图统一放 pkg-hero 分包');
  assert(subImgs.length > 0, '分包缺少人物图');
  for (const file of subImgs) {
    assert(/[\\/]img[\\/]hero-\d+\.webp$/.test(file), `分包出现非人物图：${path.relative(MP, file)}`);
    assert(fs.statSync(file).size <= 16 * 1024, `分包人物图过大：${path.relative(MP, file)}`);
  }
  console.log(`     主包 ${mb(mainBytes)}MB / ${main.length} 个文件`);

  // 图片路径是模板里拼的（/img/{{item.img}}.webp），静态扫描认不出依赖，
  // 开着「上传时过滤无依赖文件」会把 557 张图整批剔掉 —— 必须关。
  const projCfg = JSON.parse(fs.readFileSync(path.join(MP, 'project.config.json'), 'utf8'));
  assert.strictEqual(
    projCfg.setting.ignoreUploadUnusedFiles,
    false,
    '动态拼接的图片路径需关闭 ignoreUploadUnusedFiles，否则上传时图片会被过滤'
  );
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

run('A1 隐私声明与剪贴板降级', () => {
  const appJson = JSON.parse(fs.readFileSync(path.join(MP, 'app.json'), 'utf8'));
  assert.strictEqual(appJson.__usePrivacyCheck__, true, 'app.json 未开启 __usePrivacyCheck__');
  const appSrc = fs.readFileSync(path.join(MP, 'app.js'), 'utf8');
  assert(appSrc.includes('onNeedPrivacyAuthorization'), 'app.js 未注册隐私授权兜底');
  const aboutWxml = fs.readFileSync(path.join(MP, 'pages', 'about', 'about.wxml'), 'utf8');
  assert(aboutWxml.includes('剪贴板'), '关于页未说明剪贴板用途');

  storage.clear();
  prefs.resetPrefs();
  require('../miniprogram/app.js');
  assert(lastApp, 'app.js 未调用 App()');
  lastApp.onLaunch();
  assert.strictEqual(typeof privacyHandler, 'function', '未注册 onNeedPrivacyAuthorization');
  let resolution = null;
  privacyHandler((res) => {
    resolution = res;
  });
  assert.deepStrictEqual(resolution, { event: 'agree' });

  const { copy } = require('../miniprogram/utils/ui');
  const original = global.wx.setClipboardData;
  global.wx.setClipboardData = (opts) => {
    if (opts.fail) opts.fail(new Error('scope is not declared'));
  };
  lastToast = '';
  copy('剪贴板测试');
  assert(lastToast.includes('复制失败'), '复制失败时应提示长按选择文本');
  global.wx.setClipboardData = original;
});

run('主包词库页把词卡/名言/人物三个 tab 交给分包', () => {
  const page = loadPage('lexicon');
  page.onLoad();
  navigations.length = 0;
  for (const key of ['cards', 'quotes', 'heroes']) {
    page.switchTab({ currentTarget: { dataset: { key } } });
  }
  assert.deepStrictEqual(
    navigations,
    [
      '/pkg-hero/pages/browse/browse?tab=cards',
      '/pkg-hero/pages/browse/browse?tab=quotes',
      '/pkg-hero/pages/browse/browse?tab=heroes',
    ],
    '词卡/名言/人物应跳转到 pkg-hero 分包浏览页'
  );
  assert.strictEqual(page.data.tab, 'words', '跳到分包不应改变主包页自身的 tab 状态');

  navigations.length = 0;
  page.switchTab({ currentTarget: { dataset: { key: 'rules' } } });
  assert.deepStrictEqual(navigations, [], '句式仍在主包内切换，不应跳转');
  assert.strictEqual(page.data.tab, 'rules');
});

run('A4 首屏数据解耦', () => {
  const appSrc = fs.readFileSync(path.join(MP, 'app.js'), 'utf8');
  assert(!/require\(['"]\.\/services\/(content|lore)['"]\)/.test(appSrc), 'app.js 不应加载 content/lore');
  assert(appSrc.includes("require('./data/counts')"), 'app.js 应只读取静态计数');
  const contentSrc = fs.readFileSync(path.join(MP, 'services', 'content.js'), 'utf8');
  assert(!contentSrc.includes('data/lore'), 'content.js 不应加载 lore');
  const lexiconSrc = fs.readFileSync(path.join(MP, 'pages', 'lexicon', 'lexicon.js'), 'utf8');
  // 主包词库页只做词条/句式检索；词卡/名言/人物整块在 pkg-hero 分包，
  // 主包一旦 require lore，1MB 数据连同人物图就会被算进主包预算。
  assert(!lexiconSrc.includes('services/lore'), '主包词库页不应加载 lore（已移入 pkg-hero 分包）');
  assert(lexiconSrc.includes('REMOTE_TABS'), '主包词库页应把词卡/名言/人物三个 tab 指向分包');
  const browseSrc = fs.readFileSync(path.join(MP, PAGE_ROUTES.browse + '.js'), 'utf8');
  assert(browseSrc.includes("require('../../services/lore')"), '分包浏览页应延迟加载 lore');
  const heroSrc = fs.readFileSync(path.join(MP, PAGE_ROUTES.hero + '.js'), 'utf8');
  assert(heroSrc.includes("require('../../services/lore')"), '人物页应延迟加载 lore（同分包）');
  const aboutSrc = fs.readFileSync(path.join(MP, 'pages', 'about', 'about.js'), 'utf8');
  assert(!aboutSrc.includes("services/content"), '关于页不应为耗时统计加载 seed');
  assert(aboutSrc.includes("services/perf"), '关于页应只加载 perf');
});

run('A5 翻译异常兜底与全局错误上报', () => {
  require('../miniprogram/app.js');
  assert(lastApp, 'app.js 未加载');
  const page = loadPage('index');
  const original = content.translate;
  fakeApp.errors.length = 0;
  content.translate = () => {
    throw new Error('boom');
  };
  try {
    assert.strictEqual(page.safeTranslate('你好'), '你好', '异常时应原样返回，保证流程不中断');
  } finally {
    content.translate = original;
  }
  assert(fakeApp.errors.some((e) => e.kind === 'translate_error'), '未上报翻译异常');

  lastApp.onError(new Error('global'));
  assert(realtimeLogs.some((l) => l.kind === 'onError'), '未写入实时日志');
});

run('A2 超长分享只带 overflow 标记', () => {
  const page = loadPage('index');
  page.onLoad({});
  const long = '好'.repeat(200);
  page.setData({ input: long, output: '淋语'.repeat(50), inputLength: long.length, inputTrimmed: true });
  assert.strictEqual(page.shareQuerySuffix(), 'overflow=1');

  lastToast = '';
  page.onLoad({ overflow: '1' });
  assert(lastToast.includes('原文过长'), '落地页应提示原文过长未带出');
});

runAsync('A2 分享 path 不超限且短文本可带回原文', async () => {
  const page = loadPage('index');
  page.onLoad({});
  const long = '好'.repeat(200);
  page.setData({ input: long, output: '淋语'.repeat(50), inputLength: long.length, inputTrimmed: true });
  page._checked = { content: page.data.output, ok: true };
  const share = await page.onShareAppMessage();
  assert.strictEqual(share.path, '/pages/index/index?overflow=1');
  assert.strictEqual(page.onShareTimeline().query, 'overflow=1');

  const short = loadPage('index');
  short.onLoad({});
  short.setData({ input: '晚安', output: '碗安惹', inputTrimmed: true });
  short._checked = { content: '碗安惹', ok: true };
  const withText = await short.onShareAppMessage();
  assert(withText.path.startsWith('/pages/index/index?text='));
  const carried = decodeURIComponent(withText.path.split('text=')[1]);
  assert.strictEqual(carried, '晚安');
  assert(Buffer.byteLength(carried, 'utf8') <= 300);
});

runAsync('A3 本地词表与分享/历史双闸门', async () => {
  const sec = require('../miniprogram/services/sec');
  assert(sec.checkLocal('我们去赌博'), '本地词表未命中赌博');
  assert(sec.checkLocal('赌 博'), '应识别简单分隔变形');
  assert(!sec.checkLocal('今天天气真好'));

  let remote = 0;
  const originalRemote = global.wx.msgSecCheck;
  global.wx.msgSecCheck = (opts) => {
    remote += 1;
    opts.success({ result: { suggest: 'pass' } });
  };
  assert.strictEqual(await sec.checkText('今天天气真好'), true);
  assert.strictEqual(remote, 1, '本地未命中时应尝试远端校验');
  remote = 0;
  assert.strictEqual(await sec.checkText('我们去赌博'), false);
  assert.strictEqual(remote, 0, '本地命中不应再调用远端');
  global.wx.msgSecCheck = (opts) => opts.success({ result: { suggest: 'risky' } });
  assert.strictEqual(await sec.checkText('今天天气真好'), false);
  global.wx.msgSecCheck = originalRemote;

  const page = loadPage('index');
  page.onLoad({});
  page.setData({ input: '赌博', output: '赌博', inputTrimmed: true });
  page._checked = { content: '赌博', ok: false };
  const share = await page.onShareAppMessage();
  assert.strictEqual(share.title, '淋语翻译器 · 把中文翻译成淋语♥');
  assert.strictEqual(share.path, '/pages/index/index');
  assert.strictEqual(page.onShareTimeline().query, '');

  storage.clear();
  history.clearHistory();
  const originalAdd = history.addHistory;
  let added = 0;
  history.addHistory = () => {
    added += 1;
  };
  lastToast = '';
  page.secCheckAndRemember('赌博', '赌博');
  await new Promise((resolve) => setTimeout(resolve, 0));
  history.addHistory = originalAdd;
  assert.strictEqual(added, 0, '未通过校验的内容不应写入历史');
  assert(lastToast.includes('内容安全'), '应提示未通过内容安全校验');
  assert(page.data.historyNote.includes('未写入'), '结果区状态不应误报已写入历史');
});

run('配图链路：列表与详情都能拿到真实图片路径', () => {
  const loreSvc = require('../miniprogram/pkg-hero/services/lore');
  const withImg = loreSvc.heroes.filter((h) => h.img);
  const noImg = loreSvc.heroes.filter((h) => !h.img);
  assert(withImg.length > 500, `有图人物过少：${withImg.length}`);
  for (const hero of withImg) {
    assert(/^hero-\d+$/.test(hero.img), `图片编号不规范：${hero.name} ${hero.img}`);
    assert.strictEqual(hero.thumb, `/pkg-hero/img/${hero.img}.webp`, `${hero.name} 缩略图路径不对`);
  }
  for (const hero of noImg) {
    assert.strictEqual(hero.thumb, '', `${hero.name} 无图时 thumb 应为空`);
  }

  // 列表：视图模型必须把 thumb 透出来（白名单字段，漏了就是满屏首字方块）
  const listPage = loadPage('browse');
  listPage.onLoad({ tab: 'heroes' });
  listPage.setData({ tab: 'heroes', heroGroup: 'game' });
  listPage.applyFilter(true);
  const shown = listPage.data.shown;
  assert(shown.length > 0, '人物列表为空');
  const withImgVm = shown.filter((item) => item.thumb);
  assert(withImgVm.length > 0, '列表视图模型没有透出 thumb');
  for (const item of withImgVm) {
    assert(/^\/pkg-hero\/img\/hero-\d+\.webp$/.test(item.thumb), `列表缩略图路径异常：${item.thumb}`);
  }

  // 详情：photo 指向分包里的 136px 图
  const heroPage = loadPage('hero');
  heroPage.onLoad({ id: '0' });
  assert(/^\.\.\/\.\.\/img\/hero-\d+\.webp$/.test(heroPage.data.photo), '详情图应指向分包相对路径');
  heroPage.onPhotoError();
  assert.strictEqual(heroPage.data.photo, '', '图片加载失败后应回落首字占位');

  const noImgIdx = String(loreSvc.heroes.findIndex((h) => !h.img));
  if (noImgIdx !== '-1') {
    heroPage.onLoad({ id: noImgIdx });
    assert.strictEqual(heroPage.data.photo, '', '无图人物不应拼出图片路径');
  }
});

run('B2 视图模型不下发 searchText', () => {
  const page = loadPage('lexicon');
  const wordVm = page.toViewModel('words', content.words[0], 0, '');
  assert(!('searchText' in wordVm), '词条视图模型不应携带 searchText');
  const browsePage = loadPage('browse');
  const card = require('../miniprogram/pkg-hero/services/lore').cards[0];
  const cardVm = browsePage.toViewModel('cards', card, 0, '');
  assert(!('searchText' in cardVm), '词卡视图模型不应携带 searchText');
});

run('B3 长列表增量 setData', () => {
  const page = loadPage('lexicon');
  page.onLoad();
  page._filtered = content.words;
  page._shownCount = 30;
  page.data.hasMore = true;
  page._patches = [];
  page.loadMore();
  const patch = page._patches[0];
  assert(patch, '词库 loadMore 未调用 setData');
  assert(!('shown' in patch), '词库 loadMore 不应全量替换 shown');
  assert(Object.keys(patch).some((k) => k.startsWith('shown[')), '词库 loadMore 应使用增量路径');
  assert.strictEqual(page.data.shown.length, 60, '词库第一页增量后应有 60 条');
  page._patches = [];
  page.loadMore();
  assert.strictEqual(page.data.shown.length, 90, '词库连续加载应继续增量追加');
  assert(Object.keys(page._patches[0]).some((k) => k.startsWith('shown[')));

  storage.clear();
  history.clearHistory();
  for (let i = 0; i < 120; i += 1) history.addHistory(`输入${i}`, `输出${i}`);
  const hp = loadPage('history');
  hp.onLoad({});
  hp.onShow();
  assert.strictEqual(hp.data.hasMore, true);
  hp._patches = [];
  hp.loadMore();
  const hpatch = hp._patches[0];
  assert(hpatch, '历史 loadMore 未调用 setData');
  assert(!('groups' in hpatch), '历史 loadMore 不应全量替换 groups');
  assert(Object.keys(hpatch).some((k) => k.startsWith('groups[')), '历史 loadMore 应使用增量路径');
  assert.strictEqual(hp.data.groups[0].items.length, 100, '历史第一次加载更多后应有 100 条');
  assert.strictEqual(hp.data.hasMore, true);
  hp._patches = [];
  hp.loadMore();
  assert.strictEqual(hp.data.groups[0].items.length, 120, '历史连续加载应继续增量追加');
  assert.strictEqual(hp.data.hasMore, false);
});

run('B4 历史写缓存 + 异步节流', () => {
  storage.clear();
  history.clearHistory();
  history.flush();
  storage.clear();

  const originalAsync = global.wx.setStorage;
  const originalSync = global.wx.setStorageSync;
  let asyncWrites = 0;
  let syncWrites = 0;
  global.wx.setStorage = (opts) => {
    asyncWrites += 1;
    if (opts.success) opts.success();
  };
  global.wx.setStorageSync = (key, value) => {
    syncWrites += 1;
    storage.set(key, value);
  };
  try {
    history.addHistory('缓存测试', '缓存输出');
    assert.strictEqual(syncWrites, 0, 'addHistory 不应同步写 storage');
    assert.strictEqual(asyncWrites, 0, '300ms 节流内不应立即写');
    assert(history.readHistory().some((row) => row.input === '缓存测试'), '缓存应立即可读');
    history.flush();
    assert.strictEqual(asyncWrites, 1, 'flush 应异步写一次');
  } finally {
    global.wx.setStorage = originalAsync;
    global.wx.setStorageSync = originalSync;
    history.clearHistory();
    history.flush();
    storage.clear();
  }
});

runAsync('B5 历史搜索 150ms 防抖', async () => {
  storage.clear();
  history.clearHistory();
  history.addHistory('苹果', '苹果淋语');
  const page = loadPage('history');
  page.onLoad({});
  page.onShow();
  let calls = 0;
  const original = page.applyFilter;
  page.applyFilter = function (...args) {
    calls += 1;
    return original.apply(this, args);
  };
  page.onSearch({ detail: { value: '苹果' } });
  assert.strictEqual(calls, 0, '输入时不应立即全量过滤');
  await new Promise((resolve) => setTimeout(resolve, 180));
  assert.strictEqual(calls, 1, '防抖结束后应过滤一次');
  page.applyFilter = original;
  history.clearHistory();
  history.flush();
  storage.clear();
});

run('B6/B8 主题同步收口与 customNav 分支', () => {
  for (const name of ['index', 'lexicon', 'history', 'about']) {
    const src = fs.readFileSync(path.join(MP, 'pages', name, `${name}.js`), 'utf8');
    assert(src.includes('syncChrome(this'), `${name} 未使用 syncChrome`);
  }
  const heroSrc = fs.readFileSync(path.join(MP, PAGE_ROUTES.hero + '.js'), 'utf8');
  assert(heroSrc.includes('syncChrome(this)'));
  assert(!heroSrc.includes('{ tab: false }'), 'hero 页不应再传无效的第二个实参');

  let navCalls = 0;
  let bgCalls = 0;
  const originalNav = global.wx.setNavigationBarColor;
  const originalBg = global.wx.setBackgroundColor;
  global.wx.setNavigationBarColor = () => {
    navCalls += 1;
  };
  global.wx.setBackgroundColor = () => {
    bgCalls += 1;
  };
  try {
    prefs.applyChrome('black', { customNav: true });
    assert.strictEqual(navCalls, 0, 'custom 导航页不应调用 setNavigationBarColor');
    assert.strictEqual(bgCalls, 1, 'custom 导航页仍应设置页面背景色');
    prefs.applyChrome('black');
    assert.strictEqual(navCalls, 1);
  } finally {
    global.wx.setNavigationBarColor = originalNav;
    global.wx.setBackgroundColor = originalBg;
  }
});

run('B13 翻译耗时统计', () => {
  content.translate('你今天真好看！');
  const stats = content.translateStats();
  assert(stats && stats.count > 0, '未记录翻译耗时');
  assert(Number.isFinite(stats.p50) && Number.isFinite(stats.p95), '缺少 P50/P95');
  assert(stats.p50 <= stats.p95);
  const page = loadPage('about');
  page.onLoad({});
  assert(page.data.perf, '关于页未展示耗时统计');
});

run('B14 提审配置与版本单一来源', () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(MP, 'project.config.json'), 'utf8'));
  assert.strictEqual(cfg.setting.urlCheck, true, 'urlCheck 应开启');
  assert.strictEqual(cfg.setting.uploadWithSourceMap, false, '不应上传 sourcemap');
  const priv = JSON.parse(fs.readFileSync(path.join(MP, 'project.private.config.json'), 'utf8'));
  assert.strictEqual(priv.setting.urlCheck, true, '私有配置也不应关闭 urlCheck');
  assert(fs.existsSync(path.join(MP, 'README.md')), '缺少小程序 README');
  assert.strictEqual(require('../miniprogram/data/version'), require('../package.json').version);
});

run('B11 lore 聚合依赖的 drop 字段不可剥离', () => {
  const e4 = require('../miniprogram/pkg-hero/data/lore-extra4');
  const e5 = require('../miniprogram/pkg-hero/data/lore-extra5');
  assert(Array.isArray(e4.dropCards) && Array.isArray(e4.dropQuotes));
  assert(Array.isArray(e5.dropCards) && Array.isArray(e5.dropQuotes) && Array.isArray(e5.dropHeroes));
  const dropped = new Set([...e4.dropCards, ...e5.dropCards]);
  for (const card of loreService.cards) {
    assert(!dropped.has(card.term), `被剔除的词卡「${card.term}」仍出现在最终数据中`);
  }
});

run('词库合规扫描清单已归档', () => {
  const dir = path.join(ROOT, 'evidence');
  const files = fs.readdirSync(dir).filter((f) => f.startsWith('weapp-content-audit-'));
  assert(files.length > 0, '缺少 evidence/weapp-content-audit-*.md');
});

(async () => {
  for (const { name, fn } of pending) {
    try {
      await fn();
      console.log(`PASS [${name}]`);
    } catch (err) {
      failed += 1;
      console.log(`FAIL [${name}] ${err.message}`);
    }
  }
  if (failed) {
    console.log(`\n${failed} 项小程序检查未通过`);
    process.exitCode = 1;
  } else {
    console.log('\n小程序检查全部通过');
  }
})();
