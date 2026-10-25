'use strict';

// 第八轮配图采集（2026-10-25）
//
// 硬约束：只用真实图片源，不用 AI 图、不自己画。
//   UP 主        → B 站头像（未露脸的 UP 一律用头像，这本来就是项目既定规则）
//   游戏角色     → B 站「该角色的淋语视频」封面，其次该角色名的淋语检索首条封面
//   真人 / AI    → 其代表视频封面
// 全部走 B 站公开接口（搜索 + view + card），不带凭据；抓到的 URL 全部记进 evidence/hero-images.json。
//
// 落盘：256x256 居中裁剪后存 src/renderer/img/hero-<n>.png，缩略图 img/thumb/hero-<n>.webp。
// 裁剪与压缩交给 scripts/optimize-images.py，本脚本只负责下载原图。

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

/** 搜视频：返回第一条的 bvid / 标题 / 封面 */
async function searchVideo(kw) {
  const j = await api(
    `https://api.bilibili.com/x/web-interface/search/type?search_type=video&keyword=${encodeURIComponent(kw)}&page=1`
  );
  const list = (j && j.data && j.data.result) || [];
  for (const v of list) {
    if (v.bvid && v.pic) return { bvid: v.bvid, title: String(v.title || '').replace(/<[^>]+>/g, ''), pic: v.pic };
  }
  return null;
}

/** 搜 UP 主：返回 mid */
async function searchUser(kw) {
  const j = await api(
    `https://api.bilibili.com/x/web-interface/search/type?search_type=bili_user&keyword=${encodeURIComponent(kw)}&page=1`
  );
  const list = (j && j.data && j.data.result) || [];
  for (const u of list) if (u.mid) return { mid: u.mid, name: String(u.uname || '') };
  return null;
}

/** 取 UP 主头像 */
async function userFace(mid) {
  const j = await api(`https://api.bilibili.com/x/web-interface/card?mid=${mid}&photo=false`);
  const face = j && j.data && j.data.card && j.data.card.face;
  return face || '';
}

async function download(url, dest) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: HD });
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

// 每个英雄的检索策略：优先关键词在前
const PLAN = {
  // 原神 / 淋神
  雷电将军: { kw: ['【淋神】雷电将军', '淋神 雷神', '雷电将军'], zone: '淋神' },
  流浪者: { kw: ['【淋神】流浪者', '淋神 散兵', '原神 流浪者'], zone: '淋神' },
  胡桃: { kw: ['【淋神】胡桃', '淋神 胡桃', '原神 胡桃'], zone: '淋神' },
  刻晴: { kw: ['【淋神】刻晴', '淋神 刻晴', '原神 刻晴'], zone: '淋神' },
  妮露: { kw: ['【淋神】妮露', '淋神 妮露', '原神 妮露'], zone: '淋神' },
  纳阴妲: { kw: ['【淋神】纳阴妲', '淋神 纳西妲'], zone: '淋神' },
  我雅: { kw: ['【淋神】你雅首谈女王是怎样炼成的', '淋神 你雅'], zone: '淋神' },
  莱欧斯利: { kw: ['【淋神】莱欧斯利入赘草行久', '淋神 莱欧斯利'], zone: '淋神' },
  // 王者淋耀
  蒜姐: { kw: ['【王者淋耀】蒜姐推销自用好物红杉木', '王者淋耀 蒜姐'], zone: '王者淋耀' },
  我米: { kw: ['【王者淋耀】你们对我米所做的这些累累的罪行', '王者淋耀 米莱狄'], zone: '王者淋耀' },
  我月: { kw: ['【淋月峡谷吸人日记】蓝月亮吸', '淋月峡谷 海月'], zone: '王者淋耀' },
  我曌: { kw: ['【淋者荣耀】我曌知心性情大气巧思', '淋者荣耀 武则天'], zone: '淋者荣耀' },
  // 第五淋格
  淋人金Daddy: { kw: ['【第五淋格】淋人金Daddy脚刹麦子', '第五淋格 淋人金'], zone: '第五淋格' },
  凤蝶: { kw: ['【第五淋格】凤蝶化身冰雪女王', '第五淋格 凤蝶'], zone: '第五淋格' },
  // 守望淋锋
  血律Daddy: { kw: ['【守望淋锋】又素血律Daddy掌掴单牵摩西女', '守望淋锋 血律'], zone: '守望淋锋' },
  摩西女: { kw: ['【守望淋锋】又素血律Daddy掌掴单牵摩西女', '守望淋锋 摩西'], zone: '守望淋锋' },
  // 淋明杀鸡
  枝性美克里斯: { kw: ['[淋明杀机]枝性美克里斯惨遭冻肉陷害', '淋明杀机'], zone: '淋明杀鸡' },
  // 星淋铁道
  火淋: { kw: ['《β坏:星淋铁道》火淋角色PV', '星淋铁道 火淋'], zone: '星淋铁道' },
  淋光: { kw: ['《β坏:星淋铁道》淋光角色PV', '星淋铁道 淋光'], zone: '星淋铁道' },
  // 三角淋 / 淋角洲
  威龙daddy: { kw: ['三角淋行动 女特务首次潜入风暴玛焰', '三角淋行动'], zone: '三角淋行动' },
  交女王: { kw: ['【淋角洲行动】交女王们驾到', '淋角洲行动'], zone: '淋角洲行动' },
  // DOTA / 淋安京
  杂技女亡帕克: { kw: ['βeta2 杂技女亡帕克淋动全场', '刀塔 帕克'], zone: 'DOTA 区' },
  铁T成长: { kw: ['铁T成长用爱翻转全世界 撅战！淋安京', '撅战淋安京'], zone: '撅战淋安京' },
  // 真人 / AI
  阴婷宝: { kw: ['【阴婷宝】国内首个内置周阴婷语音包的人工智能', '阴婷宝'], zone: '真人分区' },
  木头人的磁带旧时光: { kw: ['木头人的磁带旧时光', '周阴婷 木头人'], zone: '真人分区' },
  'FLY 组合工作室': { kw: ['FLY组合工作室 阴婷宝', 'FLY组合 淋语'], zone: '真人分区' },
};

