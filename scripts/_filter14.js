'use strict';
// 临时评审辅助:从 lexicon-cand14.json 里按淋味特征过滤出人工评审短名单
const d = require('../evidence/lexicon-cand14.json');
const STRONG = /[淋阴鼠惹噜厚靴熏柱珍尊素吸婊蕉蒜嘤雷糕"]/;
const GENERIC_VIA = (v) => v.length === 1 && (v[0] === 'redup' || v[0] === 'token' || v[0] === 'ngram');
const out = d.usable.filter((u) => {
  if (!u.wholeWord || u.lineCount < 2) return false;
  if (u.in_seed_exact || u.in_seed_partial) return false;
  const c = u.cand;
  if (c.length < 2 || c.length > 12) return false;
  if (GENERIC_VIA(u.via) && !STRONG.test(c)) return false;
  return STRONG.test(c) || u.via.some((v) => ['dict', 'subst', 'tail', 'selfref', 'linname'].includes(v));
});
console.log('filtered:', out.length);
for (const u of out) {
  const s = u.samples[0];
  const samp = (s ? s.text : '').slice(0, 60).replace(/\s+/g, ' ');
  const tit = u.titles && u.titles[0] ? u.titles[0].label : '';
  console.log(u.cand + ' | ' + u.via.join(',') + ' | ' + u.lineCount + '行 | ' + samp + ' | ' + String(tit).slice(0, 34));
}
