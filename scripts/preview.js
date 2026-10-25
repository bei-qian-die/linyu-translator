'use strict';

// 生成浏览器预览包：把渲染层复制到临时目录，并注入一个内存版 window.api stub，
// 便于用浏览器走查五板块 CRUD、开发者模式门禁、撤销/备份/导入导出与三套主题（不参与打包）。
const fs = require('fs');
const path = require('path');
const { createDb } = require('../src/core/db');
const seed = require('../src/core/seed.json');
const lore = require('../src/core/lore');
const { translateText } = require('../src/core/translator');
const { createAuth, DEFAULT_USER, DEFAULT_PASSWORD } = require('../src/core/auth');

const OUT = process.env.OUT || path.join(process.env.TEMP || 'C:/Users/qiuzh/AppData/Local/Temp', 'pv');
const SRC = path.join(__dirname, '..', 'src', 'renderer');

function copy(rel) {
  const from = path.join(SRC, rel);
  const to = path.join(OUT, rel);
  if (fs.statSync(from).isDirectory()) {
    fs.mkdirSync(to, { recursive: true });
    for (const name of fs.readdirSync(from)) copy(path.join(rel, name));
    return;
  }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

// 预览要跑的是 www/ 里已经包过 IIFE 的 core/mobile 产物：
// 直接 copy src/core 会让 lore-extra3..10 的 `const cards` 在同一个 <script> 作用域里撞名。
function copyFromRoot(fromRel, toRel) {
  const from = path.join(__dirname, '..', fromRel);
  const to = path.join(OUT, toRel || fromRel);
  if (!fs.existsSync(from)) throw new Error('预览缺少 ' + fromRel + '，先跑 npm run mobile:build');
  if (fs.statSync(from).isDirectory()) {
    fs.mkdirSync(to, { recursive: true });
    for (const name of fs.readdirSync(from)) copyFromRoot(path.join(fromRel, name), path.join(toRel || fromRel, name));
    return;
  }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of ['app.js', 'style.css']) copy(f);
  for (const img of fs.readdirSync(path.join(SRC, 'img'))) copy(path.join('img', img));
  for (const [from, to] of [
    ['www/core', 'core'],
    ['www/mobile', 'mobile'],
    ['www/vendor', 'vendor'],
    ['www/seed-data.js', 'seed-data.js'],
    ['www/seed.json', 'seed.json'],
  ]) {
    copyFromRoot(from, to);
  }
  fs.copyFileSync(
    path.join(__dirname, '..', 'node_modules', 'vue', 'dist', 'vue.global.prod.js'),
    path.join(OUT, 'vue.global.prod.js')
  );

  // 用真实入库路径生成快照，保证预览看到的字段形状和 Electron 里一致
  const creds = new Map();
  const pvAuth = createAuth({
    getSetting: (k) => (creds.has(k) ? creds.get(k) : null),
    setSetting: (k, v) => creds.set(k, v),
  });
  pvAuth.ensureInit();

  const store = await createDb({ seed, lore });
  const data = {
    words: store.getWords(),
    rules: store.getRules(),
    cards: store.getCards(),
    heroes: store.getHeroes(),
    quotes: store.getQuotes(),
  };
  const sampleExport = store.exportAll();
  store.close();

  const coreDir = path.join(__dirname, '..', 'src', 'core');
  const tokSrc = fs.readFileSync(path.join(coreDir, 'tokenizer.js'), 'utf8');
  const traSrc = fs.readFileSync(path.join(coreDir, 'translator.js'), 'utf8');

  const stub = `
window.__pv = ${JSON.stringify(data)};
window.__pvSampleExport = ${JSON.stringify({
    app: sampleExport.app,
    format: 1,
    data: {
      words: sampleExport.data.words.slice(0, 3).concat([{ zh: '导入演示词', linyu: '导入演示惹' }]),
      rules: [{ pattern: '导入演示(.{1,3})', template: '演$1示噜', note: '导入用' }],
      cards: [{ term: '导入演示卡', type: 'meme', meaning: '走查导入用的假词卡', example: '', source: 'preview', hero: '不存在的人物' }],
      quotes: [{ text: '导入演示名言', author: '演示', hero: '', src: 'preview' }],
      heroes: [],
    },
  })};
window.__pvAuth = { user: ${JSON.stringify(DEFAULT_USER)}, pass: ${JSON.stringify(DEFAULT_PASSWORD)} };
window.__core = {};
(function(){ function load(name, code){ var m={exports:{}}; new Function("module","exports","require",code)(m, m.exports, function(p){ return window.__core[p.replace(/^.*\\/(.*)$/, "$1")]; }); window.__core[name]=m.exports; }
load("tokenizer", ${JSON.stringify(tokSrc)});
load("translator", ${JSON.stringify(traSrc)}); })();
window.translateText = window.__core.translator.translateText;

(function () {
  var seq = 900000;
  var unlocked = false;
  var fails = 0;
  var lockLeft = 0;
  var prefs = {};
  var history = [];
  var pendingUndo = null;
  var pendingImport = null;
  var snapshots = [
    { name: 'linyu.db.bak1', size: 55296, mtime: new Date(Date.now() - 3600000).toISOString(), slot: 1 },
    { name: 'linyu.db.bak2', size: 54012, mtime: new Date(Date.now() - 86400000).toISOString(), slot: 2 }
  ];
  function uid() { return ++seq; }
  function ok(d) { return Promise.resolve({ ok: true, data: d }); }
  function bad(m) { return Promise.resolve({ ok: false, error: m }); }
  function status() {
    return { unlocked: unlocked, user: window.__pvAuth.user, needsSetup: false, defaultPass: true, lockLeft: lockLeft };
  }
  // 与主进程一致的写操作门禁 + mustOk 语义，便于在浏览器里验证「未登录不能改」和校验报错
  function gate(fn) {
    if (!unlocked) return bad('请先在「设置 → 开发者模式」中登录开发者账号');
    var res;
    try { res = fn(); } catch (e) { return bad(e.message); }
    if (res && res.error) return bad(res.error);
    if (res && res.undo) pendingUndo = { undo: res.undo, at: Date.now() };
    return ok(res);
  }
  function trim(v) { return String(v == null ? '' : v).trim(); }
  function dup(list, key, val, skipId) {
    for (var i = 0; i < list.length; i++) if (list[i][key] === val && list[i].id !== skipId) return true;
    return false;
  }
  function find(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function removeAndSnapshot(list, id, kind, keyCol) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].id !== id) continue;
      var row = list.splice(i, 1)[0];
      var snap = JSON.parse(JSON.stringify(row));
      snap.id = row.id;
      return { ok: true, undo: { kind: kind, rows: [snap], label: String(row[keyCol] || '') } };
    }
    return { error: '内容不存在或已被删除' };
  }
  function doUndo() {
    if (!pendingUndo) return { error: '没有可撤销的操作了' };
    if (Date.now() - pendingUndo.at > 60000) { pendingUndo = null; return { error: '撤销时间已过，请重新添加内容' }; }
    var slot = pendingUndo; pendingUndo = null;
    var u = slot.undo;
    var list = u.kind === 'word' ? window.__pv.words
      : u.kind === 'rule' ? window.__pv.rules
      : u.kind === 'card' ? window.__pv.cards
      : u.kind === 'quote' ? window.__pv.quotes
      : u.kind === 'hero' ? window.__pv.heroes
      : history;
    for (var i = 0; i < u.rows.length; i++) {
      var row = JSON.parse(JSON.stringify(u.rows[i]));
      var at = list.findIndex(function (x) { return x.id >= row.id; });
      if (at < 0) list.push(row); else list.splice(at, 0, row);
    }
    return { ok: true, restored: u.rows.length, kind: u.kind, label: u.label };
  }
  function normHero(h) {
    return {
      name: trim(h.name), alias: h.alias || '', rank: h.rank || '', intro: h.intro || '',
      baike: h.baike || '', tags: h.tags || [], works: h.works || [], words: h.words || [],
      img: h.img || '', group: h.group || 'real', links: h.links || []
    };
  }
  var SECTION_KEY = { words: 'zh', rules: 'pattern', cards: 'term', quotes: 'body', heroes: 'name' };
  var SECTION_LABEL = { words: '词库', rules: '句式', cards: '词卡', quotes: '名言', heroes: '人物传' };
  var LIST_OF = { words: 'words', rules: 'rules', cards: 'cards', quotes: 'quotes', heroes: 'heroes' };
  function quoteKey(q) { return q.body != null ? q.body : q.text; }
  function planImport(payload, strategy) {
    var sections = [];
    var problems = [];
    for (var key in SECTION_KEY) {
      var rows = window.__pv[LIST_OF[key]];
      var keyCol = key === 'quotes' ? 'text' : SECTION_KEY[key];
      var idx = {};
      for (var i = 0; i < rows.length; i++) idx[String(rows[i][keyCol])] = rows[i];
      var add = 0, update = 0, skip = 0;
      var list = (payload.data && payload.data[key]) || [];
      for (var j = 0; j < list.length; j++) {
        var item = list[j];
        var id = key === 'quotes' ? quoteKey(item) : item[SECTION_KEY[key]];
        if (!id) { problems.push(SECTION_LABEL[key] + '：有条目缺少主键'); continue; }
        var before = idx[String(id)];
        if (!before) add++;
        else if (strategy === 'add-only') skip++;
        else if (JSON.stringify(before) === JSON.stringify(Object.assign({}, before, item))) skip++;
        else update++;
      }
      sections.push({ key: key, label: SECTION_LABEL[key], add: add, update: update, skip: skip, total: list.length });
    }
    return { sections: sections, problems: problems, strategy: strategy };
  }
  function applyImport(strategy) {
    var payload = pendingImport.payload;
    pendingImport = null;
    var result = { add: 0, update: 0, skip: 0 };
    for (var key in SECTION_KEY) {
      var rows = window.__pv[LIST_OF[key]];
      var keyCol = key === 'quotes' ? 'text' : SECTION_KEY[key];
      var list = (payload.data && payload.data[key]) || [];
      for (var j = 0; j < list.length; j++) {
        var item = JSON.parse(JSON.stringify(list[j]));
        var id = key === 'quotes' ? quoteKey(item) : item[SECTION_KEY[key]];
        if (!id) continue;
        var hit = null;
        for (var i = 0; i < rows.length; i++) if (String(rows[i][keyCol]) === String(id)) { hit = rows[i]; break; }
        if (!hit) {
          item.id = uid();
          if (key === 'quotes') { item.text = quoteKey(item); delete item.body; }
          rows.push(item);
          result.add++;
        } else if (strategy === 'merge') {
          for (var k in item) if (k !== 'id') hit[k] = item[k];
          result.update++;
        } else result.skip++;
      }
    }
    return result;
  }
  function undoReady() { return Boolean(pendingUndo && unlocked && Date.now() - pendingUndo.at <= 60000); }
  window.api = {
    translate: function (t, mode) {
      var trace = unlocked ? [] : null;
      var uncovered = unlocked ? [] : null;
      var dst = window.translateText(t, { words: window.__pv.words, rules: window.__pv.rules, trace: trace, uncovered: uncovered });
      if (mode !== 'preview' && String(t || '').trim()) history.unshift({ id: uid(), src: String(t), dst: dst, created_at: new Date().toISOString() });
      return ok({ dst: dst, preview: mode === 'preview', trace: trace, uncovered: uncovered });
    },
    authStatus: function () { return ok(status()); },
    meta: function () { return ok({ defaultUser: window.__pvAuth.user, defaultPassword: window.__pvAuth.pass, version: 'preview', historyLimit: 200 }); },
    login: function (u, p) {
      if (lockLeft > 0) return bad('尝试过于频繁，请稍后再试');
      if (trim(u) === window.__pvAuth.user && p === window.__pvAuth.pass) {
        fails = 0; lockLeft = 0; unlocked = true;
        return ok(status());
      }
      fails += 1;
      if (fails >= 5) { lockLeft = 30; fails = 0; return bad('账号或密码错误，已锁定 30 秒'); }
      return bad('账号或密码错误（还可尝试 ' + (5 - fails) + ' 次）');
    },
    logout: function () { unlocked = false; pendingUndo = null; return ok(status()); },
    changePassword: function (oldP, newP) {
      return gate(function () {
        if (oldP !== window.__pvAuth.pass) return { error: '原密码不正确' };
        if (String(newP || '').length < 6) return { error: '新密码至少 6 位' };
        window.__pvAuth.pass = String(newP);
        return { ok: true };
      });
    },
    syncSeed: function () { return gate(function () { return { ok: true, added: 0 }; }); },
    undoDelete: function () { return gate(function () { return doUndo(); }); },
    undoState: function () { return ok({ available: undoReady(), label: pendingUndo ? pendingUndo.undo.label : '' }); },

    listWords: function () { return ok(window.__pv.words.slice()); },
    addWord: function (zh, ly) {
      return gate(function () {
        zh = trim(zh); ly = trim(ly);
        if (!zh || !ly) return { error: '中文和淋语都不能为空' };
        if (dup(window.__pv.words, 'zh', zh)) return { error: '词条「' + zh + '」已存在' };
        window.__pv.words.push({ id: uid(), zh: zh, linyu: ly });
        return { ok: true };
      });
    },
    updateWord: function (id, ly, zh) {
      return gate(function () {
        var w = find(window.__pv.words, id);
        if (!w) return { error: '词条不存在' };
        ly = trim(ly);
        if (!ly) return { error: '淋语不能为空' };
        if (zh != null && trim(zh)) {
          zh = trim(zh);
          if (dup(window.__pv.words, 'zh', zh, id)) return { error: '词条「' + zh + '」已存在' };
          w.zh = zh;
        }
        w.linyu = ly;
        return { ok: true };
      });
    },
    deleteWord: function (id) {
      return gate(function () { return removeAndSnapshot(window.__pv.words, id, 'word', 'zh'); });
    },

    listRules: function () { return ok(window.__pv.rules.slice()); },
    addRule: function (p, t, n) {
      return gate(function () {
        p = trim(p); t = trim(t);
        if (!p || !t) return { error: '正则和模板都不能为空' };
        try { new RegExp(p); } catch (e) { return { error: '正则表达式非法' }; }
        if (dup(window.__pv.rules, 'pattern', p)) return { error: '规则「' + p + '」已存在' };
        window.__pv.rules.push({ id: uid(), pattern: p, template: t, note: trim(n) });
        return { ok: true };
      });
    },
    updateRule: function (id, t, n, p) {
      return gate(function () {
        var r = find(window.__pv.rules, id);
        if (!r) return { error: '句式不存在' };
        t = trim(t);
        if (!t) return { error: '模板不能为空' };
        if (p != null && trim(p)) {
          p = trim(p);
          try { new RegExp(p); } catch (e) { return { error: '正则表达式非法' }; }
          if (dup(window.__pv.rules, 'pattern', p, id)) return { error: '规则「' + p + '」已存在' };
          r.pattern = p;
        }
        r.template = t;
        r.note = trim(n);
        return { ok: true };
      });
    },
    deleteRule: function (id) {
      return gate(function () { return removeAndSnapshot(window.__pv.rules, id, 'rule', 'pattern'); });
    },

    listCards: function () { return ok(window.__pv.cards.slice()); },
    addCard: function (c) {
      return gate(function () {
        c = c || {};
        var term = trim(c.term);
        if (!term) return { error: '词名不能为空' };
        if (!trim(c.meaning)) return { error: '释义不能为空' };
        if (dup(window.__pv.cards, 'term', term)) return { error: '词卡「' + term + '」已存在' };
        window.__pv.cards.push({ id: uid(), term: term, type: c.type || 'slang', meaning: trim(c.meaning), example: c.example || '', source: c.source || '', hero: c.hero || '' });
        return { ok: true };
      });
    },
    updateCard: function (id, c) {
      return gate(function () {
        var card = find(window.__pv.cards, id);
        if (!card) return { error: '词卡不存在' };
        c = c || {};
        var term = trim(c.term);
        if (!term) return { error: '词名不能为空' };
        if (!trim(c.meaning)) return { error: '释义不能为空' };
        if (dup(window.__pv.cards, 'term', term, id)) return { error: '词卡「' + term + '」已存在' };
        card.term = term;
        card.type = c.type || 'slang';
        card.meaning = trim(c.meaning);
        card.example = c.example || '';
        card.source = c.source || '';
        card.hero = c.hero || '';
        return { ok: true };
      });
    },
    deleteCard: function (id) {
      return gate(function () { return removeAndSnapshot(window.__pv.cards, id, 'card', 'term'); });
    },

    listQuotes: function () { return ok(window.__pv.quotes.slice()); },
    addQuote: function (q) {
      return gate(function () {
        q = q || {};
        var body = trim(q.text);
        if (!body) return { error: '名言内容不能为空' };
        var c = window.__pv.quotes;
        for (var i = 0; i < c.length; i++) if (c[i].text === body) return { error: '这条名言已存在' };
        c.push({ id: uid(), text: body, author: q.author || '', hero: q.hero || '', src: q.src || '' });
        return { ok: true };
      });
    },
    updateQuote: function (id, q) {
      return gate(function () {
        var row = find(window.__pv.quotes, id);
        if (!row) return { error: '名言不存在' };
        q = q || {};
        var body = trim(q.text);
        if (!body) return { error: '名言内容不能为空' };
        for (var i = 0; i < window.__pv.quotes.length; i++) {
          var it = window.__pv.quotes[i];
          if (it.id !== id && it.text === body) return { error: '这条名言已存在' };
        }
        row.text = body;
        row.author = q.author || '';
        row.hero = q.hero || '';
        row.src = q.src || '';
        return { ok: true };
      });
    },
    deleteQuote: function (id) {
      return gate(function () { return removeAndSnapshot(window.__pv.quotes, id, 'quote', 'text'); });
    },

    listHeroes: function () { return ok(window.__pv.heroes.slice()); },
    addHero: function (h) {
      return gate(function () {
        h = h || {};
        var name = trim(h.name);
        if (!name) return { error: '英雄名字不能为空' };
        if (dup(window.__pv.heroes, 'name', name)) return { error: '英雄「' + name + '」已存在' };
        var row = normHero(h);
        row.id = uid();
        window.__pv.heroes.push(row);
        return { ok: true };
      });
    },
    updateHero: function (id, h) {
      return gate(function () {
        var row = find(window.__pv.heroes, id);
        if (!row) return { error: '英雄不存在' };
        h = h || {};
        var name = trim(h.name);
        if (!name) return { error: '英雄名字不能为空' };
        if (dup(window.__pv.heroes, 'name', name, id)) return { error: '英雄「' + name + '」已存在' };
        var next = normHero(h);
        for (var k in next) row[k] = next[k];
        return { ok: true };
      });
    },
    deleteHero: function (id) {
      return gate(function () { return removeAndSnapshot(window.__pv.heroes, id, 'hero', 'name'); });
    },

    inspect: function () {
      var heroNames = {};
      window.__pv.heroes.forEach(function (h) { heroNames[h.name] = 1; });
      var zhSet = {};
      window.__pv.words.forEach(function (w) { zhSet[w.zh] = 1; });
      var invalid = window.__pv.words.filter(function (w) { return w.zh === w.linyu; });
      var byLy = {};
      window.__pv.words.forEach(function (w) { (byLy[w.linyu] = byLy[w.linyu] || []).push(w); });
      var dupLy = Object.keys(byLy).filter(function (k) { return byLy[k].length > 1; }).map(function (k) {
        return { linyu: k, items: byLy[k].map(function (w) { return { id: w.id, zh: w.zh }; }) };
      });
      var oc = window.__pv.cards.filter(function (c) { return c.hero && !heroNames[c.hero]; });
      var oq = window.__pv.quotes.filter(function (q) { return q.hero && !heroNames[q.hero]; });
      var oh = [];
      window.__pv.heroes.forEach(function (h) {
        var miss = (h.words || []).filter(function (z) { return !zhSet[z]; });
        if (miss.length) oh.push({ hero: h.name, missing: miss });
      });
      return ok({
        invalidWords: invalid.slice(0, 60), dupLinyu: dupLy.slice(0, 40),
        orphanCards: oc.slice(0, 60), orphanQuotes: oq.slice(0, 60), orphanHeroWords: oh.slice(0, 60),
        totals: { invalidWords: invalid.length, dupLinyu: dupLy.reduce(function (n, g) { return n + g.items.length; }, 0),
          orphanCards: oc.length, orphanQuotes: oq.length, orphanHeroWords: oh.reduce(function (n, g) { return n + g.missing.length; }, 0) }
      });
    },
    cleanHeroWords: function (list) {
      return gate(function () {
        var fixed = 0;
        (list || []).forEach(function (item) {
          var h = null;
          for (var i = 0; i < window.__pv.heroes.length; i++) if (window.__pv.heroes[i].name === item.hero) { h = window.__pv.heroes[i]; break; }
          if (!h) return;
          var drop = item.missing || [];
          h.words = (h.words || []).filter(function (z) { return drop.indexOf(z) < 0; });
          fixed++;
        });
        return { ok: true, fixed: fixed };
      });
    },
    exportData: function () {
      return gate(function () {
        return { canceled: false, file: 'C:\\\\temp\\\\淋语数据-preview.json', counts: {
          words: window.__pv.words.length, rules: window.__pv.rules.length, cards: window.__pv.cards.length,
          quotes: window.__pv.quotes.length, heroes: window.__pv.heroes.length }, media: 0 };
      });
    },
    pickImport: function () {
      var payload = window.__pvImportPayload || window.__pvSampleExport;
      pendingImport = { payload: JSON.parse(JSON.stringify(payload)) };
      var plan = planImport(pendingImport.payload, 'merge');
      return ok({ canceled: false, file: 'C:\\\\temp\\\\导入文件.json', sections: plan.sections, problems: plan.problems, strategy: 'merge' });
    },
    replanImport: function (opts) {
      if (!pendingImport) return bad('请先重新选择导入文件');
      var strategy = (opts && opts.strategy) || 'merge';
      var plan = planImport(pendingImport.payload, strategy);
      return ok({ canceled: false, file: 'C:\\\\temp\\\\导入文件.json', sections: plan.sections, problems: plan.problems, strategy: strategy });
    },
    applyImport: function (opts) {
      return gate(function () {
        if (!pendingImport) return { error: '请先重新选择导入文件' };
        var r = applyImport((opts && opts.strategy) || 'merge');
        return Object.assign({ ok: true }, r);
      });
    },
    cancelImport: function () { pendingImport = null; return ok({ ok: true }); },

    listBackups: function () { return ok(snapshots.slice()); },
    restoreBackup: function () { return gate(function () { return { ok: true }; }); },
    restoreBefore: function () { return gate(function () { return { ok: true }; }); },

    pickImage: function () { return gate(function () { return { canceled: true }; }); },
    mediaData: function () { return bad('预览环境不读取本地图片'); },

    listHistory: function () { return ok(history.slice()); },
    clearHistory: function () {
      return gate(function () {
        var rows = history.slice();
        history = [];
        return { ok: true, undo: { kind: 'history', rows: rows, label: '翻译历史' } };
      });
    },

    initOrientation: function () { return ok({ type: 'portrait', locked: true, autoRotate: false }); },
    setOrientation: function (t) { return ok({ type: t || 'portrait', locked: true, autoRotate: false }); },
    setAutoRotate: function (on) { return ok({ type: 'portrait', locked: !on, autoRotate: !!on }); },
    onOrientationChange: function () { return function () {}; },

    getPrefs: function () { return ok(Object.assign({}, prefs)); },
    setPref: function (k, v) { prefs[String(k)] = String(v); return ok({ ok: true }); },
    openLogs: function () { return ok({ dir: 'C:\\\\temp\\\\logs', tail: '' }); },
    openExternal: function (u) { console.log('open', u); return ok(true); },
  };
})();
`;

  fs.writeFileSync(path.join(OUT, '_stub.js'), stub, 'utf8');

  let html = fs.readFileSync(path.join(__dirname, '..', 'www', 'index.html'), 'utf8');
  html = html
    // 预览的 _stub.js 用 new Function 注入 tokenizer/translator；生产 CSP 只放 wasm-unsafe-eval，
    // 预览页临时放行 unsafe-eval（不改 src/renderer/index.html 的生产 CSP）。
    .replace("script-src 'self' 'wasm-unsafe-eval'", "script-src 'self' 'unsafe-eval'")
    // 预览用 _stub.js 直接提供 window.api；entry.js 会异步建真库并把 stub 换掉
    .replace(/\s*<script src="mobile\/entry\.js"><\/script>/, '')
    .replace('../../node_modules/vue/dist/vue.global.prod.js', 'vue.global.prod.js')
    .replace('<script src="app.js"></script>', '<script src="_stub.js"></script>\n  <script src="app.js"></script>');
  fs.writeFileSync(path.join(OUT, '_preview.html'), html, 'utf8');
  console.log(
    `预览已生成：${path.join(OUT, '_preview.html')}（${data.words.length} 词条 / ${data.rules.length} 句式 / ` +
      `${data.cards.length} 词卡 / ${data.heroes.length} 英雄 / ${data.quotes.length} 名言）`
  );
})().catch((err) => {
  console.error('预览生成失败：', err);
  process.exit(1);
});
