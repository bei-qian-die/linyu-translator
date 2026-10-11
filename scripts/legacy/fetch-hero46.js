'use strict';
// 抓取新英雄头像（UP主未露脸 -> 用其社交平台头像 owner.face）
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const FFMPEG = process.env.FFMPEG || 'D:/tools/ffmpeg/ffmpeg.exe';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36';
const OUT = path.join(__dirname, '..', '..', 'src', 'renderer', 'img');

const LIST = [
  ['hero-46.png', 'BV1rV411u7Gn'],
];

(async () => {
  for (const [name, bv] of LIST) {
    const r = await fetch('https://api.bilibili.com/x/web-interface/view?bvid=' + bv, {
      headers: { 'User-Agent': UA, Referer: 'https://www.bilibili.com/' },
    });
    const j = await r.json();
    if (j.code !== 0) {
      console.log('view fail', bv, j.code);
      continue;
    }
    const d = j.data;
    console.log('video:', d.title, '| up:', d.owner.name, '| play:', d.stat.view, '| like:', d.stat.like);
    console.log('face:', d.owner.face);
    let url = String(d.owner.face || '').replace(/^http:/, 'https:');
    if (!url) {
      console.log('no face, fallback cover');
      url = String(d.pic).replace(/^http:/, 'https:');
    }
    const buf = Buffer.from(await (await fetch(url, { headers: { 'User-Agent': UA, Referer: 'https://www.bilibili.com/' } })).arrayBuffer());
    const tmp = path.join(OUT, '_tmp_' + name.replace('.png', '.jpg'));
    fs.writeFileSync(tmp, buf);
    execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', tmp, '-vf', 'scale=512:512:force_original_aspect_ratio=increase,crop=512:512,scale=256:256', path.join(OUT, name)], { stdio: 'pipe' });
    fs.unlinkSync(tmp);
    console.log('ok', name, fs.statSync(path.join(OUT, name)).size, 'bytes');
  }
})();
