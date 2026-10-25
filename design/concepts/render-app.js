'use strict';

// Dev-only preview harness: renders the real page JS data + WXML + WXSS with Edge.
// It is not a WeChat runtime; it exists to catch layout/markup regressions quickly.

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '../../miniprogram');
const OUT = path.join(__dirname, 'app-shots');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

const content = require(path.join(ROOT, 'utils/content.js'));
const prefs = require(path.join(ROOT, 'utils/prefs.js'));

const CHROME = {
  white: {
    navBg: '#f7f5f1',
    navFront: '#000000',
    tabBg: '#f7f5f1',
    tabColor: '#6d6861',
    tabSelected: '#141414',
    border: 'rgba(20,20,20,.14)',
  },
  black: {
    navBg: '#111112',
    navFront: '#ffffff',
    tabBg: '#111112',
    tabColor: '#99948b',
    tabSelected: '#ff6f9c',
    border: 'rgba(242,239,233,.16)',
  },
  rose: {
    navBg: '#fbf2f3',
    navFront: '#000000',
    tabBg: '#fbf2f3',
    tabColor: '#7e5c66',
    tabSelected: '#c2185b',
    border: 'rgba(42,27,32,.15)',
  },
};

const TAB_TITLES = { index: '淋语翻译器', lexicon: '词库', history: '历史', about: '关于' };
const TABS = [
  { key: 'index', label: '翻译' },
  { key: 'lexicon', label: '词库' },
  { key: 'history', label: '历史' },
  { key: 'about', label: '关于' },
];

const storage = new Map();
let navTitle = '';

const app = {
  globalData: {
    version: '1.13.0',
    theme: 'white',
    live: true,
    historyLimit: 200,
    pendingInput: '',
    counts: content.counts,
  },
  applyTheme(key) {
    this.globalData.theme = key;
    const current = storage.get('linyu.prefs.v1') || {};
    storage.set('linyu.prefs.v1', Object.assign({}, current, { theme: key }));
    return key;
  },
  setLive(on) {
    this.globalData.live = Boolean(on);
    const current = storage.get('linyu.prefs.v1') || {};
    storage.set('linyu.prefs.v1', Object.assign({}, current, { live: Boolean(on) }));
    return this.globalData.live;
  },
  setHistoryLimit(limit) {
    this.globalData.historyLimit = Number(limit) || 200;
  },
  resetLocalData() {
    storage.delete('linyu.history.v1');
    const next = prefs.resetPrefs();
    this.globalData.theme = next.theme;
    this.globalData.live = next.live;
    this.globalData.historyLimit = next.historyLimit;
    return next;
  },
};

function historyRows() {
  const now = Date.now();
  const rows = [
    ['你今天真好看！', now - 60 * 60 * 1000],
    ['我不知道呢，感觉很开心', now - 3 * 60 * 60 * 1000],
    ['谢谢宝贝的抱抱', now - 26 * 60 * 60 * 1000],
    ['这也太可爱了吧哈哈哈哈', now - 3 * 24 * 60 * 60 * 1000],
  ];
  return rows.map(([input, createdAt], index) => ({
    id: 'preview-' + index,
    input,
    output: content.translate(input),
    createdAt,
  }));
}

global.wx = {
  getStorageSync(key) {
    return storage.has(key) ? JSON.parse(JSON.stringify(storage.get(key))) : '';
  },
  setStorageSync(key, value) {
    storage.set(key, JSON.parse(JSON.stringify(value)));
  },
  removeStorageSync(key) {
    storage.delete(key);
  },
  setNavigationBarColor() {},
  setBackgroundColor() {},
  setTabBarStyle() {},
  setNavigationBarTitle(opts) {
    navTitle = (opts && opts.title) || '';
  },
  pageScrollTo() {},
  navigateTo() {},
  switchTab() {},
  hideShareMenu() {},
  vibrateShort() {},
  showToast() {},
  hideToast() {},
  setClipboardData() {},
  getClipboardData() {},
  showModal() {},
};
global.getApp = () => app;

