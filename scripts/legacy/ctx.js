'use strict';
const fs = require('fs');
const files = process.argv[2].split(',');
const terms = process.argv.slice(3);
const out = [];
for (const f of files) {
  let cur = f;
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    if (line.startsWith('====')) {
      cur = line.replace(/^==== /, '').replace(/ ====$/, '');
      continue;
    }
    for (const t of terms) {
      if (line.includes(t)) {
        out.push(cur + ' || ' + line.trim());
        break;
      }
    }
  }
}
const seen = new Set();
const ded = out.filter((l) => (seen.has(l) ? false : (seen.add(l), true)));
console.log(ded.slice(0, Number(process.env.LIM || 90)).join('\n'));
console.error('matched', ded.length);
