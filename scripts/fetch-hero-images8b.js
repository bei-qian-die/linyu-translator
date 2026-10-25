'use strict';

// 第八轮配图采集 v2（2026-10-25）
//
// v1 的问题：只用关键词检索的首条封面，命中率不到七成——
// 「胡桃」抓到《永劫无间》胡桃、「刻晴」抓到无关视频这种张冠李戴，
// 按项目配图规则（禁用与英雄无关的图）这些都必须作废重抓。
//
// v2 的取图优先级，每一级都要求是「与这个人直接相关」的真实图片源：
//   1. 人物自带的代表视频（heroes.links 里的 bilibili BV）
//        UP 主 → 该视频 UP 的 B 站头像（未露脸 UP 一律用头像，项目既定规则）
//        角色 / 真人 → 该视频封面
//   2. B 站站内检索，但必须过相关性校验：命中标题要包含该人物的名或别名关键词
//   3. 百度百科词条图（用户明确的合规来源之一）
//   4. 以上都没有 → 标记「待补图」，绝不拿无关图凑数
//
// 全程走公开接口：/x/web-interface/view、/x/web-interface/card、/x/web-interface/search/type、
// baike.baidu.com/api/openapi/BaikeLemmaCardApi，不带任何凭据。
// 每张图的来源 URL 与命中标题都记进 evidence/hero-images-20261025.json，可逐张回查。

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const IMG_DIR = path.join(ROOT, 'src', 'renderer', 'img');
const RAW_DIR = path.join(ROOT, 'evidence', 'hero-img-raw');
fs.mkdirSync(RAW_DIR, { recursive: true });

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const HD = { 'User-Agent': UA, Referer: 'https://www.bilibili.com/' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: HD });
      if (r.status === 412 || r.status === 429) {
        await sleep(4000 * (i + 1));
        continue;
      }
      return await r.json();
    } catch {
      await sleep(1500 * (i + 1));
    }
  }
  return null;
}

async function view(bvid) {
  const j = await api(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`);
  if (!j || !j.data) return null;
  return {
    pic: j.data.pic,
    title: String(j.data.title || ''),
    mid: j.data.owner && j.data.owner.mid,
    up: (j.data.owner && j.data.owner.name) || '',
  };
}

async function face(mid) {
  const j = await api(`https://api.bilibili.com/x/web-interface/card?mid=${mid}&photo=false`);
  const f = j && j.data && j.data.card && j.data.card.face;
  return f || '';
}

async function searchVideo(kw, must) {
  const j = await api(
    `https://api.bilibili.com/x/web-interface/search/type?search_type=video&keyword=${encodeURIComponent(kw)}&page=1`
  );
  const list = (j && j.data && j.data.result) || [];
  for (const v of list) {
    const t = String(v.title || '').replace(/<[^>]+>/g, '');
    if (!v.bvid || !v.pic) continue;
    if (must && !must.test(t)) continue;
    return { bvid: v.bvid, title: t, pic: v.pic, mid: v.mid };
  }
  return null;
}

async function baikePic(key) {
  const j = await api(
    `https://baike.baidu.com/api/openapi/BaikeLemmaCardApi?scope=103&format=json&appid=379020&bk_key=${encodeURIComponent(key)}&bk_length=400`
  );
  if (!j || !j.pic) return null;
  return { pic: j.pic, title: '百度百科《' + (j.key || key) + '》词条图' };
}

async function download(url, dest) {
  const full = /^https?:/i.test(url) ? url : 'https:' + url;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(full, { headers: HD });
      if (!r.ok) {
        await sleep(1200);
        continue;
      }
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 2000) return 0;
      fs.writeFileSync(dest, buf);
      return buf.length;
    } catch {
      await sleep(1200);
    }
  }
  return 0;
}

// 检索兜底时的相关性校验：命中标题必须同时含「人物关键词」与「分区关键词」，
// 否则宁可标缺图——v1 就是栽在只命中了一半关键词上。
const PLAN = {
  雷电将军: { kw: ['【淋神】雷电将军', '淋神 雷神 雷电将军'], kwRe: /雷电将军|雷神/, zoneRe: /淋神|原神/ },
  流浪者: { kw: ['【淋神】流浪者', '淋神 散兵 流浪者'], kwRe: /流浪者|散兵/, zoneRe: /淋神|原神/ },
  胡桃: { kw: ['【淋神】胡桃', '淋神 胡桃 往生堂'], kwRe: /胡桃/, zoneRe: /淋神|原神|往生堂/ },
  刻晴: { kw: ['【淋神】刻晴', '淋神 刻晴 玉衡'], kwRe: /刻晴|玉衡/, zoneRe: /淋神|原神/ },
  妮露: { kw: ['【淋神】妮露', '淋神 妮露 舞娘'], kwRe: /妮露/, zoneRe: /淋神|原神/ },
  火淋: { kw: ['星淋铁道 火淋 轰动演出', '星淋铁道 角色PV'], kwRe: /火淋|轰动演出/, zoneRe: /星淋铁道|β坏|铁道/ },
  蒜姐: { kw: ['王者淋耀 蒜姐 飞天婆', '上官婉儿 蒜姐'], kwRe: /蒜姐|婉儿/, zoneRe: /王者|淋耀|婉儿/ },
  凤蝶: { kw: ['第五淋格 凤蝶 冰雪女王', '第五人格 凤蝶'], kwRe: /凤蝶/, zoneRe: /第五|淋格/ },
  杂技女亡帕克: { kw: ['刀塔 帕克 淋动全场', 'DOTA 帕克'], kwRe: /帕克/, zoneRe: /刀塔|DOTA|淋|β/ },
  铁T成长: { kw: ['撅战 淋安京 铁T', '决战平安京 铁T'], kwRe: /铁T|铁t/, zoneRe: /淋安京|平安京|撅战/ },
  交女王: { kw: ['淋角洲行动 交女王', '三角洲行动 交女王'], kwRe: /交女王|角洲/, zoneRe: /淋角洲|三角洲/ },
  威龙daddy: { kw: ['三角淋行动 威龙', '三角洲行动 威龙'], kwRe: /威龙/, zoneRe: /三角淋|三角洲/ },
};
// 百度百科兜底的词条名
const BAIKE = {
  雷电将军: '雷电将军',
  流浪者: '流浪者(原神)',
  胡桃: '胡桃(原神)',
  刻晴: '刻晴',
  妮露: '妮露(原神)',
  木头人的磁带旧时光: '木头人的磁带旧时光',
};

