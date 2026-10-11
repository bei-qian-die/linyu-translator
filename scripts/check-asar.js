'use strict';
const asar = require('@electron/asar');
const vm = require('vm');
const p = 'release/win-unpacked/resources/app.asar';
const pick = (rel) => asar.extractFile(p, rel.split('/').join('\\')).toString('utf8');

const files = asar.listPackage(p).map((s) => s.replace(/\//g, '\\'));
const inSrc = files.filter((f) => f.startsWith('\\src\\'));
console.log('total', files.length, 'src files', inSrc.length);
console.log('hero imgs', inSrc.filter((f) => /hero-\d+\.png$/.test(f)).length);
console.log('leak', inSrc.filter((f) => /_preview|_stub/.test(f)));

// 直接从 asar 里递归加载 src/core 模块，以后新增 lore-extraN 不用再改这个脚本
const cache = {};
function coreRequire(id) {
  let rel = id.replace(/^\.\//, '');
  if (!/\.[a-z]+$/.test(rel)) rel += '.js';
  if (!/^[\w.-]+\.js$/.test(rel)) throw new Error('check-asar 只会解析 src/core 同级模块：' + id);
  if (cache[rel]) return cache[rel].exports;
  const mod = { exports: {} };
  cache[rel] = mod;
  vm.runInNewContext(pick('src/core/' + rel), {
    module: mod,
    exports: mod.exports,
    require: coreRequire,
    console,
  });
  return mod.exports;
}
const lore = coreRequire('./lore.js');
console.log('heroes', lore.heroes.length, 'cards', lore.flashcards.length, 'quotes', lore.quotes.length);
console.log('game heroes', lore.heroes.filter((h) => h.group === 'game').map((h) => h.name).join(','));

const seed = JSON.parse(pick('src/core/seed.json'));
console.log('seed words', seed.words.length, 'rules', seed.rules.length);

const html = pick('src/renderer/index.html');
console.log('filteredHeroes in html', html.includes('v-for="h in filteredHeroes"'), '| group tabs', html.includes('heroCount(g.key)'));
const appjs = pick('src/renderer/app.js');
console.log('heroCount exported', appjs.includes('filteredHeroes, heroCount'));

// 开发者模式与五板块 CRUD 是否真的进了包
console.log('has auth.js', files.includes('\\src\\core\\auth.js'));
const mainjs = pick('src/main/main.js');
console.log(
  'ipc gate',
  ['wrapDev', "ly:auth:login", "ly:cards:add", "ly:media:pick", "await fn(...args)"].every((s) => mainjs.includes(s))
);
console.log(
  'dev ui',
  appjs.includes('listCards') && appjs.includes('开发者模式') && html.includes('进入开发者模式') && html.includes('lock-bar')
);
console.log('db tables', ['cards', 'quotes', 'heroes', 'settings', 'deleted'].every((t) => pick('src/core/db.js').includes('CREATE TABLE IF NOT EXISTS ' + t)));