function resetStore(theme) {
  storage.clear();
  storage.set('linyu.prefs.v1', { theme, live: true, historyLimit: 200 });
  storage.set('linyu.history.v1', historyRows());
  app.globalData.theme = theme;
  app.globalData.live = true;
  app.globalData.historyLimit = 200;
  app.globalData.pendingInput = '';
  navTitle = '';
}

function loadPage(name, options) {
  let config = null;
  global.Page = (value) => {
    config = value;
  };
  const file = path.join(ROOT, 'pages', name, name + '.js');
  delete require.cache[require.resolve(file)];
  require(file);
  const page = Object.create(config);
  page.data = JSON.parse(JSON.stringify(config.data));
  page.setData = function setData(patch, cb) {
    Object.assign(this.data, patch);
    if (cb) cb.call(this);
  };
  if (page.onLoad) page.onLoad(options || {});
  if (page.onShow) page.onShow();
  return page;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function evalExpr(expr, scope) {
  try {
    const fn = new Function('__scope', 'with (__scope) { return (' + expr + '); }');
    return fn(scope);
  } catch (err) {
    return '';
  }
}

function isTruthy(value) {
  return Boolean(value);
}

function evalRaw(raw, scope) {
  if (raw === true) return true;
  const source = String(raw).trim();
  const wrapped = source.match(/^\{\{([\s\S]*)\}\}$/);
  if (wrapped) return evalExpr(wrapped[1], scope);
  return source;
}

function interpolate(raw, scope) {
  return String(raw).replace(/\{\{([\s\S]*?)\}\}/g, (match, expr) => {
    const value = evalExpr(expr.trim(), scope);
    return value == null ? '' : String(value);
  });
}

function parseAttrs(source) {
  const attrs = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'))?/g;
  let match;
  while ((match = re.exec(source))) {
    attrs[match[1]] = match[2] !== undefined ? match[2] : match[3] !== undefined ? match[3] : true;
  }
  return attrs;
}

function parseWxml(source) {
  const src = source.replace(/<!--[\s\S]*?-->/g, '');
  const root = { type: 'root', children: [] };
  const stack = [root];
  const tagRe = /<(\/?)([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g;
  let last = 0;
  let match;
  while ((match = tagRe.exec(src))) {
    const text = src.slice(last, match.index);
    if (text.trim()) stack[stack.length - 1].children.push({ type: 'text', text });
    const closing = match[1];
    const name = match[2].toLowerCase();
    const selfClose = match[4] === '/';
    if (closing) {
      if (stack.length > 1) stack.pop();
    } else {
      const node = { type: 'element', tag: name, attrs: parseAttrs(match[3]), children: [] };
      stack[stack.length - 1].children.push(node);
      if (!selfClose) stack.push(node);
    }
    last = tagRe.lastIndex;
  }
  return root;
}

const templateCache = new Map();

function getTemplate(page) {
  if (!templateCache.has(page)) {
    const file = path.join(ROOT, 'pages', page, page + '.wxml');
    templateCache.set(page, parseWxml(fs.readFileSync(file, 'utf8')));
  }
  return templateCache.get(page);
}

function renderNodes(nodes, scope, page) {
  let html = '';
  let chain = null;
  for (const node of nodes) {
    if (node.type === 'text') {
      html += escapeHtml(interpolate(node.text, scope));
      continue;
    }
    const attrs = node.attrs;
    let show = true;
    if ('wx:if' in attrs) {
      const value = isTruthy(evalRaw(attrs['wx:if'], scope));
      chain = { matched: value };
      show = value;
    } else if ('wx:elif' in attrs) {
      if (chain && !chain.matched) {
        const value = isTruthy(evalRaw(attrs['wx:elif'], scope));
        show = value;
        if (value) chain.matched = true;
      } else {
        show = false;
      }
    } else if ('wx:else' in attrs) {
      show = Boolean(chain && !chain.matched);
      if (show) chain.matched = true;
    } else {
      chain = null;
    }
    if (!show) continue;

    if ('wx:for' in attrs) {
      const list = evalRaw(attrs['wx:for'], scope) || [];
      const itemName = attrs['wx:for-item'] || 'item';
      const indexName = attrs['wx:for-index'] || 'index';
      list.forEach((item, index) => {
        const childScope = Object.create(scope);
        childScope[itemName] = item;
        childScope[indexName] = index;
        html += renderElement(node, childScope, page);
      });
      continue;
    }
    html += renderElement(node, scope, page);
  }
  return html;
}

function renderElement(node, scope, page) {
  if (node.tag === 'block') return renderNodes(node.children, scope, page);

  const attrs = node.attrs;
  const className = attrs.class !== undefined ? interpolate(attrs.class, scope) : '';
  const style = attrs.style !== undefined ? interpolate(attrs.style, scope) : '';
  const classAttr = className ? ` class="${escapeAttr(className)}"` : '';
  const styleAttr = style ? ` style="${escapeAttr(style)}"` : '';

  if (node.tag === 'input') {
    const value = attrs.value !== undefined ? interpolate(attrs.value, scope) : '';
    const placeholder = attrs.placeholder !== undefined ? interpolate(attrs.placeholder, scope) : '';
    return (
      '<input' +
      classAttr +
      styleAttr +
      ' value="' +
      escapeAttr(value) +
      '" placeholder="' +
      escapeAttr(placeholder) +
      '">'
    );
  }

  if (node.tag === 'textarea') {
    const value = attrs.value !== undefined ? interpolate(attrs.value, scope) : '';
    const placeholder = attrs.placeholder !== undefined ? interpolate(attrs.placeholder, scope) : '';
    const body = value || placeholder;
    const extra = value ? '' : ' wx-placeholder';
    return (
      '<div' +
      classAttr +
      ' data-wx="textarea"' +
      styleAttr +
      '><span class="wx-textarea' +
      extra +
      '">' +
      escapeHtml(body) +
      '</span></div>'
    );
  }

  if (node.tag === 'switch') {
    const checked = attrs.checked !== undefined && isTruthy(evalRaw(attrs.checked, scope));
    return '<span class="wx-switch' + (checked ? ' on' : '') + '"><i></i></span>';
  }

  const map = {
    view: 'div',
    text: 'span',
    'scroll-view': 'div',
    picker: 'div',
    navigator: 'a',
    button: 'button',
    image: 'img',
  };
  const tag = map[node.tag] || 'div';
  let extra = '';
  if (node.tag === 'button' && attrs.disabled !== undefined && isTruthy(evalRaw(attrs.disabled, scope))) {
    extra += ' disabled';
  }
  if (node.tag === 'image') {
    const src = attrs.src !== undefined ? interpolate(attrs.src, scope) : '';
    return '<img' + classAttr + styleAttr + ' src="' + escapeAttr(src) + '">';
  }
  const body =
    node.tag === 'scroll-view'
      ? renderNodes(node.children, scope, page)
      : renderNodes(node.children, scope, page);
  return '<' + tag + classAttr + styleAttr + extra + '>' + body + '</' + tag + '>';
}

function convertCss(source) {
  return source
    .replace(/(-?\d*\.?\d+)rpx/g, (match, number) => parseFloat(number) / 2 + 'px')
    .replace(/^page\s*\{/m, 'body {');
}

const GLOBAL_CSS = convertCss(fs.readFileSync(path.join(ROOT, 'app.wxss'), 'utf8'));

function pageCss(page) {
  const file = path.join(ROOT, 'pages', page, page + '.wxss');
  return convertCss(fs.readFileSync(file, 'utf8'));
}

function chromeHtml(page, theme, heroName, data) {
  const colors = CHROME[theme] || CHROME.white;
  const isStackPage = page === 'hero';
  const title = isStackPage ? heroName || navTitle || '人物详情' : TAB_TITLES[page];
  const back = isStackPage ? '<span class="nav-back">‹</span>' : '';
  const capsule =
    '<span class="capsule"><i></i><i></i><i></i><span class="cap-div"></span><span class="cap-target"></span></span>';
  const tabs = TABS.map(
    (tab) =>
      '<span class="tabbar-item' +
      (tab.key === page ? ' on' : '') +
      '"' +
      (tab.key === page ? ' style="color:' + colors.tabSelected + '"' : '') +
      '>' +
      tab.label +
      '</span>'
  ).join('');
  return (
    '<div class="statusbar" style="background:' +
    colors.navBg +
    ';color:' +
    colors.navFront +
    '"><span>9:41</span><span class="status-icons">●●●● ▮</span></div>' +
    '<div class="navbar" style="background:' +
    colors.navBg +
    ';color:' +
    colors.navFront +
    '">' +
    back +
    '<span class="nav-title">' +
    escapeHtml(title) +
    '</span>' +
    (isStackPage ? '' : capsule) +
    '</div>' +
    '<div class="stage">' +
    '<div class="page theme-' +
    theme +
    '">' +
    renderNodes(getTemplate(page).children, data, page) +
    '</div>' +
    '</div>' +
    (isStackPage
      ? ''
      : '<div class="tabbar" style="background:' +
        colors.tabBg +
        ';border-top-color:' +
        colors.border +
        ';color:' +
        colors.tabColor +
        '">' +
        tabs +
        '</div>')
  );
}

const HARNESS_CSS = `
  html, body { margin: 0; padding: 0; background: #dcd9d3; }
  body { -webkit-font-smoothing: antialiased; }
  .screen {
    width: 375px;
    height: 812px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: #f7f5f1;
    position: relative;
  }
  .statusbar {
    flex: none;
    height: 44px;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    padding: 0 22px 8px;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: .02em;
  }
  .status-icons { font-size: 10px; letter-spacing: .08em; }
  .navbar {
    flex: none;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    font-size: 17px;
    font-weight: 600;
  }
  .nav-title { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .nav-back {
    position: absolute;
    left: 16px;
    top: 0;
    line-height: 44px;
    font-size: 32px;
    font-weight: 300;
  }
  .capsule {
    position: absolute;
    right: 10px;
    top: 9px;
    width: 87px;
    height: 26px;
    border: 1px solid currentColor;
    border-radius: 13px;
    display: flex;
    align-items: center;
    justify-content: space-evenly;
    opacity: .55;
  }
  .capsule i { width: 3px; height: 3px; border-radius: 50%; background: currentColor; }
  .cap-div { width: 1px; height: 14px; background: currentColor; opacity: .4; }
  .cap-target { width: 9px; height: 9px; border: 1.5px solid currentColor; border-radius: 50%; position: relative; }
  .cap-target::after { content: ''; position: absolute; inset: 2.5px; border-radius: 50%; background: currentColor; }
  .stage { flex: 1; min-height: 0; overflow-y: auto; }
  .page { min-height: 100% !important; }
  .tabbar {
    flex: none;
    height: 50px;
    display: flex;
    align-items: stretch;
    border-top: .5px solid transparent;
  }
  .tabbar-item {
    position: relative;
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    letter-spacing: .02em;
  }
  .tabbar-item.on { font-weight: 600; }
  .tabbar-item.on::after {
    content: '';
    position: absolute;
    left: 50%;
    bottom: 7px;
    transform: translateX(-50%);
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: currentColor;
  }
  .wx-textarea { display: block; white-space: pre-wrap; word-break: break-word; }
  .wx-placeholder { color: var(--placeholder); }
  input { border: 0; outline: none; background: transparent; font: inherit; color: inherit; }
  .search-input::placeholder { color: var(--placeholder); }
  .wx-switch {
    display: inline-flex;
    align-items: center;
    width: 51px;
    height: 31px;
    padding: 2px;
    border-radius: 16px;
    background: rgba(120, 120, 120, .32);
    flex: none;
  }
  .wx-switch i {
    width: 27px;
    height: 27px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 1px 3px rgba(0,0,0,.2);
    transition: transform .2s ease;
  }
  .wx-switch.on { background: var(--accent); }
  .wx-switch.on i { transform: translateX(20px); }
  html.full, html.full body { height: auto; }
  html.full .screen { height: auto; min-height: 812px; overflow: visible; }
  html.full .stage { overflow: visible; }
  html.full .tabbar { display: none; }
`;

function renderHtml({ page, theme, heroName, data }) {
  const body = chromeHtml(page, theme, heroName, data);
  const css = GLOBAL_CSS + '\n' + pageCss(page) + '\n' + HARNESS_CSS;
  return (
    '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>linyu preview</title><style>' +
    css +
    '</style></head><body><div class="screen">' +
    body +
    '</div><script>if(location.search.indexOf("full")>=0){document.documentElement.classList.add("full");}</script></body></html>'
  );
}

function pickHero() {
  let best = null;
  let bestCount = -1;
  for (const hero of content.heroes) {
    const related = content.relatedForHero(hero);
    const count =
      related.words.length + related.rules.length + related.cards.length + related.quotes.length;
    if (count > bestCount) {
      best = hero;
      bestCount = count;
    }
  }
  return best;
}

const hero = pickHero();

const variants = [
  { id: 'home-white', page: 'index', theme: 'white', viewport: true, setup: (p) => p.applyInput('你今天真好看！', false) },
  { id: 'home-black', page: 'index', theme: 'black', viewport: true, setup: (p) => p.applyInput('你今天真好看！', false) },
  { id: 'home-rose', page: 'index', theme: 'rose', viewport: true, setup: (p) => p.applyInput('你今天真好看！', false) },
  { id: 'home-empty-white', page: 'index', theme: 'white', viewport: true },
  {
    id: 'lexicon-words-white',
    page: 'lexicon',
    theme: 'white',
    setup: (p) => {
      p.setData({ tab: 'words', placeholder: '搜索中文 / 淋语 / 解释…' }, () => p.applyFilter(true));
    },
  },
  {
    id: 'lexicon-cards-white',
    page: 'lexicon',
    theme: 'white',
    setup: (p) => {
      p.setData({ tab: 'cards', placeholder: '搜索词名 / 释义 / 出处…' }, () => p.applyFilter(true));
    },
  },
  {
    id: 'lexicon-quotes-white',
    page: 'lexicon',
    theme: 'white',
    setup: (p) => {
      p.setData({ tab: 'quotes', placeholder: '搜索名言 / 发言人 / 出处…' }, () => p.applyFilter(true));
    },
  },
  {
    id: 'lexicon-heroes-white',
    page: 'lexicon',
    theme: 'white',
    setup: (p) => {
      p.setData({ tab: 'heroes', placeholder: '搜索名字 / 称号 / 标签…' }, () => p.applyFilter(true));
    },
  },
  { id: 'history-white', page: 'history', theme: 'white' },
  { id: 'history-black', page: 'history', theme: 'black' },
  { id: 'about-white', page: 'about', theme: 'white' },
  { id: 'about-black', page: 'about', theme: 'black' },
  { id: 'about-rose', page: 'about', theme: 'rose' },
  {
    id: 'hero-white',
    page: 'hero',
    theme: 'white',
    options: { id: hero.id },
    heroName: hero.name,
  },
  {
    id: 'hero-top-white',
    page: 'hero',
    theme: 'white',
    options: { id: hero.id },
    heroName: hero.name,
    viewport: true,
  },
  {
    id: 'hero-top-black',
    page: 'hero',
    theme: 'black',
    options: { id: hero.id },
    heroName: hero.name,
    viewport: true,
  },
];

function buildVariant(variant) {
  resetStore(variant.theme);
  const page = loadPage(variant.page, variant.options || {});
  if (variant.setup) variant.setup(page);
  const html = renderHtml({
    page: variant.page,
    theme: variant.theme,
    heroName: variant.heroName,
    data: page.data,
  });
  const file = path.join(OUT, variant.id + '.html');
  fs.writeFileSync(file, html, 'utf8');
  return { file, viewport: Boolean(variant.viewport), id: variant.id };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function openTarget(port) {
  for (let i = 0; i < 100; i += 1) {
    try {
      const list = await fetch('http://127.0.0.1:' + port + '/json/list').then((r) => r.json());
      const target = list.find((item) => item.type === 'page');
      if (target) return target;
    } catch (err) {
      // browser is still starting
    }
    await sleep(150);
  }
  throw new Error('Edge page target not found');
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const pending = new Map();
    let seq = 0;
    ws.addEventListener('open', () => {
      resolve({
        send(method, params) {
          const id = ++seq;
          ws.send(JSON.stringify({ id, method, params: params || {} }));
          return new Promise((res, rej) => pending.set(id, { res, rej }));
        },
        close() {
          ws.close();
        },
      });
    });
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (!msg.id || !pending.has(msg.id)) return;
      const { res, rej } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) rej(new Error(msg.error.message));
      else res(msg.result);
    });
    ws.addEventListener('error', reject);
  });
}