(async () => {
  const lore = require(path.join(ROOT, 'src', 'core', 'lore.js'));
  const onDisk = new Set(fs.readdirSync(IMG_DIR));
  const need = lore.heroes.filter((h) => !h.img || !onDisk.has(String(h.img).replace(/^.*\//, '')));

  let next = 1;
  for (const f of onDisk) {
    const m = f.match(/^hero-(\d+)\./);
    if (m) next = Math.max(next, Number(m[1]) + 1);
  }

  const assign = {};
  const report = [];
  const PY = process.env.PY || 'python';

  for (const h of need) {
    const grp = h.grp || h.group || '';
    let url = '';
    let how = '';
    let title = '';

    // ① 人物自带的代表视频
    const bv = (h.links || [])
      .map((l) => String((l && l.url) || '').match(/bilibili\.com\/video\/(BV[0-9A-Za-z]{10})/))
      .find(Boolean);
    if (bv) {
      const v = await view(bv[1]);
      await sleep(800);
      if (v) {
        if (grp === 'up' && v.mid) {
          const f = await face(v.mid);
          await sleep(700);
          if (f) {
            url = f;
            how = 'B 站 UP 头像';
            title = v.up || h.name;
          }
        }
        if (!url && v.pic) {
          url = v.pic;
          how = 'B 站代表视频封面';
          title = v.title;
        }
      }
    }

    // ② 站内检索 + 相关性校验
    if (!url) {
      const plan = PLAN[h.name];
      const kws = plan ? plan.kw : [`${h.name} 淋语`, h.name];
      for (const kw of kws) {
        const must = plan ? new RegExp(`(?=.*${plan.kwRe.source})(?=.*${plan.zoneRe.source})`) : new RegExp(h.name);
        const v = await searchVideo(kw, must);
        await sleep(900);
        if (v) {
          if (grp === 'up' && v.mid) {
            const f = await face(v.mid);
            await sleep(700);
            if (f) {
              url = f;
              how = 'B 站 UP 头像';
              title = h.name;
              break;
            }
          }
          url = v.pic;
          how = 'B 站淋语视频封面';
          title = v.title;
          break;
        }
      }
    }

    // ③ 百度百科词条图
    if (!url && BAIKE[h.name]) {
      for (const key of [BAIKE[h.name], h.name]) {
        const b = await baikePic(key);
        await sleep(900);
        if (b) {
          url = b.pic;
          how = '百度百科词条图';
          title = b.title;
          break;
        }
      }
    }

    if (!url) {
      report.push({ name: h.name, group: grp, status: '待补图', reason: '三类来源都没有相关图片' });
      console.error(`[miss] ${h.name}`);
      continue;
    }

    // 已指定过路径的（如 hero-75）沿用原文件名，避免改数据；没指定的顺延编号
    const file = h.img ? String(h.img).replace(/^.*\//, '') : `hero-${next}.png`;
    const outPath = path.join(IMG_DIR, file);
    const rawPath = path.join(RAW_DIR, file.replace(/\.png$/, '.raw'));
    const size = await download(url, rawPath);
    if (!size) {
      report.push({ name: h.name, status: '待补图', reason: '下载失败', url });
      console.error(`[dl-fail] ${h.name}`);
      continue;
    }
    try {
      execFileSync(PY, [path.join(ROOT, 'scripts', 'crop-hero.py'), rawPath, outPath], { stdio: 'ignore' });
    } catch (e) {
      report.push({ name: h.name, status: '待补图', reason: '裁剪失败：' + e.message, url });
      console.error(`[crop-fail] ${h.name}`);
      continue;
    }
    assign[h.name] = 'img/' + file;
    report.push({ name: h.name, group: grp, file, how, title, url });
    if (!h.img) next++;
    console.error(`[ok] ${h.name} <- ${file} (${how}) ${title.slice(0, 30)}`);
    await sleep(600);
  }

  fs.writeFileSync(
    path.join(ROOT, 'evidence', 'hero-images-20261025.json'),
    JSON.stringify({ fetchedAt: new Date().toISOString(), assign, report }, null, 2),
    'utf8'
  );
  console.error(`\n[done] 成功 ${Object.keys(assign).length} / 需要 ${need.length}，待补图 ${report.filter((r) => r.status === '待补图').length}`);
})();
