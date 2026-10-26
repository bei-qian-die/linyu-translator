'use strict';

// 语义位体系 —— 第十九轮（瓦罗淋特 / 无畏契约分区扩充）
//
// 只做一件事：在 18 号白名单之上，为瓦罗淋特分区补 8 个专属子语义位，
// 供 curated-linyu19.js / apply-linyu19.js 校验，避免又造出第二套分区写法。
//
// 约定同 13/18 号：
//   - 分区 key 固定用已有的 `瓦罗淋特`，子位一律挂在该分区之下
//   - examples 必须能在 corpus/*.txt 里逐字查到（由 scripts/verify-qc19.js 核对）
//   - 不修改 13/18 号文件本身：19 号只做「基座 + 增量」的合并导出，保证旧脚本零影响
const tax18 = require('./slot-taxonomy18.js');

const NEW_SUB = [
  {
    key: '瓦罗特工位分',
    desc: '特工定位与圈内位分式叫法：一突、二突、奶妈、女特务、黑妹、炸弹妹。',
    examples: ['一突', '二突', '奶妈', '女特务', '黑妹', '炸弹妹'],
  },
  {
    key: '瓦罗报点术语',
    desc: '地图报点与站位沟通：报点、点位、架枪、对枪、摸点、绕后。',
    examples: ['报点', '点位', '架枪', '对枪', '摸点', '绕后'],
  },
  {
    key: '瓦罗战术术语',
    desc: '回合战术与操作黑话：爆弹、默认、静步、补枪、大拉、干拉。',
    examples: ['爆弹', '默认', '静步', '补枪', '大拉', '干拉'],
  },
  {
    key: '瓦罗枪械经济',
    desc: '枪械、护甲与买装经济：爆能器、狂徒、幻影、獠犬、戍卫、短枪、长枪。',
    examples: ['爆能器', '狂徒', '幻影', '獠犬', '戍卫', '短枪', '长枪'],
  },
  {
    key: '瓦罗自称体系',
    desc: '「我 + 特工」式自称构词法：我🐍（蝰蛇）、我梦（黑梦）、我🔒（钢锁）。',
    examples: ['我🐍', '我梦', '我🔒'],
  },
  {
    key: '瓦罗地图',
    desc: '地图名与地图黑话：源工重镇、亚海悬城、日落之城、霓虹町、森寒冬港。',
    examples: ['源工重镇', '亚海悬城', '日落之城', '霓虹町', '森寒冬港'],
  },
  {
    key: '瓦罗赛事梗',
    desc: '赛事、选手与观众黑话：瓦学弟、康康、冠军。',
    examples: ['瓦学弟', '康康', '冠军'],
  },
  {
    key: '瓦罗皮肤经济',
    desc: '皮肤与商店经济：皮肤、抽卡、每日商店。',
    examples: ['皮肤', '抽卡', '每日商店'],
  },
  {
    key: '瓦罗整活梗',
    desc: '圈内整活与拟人黑话：女特务、鸡女、赔钱货、尸油、秋裤、汗脚。',
    examples: ['女特务', '赔钱货', '秋裤', '汗脚'],
  },
].map((t) => ({ ...t, isNew: true }));

const KEYS = [...tax18.KEYS, ...NEW_SUB.map((t) => t.key)];
const TAXONOMY = [...tax18.TAXONOMY, ...NEW_SUB];

const seen = new Set();
for (const t of TAXONOMY) {
  if (seen.has(t.key)) throw new Error('slot-taxonomy19: 重复 key ' + t.key);
  seen.add(t.key);
}

const splitSlot = tax18.splitSlot;
const validateSlot = (s) => splitSlot(s).filter((k) => !seen.has(k));

module.exports = { TAXONOMY, KEYS, NEW_KEYS: NEW_SUB.map((t) => t.key), splitSlot, validateSlot, BASE: tax18 };
