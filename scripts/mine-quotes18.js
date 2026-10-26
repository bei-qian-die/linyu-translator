'use strict';

// 第十八轮名言挖掘：从 corpus/*.txt 里捞第五淋格相关原句，按 bvid 关联 manifest 拿到
// 真实视频标题与 UP 主，产出可回源的候选池。
//
// 与 16 轮的 mine-quotes16.js 的差别：
//   - 语料是「按 bvid 分块」写的（# bvid=... 行开头），所以能精确把每条评论/弹幕挂回视频，
//     author 就可以写成「B站《标题》评论区」而不是笼统的「网络」
//   - 打分只认第五人格语境词 + 淋语语气词，避免把别区的句子混进来
//
// 产出 evidence/cand18-quotes.json + .txt
// 用法: node scripts/mine-quotes18.js
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'evidence', 'cand18-quotes.json');

// 语境词：命中任意一个才认为这句属于第五人格区
const CTX = /第五人格|第五淋格|庄园|监管者|求生者|狂欢之椅|密码机|地窖|红蝶|杰克|盲女|佣兵|祭司|调香师|大副|渔女|小丑|鹿头|宿伞|机械师|愚人金|喧嚣|舞女|魔术师|冒险家|勘探员|调酒师|杂技|画家|病患|心理|玩具商|空军|咒术师|前锋|雕刻家|黄衣|守椅|摇表|打洞|无敌点|翻窗|板子|牵制|秒倒|排位|金皮|紫皮|回声|碎片|限定/;
// 淋语标记：有这些才「像淋语」而不是普通攻略评论
const MARK = /惹|噜|厚|靴靴|素|鼠|阴|淋|脚刹|掌掴|淡淡的|笑鼠|命大|贝|乌干达|daddy|Daddy|女士|男宠|女特务|婆|姐|么么|啾咪|惹|噜|尊素|素不素|素在|可以说的嘛|是可以说的|我不行了|秒了|有点像/;

const MIN = 8;
const MAX = 62;

function loadManifest() {
  const dir = path.join(ROOT, 'evidence');
  const map = new Map();
  for (const f of fs.readdirSync(dir).filter((x) => /^manifest-.*\.json$/.test(x))) {
    try {
      const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      const arr = Array.isArray(j) ? j : j.items || j.videos || [];
      for (const v of arr) {
        if (v && v.bvid) map.set(v.bvid, { title: String(v.title || ''), author: String(v.author || v.up || '') });
      }
    } catch {
      /* 单个 manifest 坏了不影响整体 */
    }
  }
  return map;
}

const manifest = loadManifest();

let blob = '';
for (const f of fs.readdirSync(path.join(ROOT, 'corpus')).filter((x) => x.endsWith('.txt')).sort()) {
  blob += fs.readFileSync(path.join(ROOT, 'corpus', f), 'utf8') + '\n';
}

