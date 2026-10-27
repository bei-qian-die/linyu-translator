'use strict';
// 只读转储：导出指定 tag 的英雄（name/alias/img/intro/tags），供配图审查用。
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
const TAG = process.argv[2] || '第五淋格';

const m = { exports: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'src/core/lore.js'), 'utf8'), {
  module: m,
  exports: m.exports,
  require: (p) => require(path.join(ROOT, 'src/core/' + String(p).replace(/^.*[\\/]/, ''))),
});
const lore = m.exports;
const heroes = lore.heroes.filter((h) => (h.tags || []).includes(TAG));
console.error('total heroes:', lore.heroes.length, 'with tag', TAG, ':', heroes.length);
const out = heroes.map((h) => ({
  name: h.name,
  alias: h.alias,
  img: h.img || '',
  intro: h.intro || '',
  tags: h.tags,
}));
fs.writeFileSync(path.join(ROOT, 'evidence', `qc22-heroes-${TAG}.json`), JSON.stringify(out, null, 1), 'utf8');
console.log(out.map((h) => `${h.name}\t${h.img}`).join('\n'));
