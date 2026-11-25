// 第二十七轮名言采集：直接从 B 站公开检索结果里取真实标题作为「社区共识梗句」。
// 不编造任何人物原话；每条都带 bvid 与 UP 主，可点回原视频。
// 与既有 quotes 去重（去标点后比对），优先取主窗口（2026-10-26 ～ 2026-11-25）内的条目。
// 用法：node scripts/build-new27-quotes.mjs
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const ROOT = path.join(process.cwd());
const evFiles = fs
  .readdirSync('evidence')
  .filter((f) => /^bili-search-new27-\d{14}\.json$/.test(f))
  .sort();
if (!evFiles.length) {
  console.error('没有找到 evidence/bili-search-new27-*.json，请先跑 harvest-new27.mjs');
  process.exit(1);
}
const ev = JSON.parse(fs.readFileSync(path.join('evidence', evFiles[evFiles.length - 1]), 'utf8'));

const WIN_START = Date.UTC(2026, 9, 26) / 1000;
const WIN_END = Date.UTC(2026, 10, 26) / 1000;

// 既有 quotes 去重基线
const lore = require(path.join(ROOT, 'src/core/lore.js'));
const norm = (s) => String(s || '').replace(/\s+/g, '').toLowerCase();
const strip = (s) =>
  norm(s).replace(/[，。！？、；：""''‘“（）()…~—\-《》,.!?;:"'[\]【】]/g, '');
const taken = new Set(lore.quotes.map((q) => strip(q.text)));

const ZONES = [
  ['星淋铁道', /星淋|星铁|铁道|崩坏|星穹|二相|狸狸|砂途|白厄|花火|砂金|黄泉|椒丘|知根鸟|周天哥/],
  ['王者淋耀', /王者淋耀|淋者荣耀|我芈|我华|我琳|我米|我拉|乔姐|大小姐/],
  ['阴雄淋盟', /阴雄淋盟|英雄淋盟|我吸|我琴|我阴|露贵人|女竞/],
  ['守望淋锋', /守望淋锋|守望|枪男|女特务|夺命女|莫伊拉|花男|我老衲/],
  ['第五淋格', /第五淋格|大歌剧|娅娅|大亩主|红杉木/],
  ['淋神', /淋神|原神|月绽放|小男孩队|心海|群玉阁/],
  ['通用 / 抽象新梗', /抽象|梗|新梗|2G|5G|妈妈/],
];

const HEROES = [
  '花火', '砂金', '知更鸟', '流萤', '星期日', '黄泉', '白厄', '椒丘', '黑塔', '姬子',
  '景元', '刃', '卡芙卡', '银狼', '镜流', '丹恒', '三月七', '克拉拉', '停云', '白露',
  '藿藿', '银枝', '托帕', '真理医生', '翡翠', '云璃', '貊泽', '飞霄', '万敌', '遐蝶',
  '希儿', '布洛妮娅', '娜塔莎', '驭空', '桂乃芬',
];

const pickHero = (t) => HEROES.find((h) => t.includes(h)) || '';
const pickZone = (t) => (ZONES.find(([, re]) => re.test(t)) || [''])[0];

const all = [];
const seenBv = new Set();
for (const [kw, arr] of Object.entries(ev)) {
  for (const v of arr) {
    if (!v.title || seenBv.has(v.bvid)) continue;
    seenBv.add(v.bvid);
    all.push({ ...v, kw });
  }
}

const usable = all.filter((v) => {
  const t = v.title;
  if (t.length < 8 || t.length > 60) return false;
  if (!/淋|婆|惹|娥|素|姐妹|我[花砂鸟萤日泉白椒塔姬景刃卡狼镜恒七拉云露藿枝帕翡璃貊霄敌蝶希妮空桂]|赔钱|星铁|铁道|抽象|梗/.test(t)) return false;
  if (strip(t).length < 8) return false;
  if (taken.has(strip(t))) return false;
  taken.add(strip(t));
  return true;
});

const inWin = usable.filter((v) => v.pubdate >= WIN_START && v.pubdate <= WIN_END);
const outWin = usable.filter((v) => v.pubdate < WIN_START || v.pubdate > WIN_END);

// 主窗口优先；同一 UP 主最多取 4 条，保证来源分布
const authorCount = new Map();
const out = [];
const push = (v, freshness) => {
  const t = v.title.trim();
  if (!t) return;
  const c = authorCount.get(v.author) || 0;
  if (c >= 4) return;
  authorCount.set(v.author, c + 1);
  const url = `https://www.bilibili.com/video/${v.bvid}`;
  out.push({
    text: t,
    author: v.author || 'B 站 UP 主',
    src: url,
    verify: url,
    hero: pickHero(t),
    zone: pickZone(t),
    freshness,
  });
};

for (const v of inWin) if (out.length < 110) push(v, 'new');
for (const v of outWin) if (out.length < 150) push(v, 'revived');
for (const v of inWin) if (out.length < 150) push(v, 'new');

fs.writeFileSync('scripts/curated-new27-quotes.json', JSON.stringify(out, null, 1));
console.log('候选', usable.length, '| 主窗口', inWin.length, '| 取出', out.length);
const byZone = {};
for (const q of out) byZone[q.zone || '未分区'] = (byZone[q.zone || '未分区'] || 0) + 1;
console.log('分区分布', byZone);
