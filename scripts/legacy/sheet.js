'use strict';
const { execFileSync } = require('child_process');
const path = require('path');

const FFMPEG = 'D:/tools/ffmpeg/ffmpeg.exe';
const DIR = 'C:/Users/qiuzh/AppData/Local/Temp/cand';
const OUT = 'C:/Users/qiuzh/AppData/Local/Temp/labelled.png';

const ITEMS = [
  ['BV1444y1c7FN', '1 开心姐生物课'],
  ['BV15hPczdER9', '2 梵谷PK陈泽'],
  ['BV15m4y1179Y', '3 施柔儿直播'],
  ['BV1Bu4y1P79U', '4 妮蔻变身教学'],
  ['BV1MSd4BFETG', '5 埋汰姐吃播'],
  ['BV1Mk4kebEAv', '6 梵谷直播录屏'],
  ['BV1V9DiBSE77', '7 埋汰姐狂暴'],
  ['BV1Vj6CYpEmx', '8 施柔儿俩小伙'],
  ['BV1bh411v7dn', '9 元歌工友'],
  ['BV1c3411t7Li', '10 元歌'],
  ['BV1et411Q7dN', '11 妮蔻介绍'],
  ['BV1gyA6zxEXB', '12 郭语大师课玛莎'],
  ['BV1jHo8Y8ESA', '13 开心姐被怼'],
  ['BV1sC411s7NZ', '14 郭老师玛莎'],
  ['BV1vWBCBgEuT', '15 郭门会议玛莎'],
  ['BV1zc411x7tG', '16 湿柔儿怒骂三梦'],
  ['BV1zh4y1d77Y', '17 yagao妮蔻'],
];

const inputs = [];
const parts = [];
ITEMS.forEach(([bv, label], i) => {
  inputs.push('-i', path.join(DIR, bv + '.png'));
  parts.push(
    `[${i}:v]drawtext=fontfile='C\:\\\\Windows\\\\Fonts\\\\msyh.ttc':text='${label}':fontsize=22:fontcolor=yellow:box=1:boxcolor=black@0.75:x=4:y=4[l${i}]`
  );
});
parts.push(`${ITEMS.map((_, i) => `[l${i}]`).join('')}hstack=inputs=${ITEMS.length}[o]`);

execFileSync(FFMPEG, ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', parts.join(';'), '-map', '[o]', OUT], { stdio: 'inherit' });
console.log('written', OUT);
