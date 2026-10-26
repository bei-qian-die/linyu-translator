'use strict';

// 语义位体系 —— 第二十轮（淋威争锋 / 漫威争锋分区开区）
//
// 只做一件事：在 19 号白名单之上，为「淋威争锋」分区补 1 个主 key + 9 个子语义位，
// 供 curated-linyu20.js / apply-linyu20.js 校验，避免又造出第二套分区写法。
//
// 约定同 13/18/19 号：
//   - 分区主 key 固定为 `淋威争锋`（沿用项目「游戏原名淋化」惯例：漫威争锋 → 淋威争锋）
//   - 子位一律挂在该分区之下
//   - examples 必须能在 corpus/*.txt 里逐字查到（由 scripts/verify-qc20.js 核对）
//   - 不修改 13/18/19 号文件本身：20 号只做「基座 + 增量」的合并导出，保证旧脚本零影响
const tax19 = require('./slot-taxonomy19.js');

const NEW_SUB = [
  {
    key: '淋威英雄位分',
    desc: '官方三种职责与圈内位分式叫法：捍卫者、决斗家、策略家、全能英雄、奶妈、坦克位。',
    examples: ['捍卫者', '决斗家', '策略家', '奶位', '三残'],
  },
  {
    key: '淋威自称体系',
    desc: '「我X / 你X」角色代称构词法：我基（洛基）、我匕（斗篷与匕首）、我红（猩红女巫）、你冰（冰月花雪）。',
    examples: ['我基', '我匕', '我红', '你冰', '你漫', '没爱你们的话我红来爱你们'],
  },
  {
    key: '淋威地图舞台',
    desc: '地图与场景名：阿斯加德、仙宫、世界树、瓦坎达、昆仑、东京2099、九头蛇、克林塔。',
    examples: ['阿斯加德', '仙宫', '瓦坎达', '昆仑', '东京2099', '克林塔'],
  },
  {
    key: '淋威连携组合',
    desc: '连携技能与组合叫法：神嗣苏生、共生体羁绊、伽马充能、时空传送、X星球伙伴。',
    examples: ['神嗣苏生', '共生体羁绊', '伽马充能', '时空传送'],
  },
  {
    key: '淋威皮肤潮流',
    desc: '皮肤与外观经济：金皮、紫皮、泳装皮、传说皮、限定皮、 retro 系列。',
    examples: ['金皮', '紫皮', '泳装皮', '皮肤'],
  },
  {
    key: '淋威赛事圈',
    desc: '赛事与选手圈子黑话：太平洋赛区、季后赛、蓝方红方、版本之子。',
    examples: ['版本之子'],
  },
  {
    key: '淋威模式玩法',
    desc: '玩法模式黑话：占点、推车、运货、人机训练、pve、自走棋、征服、竞技模式。',
    examples: ['占点', 'pve', '竞技模式', '排位'],
  },
  {
    key: '淋威剧情线',
    desc: '世界观与剧情梗：时间流纠缠、多元宇宙、神髓场景故事线。',
    examples: ['时间流纠缠', '多元宇宙'],
  },
  {
    key: '淋威整活梗',
    desc: '圈内整活与淋语口癖：NBCS、只素、心有淋吸、daddy、again、够惹。',
    examples: ['只素', 'NBCS', '心有淋吸', 'daddy', 'again', '好惹'],
  },
].map((t) => ({ ...t, isNew: true }));

const NEW_MAIN = [
  {
    key: '淋威争锋',
    desc: '《漫威争锋》淋化分区名，覆盖英雄、地图、模式、皮肤、赛事与整活梗的全部词条。',
    examples: ['淋威争锋', '漫威争锋', '你漫', 'Marvel Rivals'],
    isNew: true,
  },
];

const KEYS = [...tax19.KEYS, ...NEW_MAIN.map((t) => t.key), ...NEW_SUB.map((t) => t.key)];
const TAXONOMY = [...tax19.TAXONOMY, ...NEW_MAIN, ...NEW_SUB];

const seen = new Set();
for (const t of TAXONOMY) {
  if (seen.has(t.key)) throw new Error('slot-taxonomy20: 重复 key ' + t.key);
  seen.add(t.key);
}

const splitSlot = tax19.splitSlot;
const validateSlot = (s) => splitSlot(s).filter((k) => !seen.has(k));

module.exports = {
  TAXONOMY,
  KEYS,
  NEW_KEYS: [...NEW_MAIN, ...NEW_SUB].map((t) => t.key),
  splitSlot,
  validateSlot,
  BASE: tax19,
};
