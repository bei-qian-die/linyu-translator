'use strict';
// 第二十二轮 · 来源一：百度百科词条主图（第五人格角色）。
// 校验：abstract 必须含「第五人格」（或 identity v），防止词条抓串。
// 产出 evidence/qc22-baike/<name>.jpg + evidence/qc22-baike.json
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'evidence', 'qc22-baike');
const OUT_JSON = path.join(ROOT, 'evidence', 'qc22-baike.json');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const HDR = { 'User-Agent': UA, Referer: 'https://baike.baidu.com/' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 词库名 → 百度词条名（官方词条常带「(第五人格)」后缀或用全名）
const PLAN = process.argv[2]
  ? process.argv[2].split(',').map((s) => s.split('=')).map(([name, key]) => ({ name, key: key || name }))
  : [
      ['医生', '医生(第五人格)'], ['律师', '律师(第五人格)'], ['医生2', '艾米丽(第五人格)'],
      ['园丁', '园丁(第五人格)'], ['空军', '空军(第五人格)'], ['佣兵', '佣兵(第五人格)'],
      ['机械师', '机械师(第五人格)'], ['盲女', '盲女(第五人格)'], ['舞女', '舞女(第五人格)'],
      ['调香师', '调香师(第五人格)'], ['祭司', '祭司(第五人格)'], ['魔术师', '魔术师(第五人格)'],
      ['冒险家', '冒险家(第五人格)'], ['勘探员', '勘探员(第五人格)'], ['调酒师', '调酒师(第五人格)'],
      ['杂技演员', '杂技演员(第五人格)'], ['画家', '画家(第五人格)'], ['病患', '病患(第五人格)'],
      ['心理学家', '心理学家(第五人格)'], ['玩具商', '玩具商(第五人格)'], ['咒术师', '咒术师(第五人格)'],
      ['前锋', '前锋(第五人格)'], ['昆虫学者', '昆虫学者(第五人格)'], ['囚徒', '囚徒(第五人格)'],
      ['邮差', '邮差(第五人格)'], ['入殓师', '入殓师(第五人格)'], ['小提琴家', '小提琴家(第五人格)'],
      ['牛仔', '牛仔(第五人格)'], ['野人', '野人(第五人格)'], ['幸运儿', '幸运儿(第五人格)'],
      ['古董商', '古董商(第五人格)'], ['守墓人', '守墓人(第五人格)'], ['击球手', '击球手(第五人格)'],
      ['守夜人', '守夜人(第五人格)'], ['蜡像师', '蜡像师(第五人格)'], ['记录员', '记录员(第五人格)'],
      ['疯眼', '疯眼(第五人格)'], ['隐士', '隐士(第五人格)'], ['使徒', '使徒(第五人格)'],
      ['梦之女巫', '梦之女巫(第五人格)'], ['蜘蛛', '蜘蛛(第五人格)'], ['爱哭鬼', '爱哭鬼(第五人格)'],
      ['黄衣之主', '黄衣之主(第五人格)'], ['摄影师', '摄影师(第五人格)'], ['红夫人', '红夫人(第五人格)'],
      ['愚人金', '愚人金(第五人格)'], ['时空之影', '时空之影(第五人格)'], ['喧嚣', '喧嚣(第五人格)'],
      ['破轮', '破轮(第五人格)'], ['邦邦', '邦邦(第五人格)'], ['大副', '大副(第五人格)'],
      ['小女孩', '小女孩(第五人格)'], ['凤蝶', '凤蝶(第五人格)'],
    ].map(([name, key]) => ({ name, key }));

async function lemma(key) {
  const u = 'https://baike.baidu.com/api/openapi/BaikeLemmaCardApi?scope=103&format=json&appid=379020&bk_key=' +
    encodeURIComponent(key) + '&bk_length=300';
  const r = await fetch(u, { headers: HDR });
  return JSON.parse(await r.text());
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const items = [], rejected = [];
  for (const { name, key } of PLAN) {
    let j;
    try { j = await lemma(key); } catch (e) { rejected.push({ name, key, why: '接口失败 ' + e.message }); continue; }
    const abs = String(j.abstract || '');
    if (!/第五人格|identity v/i.test(abs)) {
      rejected.push({ name, key, why: '词条疑似抓串：' + abs.slice(0, 40) });
      await sleep(150);
      continue;
    }
    if (!j.image) { rejected.push({ name, key, why: '词条无主图' }); await sleep(150); continue; }
    const file = `${name}.jpg`;
    try {
      const r = await fetch(j.image, { headers: HDR });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 4000) throw new Error('too small');
      fs.writeFileSync(path.join(OUT_DIR, file), buf);
    } catch (e) { rejected.push({ name, key, why: '主图下载失败 ' + e.message }); await sleep(150); continue; }
    items.push({ name, key, lemma: j.key || key, desc: abs.slice(0, 60), image: j.image, file });
    console.error(`[OK] ${name} ← 「${j.key || key}」`);
    await sleep(150);
  }
  fs.writeFileSync(OUT_JSON, JSON.stringify({ generatedAt: new Date().toISOString(), items, rejected }, null, 2), 'utf8');
  console.log(`词条主图 ${items.length} 张，丢弃 ${rejected.length} 个 -> ${OUT_JSON}`);
  for (const r of rejected) console.log(`  [丢弃] ${r.name}(${r.key})：${r.why}`);
})();