async function evaluate(cdp, expression, awaitPromise) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: Boolean(awaitPromise),
    returnByValue: true,
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'evaluate failed');
  return result.result.value;
}

async function waitReady(cdp) {
  for (let i = 0; i < 80; i += 1) {
    try {
      const ready = await evaluate(cdp, 'document.readyState');
      if (ready === 'complete') {
        await evaluate(
          cdp,
          'document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => r(true))))',
          true
        );
        return;
      }
    } catch (err) {
      // navigation in progress
    }
    await sleep(100);
  }
  throw new Error('page did not become ready');
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const built = variants.map(buildVariant);
  console.log('built', built.length, 'variants in', OUT);

  const port = 9611;
  const profile = path.join(os.tmpdir(), 'ly-app-preview-' + Date.now());
  const browser = spawn(
    EDGE,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--disable-extensions',
      '--no-first-run',
      '--no-default-browser-check',
      '--remote-debugging-port=' + port,
      '--user-data-dir=' + profile,
      'about:blank',
    ],
    { stdio: 'ignore' }
  );

  try {
    const target = await openTarget(port);
    const cdp = await connect(target.webSocketDebuggerUrl);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    for (const item of built) {
      const url = pathToFileURL(item.file).href + (item.viewport ? '' : '?full=1');
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: 375,
        height: 812,
        deviceScaleFactor: item.viewport ? 2 : 1,
        mobile: true,
      });
      await cdp.send('Page.navigate', { url });
      await waitReady(cdp);
      await sleep(400);

      let height = 812;
      if (!item.viewport) {
        height = Math.max(812, await evaluate(cdp, 'document.documentElement.scrollHeight'));
        await cdp.send('Emulation.setDeviceMetricsOverride', {
          width: 375,
          height,
          deviceScaleFactor: 1,
          mobile: true,
        });
        await sleep(120);
        height = Math.max(812, await evaluate(cdp, 'document.documentElement.scrollHeight'));
        await cdp.send('Emulation.setDeviceMetricsOverride', {
          width: 375,
          height,
          deviceScaleFactor: 1,
          mobile: true,
        });
      }

      const shot = await cdp.send('Page.captureScreenshot', {
        format: 'png',
        fromSurface: true,
        captureBeyondViewport: true,
      });
      const file = path.join(OUT, item.id + '.png');
      fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
      console.log('shot', item.id, '375x' + height, fs.statSync(file).size, 'bytes');
    }

    await cdp.send('Browser.close').catch(() => {});
    cdp.close();
  } finally {
    browser.kill();
  }
})().catch((err) => {
  console.error(err.stack || err);
  process.exit(1);
});
