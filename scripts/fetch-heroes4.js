'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// 迭代#6 新增英雄真图：游戏分区用所在系列视频的封面，UP主分区用其 UP 主头像。
const FFMPEG = process.env.FFMPEG || 'D:/tools/ffmpeg/ffmpeg.exe';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36';
const OUT = path.join(__dirname, '..', 'src', 'renderer', 'img');

// [imgName, bvid, mode, 归属]
const LIST = [
  ['hero-47.png', 'BV1nx4y1f7Em', 'cover', '我华（伽罗·太华）'],
  ['hero-48.png', 'BV1CM4m1R7Ve', 'cover', '我泔（甄姬）'],
  ['hero-49.png', 'BV1WV4y1Y7Hh', 'cover', '我妲（妲己）'],
  ['hero-50.png', 'BV19V41137xy', 'cover', '我虞（虞姬）'],
  ['hero-51.png', 'BV1rFGbzFEvp', 'cover', '我琴（娑娜）'],
  ['hero-52.png', 'BV1ZM4y1273S', 'cover', '我光（拉克丝）'],
  ['hero-53.png', 'BV1hx4y1s7gL', 'cover', '我鸟（知更鸟）'],
  ['hero-54.png', 'BV1iz4y177AR', 'face', '暴躁的鹿鹿'],
  ['hero-55.png', 'BV1hK4ozfEhJ', 'face', '坚决不打羊胎素'],
  ['hero-56.png', 'BV1S7411p7at', 'face', '妖女即将收服BadBoy'],
  ['hero-57.png', 'BV1Kh4y1d7Nx', 'face', '提瓦淋新人桑'],
  ['hero-58.png', 'BV1ngnRzoEdm', 'face', '伤心凉茶'],
  ['hero-59.png', 'BV17CiGeUEZc', 'face', '一米六也很厉害啦'],
  ['hero-60.png', 'BV1sL4y1w7gc', 'cover', '凤仙子（罗玉凤）'],
];

async function view(bv) {
  const r = await fetch('https://api.bilibili.com/x/web-interface/view?bvid=' + bv, {
    headers: { 'User-Agent': UA, Referer: 'https://www.bilibili.com/' },
  });
  const j = await r.json();
  if (j.code !== 0) throw new Error(bv + ' view code=' + j.code);
  return j.data;
}

(async () => {
  const evidence = [];
  for (const [name, bv, mode, who] of LIST) {
    try {
      const d = await view(bv);
      evidence.push({
        img: name,
        who,
        bvid: bv,
        title: d.title,
        up: d.owner.name,
        mid: d.owner.mid,
        face: d.owner.face,
        play: d.stat.view,
        like: d.stat.like,
        desc: (d.desc || '').replace(/\s+/g, ' ').slice(0, 200),
      });
      let url = (mode === 'face' ? d.owner.face : d.pic) || '';
      url = url.replace(/^http:/, 'https:').replace(/@.*$/, '');
      const tmp = path.join(OUT, '_t_' + name.replace('.png', '.jpg'));
      const buf = Buffer.from(
        await (await fetch(url, { headers: { 'User-Agent': UA, Referer: 'https://www.bilibili.com/' } })).arrayBuffer()
      );
      fs.writeFileSync(tmp, buf);
      execFileSync(
        FFMPEG,
        ['-y', '-loglevel', 'error', '-i', tmp, '-vf', 'scale=512:512:force_original_aspect_ratio=increase,crop=512:512,scale=256:256', path.join(OUT, name)],
        { stdio: 'pipe' }
      );
      fs.unlinkSync(tmp);
      console.log('ok', name, mode, bv, who, '|', d.title.slice(0, 24));
    } catch (e) {
      console.log('FAIL', name, bv, e.message);
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  fs.writeFileSync(path.join(__dirname, '..', 'evidence', 'hero4_evidence.json'), JSON.stringify(evidence, null, 1), 'utf8');
  console.log('evidence:', evidence.length);
})();