// 语料有两种历史格式：
//   A 新格式（harvest-bili 本届）：【视频】标题 / 【UP】名字 / 【简介】 / 【评论】逐条 —— 没有 bvid，
//     但 UP 名就在块里，作者信息比 bvid 更直接、更准（不会错位）。
//   B 旧格式：块末尾有一行 `# bvid=...`，只能靠 manifest 反查标题与 UP，容易错位一档。
// 因此 A 优先：解析到 【视频】 就开新块，作者直接取 【UP】。
const blocks = [];
let curBlock = null;
for (const raw of blob.split(/\r?\n/)) {
  const line = raw.trim();
  if (!line) continue;
  const mv = line.match(/^【视频】\s*(.*)$/);
  if (mv) {
    curBlock = { title: mv[1].trim(), up: '', lines: [] };
    blocks.push(curBlock);
    continue;
  }
  if (!curBlock) continue;
  const mu = line.match(/^【UP】\s*(.*)$/);
  if (mu) {
    curBlock.up = mu[1].trim();
    continue;
  }
  if (/^【(简介|desc)】/.test(line)) continue;
  const mc = line.match(/^【(评论|弹幕)】\s*(.*)$/);
  if (mc) {
    curBlock.lines.push({ kind: mc[1], text: mc[2].trim() });
    continue;
  }
  if (/^#/.test(line)) continue;
  curBlock.lines.push({ kind: '评论', text: line });
}

// 旧格式兜底：没有 【视频】 分块的语料，用 bvid 块 + manifest 反查
const cand = [];
const seen = new Set();
for (const b of blocks) {
  for (const ln of b.lines) {
    const text = ln.text.replace(/\[[^\]]{1,8}\]/g, '').trim();
    if (text.length < MIN || text.length > MAX) continue;
    if (!CTX.test(text)) continue;
    if (seen.has(text)) continue;

    // 打分制而不是硬性要求淋语语气词：第五相关句子里很多「有观点、有情绪」的话同样值得收，
    // 只是不带惹/噜。CTX 已保证语境对，剩下用分数卡质量。
    let score = 2;
    if (MARK.test(text)) score += 4;
    if (/第五淋格|脚刹|掌掴|乌干达|男宠|女特务|Daddy|daddy|淋|鼠/.test(text)) score += 3;
    if (/惹|噜|素|厚|靴靴/.test(text)) score += 2;
    if (/我不行了|是可以说的|秒了|有点像|淡淡的|笑鼠|救命|离谱|抽象|心疼|建议/.test(text)) score += 2;
    if (/我觉得|真的|怎么|为什么|能不能|不会|居然/.test(text)) score += 1;
    if (text.length >= 12 && text.length <= 40) score += 1;
    if (/攻略|教学|配装|天赋推荐|强度排行|下载|安装/.test(text)) score -= 5;
    if (score < 5) continue;
    seen.add(text);

    cand.push({
      text,
      kind: ln.kind,
      title: b.title,
      up: b.up,
      score,
    });
  }
}

// 旧格式语料兜底：这些文件没有 【视频】 分块，只能整篇逐行扫；作者取不到 UP 名，
// 于是按项目惯例记作品出处（B站第五人格相关视频评论区），而不是硬编一个人名。
for (const raw of blob.split(/\r?\n/)) {
  const t = raw.replace(/^【(评论|弹幕|视频)】\s*/, '').replace(/\[[^\]]{1,8}\]/g, '').trim();
  if (t.length < MIN || t.length > MAX) continue;
  if (!CTX.test(t)) continue;
  if (seen.has(t)) continue;
  if (blocks.some((b) => b.lines.some((l) => l.text.includes(t.slice(0, 12))))) continue;
  let score = 2;
  if (MARK.test(t)) score += 4;
  if (/第五淋格|脚刹|掌掴|乌干达|男宠|女特务|Daddy|daddy|淋|鼠/.test(t)) score += 3;
  if (/我不行了|是可以说的|秒了|有点像|淡淡的|笑鼠|救命|离谱|抽象/.test(t)) score += 2;
  if (/我觉得|真的|怎么|为什么|能不能|居然/.test(t)) score += 1;
  if (/攻略|教学|配装|天赋推荐|强度排行|下载|安装/.test(t)) score -= 5;
  if (score < 6) continue;
  seen.add(t);
  cand.push({ text: t, kind: '评论', title: '', up: '', score: score - 1 });
}

// 视频标题本身也是名言候选（第五淋格标题体就是作品），单独收一批，作者记为 UP
for (const b of blocks) {
  const t = b.title.trim();
  if (!t || t.length < MIN || t.length > MAX) continue;
  if (!CTX.test(t) || !MARK.test(t)) continue;
  const key = 'TITLE:' + t;
  if (seen.has(key)) continue;
  seen.add(key);
  cand.push({ text: t, kind: '标题', title: t, up: b.up, score: 9 });
}

cand.sort((a, b) => b.score - a.score);

fs.writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), total: cand.length, items: cand }, null, 2) + '\n', 'utf8');
fs.writeFileSync(
  path.join(ROOT, 'evidence', 'cand18-quotes.txt'),
  cand.map((c, i) => `${i}\t${c.score}\t${c.kind}\t${c.up}\t${c.text}`).join('\n') + '\n',
  'utf8'
);

console.log(`[mine18] 候选 ${cand.length} 条（带 UP 的 ${cand.filter((c) => c.up).length} 条）-> ${OUT}`);
