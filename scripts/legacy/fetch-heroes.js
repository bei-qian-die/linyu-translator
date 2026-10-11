'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const FFMPEG = process.env.FFMPEG || 'D:/tools/ffmpeg/ffmpeg.exe';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36';
const OUT = path.join(__dirname, '..', '..', 'src', 'renderer', 'img');

// [输出文件名, bvid]
const ALL = [
  ['hero-13.png', 'BV1XL411i7cc'],
  ['hero-14.png', 'BV15hPczdER9'],
  ['hero-15.png', 'BV1yu4y1r7mL'],
  ['hero-16.png', 'BV1gyA6zxEXB'],
  ['hero-17.png', 'BV1dV411u7qQ'],
  ['hero-18.png', 'BV1Zw411c73Y'],
  ['hero-19.png', 'BV1p34y1N7oL'],
  ['hero-20.png', 'BV1444y1c7FN'],
  ['hero-21.png', 'BV1MSd4BFETG'],
  ['hero-22.png', 'BV15m4y1179Y'],
  ['hero-23.png', 'BV1csHy6nEGn'],
  ['hero-24.png', 'BV1c3411t7Li'],
  ['hero-25.png', 'BV1et411Q7dN'],
  ['hero-26.png', 'BV1wb41177tk'],
];
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const LIST = only ? ALL.filter(([n]) => only.includes(n)) : ALL;

async function view(bv) {
  const r = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${bv}`, {
    headers: { 'User-Agent': UA, Referer: 'https://www.bilibili.com/' },
  });
  const j = await r.json();
  if (j.code !== 0) throw new Error(`${bv} view code=${j.code}`);
  return j.data;
}

(async () => {
  for (const [name, bv] of LIST) {
    try {
      const d = await view(bv);
      const pic = d.pic.replace(/^http:/, 'https:');
      const tmp = path.join(OUT, '_tmp_' + name.replace('.png', '.jpg'));
      const buf = Buffer.from(
        await (await fetch(pic, { headers: { 'User-Agent': UA, Referer: 'https://www.bilibili.com/' } })).arrayBuffer()
      );
      fs.writeFileSync(tmp, buf);
      execFileSync(
        FFMPEG,
        ['-y', '-loglevel', 'error', '-i', tmp, '-vf', 'scale=512:512:force_original_aspect_ratio=increase,crop=512:512,scale=256:256', path.join(OUT, name)],
        { stdio: 'pipe' }
      );
      fs.unlinkSync(tmp);
      console.log('ok', name, bv, d.title.slice(0, 28));
    } catch (e) {
      console.log('FAIL', name, bv, e.message);
    }
    await new Promise((r) => setTimeout(r, 250));
  }
})();
