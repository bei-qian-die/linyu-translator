'use strict';

// 第二十轮：把《漫威争锋》英雄的百度百科词条正文抓成本地语料。
// 目的有两个：
//   1) 让「捍卫者 / 决斗家 / 策略家」这类官方职责说法在语料里逐字可查——
//      它们是 Barnes & Noble 玩家区的标准用法，但 B 站评论里很少出现，
//      没有来源就会变成「凭空编词」，attest/bleed 两道闸门都会红。
//   2) 给每个人物传一条可回源的 baike 链接与官方立绘图源。
//
// 只用百度百科开放接口 BaikeLemmaCardApi（公开，无需凭据）。
// 注意：同一个英雄名可能对应漫画/电影词条，这里用「摘要必须提到漫威或游戏」作为过滤器，
// 不匹配就换第二个检索 key，仍然不匹配就如实记为「未取到」，不硬套。
//
// 产出 corpus/corpus-baike20.txt + evidence/baike20.json
const fs = require('fs');
const path = require('path');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const ROOT = path.join(__dirname, '..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const strip = (s) =>
  String(s || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, ' ');

// name: [检索 key 候选]
const { HERO_BAIKE } = require(path.join(ROOT, 'scripts/curated-heroes20.js'));

const OK = /漫威|Marvel|争锋|超级英雄|网易|游戏|捍卫者|决斗家|策略家/;

async function card(key) {
  const u =
    'https://baike.baidu.com/api/openapi/BaikeLemmaCardApi?scope=103&format=json&appid=379020&bk_key=' +
    encodeURIComponent(key) +
    '&bk_length=4000';
  for (let a = 0; a < 3; a++) {
    try {
      const r = await fetch(u, { headers: { 'User-Agent': UA } });
      return await r.json();
    } catch {
      await sleep(1200 * (a + 1));
    }
  }
  return null;
}

(async () => {
  const out = [];
  const map = {};
  out.push('# 百度百科公开接口快照（第二十轮 · 淋威争锋英雄词条）');
  out.push(`# 抓取时间: ${new Date().toISOString()}`);
  out.push('# 来源：baike.baidu.com BaikeLemmaCardApi，未使用任何凭据');

  const entries = Object.entries(HERO_BAIKE);
  for (let i = 0; i < entries.length; i++) {
    const [name, keys] = entries[i];
    let hit = null;
    for (const key of keys) {
      const j = await card(key);
      const desc = strip(j && (j.desc || (j.content && j.content.desc)) || '');
      if (j && desc && OK.test(desc)) {
        hit = { key: j.key || key, desc, pic: (j.image && (j.image.picUrl || j.image.url)) || j.picUrl || '' };
        break;
      }
      await sleep(700);
    }
    if (!hit) {
      console.error(`[miss] ${name}：百科摘要不匹配，记入待核清单`);
      map[name] = { name, miss: true };
      continue;
    }
    const url = `https://baike.baidu.com/item/${encodeURIComponent(hit.key)}`;
    map[name] = { name, key: hit.key, desc: hit.desc, url, pic: hit.pic };
    out.push(`【视频】漫威争锋 ${name}（${hit.key}）`);
    out.push(`【简介】${hit.desc.slice(0, 600)}`);
    console.error(`[ok ${i + 1}/${entries.length}] ${name} ← ${hit.key}（${hit.desc.length} 字）`);
    await sleep(600);
  }

  fs.writeFileSync(path.join(ROOT, 'corpus', 'corpus-baike20.txt'), out.join('\n') + '\n', 'utf8');
  fs.writeFileSync(path.join(ROOT, 'evidence', 'baike20.json'), JSON.stringify(map, null, 2), 'utf8');
  const got = Object.values(map).filter((v) => !v.miss).length;
  console.error(`\n[done] ${got}/${entries.length} 位英雄取到百科正文 → corpus/corpus-baike20.txt、evidence/baike20.json`);
})();