(async () => {
  const lore = require(path.join(ROOT, 'src', 'core', 'lore.js'));
  const existing = new Set(fs.readdirSync(IMG_DIR));
  const need = lore.heroes.filter((h) => !h.img || !existing.has(String(h.img).replace(/^.*\//, '')));

  // 下一个可用编号
  let next = 1;
  for (const f of existing) {
    const m = f.match(/^hero-(\d+)\./);
    if (m) next = Math.max(next, Number(m[1]) + 1);
  }

  const report = [];
  const assign = {};

  for (const h of need) {
    const grp = h.grp || h.group || '';
    let url = '';
    let how = '';
    let title = '';

    if (grp === 'up') {
      // 未露脸的 UP 一律用头像
      const u = await searchUser(h.name);
      await sleep(900);
      if (u) {
        const face = await userFace(u.mid);
        await sleep(700);
        if (face) {
          url = face;
          how = 'B 站 UP 头像';
          title = u.name;
        }
      }
    }
    if (!url) {
      const plan = PLAN[h.name];
      const kws = plan ? plan.kw : [h.name + ' 淋语', h.name];
      for (const kw of kws) {
        const v = await searchVideo(kw);
        await sleep(900);
        if (v) {
          url = v.pic;
          how = 'B 站淋语视频封面';
          title = v.title;
          break;
        }
      }
    }
    if (!url) {
      report.push({ name: h.name, status: '缺图', reason: '检索不到可用封面或头像' });
      console.error(`[miss] ${h.name}`);
      continue;
    }

    const full = /^https?:/i.test(url) ? url : 'https:' + url;
    const file = `hero-${next}.png`;
    const rawPath = path.join(RAW_DIR, `hero-${next}.raw`);
    const size = await download(full, rawPath);
    if (!size) {
      report.push({ name: h.name, status: '缺图', reason: '下载失败', url: full });
      console.error(`[dl-fail] ${h.name}`);
      continue;
    }
    // 居中裁剪到 256x256 再落盘（与原有人物图规格一致）
    const PY = process.env.PY || 'python';
    try {
      execFileSync(PY, [
        path.join(ROOT, 'scripts', 'crop-hero.py'),
        rawPath,
        path.join(IMG_DIR, file),
      ], { stdio: 'ignore' });
    } catch (e) {
      report.push({ name: h.name, status: '缺图', reason: '裁剪失败：' + e.message, url: full });
      console.error(`[crop-fail] ${h.name} ${e.message}`);
      continue;
    }
    assign[h.name] = 'img/' + file;
    report.push({ name: h.name, file, url: full, how, title, zone: (PLAN[h.name] || {}).zone || '' });
    console.error(`[ok ${next}] ${h.name} <- ${file} (${how}) ${title.slice(0, 28)}`);
    next++;
    await sleep(600);
  }

  fs.writeFileSync(
    path.join(ROOT, 'evidence', 'hero-images-20261025.json'),
    JSON.stringify({ fetchedAt: new Date().toISOString(), assign, report }, null, 2),
    'utf8'
  );
  console.error(`\n[done] 成功 ${Object.keys(assign).length} / 需要 ${need.length}`);
  console.error('缺图 ' + report.filter((r) => r.status === '缺图').length);
})();
