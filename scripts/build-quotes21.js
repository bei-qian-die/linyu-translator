'use strict';

// 第二十一轮名言生成：不手写，全部从本轮采集产物里提。
//
// 两个来源：
//   1) B 站「守望淋锋」视频标题 —— 标题本身就是成句，作者＝真实 UP 主，链接＝真实 BV
//   2) B 站专栏《守望先锋迷惑行为大全》的顺口溜 —— 作者＝专栏，链接＝专栏页
//
// 产出 scripts/curated-quotes21.json，字段口径同 20 号：
//   { text, author, hero, src, scene, score }
//
// 用法: node scripts/build-quotes21.js
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MANIFEST = path.join(ROOT, 'evidence/manifest-dm21-20261026190734.json');
const OUT = path.join(ROOT, 'scripts/curated-quotes21.json');

// 标题 → 涉及英雄（用于卡片/人物页的关联，可空）
const HERO_HINT = [
  ['血律', '血律'],
  ['摩西', '天使'],
  ['雾子', '雾子'],
  ['阿三', '秩序之光'],
  ['秩序之光', '秩序之光'],
  ['卢西奥', '卢西奥'],
  ['莫伊拉', '莫伊拉'],
  ['我莫', '莫伊拉'],
  ['我辛', '秩序之光'],
  ['我光', '秩序之光'],
  ['我花', '生命之梭'],
  ['我美', '美'],
  ['我律', '血律'],
  ['我摩', '天使'],
  ['钻地婆', '探奇'],
  ['无漾', '无漾'],
  ['莱耶斯', '死神'],
  ['死神', '死神'],
  ['源氏', '源氏'],
  ['神龙少侠', '源氏'],
  ['堡垒', '堡垒'],
  ['士兵76', '士兵:76'],
  ['士兵:76', '士兵:76'],
  ['黑影', '黑影'],
  ['花男', '生命之梭'],
  ['法鸡', '法老之鹰'],
  ['狂鼠', '狂鼠'],
  ['大锤', '莱因哈特'],
  ['D.Va', 'D.Va'],
  ['天使', '天使'],
];

const guessHero = (t) => {
  for (const [k, v] of HERO_HINT) if (String(t).includes(k)) return v;
  return '';
};

const SCORE_TITLE = 12; // 标题＝作者原话，最高权重
const SCORE_COLUMN = 10;

const out = [];
const seen = new Set();
const push = (q) => {
  const k = q.text.replace(/\s+/g, '');
  if (!k || seen.has(k)) return;
  seen.add(k);
  out.push(q);
};

// ---------- 1. 视频标题 ----------
const videos = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
for (const v of videos) {
  const t = String(v.title || '').trim();
  if (!t) continue;
  push({
    text: t,
    author: v.up || '',
    hero: guessHero(t),
    src: v.url || `https://www.bilibili.com/video/${v.bvid}`,
    scene: '守望淋锋 / 视频标题',
    score: SCORE_TITLE,
  });
}

// ---------- 2. 迷惑行为大全顺口溜 ----------
const CONF_URL = 'https://www.bilibili.com/read/cv4001799/';
const CONF = [
  '推车游戏不推车，占点游戏不占点',
  '街机模式骂人菜，竞技模式劝人佛',
  '经典快速甩锅王，天梯上分练英雄',
  '玻璃心犯说不得，好心建议反被嘲',
  '头铁不换是信仰，敌人跟盾都健朗',
  '团队游戏做独狼，输了双标怪友盲',
  '总是想着1v6，炸鱼不成反被遛',
  '不等集合自己上，杀了四个又怎样',
  '奶t怪c不杀人，c怪奶t没资源',
  '抢完资源不做事，队友环境易逝世',
  '和尚安娜活不了，换机动奶好不好',
  '各司其职做不到，问候彼此有一套',
  '长枪再多皆赛马，互相鄙视傻不傻',
  '集火保人意识危，末日铁拳全曹飞',
  '顺风局势偷偷混，真把自己当神棍',
  '菜不自知还乱叫，生涯一锁报大号',
  '各个频道五百强，试问键盘谁不强',
  '请求合作不语音，一进语音音量金',
];
for (const t of CONF) {
  push({
    text: t,
    author: 'B站专栏《守望先锋迷惑行为大全》',
    hero: guessHero(t),
    src: CONF_URL,
    scene: '守望淋锋 / 对局黑话顺口溜',
    score: SCORE_COLUMN,
  });
}

out.sort((a, b) => b.score - a.score);
fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n', 'utf8');
console.error(`[quotes21] 写出 ${out.length} 条 → ${path.relative(ROOT, OUT)}`);
