// @ts-check
'use strict';

// 库实现不直接依赖 node 的 fs / path / sql.js。
// 桌面 Electron 走 require('../mobile/fsAdapter') + require('sql.js') + require('./seed.json') + require('./lore')。
// 移动 WebView 走全局 fsAdapter / initSqlJs / SEED_DATA / LORE_DATA（在 src/mobile/entry.js 里挂好）。

let initSqlJs;
let fsAdapter;
let linyuScrypt;
let SEED_DATA;
let LORE_DATA;
let DEPRECATED = {};
let sysPath;

if (typeof module === 'object' && module && module.exports) {
  initSqlJs = require('sql.js');
  fsAdapter = require('../mobile/fsAdapter');
  linyuScrypt = require('../mobile/scrypt');
  SEED_DATA = require('./seed.json');
  LORE_DATA = require('./lore');
  DEPRECATED = require('./deprecated') || {};
  sysPath = require('path');
} else {
  initSqlJs = window.initSqlJs;
  // fsAdapter 不能用 window.fsAdapter 直接捕获：本文件在 index.html 里的加载位置早于
  // entry 层（src/mobile/entry.js / src/web/webEntry.js），而适配器正是由 entry 选定的。
  // 捕获的话拿到的是 mobile/fsAdapter.js 挂的 Capacitor 版，等 entry 换成 IndexedDB 版
  // 之后这里仍指向旧对象 —— 浏览器里调用 .exists() 直接抛
  // "Cannot read properties of undefined (reading 'Plugins')"，导致 createDb 整个失败、
  // 词库 0 条。改成每次调用时从 window 取，谁最后挂上就用谁。
  fsAdapter = {
    get kind() { return window.fsAdapter && window.fsAdapter.kind; },
    dirOf: (p) => window.fsAdapter.dirOf(p),
    basenameOf: (p) => window.fsAdapter.basenameOf(p),
    read: (p) => window.fsAdapter.read(p),
    readSync: (p) => window.fsAdapter.readSync(p),
    write: (p, b) => window.fsAdapter.write(p, b),
    writeSync: (p, b) => window.fsAdapter.writeSync(p, b),
    unlink: (p) => window.fsAdapter.unlink(p),
    rename: (a, b) => window.fsAdapter.rename(a, b),
    copy: (a, b) => window.fsAdapter.copy(a, b),
    readdir: (p) => window.fsAdapter.readdir(p),
    readdirSync: (p) => window.fsAdapter.readdirSync(p),
    stat: (p) => window.fsAdapter.stat(p),
    statSync: (p) => window.fsAdapter.statSync(p),
    exists: (p) => window.fsAdapter.exists(p),
    existsSync: (p) => window.fsAdapter.existsSync(p),
    mkdirp: (p) => window.fsAdapter.mkdirp(p),
  };
  linyuScrypt = window.linyuScrypt;
  SEED_DATA = window.SEED_DATA;
  LORE_DATA = window.LORE_DATA;
  DEPRECATED = window.LINYU_DEPRECATED || {};
  sysPath = null;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS words (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  zh TEXT NOT NULL UNIQUE,
  linyu TEXT NOT NULL,
  alias TEXT DEFAULT '',
  sense TEXT DEFAULT '',
  source TEXT DEFAULT '',
  pop TEXT DEFAULT '',
  rel TEXT DEFAULT '[]',
  slot TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pattern TEXT NOT NULL UNIQUE,
  template TEXT NOT NULL,
  note TEXT DEFAULT '',
  scene TEXT DEFAULT '',
  examples TEXT DEFAULT '',
  src TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  src TEXT NOT NULL,
  dst TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  term TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL DEFAULT 'slang',
  meaning TEXT NOT NULL DEFAULT '',
  example TEXT DEFAULT '',
  source TEXT DEFAULT '',
  hero TEXT DEFAULT '',
  aliases TEXT DEFAULT '[]',
  detail TEXT DEFAULT '',
  rel TEXT DEFAULT '[]'
);
CREATE TABLE IF NOT EXISTS quotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  body TEXT NOT NULL,
  author TEXT DEFAULT '',
  hero TEXT DEFAULT '',
  src TEXT DEFAULT '',
  scene TEXT DEFAULT '',
  rel TEXT DEFAULT '[]'
);
CREATE TABLE IF NOT EXISTS heroes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  alias TEXT DEFAULT '',
  rank TEXT DEFAULT '',
  intro TEXT DEFAULT '',
  baike TEXT DEFAULT '',
  tags TEXT DEFAULT '[]',
  works TEXT DEFAULT '[]',
  words TEXT DEFAULT '[]',
  img TEXT DEFAULT '',
  grp TEXT DEFAULT 'real',
  links TEXT DEFAULT '[]'
);
CREATE TABLE IF NOT EXISTS settings (
  k TEXT PRIMARY KEY,
  v TEXT
);
CREATE TABLE IF NOT EXISTS deleted (
  kind TEXT NOT NULL,
  key TEXT NOT NULL,
  PRIMARY KEY (kind, key)
);
`;

const DEFAULT_HISTORY_LIMIT = 200;
const BACKUP_KEEP = 2;
const BACKUP_RE = /^linyu\.db\.bak(\d+)$/;
// 界面偏好存 settings 表，但只有白名单键可被渲染层读写（开发者账号凭据也在 settings 里，不能被当成偏好暴露出去）
const PREF_KEYS = new Set([
  'win.bounds',
  'win.maximized',
  'last.view',
  'history.limit',
  'ui.theme',
  'ui.live',
  'ui.autoRotate',
]);

const SECTIONS = {
  words: { table: 'words', keyCol: 'zh', label: '词库' },
  rules: { table: 'rules', keyCol: 'pattern', label: '句式' },
  cards: { table: 'cards', keyCol: 'term', label: '词卡' },
  quotes: { table: 'quotes', keyCol: 'body', label: '名言' },
  heroes: { table: 'heroes', keyCol: 'name', label: '人物传' },
};

const UNDO_KIND = {
  word: 'words',
  rule: 'rules',
  card: 'cards',
  quote: 'quotes',
  hero: 'heroes',
  history: 'history',
};

function clampLimit(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_HISTORY_LIMIT;
  return Math.min(2000, Math.max(50, Math.round(n)));
}

// sql.js 不带 locateFile 时会把 wasm 解析成"当前调用脚本所在目录/sql-wasm.wasm"，
// WebView 里就是 mobile/sql-wasm.wasm → 404，库根本打不开。按 <script src="vendor/sql-wasm.js">
// 自己的地址定位，wasm 永远和它同级；Node 分支交给 sql.js 用 __dirname 找，不要传。
function sqlJsOptions() {
  if (sysPath) return undefined;
  const tag = typeof document !== 'undefined' && document.querySelector &&
    (/** @type {HTMLScriptElement | null} */ (document.querySelector('script[src*="sql-wasm.js"]')));
  const base = tag ? new URL('.', tag.src).href : new URL('vendor/', document.baseURI).href;
  return {
    locateFile: (file) => {
      const u = new URL(file, base);
      // 分享链接部署（app.workbuddy.host?sharecode=…）下，平台对子资源也校验 sharecode：
      // 没带参数的请求返回 403 + 一段错误 HTML。wasm 的 URL 是 sql.js 在运行时拼出来的，
      // 不会自动继承页面参数 —— 一旦 Cookie 缺失就拿到 HTML 去实例化 wasm，必然失败。
      try {
        const sc = new URLSearchParams(location.search).get('sharecode');
        if (sc && !u.searchParams.has('sharecode')) u.searchParams.set('sharecode', sc);
      } catch { /* 非浏览器环境或 location 不可用时忽略 */ }
      return u.href;
    },
  };
}

async function createDb({ filePath, seed, lore, onPersistError, version }) {
  const SQL = await initSqlJs(sqlJsOptions());

  // 读库之前先滚动备份，bak1 就是「上一次正常退出的状态」，本次会话改坏了也能退回去
  function backupDir() {
    return filePath ? fsAdapter.dirOf(filePath) : null;
  }

  async function rotateBackups() {
    if (!filePath) return;
    const exists = await fsAdapter.exists(filePath);
    if (!exists) return;
    for (let i = BACKUP_KEEP - 1; i >= 1; i--) {
      const from = `${filePath}.bak${i}`;
      const to = `${filePath}.bak${i + 1}`;
      if (await fsAdapter.exists(from)) await fsAdapter.rename(from, to);
    }
    await fsAdapter.copy(filePath, `${filePath}.bak1`);
  }

  // 半截/损坏的库文件不能让应用启动失败：先试着读，读不通就 quarantine 原件，再从滚动备份里捞最近能用的一份。
  // 注意顺序：必须先确认当前文件可用，再滚动备份，否则坏文件会把唯一的好备份覆盖掉。
  async function loadUsable(file) {
    const bytes = await fsAdapter.read(file);
    const loaded = new SQL.Database(bytes);
    loaded.exec('SELECT COUNT(*) FROM sqlite_master');
    return loaded;
  }

  let db = null;
  let recovery = null;
  let fromCurrent = false;
  if (filePath && (await fsAdapter.exists(filePath))) {
    try {
      db = await loadUsable(filePath);
      fromCurrent = true;
    } catch (err) {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const quarantine = `${filePath}.broken-${stamp}`;
      let kept = '';
      try {
        const dir = fsAdapter.dirOf(filePath);
        if (dir) await fsAdapter.mkdirp(dir);
        const quarantineBytes = await fsAdapter.read(filePath);
        await fsAdapter.write(quarantine, quarantineBytes);
        await fsAdapter.unlink(filePath);
        kept = fsAdapter.basenameOf(quarantine);
      } catch {
        /* 改不动就留着，下一步靠备份重建 */
      }
      for (let i = 1; i <= BACKUP_KEEP && !db; i++) {
        const bak = `${filePath}.bak${i}`;
        if (!(await fsAdapter.exists(bak))) continue;
        try {
          db = await loadUsable(bak);
          recovery = { fromBackup: fsAdapter.basenameOf(bak), quarantine: kept, reason: String((err && err.message) || err) };
        } catch {
          /* 这一份也坏了，试下一份 */
        }
      }
      if (!db) recovery = { fromBackup: '', quarantine: kept, reason: String((err && err.message) || err) };
    }
  }
  if (!db) db = new SQL.Database();
  if (fromCurrent) {
    try {
      await rotateBackups();
    } catch (err) {
      if (onPersistError) onPersistError('backup', err);
    }
  }

  // 老库的表建好时还没有后来新增的列；CREATE TABLE IF NOT EXISTS 只负责建表，
  // 不会给已存在的表补列，所以必须显式 ALTER。补列抛错说明列已存在，忽略即可。
  // 用数据表驱动而不是手写 try/catch：漏一列不会报错，只会在升级后静默地"存不进去"。
  const NEW_COLUMNS = [
    ['words', 'alias', "TEXT DEFAULT ''"],
    ['words', 'sense', "TEXT DEFAULT ''"],
    ['words', 'source', "TEXT DEFAULT ''"],
    ['words', 'pop', "TEXT DEFAULT ''"],
    ['words', 'rel', "TEXT DEFAULT '[]'"],
    ['words', 'slot', "TEXT DEFAULT ''"],
    ['rules', 'scene', "TEXT DEFAULT ''"],
    ['rules', 'examples', "TEXT DEFAULT ''"],
    ['rules', 'src', "TEXT DEFAULT ''"],
    ['cards', 'aliases', "TEXT DEFAULT '[]'"],
    ['cards', 'detail', "TEXT DEFAULT ''"],
    ['cards', 'rel', "TEXT DEFAULT '[]'"],
    ['quotes', 'scene', "TEXT DEFAULT ''"],
    ['quotes', 'rel', "TEXT DEFAULT '[]'"],
  ];

  function ensureColumns() {
    for (const [table, col, decl] of NEW_COLUMNS) {
      try {
        db.run('ALTER TABLE ' + table + ' ADD COLUMN ' + col + ' ' + decl);
      } catch {
        /* 列已存在 */
      }
    }
    // heroes 不加新列：它的 name/alias/intro/works/words 已经覆盖了人物传的全部字段，
    // 再加一份 relWords 只会和 heroes.words 重复，反而多一处可能对不上的数据。
  }

  db.run(SCHEMA);
  ensureColumns();

  if (recovery && onPersistError) onPersistError('recover', new Error(JSON.stringify(recovery)));

  function isEmpty(table) {
    return Number(db.exec('SELECT COUNT(*) FROM ' + table)[0].values[0][0]) === 0;
  }

  // 流行度只认三个档位，写进来的自由文本在读出去时会被归一，免得筛选时冒出第四种值
  const POP_LEVELS = new Set(['高', '中', '低']);
  function normPop(v) {
    const s = String(v == null ? '' : v).trim();
    return POP_LEVELS.has(s) ? s : '';
  }

  // 「关联词条」既可能来自表单的顿号串，也可能来自导入文件的数组，两边都收成去空的字符串数组
  function relList(v) {
    const raw = Array.isArray(v) ? v : String(v == null ? '' : v).split(/[\n,，、]/);
    const seen = new Set();
    for (const s of raw) {
      const t = String(s == null ? '' : s).trim();
      if (t) seen.add(t);
    }
    return [...seen];
  }

  function wordArgs(w) {
    return [
      String(w.zh || '').trim(),
      String(w.linyu || '').trim(),
      String(w.alias || ''),
      String(w.sense || ''),
      String(w.source || ''),
      normPop(w.pop),
      JSON.stringify(relList(w.rel)),
      String(w.slot || ''),
    ];
  }

  function ruleArgs(r) {
    return [
      String(r.pattern || '').trim(),
      String(r.template || '').trim(),
      String(r.note || ''),
      String(r.scene || ''),
      String(r.examples || ''),
      String(r.src || ''),
    ];
  }

  // 各 add* 的 catch 原本是无脑的：任何 SQL 失败都报「已存在」。
  // 删列改表时漏改一处 INSERT，报错就变成"这个词卡已经存在"，与真实原因（列数不匹配）
  // 完全无关，白查半天。只有约束冲突才报重复，其余把原始错误透出来。
  function dupOr(err, msg) {
    const s = String((err && err.message) || err);
    return /UNIQUE|constraint/i.test(s) ? msg : s;
  }

  function cardArgs(c) {
    return [
      String(c.term || '').trim(),
      String(c.type || 'slang'),
      String(c.meaning || '').trim(),
      String(c.example || ''),
      String(c.source || ''),
      String(c.hero || ''),
      JSON.stringify(relList(c.aliases)),
      String(c.detail || ''),
      JSON.stringify(relList(c.rel)),
    ];
  }

  function quoteArgs(q) {
    return [
      String(q.text != null ? q.text : q.body || '').trim(),
      String(q.author || ''),
      String(q.hero || ''),
      String(q.src || ''),
      String(q.scene || ''),
      JSON.stringify(relList(q.rel)),
    ];
  }

  // 条目没写 hero 时按来源推断一个（推断规则见 lore.js）。落库之后它在人物详情页里
  // 就是一条真实关联，开发者也能在界面上改，而不是每次打开都重新猜一遍。
  function resolveCardHero(c) {
    if (c.hero || !lore || typeof lore.inferCardHero !== 'function') return c;
    const hero = lore.inferCardHero(c);
    return hero ? Object.assign({}, c, { hero }) : c;
  }

  function resolveQuoteHero(q) {
    if (q.hero || !lore || typeof lore.inferQuoteHero !== 'function') return q;
    const hero = lore.inferQuoteHero(q);
    return hero ? Object.assign({}, q, { hero }) : q;
  }

  const WORD_COLS = 'id, zh, linyu, alias, sense, source, pop, rel, slot';
  const RULE_COLS = 'id, pattern, template, note, scene, examples, src';
  const CARD_COLS = 'id, term, type, meaning, example, source, hero, aliases, detail, rel';

  function seedWordsRules() {
    const insW = db.prepare('INSERT OR IGNORE INTO words (zh, linyu, alias, sense, source, pop, rel, slot) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    for (const w of seed.words) {
      if (isDeleted('word', w.zh)) continue;
      insW.run(wordArgs(w));
    }
    insW.free();
    const insR = db.prepare('INSERT OR IGNORE INTO rules (pattern, template, note, scene, examples, src) VALUES (?, ?, ?, ?, ?, ?)');
    for (const r of seed.rules) {
      if (isDeleted('rule', r.pattern)) continue;
      try {
        new RegExp(r.pattern);
      } catch {
        continue;
      }
      insR.run(ruleArgs(r));
    }
    insR.free();
  }

  // 播种也必须认 deleted：开发者删掉/改掉主键的内置条目不该在这条路径上复活，
  // 否则 seedLore 与 topUpFromSeed 对同一条目的判断就不一致了。
  function seedLore() {
    if (!lore) return;
    const insC = db.prepare('INSERT OR IGNORE INTO cards (term, type, meaning, example, source, hero, aliases, detail, rel) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    for (const c of lore.flashcards || []) {
      if (isDeleted('card', c.term)) continue;
      insC.run(cardArgs(resolveCardHero(c)));
    }
    insC.free();
    const insQ = db.prepare('INSERT OR IGNORE INTO quotes (body, author, hero, src, scene, rel) VALUES (?, ?, ?, ?, ?, ?)');
    for (const q of lore.quotes || []) {
      if (isDeleted('quote', q.text)) continue;
      insQ.run(quoteArgs(resolveQuoteHero(q)));
    }
    insQ.free();
    const insH = db.prepare('INSERT OR IGNORE INTO heroes (name, alias, rank, intro, baike, tags, works, words, img, grp, links) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    for (const h of lore.heroes || []) {
      if (isDeleted('hero', h.name)) continue;
      insH.run([
        h.name,
        h.alias || '',
        h.rank || '',
        h.intro || '',
        h.baike || '',
        JSON.stringify(h.tags || []),
        JSON.stringify(h.works || []),
        JSON.stringify(h.words || []),
        h.img || '',
        h.grp || h.group || 'real',
        JSON.stringify(h.links || []),
      ]);
    }
    insH.free();
  }

  // 同步任一条目到表内：已存在就跳过（不论新老）。专为升级后补种设计。
  function topUp(rows, table) {
    if (!lore || !rows || !rows.length) return 0;
    const conf = Object.values(SECTIONS).find((s) => s.table === table);
    if (!conf) return 0;
    const existing = new Set(all('SELECT ' + conf.keyCol + ' AS v FROM ' + table).map((r) => String(r.v)));
    let added = 0;
    if (table === 'words') {
      const ins = db.prepare('INSERT OR IGNORE INTO words (zh, linyu, alias, sense, source, pop, rel, slot) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
      for (const w of rows) {
        if (!w || !w.zh || existing.has(String(w.zh))) continue;
        // 用户改过主键或删过的内置条目不能再被补种回来：deleted 表记的是「这条已被用户主动处理过」
        if (isDeleted('word', String(w.zh))) continue;
        try { ins.run(wordArgs(w)); added++; } catch { /* 唯一约束被另一线程占用，跳过 */ }
      }
      ins.free();
    } else if (table === 'rules') {
      const ins = db.prepare('INSERT OR IGNORE INTO rules (pattern, template, note, scene, examples, src) VALUES (?, ?, ?, ?, ?, ?)');
      for (const r of rows) {
        if (!r || !r.pattern || existing.has(String(r.pattern))) continue;
        if (isDeleted('rule', String(r.pattern))) continue;
        try { new RegExp(r.pattern); } catch { continue; }
        try { ins.run(ruleArgs(r)); added++; } catch { /* 同上 */ }
      }
      ins.free();
    } else if (table === 'cards') {
      const ins = db.prepare('INSERT OR IGNORE INTO cards (term, type, meaning, example, source, hero, aliases, detail, rel) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
      for (const c of rows) {
        if (!c || !c.term || existing.has(String(c.term))) continue;
        if (isDeleted('card', String(c.term))) continue;
        try { ins.run(cardArgs(resolveCardHero(c))); added++; } catch { /* 同上 */ }
      }
      ins.free();
    } else if (table === 'quotes') {
      const ins = db.prepare('INSERT OR IGNORE INTO quotes (body, author, hero, src, scene, rel) VALUES (?, ?, ?, ?, ?, ?)');
      for (const q of rows) {
        if (!q || !q.text || existing.has(String(q.text))) continue;
        try { ins.run(quoteArgs(resolveQuoteHero(q))); added++; } catch { /* 同上 */ }
      }
      ins.free();
    } else if (table === 'heroes') {
      const ins = db.prepare('INSERT OR IGNORE INTO heroes (name, alias, rank, intro, baike, tags, works, words, img, grp, links) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      for (const h of rows) {
        if (!h || !h.name || existing.has(String(h.name))) continue;
        try {
          ins.run([
            h.name,
            h.alias || '',
            h.rank || '',
            h.intro || '',
            h.baike || '',
            JSON.stringify(h.tags || []),
            JSON.stringify(h.works || []),
            JSON.stringify(h.words || []),
            h.img || '',
            h.grp || h.group || 'real',
            JSON.stringify(h.links || []),
          ]);
          added++;
        } catch { /* 同上 */ }
      }
      ins.free();
    }
    return added;
  }

  function topUpFromSeed() {
    if (!lore) return 0;
    let added = 0;
    added += topUp(seed.words, 'words');
    added += topUp(seed.rules, 'rules');
    added += topUp(lore.flashcards, 'cards');
    added += topUp(lore.quotes, 'quotes');
    added += topUp(lore.heroes, 'heroes');
    return added;
  }

  // 初次启动时，库里一张表都还没有 → 才走 seedWordsRules；
  // 词库只在空表时播种。其他三个表（cards / quotes / heroes）任一为空就播种一遍。
  // 已经全部入库的旧库不再二次播种 —— 增量走 syncFromSeed / upgradeSeed。
  function seedIfFresh() {
    if (isEmpty('words') && seed) seedWordsRules();
    if (isEmpty('cards') || isEmpty('quotes') || isEmpty('heroes')) seedLore();
  }

  seedIfFresh();

  let persistOn = true;
  // ---- persist 防抖与队列 ----
  // 在异步 fsAdapter（indexeddb / capacitor）路径下，run() 多次快速调用会触发并发
  // persist()（最后一个不会等上一个写完 → 数据覆盖）。这里用串行队列保证每次 persist
  // 严格按顺序执行，且建了一个「最后一定写完」的保证：队列末尾永远是新请求，旧的过期
  // db.export() 会被合并（中间的 export 可以跳过）。Node 同步路径不受影响。
  let _persistSeq = 0;
  let _persistTail = null;

  function _enqueuePersist() {
    if (!filePath || !persistOn) return;
    // Node 同步路径不考虑队列
    if (fsAdapter.kind === 'node' && typeof fsAdapter.writeSync === 'function') {
      persistCore();
      return;
    }
    const token = ++_persistSeq;
    const prev = _persistTail;
    const p = (async () => {
      if (prev) {
        try { await prev; } catch { /* 上一轮挂了本轮继续试 */ }
      }
      // 这个 persist 在排队期间被更新请求取代了 → 跳过
      if (token !== _persistSeq) return;
      try { await persistCore(); }
      catch (err) { if (onPersistError) onPersistError('persist', err); }
    })();
    _persistTail = p;
    return p;
  }

  async function persist() {
    return _enqueuePersist();
  }

  async function persistCore() {
    if (!filePath || !persistOn) return;
    const bytes = db.export();
    const dir = fsAdapter.dirOf(filePath);
    if (dir) {
      try { await fsAdapter.mkdirp(dir); }
      catch (err) { if (onPersistError) onPersistError('mkdir', err); }
    }
    try {
      // 原子写：先到 .tmp，再 rename；rename 失败直接覆盖
      const tmp = filePath + '.tmp';
      await fsAdapter.write(tmp, bytes);
      try {
        await fsAdapter.rename(tmp, filePath);
      } catch (renameErr) {
        try { await fsAdapter.unlink(tmp); } catch { /* tmp 没建起来 */ }
        try { await fsAdapter.write(filePath, bytes); }
        catch (err2) {
          if (onPersistError) onPersistError('persist', err2);
          throw renameErr;
        }
      }
    } catch (err) {
      if (onPersistError) onPersistError('persist', err);
    }
  }

  // 批量写（补种、重排、导入）只落盘一次，避免每条都全库导出
  function batch(fn) {
    const prev = persistOn;
    persistOn = false;
    try {
      fn();
    } finally {
      persistOn = prev;
      _enqueuePersist();
    }
  }

  // 种子数据播种后立即持久化——否则 IndexedDB 等异步适配器上
  // 只有等到用户做了修改才会触发首次 persist，刷新页面数据丢失。
  // Node 同步路径不受影响（同步写入已在 seedIfFresh 内完成）。
  persist();

  /**
   * 查一批行。返回 any[]：sql.js 的每一行字段取决于 SELECT 的列，
   * 在这里收窄成具体类型只会让上层的 Object.assign / map 推导更糟。
   * @param {string} sql
   * @param {any[]} [params]
   * @returns {any[]}
   */
  function all(sql, params = []) {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows.map((r) => {
      const o = {};
      for (const k of Object.keys(r)) o[k] = typeof r[k] === 'bigint' ? Number(r[k]) : r[k];
      return o;
    });
  }

  function run(sql, params = []) {
    db.run(sql, params);
    persist();
  }

  function parseJson(str, fallback) {
    try {
      const v = JSON.parse(str);
      return Array.isArray(v) ? v : fallback;
    } catch {
      return fallback;
    }
  }

  function parseHeroRow(r) {
    const { grp, ...rest } = r;
    return Object.assign({}, rest, {
      group: grp,
      tags: parseJson(r.tags, []),
      works: parseJson(r.works, []),
      words: parseJson(r.words, []),
      links: parseJson(r.links, []),
    });
  }

  function heroArgs(h) {
    return [
      String(h.name || '').trim(),
      h.alias || '',
      h.rank || '',
      h.intro || '',
      h.baike || '',
      JSON.stringify(h.tags || []),
      JSON.stringify(h.works || []),
      JSON.stringify(h.words || []),
      h.img || '',
      h.grp || h.group || 'real',
      JSON.stringify(h.links || []),
    ];
  }

  // 开发者删掉的内置条目要记住，否则「补种内置」会把它们复活，与"剔除无关梗"的诉求冲突
  const SEED_KEYS = {
    word: new Set((seed ? seed.words : []).map((w) => w.zh)),
    rule: new Set((seed ? seed.rules : []).map((r) => r.pattern)),
    card: new Set(lore ? (lore.flashcards || []).map((c) => c.term) : []),
    quote: new Set(lore ? (lore.quotes || []).map((q) => q.text) : []),
    hero: new Set(lore ? (lore.heroes || []).map((h) => h.name) : []),
  };

  function rememberDeletion(kind, key) {
    if (!key || !SEED_KEYS[kind] || !SEED_KEYS[kind].has(key)) return;
    run('INSERT OR IGNORE INTO deleted (kind, key) VALUES (?, ?)', [kind, key]);
  }

  // 改主键等价于「开发者不再要这个内置条目了」。不把旧键记进 deleted，
  // 下次空表播种（seedLore）或补种（topUpFromSeed）会按名字把旧条目原样加回来，
  // 用户刚改掉的内置词条就复活了。必须在 UPDATE 之前取旧值。
  const PRIMARY_KEY = {
    word: { table: 'words', col: 'zh' },
    rule: { table: 'rules', col: 'pattern' },
    card: { table: 'cards', col: 'term' },
    quote: { table: 'quotes', col: 'body' },
    hero: { table: 'heroes', col: 'name' },
  };

  function noteKeyChange(kind, id, nextValue) {
    const pk = PRIMARY_KEY[kind];
    if (!pk) return;
    const row = all('SELECT ' + pk.col + ' AS v FROM ' + pk.table + ' WHERE id = ?', [id])[0];
    const oldValue = row && row.v != null ? String(row.v) : '';
    if (oldValue && oldValue !== String(nextValue)) rememberDeletion(kind, oldValue);
  }

  function isDeleted(kind, key) {
    return all('SELECT 1 FROM deleted WHERE kind = ? AND key = ?', [kind, key]).length > 0;
  }

  // quotes.body 没建唯一索引（老库里可能已有同句），所以重复靠查询判重
  function quoteExists(body, exceptId) {
    return all('SELECT 1 FROM quotes WHERE body = ? AND id <> ?', [body, exceptId == null ? -1 : exceptId]).length > 0;
  }

  function snapshot(table, id) {
    return all('SELECT * FROM ' + table + ' WHERE id = ?', [id])[0] || null;
  }

  // 删除即撤销：先快照整行，撤销时用 INSERT OR REPLACE 原样写回（id 也保留）
  function deleteWithUndo(table, kind, id, keyCol) {
    const row = snapshot(table, id);
    if (!row) return { error: '内容不存在或已被删除' };
    if (keyCol) rememberDeletion(kind, row[keyCol]);
    run('DELETE FROM ' + table + ' WHERE id = ?', [id]);
    return { ok: true, undo: { kind, rows: [row], label: String(row[keyCol || 'src'] || '') } };
  }

  // 列名都来自本文件的白名单（SECTIONS / toRow），不接受外部传入的列名
  function insertRow(table, row) {
    const cols = Object.keys(row);
    run('INSERT INTO ' + table + ' (' + cols.join(', ') + ') VALUES (' + cols.map(() => '?').join(', ') + ')', cols.map((c) => row[c]));
  }

  function updateRow(table, id, row) {
    const cols = Object.keys(row);
    run('UPDATE ' + table + ' SET ' + cols.map((c) => c + ' = ?').join(', ') + ' WHERE id = ?', cols.map((c) => row[c]).concat([id]));
  }

  function restoreRows(table, rows) {
    let n = 0;
    batch(() => {
      for (const row of rows) {
        const cols = Object.keys(row).filter((c) => row[c] !== undefined);
        if (!cols.length) continue;
        run(
          'INSERT OR REPLACE INTO ' + table + ' (' + cols.join(', ') + ') VALUES (' + cols.map(() => '?').join(', ') + ')',
          cols.map((c) => row[c])
        );
        n++;
      }
    });
    return n;
  }

  const api = {
    version,

    getWords() {
      return all('SELECT ' + WORD_COLS + ' FROM words ORDER BY id')
        .map((r) => Object.assign({}, r, { pop: normPop(r.pop), rel: parseJson(r.rel, []) }));
    },
    addWord(w) {
      w = w || {};
      const zh = String(w.zh || '').trim();
      const linyu = String(w.linyu || '').trim();
      if (!zh || !linyu) return { error: '中文和淋语都不能为空' };
      try {
        run('INSERT INTO words (zh, linyu, alias, sense, source, pop, rel, slot) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', wordArgs(w));
      } catch (err) {
        return { error: dupOr(err, `词条「${zh}」已存在`) };
      }
      return { ok: true };
    },
    updateWord(id, w) {
      w = w || {};
      const zh = String(w.zh || '').trim();
      const linyu = String(w.linyu || '').trim();
      if (!zh) return { error: '中文不能为空' };
      if (!linyu) return { error: '淋语不能为空' };
      noteKeyChange('word', id, zh);
      try {
        run('UPDATE words SET zh = ?, linyu = ?, alias = ?, sense = ?, source = ?, pop = ?, rel = ?, slot = ? WHERE id = ?', wordArgs(w).concat([id]));
      } catch (err) {
        return { error: dupOr(err, `词条「${zh}」已存在`) };
      }
      return { ok: true };
    },
    deleteWord(id) {
      return deleteWithUndo('words', 'word', id, 'zh');
    },
    getRules() {
      return all('SELECT ' + RULE_COLS + ' FROM rules ORDER BY id');
    },
    addRule(r) {
      r = r || {};
      const pattern = String(r.pattern || '').trim();
      const template = String(r.template || '').trim();
      if (!pattern || !template) return { error: '正则和模板都不能为空' };
      try {
        new RegExp(pattern);
      } catch {
        return { error: '正则表达式非法' };
      }
      try {
        run('INSERT INTO rules (pattern, template, note, scene, examples, src) VALUES (?, ?, ?, ?, ?, ?)', ruleArgs(r));
      } catch (err) {
        return { error: dupOr(err, `规则「${pattern}」已存在`) };
      }
      return { ok: true };
    },
    deleteRule(id) {
      return deleteWithUndo('rules', 'rule', id, 'pattern');
    },
    updateRule(id, r) {
      r = r || {};
      const pattern = String(r.pattern || '').trim();
      const template = String(r.template || '').trim();
      if (!pattern) return { error: '正则不能为空' };
      if (!template) return { error: '模板不能为空' };
      try {
        new RegExp(pattern);
      } catch {
        return { error: '正则表达式非法' };
      }
      noteKeyChange('rule', id, pattern);
      try {
        run('UPDATE rules SET pattern = ?, template = ?, note = ?, scene = ?, examples = ?, src = ? WHERE id = ?', ruleArgs(r).concat([id]));
      } catch (err) {
        return { error: dupOr(err, `规则「${pattern}」已存在`) };
      }
      return { ok: true };
    },
    // 句式匹配是有顺序的（先命中者生效），翻译引擎按 id 升序取规则。
    // 老库同步时新规则会被追加到末尾，导致具体句式被泛化句式抢走，所以按 seed 顺序重排 id。
    reorderRules(patterns) {
      const rank = new Map(patterns.map((p, i) => [p, i]));
      const rows = all('SELECT id, pattern FROM rules ORDER BY id');
      const last = Number.MAX_SAFE_INTEGER;
      const sorted = rows.slice().sort((a, b) => {
        const ra = rank.has(a.pattern) ? rank.get(a.pattern) : last;
        const rb = rank.has(b.pattern) ? rank.get(b.pattern) : last;
        return ra !== rb ? ra - rb : a.id - b.id;
      });
      batch(() => {
        sorted.forEach((r, i) => run('UPDATE rules SET id = ? WHERE id = ?', [-(i + 1), r.id]));
        sorted.forEach((r, i) => run('UPDATE rules SET id = ? WHERE id = ?', [i + 1, -(i + 1)]));
        run("UPDATE sqlite_sequence SET seq = (SELECT MAX(id) FROM rules) WHERE name = 'rules'");
      });
      return { ok: true };
    },
    // ---- 词卡（梗） ----
    getCards() {
      return all('SELECT ' + CARD_COLS + ' FROM cards ORDER BY id').map((r) =>
        Object.assign({}, r, { aliases: parseJson(r.aliases, []), rel: parseJson(r.rel, []) })
      );
    },
    addCard(c) {
      c = c || {};
      const term = String(c.term || '').trim();
      const meaning = String(c.meaning || '').trim();
      if (!term) return { error: '词名不能为空' };
      if (!meaning) return { error: '释义不能为空' };
      try {
        run('INSERT INTO cards (term, type, meaning, example, source, hero, aliases, detail, rel) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', cardArgs(c));
      } catch (err) {
        return { error: dupOr(err, `词卡「${term}」已存在`) };
      }
      return { ok: true };
    },
    updateCard(id, c) {
      c = c || {};
      const term = String(c.term || '').trim();
      const meaning = String(c.meaning || '').trim();
      if (!term) return { error: '词名不能为空' };
      if (!meaning) return { error: '释义不能为空' };
      noteKeyChange('card', id, term);
      try {
        run('UPDATE cards SET term = ?, type = ?, meaning = ?, example = ?, source = ?, hero = ?, aliases = ?, detail = ?, rel = ? WHERE id = ?', cardArgs(c).concat([id]));
      } catch (err) {
        return { error: dupOr(err, `词卡「${term}」已存在`) };
      }
      return { ok: true };
    },
    deleteCard(id) {
      return deleteWithUndo('cards', 'card', id, 'term');
    },

    // ---- 名言 ----
    getQuotes() {
      return all('SELECT id, body AS text, author, hero, src, scene, rel FROM quotes ORDER BY id')
        .map((r) => Object.assign({}, r, { rel: parseJson(r.rel, []) }));
    },
    addQuote(q) {
      q = q || {};
      const body = quoteArgs(q)[0];
      if (!body) return { error: '名言内容不能为空' };
      if (quoteExists(body)) return { error: '这条名言已存在' };
      try {
        run('INSERT INTO quotes (body, author, hero, src, scene, rel) VALUES (?, ?, ?, ?, ?, ?)', quoteArgs(q));
      } catch {
        return { error: '这条名言已存在' };
      }
      return { ok: true };
    },
    updateQuote(id, q) {
      q = q || {};
      const body = quoteArgs(q)[0];
      if (!body) return { error: '名言内容不能为空' };
      if (quoteExists(body, id)) return { error: '这条名言已存在' };
      noteKeyChange('quote', id, body);
      run('UPDATE quotes SET body = ?, author = ?, hero = ?, src = ?, scene = ?, rel = ? WHERE id = ?', quoteArgs(q).concat([id]));
      return { ok: true };
    },
    deleteQuote(id) {
      return deleteWithUndo('quotes', 'quote', id, 'body');
    },

    // ---- 英雄人物传 ----
    getHeroes() {
      return all('SELECT id, name, alias, rank, intro, baike, tags, works, words, img, grp, links FROM heroes ORDER BY id').map(parseHeroRow);
    },
    addHero(h) {
      h = h || {};
      const name = String(h.name || '').trim();
      if (!name) return { error: '英雄名字不能为空' };
      try {
        run('INSERT INTO heroes (name, alias, rank, intro, baike, tags, works, words, img, grp, links) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', heroArgs(h));
      } catch (err) {
        return { error: dupOr(err, `英雄「${name}」已存在`) };
      }
      return { ok: true };
    },
    updateHero(id, h) {
      h = h || {};
      const name = String(h.name || '').trim();
      if (!name) return { error: '英雄名字不能为空' };
      noteKeyChange('hero', id, name);
      try {
        run('UPDATE heroes SET name = ?, alias = ?, rank = ?, intro = ?, baike = ?, tags = ?, works = ?, words = ?, img = ?, grp = ?, links = ? WHERE id = ?', heroArgs(h).concat([id]));
      } catch (err) {
        return { error: dupOr(err, `英雄「${name}」已存在`) };
      }
      return { ok: true };
    },
    deleteHero(id) {
      return deleteWithUndo('heroes', 'hero', id, 'name');
    },

    // ---- 撤销刚才的删除 ----
    undoDelete(payload) {
      const undo = payload && payload.undo;
      if (!undo || !UNDO_KIND[undo.kind] || !Array.isArray(undo.rows) || !undo.rows.length) {
        return { error: '这一步已经无法撤销' };
      }
      const table = UNDO_KIND[undo.kind];
      const section = Object.keys(SECTIONS).find((k) => SECTIONS[k].table === table);
      const n = restoreRows(table, undo.rows);
      if (section && undo.rows[0][SECTIONS[section].keyCol]) {
        const key = undo.rows[0][SECTIONS[section].keyCol];
        run('DELETE FROM deleted WHERE kind = ? AND key = ?', [undo.kind, key]);
      }
      return { ok: true, restored: n, kind: undo.kind, label: undo.label };
    },

    // ---- 数据体检：内容真正的脏数据来自无效行与悬空引用 ----
    inspect() {
      const heroes = this.getHeroes();
      const words = this.getWords();
      const heroNames = new Set(heroes.map((h) => h.name));
      const zhSet = new Set(words.map((w) => w.zh));
      const invalidWords = words.filter((w) => w.zh === w.linyu);
      const sameLy = new Map();
      for (const w of words) {
        if (!sameLy.has(w.linyu)) sameLy.set(w.linyu, []);
        sameLy.get(w.linyu).push(w);
      }
      const dupLinyu = [...sameLy.entries()]
        .filter(([, list]) => list.length > 1)
        .slice(0, 40)
        .map(([ly, list]) => ({ linyu: ly, items: list.map((w) => ({ id: w.id, zh: w.zh })) }));
      const orphanCards = this.getCards().filter((c) => c.hero && !heroNames.has(c.hero));
      const orphanQuotes = this.getQuotes().filter((q) => q.hero && !heroNames.has(q.hero));
      const orphanHeroWords = [];
      for (const h of heroes) {
        const miss = (h.words || []).filter((zh) => !zhSet.has(zh));
        if (miss.length) orphanHeroWords.push({ hero: h.name, missing: miss });
      }
      return {
        invalidWords: invalidWords.slice(0, 60),
        dupLinyu,
        orphanCards: orphanCards.slice(0, 60),
        orphanQuotes: orphanQuotes.slice(0, 60),
        orphanHeroWords: orphanHeroWords.slice(0, 60),
        totals: {
          invalidWords: invalidWords.length,
          dupLinyu: dupLinyu.reduce((n, g) => n + g.items.length, 0),
          orphanCards: orphanCards.length,
          orphanQuotes: orphanQuotes.length,
          orphanHeroWords: orphanHeroWords.reduce((n, g) => n + g.missing.length, 0),
        },
      };
    },
    // 清掉英雄身上指向已删除词条的引用（只动 heroes.words 这一列，不删内容）
    cleanHeroWords(list) {
      if (!Array.isArray(list) || !list.length) return { ok: true, fixed: 0 };
      let fixed = 0;
      batch(() => {
        for (const item of list) {
          const row = all('SELECT id, words FROM heroes WHERE name = ?', [String(item.hero || '')])[0];
          if (!row) continue;
          const drop = new Set((item.missing || []).map(String));
          const keep = parseJson(row.words, []).filter((zh) => !drop.has(String(zh)));
          run('UPDATE heroes SET words = ? WHERE id = ?', [JSON.stringify(keep), row.id]);
          fixed++;
        }
      });
      return { ok: true, fixed };
    },

    // 升级后把新增的内置内容补进已有库（不覆盖用户改过的行）
    syncFromSeed() {
      let added = 0;
      batch(() => {
        added = topUpFromSeed();
      });
      return { ok: true, added };
    },

    // 版本升级用的一次性内容迁移：先精确删掉废弃/被剔除的内置条目，再补新增，最后按 seed 顺序重排句式。
    // 删除只认 deprecated.js 与 lore.pruned 两份名单里的原文，用户自建内容不在名单里就不会被碰；
    // 重排是必须的——topUpFromSeed 只会把新句式追加到末尾，而句式按 id 顺序取第一个命中。
    upgradeSeed() {
      let removed = 0;
      let added = 0;
      let patched = 0;
      const pruned = (lore && lore.pruned) || {};
      const drop = (table, col, list) => {
        for (const key of list || []) {
          for (const r of all('SELECT id FROM ' + table + ' WHERE ' + col + ' = ?', [String(key)])) {
            run('DELETE FROM ' + table + ' WHERE id = ?', [r.id]);
            removed++;
          }
        }
      };
      // 配图回填：内置英雄在上一版就已入库，topUpFromSeed 会因同名而跳过，
      // 于是新加的图永远到不了老用户的库。这里只补「当前 img 为空」的行，
      // 用户自己传过图（media:）或手动填过路径的一律不动。
      const backfillHeroImg = () => {
        if (!lore) return;
        const rows = all('SELECT id, name, img FROM heroes');
        const want = new Map();
        for (const h of lore.heroes || []) {
          if (h && h.name && h.img) want.set(h.name, h.img);
        }
        if (!want.size) return;
        for (const r of rows) {
          const img = want.get(r.name);
          if (!img || r.img) continue;
          run('UPDATE heroes SET img = ? WHERE id = ?', [img, r.id]);
          patched++;
        }
      };
      // 人物归属回填：词卡与名言的 hero 以前只存在于渲染层的一段正则里，谁打开页面
      // 谁临时算一次，库里始终是空的。这里按 lore 的归属规则补上，且只动两类行：
      //   - hero 为空，且存在可推断归属的；
      //   - hero 指到一个不存在的英雄名（容错"人名改名"），按新规则重定。
      const backfillHero = () => {
        if (!lore || typeof lore.inferCardHero !== 'function') return;
        const cards = all('SELECT id, term, source, hero FROM cards');
        const insFix = (id, hero) => run('UPDATE cards SET hero = ? WHERE id = ?', [hero, id]);
        const heroNames = new Set(all('SELECT name FROM heroes').map((r) => r.name));
        for (const c of cards) {
          const want = c.hero && heroNames.has(c.hero) ? c.hero : (lore.inferCardHero(c) || '');
          if (!want || want === c.hero) continue;
          if (!heroNames.has(want)) continue;
          insFix(c.id, want);
        }
        const quotes = all('SELECT id, body AS text, src, author, hero FROM quotes');
        const insFixQ = (id, hero) => run('UPDATE quotes SET hero = ? WHERE id = ?', [hero, id]);
        for (const q of quotes) {
          const want = q.hero && heroNames.has(q.hero) ? q.hero : (lore.inferQuoteHero(q) || '');
          if (!want || want === q.hero) continue;
          if (!heroNames.has(want)) continue;
          insFixQ(q.id, want);
        }
      };
      // 人物分组回填：旧版 heroArgs/topUp 只认 h.group，extra6~9 里大量只写了 grp:'game' 的
      // 游戏角色因此被落成 real。这里只修「库里是 real、seed 明确是 game/up」的内置人物，
      // 用户自己改过分组（非 real）的一律不动。
      const backfillHeroGroup = () => {
        if (!lore) return;
        const want = new Map();
        for (const h of lore.heroes || []) {
          const g = h.grp || h.group || 'real';
          if (g !== 'real') want.set(h.name, g);
        }
        if (!want.size) return;
        for (const r of all('SELECT id, name, grp FROM heroes')) {
          const g = want.get(r.name);
          if (!g || r.grp === g) continue;
          if (r.grp && r.grp !== 'real') continue;
          run('UPDATE heroes SET grp = ? WHERE id = ?', [g, r.id]);
          patched++;
        }
      };
      // 词库补字段：老库里已经存在的内置词条，topUpFromSeed 会因 zh 重复而跳过，
      // 于是新补的 alias / 语义位 / 出处到不了老用户。这里只做「加法」：
      //   - alias / slot 与 seed 合并（保留用户自己填的）；
      //   - sense / source / pop 只在空的时候填，绝不覆盖用户改过的内容。
      const backfillWordMeta = () => {
        if (!seed || !Array.isArray(seed.words)) return;
        const wantByZh = new Map(seed.words.map((w) => [w.zh, w]));
        const split = (s) =>
          String(s || '')
            .split(/[、,，/]/)
            .map((x) => x.trim())
            .filter(Boolean);
        for (const r of all('SELECT id, zh, alias, sense, source, pop, slot FROM words')) {
          const want = wantByZh.get(r.zh);
          if (!want) continue;
          const next = {};
          const mergedAlias = [...new Set(split(r.alias).concat(split(want.alias)))].join('、');
          if (want.alias && mergedAlias !== String(r.alias || '')) next.alias = mergedAlias;
          const mergedSlot = [...new Set(split(r.slot).concat(split(want.slot)))].join(' / ');
          if (want.slot && mergedSlot !== String(r.slot || '')) next.slot = mergedSlot;
          for (const key of ['sense', 'source', 'pop']) {
            if (!String(r[key] || '').trim() && String(want[key] || '').trim()) next[key] = want[key];
          }
          const keys = Object.keys(next);
          if (!keys.length) continue;
          run(
            'UPDATE words SET ' + keys.map((k) => k + ' = ?').join(', ') + ' WHERE id = ?',
            keys.map((k) => next[k]).concat([r.id])
          );
          patched++;
        }
      };
      // 老库里有人把 cards.type 写成中文（「俚语梗」），词卡页的类型 chip 认不出这些值，
      // 卡在任何筛选下都不显示。这里跟 lore.js 用同一张对照表收敛。
      const CARD_TYPE_ALIAS = { 俚语梗: 'slang', 网络梗: 'meme', 语气词: 'particle', 歌词典故: 'lyric' };
      const backfillCardType = () => {
        for (const r of all("SELECT id, type FROM cards WHERE type IN ('俚语梗','网络梗','语气词','歌词典故')")) {
          run('UPDATE cards SET type = ? WHERE id = ?', [CARD_TYPE_ALIAS[r.type], r.id]);
          patched++;
        }
      };
      const ruleOrder = (seed && seed.rules ? seed.rules : []).map((r) => r.pattern).filter(Boolean);      batch(() => {
        drop('words', 'zh', (DEPRECATED && DEPRECATED.words) || []);
        drop('rules', 'pattern', (DEPRECATED && DEPRECATED.rules) || []);
        drop('cards', 'term', [].concat(pruned.cards || [], pruned.dropCards || []));
        drop('quotes', 'body', [].concat(pruned.quotes || [], pruned.dropQuotes || []));
        drop('heroes', 'name', [].concat(pruned.heroes || [], pruned.dropHeroes || []));
        backfillHeroImg();
        backfillHeroGroup();
        backfillHero();
        backfillWordMeta();
        backfillCardType();
        added = topUpFromSeed();
        if (ruleOrder.length) {
          api.reorderRules(ruleOrder);
        }
      });
      return { ok: true, removed, added, patched };
    },

    // ---- 设置与偏好 ----
    getSetting(key) {
      const row = all('SELECT v FROM settings WHERE k = ?', [key])[0];
      return row ? row.v : null;
    },
    setSetting(key, value) {
      run('INSERT INTO settings (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v', [key, value == null ? '' : String(value)]);
      return { ok: true };
    },
    getPrefs() {
      const out = {};
      for (const k of PREF_KEYS) {
        const v = this.getSetting('pref:' + k);
        if (v != null) out[k] = v;
      }
      return out;
    },
    setPref(k, v) {
      if (!PREF_KEYS.has(k)) return { error: '不支持的偏好项' };
      return this.setSetting('pref:' + k, v == null ? '' : String(v));
    },

    addHistory(src, dst) {
      const limit = clampLimit(this.getSetting('pref:history.limit'));
      // 两条 SQL 包进一次 batch：原来每条 run() 各自触发一遍整库导出+同步写，
      // 点一次翻译等于全库落盘两遍。裁剪也改成先数再删——没超限时那条
      // 全表扫描的 DELETE 纯属白跑。
      batch(() => {
        run('INSERT INTO history (src, dst, created_at) VALUES (?, ?, ?)', [src, dst, new Date().toISOString()]);
        const res = db.exec('SELECT COUNT(*) FROM history');
        const n = res[0] ? Number(res[0].values[0][0]) : 0;
        if (n > limit) {
          run('DELETE FROM history WHERE id NOT IN (SELECT id FROM history ORDER BY id DESC LIMIT ?)', [limit]);
        }
      });
    },
    getHistory() {
      const limit = clampLimit(this.getSetting('pref:history.limit'));
      return all('SELECT id, src, dst, created_at FROM history ORDER BY id DESC LIMIT ?', [limit]);
    },
    historyLimit() {
      return clampLimit(this.getSetting('pref:history.limit'));
    },
    clearHistory() {
      const rows = all('SELECT * FROM history');
      run('DELETE FROM history');
      return { ok: true, undo: { kind: 'history', rows, label: '翻译历史' } };
    },

    // ---- 备份与恢复 ----
    // sync on Node, async on Capacitor. The test (and renderer pre-await code) reads .length synchronously.
    listBackups() {
      if (!filePath) return [];
      const dir = backupDir();
      if (!dir) return [];
      const isNode = fsAdapter.kind === 'node';
      const stat1 = (file) => { try { return fsAdapter.statSync(file); } catch { return null; } };
      const collectSync = () => {
        const names = fsAdapter.readdirSync(dir) || [];
        const out = [];
        for (const raw of names) {
          const name = String(raw);
          if (!BACKUP_RE.test(name)) continue;
          const m = BACKUP_RE.exec(name);
          const file = dir + sysPath.sep + name;
          const st = stat1(file);
          if (!st) continue;
          out.push({ name, size: st.size, mtime: st.mtime, slot: Number(m[1]) });
        }
        return out.sort((a, b) => a.slot - b.slot);
      };
      if (isNode) return collectSync();
      return (async () => {
        const names = await fsAdapter.readdir(dir);
        const out = [];
        for (const raw of names) {
          const name = String(raw);
          if (!BACKUP_RE.test(name)) continue;
          const m = BACKUP_RE.exec(name);
          try {
            const st = await fsAdapter.stat(name);
            out.push({ name, size: st.size, mtime: st.mtime, slot: Number(m[1]) });
          } catch {
            continue;
          }
        }
        return out.sort((a, b) => a.slot - b.slot);
      })();
    },
    // 恢复前先留一份当前状态，万一恢复到一半发现不对还能再退回去。
    // sync on Node: 调者立刻看新库；async on Capacitor：拿到 Promise。
    restoreBackup(name) {
      if (!filePath) return { error: '当前库不在磁盘上，无法恢复' };
      const safe = String(name || '');
      if (!BACKUP_RE.test(safe)) return { error: '备份文件名不合法' };
      const dir = fsAdapter.dirOf(filePath);
      const sep = sysPath ? sysPath.sep : '/';
      const bakPath = dir ? dir + sep + safe : safe;
      const beforeRestorePath = `${filePath}.before-restore`;
      const isNode = fsAdapter.kind === 'node';
      const existsSyncFn = isNode && typeof fsAdapter.existsSync === 'function' ? fsAdapter.existsSync : null;
      if (existsSyncFn) {
        if (!existsSyncFn(bakPath)) return { error: '找不到这个备份' };
        let bytes;
        try { bytes = fsAdapter.readSync(bakPath); } catch { return { error: '备份文件已损坏，未能恢复' }; }
        return doRestoreSync(bytes);
      }
      return doRestoreAsync();
      function doRestoreSync(bytes) {
        let next; try { next = new SQL.Database(bytes); } catch { return { error: '备份文件已损坏，未能恢复' }; }
        try {
          const currentBytes = db.export();
          if (typeof fsAdapter.writeSync === 'function') {
            fsAdapter.writeSync(beforeRestorePath, currentBytes);
          }
        } catch (err) { if (onPersistError) onPersistError('pre-restore', err); }
        db.close(); db = next; db.run(SCHEMA); ensureColumns();
        persist();  // 内部 Node 路径走 writeSync，对调用方来说效果同步
        return { ok: true, file: bakPath };
      }
      async function doRestoreAsync() {
        if (!(await fsAdapter.exists(bakPath))) return { error: '找不到这个备份' };
        let bytes; try { bytes = await fsAdapter.read(bakPath); } catch { return { error: '备份文件已损坏，未能恢复' }; }
        let next; try { next = new SQL.Database(bytes); } catch { return { error: '备份文件已损坏，未能恢复' }; }
        try {
          const currentBytes = db.export();
          await fsAdapter.write(beforeRestorePath, currentBytes);
        } catch (err) { if (onPersistError) onPersistError('pre-restore', err); }
        db.close(); db = next; db.run(SCHEMA); ensureColumns();
        await persist();
        return { ok: true, file: bakPath };
      }
    },
    restoreBefore() {
      if (!filePath) return { error: '当前库不在磁盘上，无法恢复' };
      const file = `${filePath}.before-restore`;
      if (fsAdapter.kind === 'node' && typeof fsAdapter.existsSync === 'function') {
        const exists = (() => { try { return fsAdapter.existsSync(file); } catch { return false; } })();
        if (!exists) return { error: '没有可退回的恢复前快照' };
        let bytes;
        try { bytes = fsAdapter.readSync(file); } catch { return { error: '恢复前快照已损坏' }; }
        let next; try { next = new SQL.Database(bytes); } catch { return { error: '恢复前快照已损坏' }; }
        db.close(); db = next; db.run(SCHEMA); ensureColumns();
        persist();
        return { ok: true };
      }
      return (async () => {
        if (!(await fsAdapter.exists(file))) return { error: '没有可退回的恢复前快照' };
        let next; try { const bytes = await fsAdapter.read(file); next = new SQL.Database(bytes); } catch { return { error: '恢复前快照已损坏' }; }
        db.close(); db = next; db.run(SCHEMA); ensureColumns();
        await persist();
        return { ok: true };
      })();
    },

    // ---- 五板块导出 / 导入（纯 JSON，可在另一台机器还原） ----
    exportAll() {
      const data = {
        words: this.getWords(),
        rules: this.getRules(),
        cards: this.getCards(),
        quotes: this.getQuotes(),
        heroes: this.getHeroes(),
      };
      return {
        app: 'linyu-translator',
        kind: 'backup',
        format: 1,
        exported_at: new Date().toISOString(),
        counts: Object.keys(data).reduce((acc, k) => ((acc[k] = data[k].length), acc), {}),
        data,
      };
    },
    // 校验结构并逐条分级：add（库里没有）/ update（库里有但内容不同）/ skip（一致，或"只新增"策略下已存在）
    sectionRows(key) {
      return all('SELECT * FROM ' + SECTIONS[key].table);
    },
    planImport(payload, strategy) {
      const bad = checkPayload(payload);
      if (bad) return { error: bad };
      const merge = strategy !== 'add-only';
      const sections = [];
      const problems = [];
      for (const key of Object.keys(SECTIONS)) {
        const conf = SECTIONS[key];
        const existing = new Map(this.sectionRows(key).map((r) => [String(r[conf.keyCol]), r]));
        let add = 0;
        let update = 0;
        let skip = 0;
        for (const raw of payload.data[key] || []) {
          const row = toRow(key, raw, problems);
          if (!row) continue;
          const before = existing.get(String(row[conf.keyCol]));
          if (!before) add += 1;
          else if (sameRow(key, before, row)) skip += 1;
          else if (merge) update += 1;
          else skip += 1;
        }
        sections.push({ key, label: conf.label, add, update, skip, total: (payload.data[key] || []).length });
      }
      return { ok: true, sections, problems, strategy: merge ? 'merge' : 'add-only' };
    },
    // 导入失败要整体回滚：先用内存快照，出错就把 db 换回快照内容
    applyImport(payload, strategy) {
      const plan = this.planImport(payload, strategy);
      if (plan.error) return plan;
      const merge = strategy !== 'add-only';
      const snapshot = db.export();
      const problems = [];
      const result = { add: 0, update: 0, skip: 0 };
      try {
        batch(() => {
          for (const key of Object.keys(SECTIONS)) {
            const conf = SECTIONS[key];
            const existing = new Map(all('SELECT * FROM ' + conf.table).map((r) => [String(r[conf.keyCol]), r]));
            for (const raw of payload.data[key] || []) {
              const row = toRow(key, raw, problems);
              if (!row) continue;
              const before = existing.get(String(row[conf.keyCol]));
              if (!before) {
                insertRow(conf.table, row);
                result.add += 1;
              } else if (merge && !sameRow(key, before, row)) {
                updateRow(conf.table, before.id, row);
                result.update += 1;
              } else {
                result.skip += 1;
              }
            }
          }
        });
      } catch (err) {
        db.close();
        db = new SQL.Database(snapshot);
        db.run(SCHEMA);
        ensureColumns();
        persist();
        return { error: '导入失败，已整体回滚：' + err.message };
      }
      return { ok: true, ...result, sections: plan.sections, problems };
    },

    // 启动时库文件读不通的现场（没有则 null），主进程据此提示用户
    recoveryInfo() {
      return recovery;
    },

    async close() {
      await persist();
      db.close();
    },

    // 给 mobile/api.js 用：直接暴露底层 adapter，写日志或维护 media 目录时用到
    adapter: fsAdapter,
  };

  return api;
}

// 把导入文件里的一条记录整理成真正的库行；不合法就返回 null 并记一条问题
function toRow(key, raw, problems) {
  if (!raw || typeof raw !== 'object') {
    problems.push('有条目不是对象');
    return null;
  }
  const s = (v) => String(v == null ? '' : v).trim();
  const arr = (v) => JSON.stringify(Array.isArray(v) ? v : []);
  // 「关联词条」在导入文件里可能是数组，也可能被写成顿号串，两种都收成同一个数组再落库
  const rel = (v) => JSON.stringify(Array.isArray(v) ? v.filter(Boolean).map(String) : s(v).split(/[\n,，、]/).filter(Boolean));
  if (key === 'words') {
    const zh = s(raw.zh);
    const linyu = s(raw.linyu);
    if (!zh || !linyu) {
      problems.push('有词条缺中文或淋语');
      return null;
    }
    // 流行度只有高/中/低三个档位，导入文件里的自由文本在这里就挡掉，别让它混进库
    const pop = s(raw.pop);
    return { zh, linyu, alias: s(raw.alias), sense: s(raw.sense), source: s(raw.source), pop: ['高', '中', '低'].includes(pop) ? pop : '', rel: rel(raw.rel) };
  }
  if (key === 'rules') {
    const pattern = s(raw.pattern);
    const template = s(raw.template);
    if (!pattern || !template) {
      problems.push('有句式缺正则或模板');
      return null;
    }
    try {
      new RegExp(pattern);
    } catch {
      problems.push(`句式正则非法：${pattern}`);
      return null;
    }
    return { pattern, template, note: s(raw.note), scene: s(raw.scene), examples: s(raw.examples), src: s(raw.src) };
  }
  if (key === 'cards') {
    const term = s(raw.term);
    const meaning = s(raw.meaning);
    if (!term) {
      problems.push('有词卡缺 term');
      return null;
    }
    return {
      term,
      type: s(raw.type) || 'slang',
      meaning,
      example: s(raw.example),
      source: s(raw.source),
      hero: s(raw.hero),
      aliases: arr(raw.aliases),
      detail: s(raw.detail),
      rel: rel(raw.rel),
    };
  }
  if (key === 'quotes') {
    const body = s(raw.text != null ? raw.text : raw.body);
    if (!body) {
      problems.push('有名言缺 text');
      return null;
    }
    return {
      body,
      author: s(raw.author),
      hero: s(raw.hero),
      src: s(raw.src),
      scene: s(raw.scene),
      rel: rel(raw.rel),
    };
  }
  if (key === 'heroes') {
    const name = s(raw.name);
    if (!name) {
      problems.push('有英雄缺 name');
      return null;
    }
    return {
      name,
      alias: s(raw.alias),
      rank: s(raw.rank),
      intro: s(raw.intro),
      baike: s(raw.baike),
      tags: arr(raw.tags),
      works: arr(raw.works),
      words: rel(raw.words),
      img: s(raw.img),
      grp: s(raw.group) || 'real',
      links: arr(raw.links),
    };
  }
  return null;
}

function sameRow(key, before, after) {
  if (key === 'words') {
    return before.zh === after.zh && before.linyu === after.linyu && (before.alias || '') === (after.alias || '')
      && (before.sense || '') === (after.sense || '') && (before.source || '') === (after.source || '')
      && (before.pop || '') === (after.pop || '') && (before.rel || '[]') === after.rel;
  }
  if (key === 'rules') {
    return before.pattern === after.pattern && before.template === after.template && (before.note || '') === (after.note || '')
      && (before.scene || '') === (after.scene || '') && (before.examples || '') === (after.examples || '') && (before.src || '') === (after.src || '');
  }
  if (key === 'cards') {
    return before.term === after.term && (before.type || 'slang') === after.type && (before.meaning || '') === after.meaning
      && (before.example || '') === (after.example || '') && (before.source || '') === (after.source || '')
      && (before.hero || '') === (after.hero || '') && (before.aliases || '[]') === after.aliases
      && (before.detail || '') === (after.detail || '') && (before.rel || '[]') === after.rel;
  }
  if (key === 'quotes') {
    return before.body === after.body && (before.author || '') === (after.author || '')
      && (before.hero || '') === (after.hero || '') && (before.src || '') === (after.src || '')
      && (before.scene || '') === (after.scene || '') && (before.rel || '[]') === after.rel;
  }
  if (key === 'heroes') {
    return before.name === after.name && (before.alias || '') === (after.alias || '') && (before.rank || '') === (after.rank || '')
      && (before.intro || '') === (after.intro || '') && (before.baike || '') === (after.baike || '')
      && (before.tags || '[]') === after.tags && (before.works || '[]') === after.works && (before.words || '[]') === after.words
      && (before.img || '') === (after.img || '') && (before.grp || 'real') === (after.grp || 'real')
      && (before.links || '[]') === after.links;
  }
  return false;
}

function checkPayload(payload) {
  if (!payload || typeof payload !== 'object') return '文件内容不是 JSON 对象';
  if (payload.app !== 'linyu-translator') return '这不是淋语翻译器导出的数据文件';
  if (!payload.data || typeof payload.data !== 'object') return '文件里没有 data 区块';
  const keys = Object.keys(SECTIONS).filter((k) => Array.isArray(payload.data[k]));
  if (!keys.length) return '文件里五板块都是空的';
  for (const k of Object.keys(payload.data)) {
    if (!SECTIONS[k]) delete payload.data[k];
    else if (!Array.isArray(payload.data[k])) return `${SECTIONS[k].label}区块不是数组`;
  }
  return null;
}

if (typeof module === 'object' && module && module.exports) {
  module.exports = { createDb, SECTIONS };
} else if (typeof window !== 'undefined') {
  window.createDb = createDb;
  window.SECTIONS = SECTIONS;
}
