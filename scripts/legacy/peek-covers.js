'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const FFMPEG = process.env.FFMPEG || 'D:/tools/ffmpeg/ffmpeg.exe';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36';
const OUT = process.env.OUTDIR || 'C:/Users/qiuzh/AppData/Local/Temp/cand';
const BVS = process.argv.slice(2);

fs.mkdirSync(OUT, { recursive: true });

(async () => {
  for (const bv of BVS) {
    try {
      const r = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${bv}`, {
        headers: { 'User-Agent': UA, Referer: 'https://www.bilibili.com/' },
      });
      const j = await r.json();
      if (j.code !== 0) throw new Error('code=' + j.code);
      const pic = j.data.pic.replace(/^http:/, 'https:');
      const jpg = path.join(OUT, bv + '.jpg');
      fs.writeFileSync(jpg, Buffer.from(await (await fetch(pic, { headers: { 'User-Agent': UA, Referer: 'https://www.bilibili.com/' } })).arrayBuffer()));
      execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', jpg, '-vf', 'scale=300:200', path.join(OUT, bv + '.png')], { stdio: 'pipe' });
      console.log('ok', bv, j.data.title.slice(0, 40));
    } catch (e) {
      console.log('FAIL', bv, e.message);
    }
    await new Promise((r) => setTimeout(r, 200));
  }
})();
