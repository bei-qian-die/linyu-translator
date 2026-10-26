'use strict';

// 语义位体系 —— 第十八轮（第五淋格分区扩充）
//
// 只做一件事：在 13 号白名单之上，为第五人格分区补 6 个专属子语义位，
// 供 curated-linyu18.js / apply-linyu18.js 校验，避免又造出第二套分区写法。
//
// 约定同 13 号：
//   - key 一律「分区名/子位」两段式，分区名固定用已有的 第五淋格
//   - examples 必须能在 corpus/*.txt 里逐字查到（由 scripts/verify-qc18.js 核对）
//   - 不修改 13 号文件本身：18 号只做「基座 + 增量」的合并导出，保证旧脚本零影响
const tax13 = require('./slot-taxonomy13.js');

const NEW_SUB = [
  {
    key: '庄园术语',
    desc: '对局内的地图机制与操作术语：密码机、地窖、狂欢之椅、挽留、摇表、打洞、点位。',
    examples: ['密码机', '地窖', '狂欢之椅', '挽留', '摇表', '点位'],
  },
  {
    key: '监管者黑话',
    desc: '监管者（屠夫）阵营的叫法与强度黑话：屠夫、屠皇、守椅、喧嚣。',
    examples: ['屠夫', '屠皇', '人皇', '守椅'],
  },
  {
    key: '求生者位分',
    desc: '求生者阵营的位分式称呼与拟人叫法：女士、大人、男宠、女特务、祭司神。',
    examples: ['红杉木女士', '庄园主大人', '男宠', '女特务', '祭司神'],
  },
  {
    key: '第五角色',
    desc: '第五人格角色的淋化叫法（我蝶 / 你杰 / 奈布 这一类），与人物传双向可达。',
    examples: ['我蝶', '你杰', '你盲', '奈布', '调马师'],
  },
  {
    key: '庄园皮肤术语',
    desc: '皮肤与抽卡经济：金皮、紫皮、回声皮、碎片、限定金、演绎之星。',
    examples: ['金皮', '紫皮', '回声皮', '碎片', '演绎之星'],
  },
  {
    key: '庄园赛事',
    desc: '赛事与段位黑话：IVL、秋季赛、季后赛、秒倒、入口即化。',
    examples: ['秒倒', '入口即化', '排位'],
  },
].map((t) => ({ ...t, isNew: true }));

const KEYS = [...tax13.KEYS, ...NEW_SUB.map((t) => t.key)];
const TAXONOMY = [...tax13.TAXONOMY, ...NEW_SUB];

const seen = new Set();
for (const t of TAXONOMY) {
  if (seen.has(t.key)) throw new Error('slot-taxonomy18: 重复 key ' + t.key);
  seen.add(t.key);
}

const splitSlot = tax13.splitSlot;
const validateSlot = (s) => splitSlot(s).filter((k) => !seen.has(k));

module.exports = { TAXONOMY, KEYS, NEW_KEYS: NEW_SUB.map((t) => t.key), splitSlot, validateSlot, BASE: tax13 };
