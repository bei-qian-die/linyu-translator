'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const FFMPEG = process.env.FFMPEG || 'D:/tools/ffmpeg/ffmpeg.exe';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36';
const OUT = path.join(__dirname, '..', '..', 'src', 'renderer', 'img');

// [imgName, bvid, mode]  mode: face=UP主头像 | cover=视频封面
const LIST = [
  ['hero-27.png', 'BV1uA4m1N7MC', 'cover'], // 孙策
  ['hero-28.png', 'BV1Dz421z7Wm', 'cover'], // 珊瑚宫心海
  ['hero-29.png', 'BV1xY4y1g7J2', 'cover'], // 腋淋（淋神 夜兰）
  ['hero-30.png', 'BV1Ds411D7fW', 'face'], // 上司磯太
  ['hero-31.png', 'BV1Bu4y1E77m', 'face'], // 四乐化碳
  ['hero-32.png', 'BV13RNF6PEpP', 'face'], // 晦暗雨季
  ['hero-33.png', 'BV1iC4y1Y7mi', 'face'], // 新酱爱追剧
  ['hero-34.png', 'BV1fMWKeNEXG', 'face'], // 生鼠不暝
  ['hero-35.png', 'BV1um4y1g77T', 'face'], // 白熊ONEヽ
  ['hero-36.png', 'BV1uA4m1N7MC', 'face'], // 去听潮声吧
  ['hero-37.png', 'BV1Ax411K7qv', 'face'], // 大啵仙女
  ['hero-38.png', 'BV1xY4y1g7J2', 'face'], // 可淋
  ['hero-39.png', 'BV1pN411t7os', 'face'], // 潮汕好男人
  ['hero-40.png', 'BV1Ui4y1i7ta', 'face'], // 水烈鸟_ZZK
  ['hero-41.png', 'BV1LX4y197Em', 'face'], // 羊崽爱吃芒果
  ['hero-42.png', 'BV1nC4y1C7t6', 'face'], // 正义的钻石男高
  ['hero-43.png', 'BV1ST411o7aW', 'face'], // 斯琴低娃老师
  ['hero-44.png', 'BV1Nx41127sR', 'face'], // 初武
  ['hero-45.png', 'BV1mL411g7Q1', 'face'] // 老凡Fv
];

async function view(bv) {
  const r = await fetch('https://api.bilibili.com/x/web-interface/view?bvid=' + bv, {
    headers: { 'User-Agent': UA, Referer: 'https://www.bilibili.com/' }
  });
  const j = await r.json();
  if (j.code !== 0) throw new Error(bv + ' view code=' + j.code);
  return j.data;
}

(async () => {
  const evidence = [];
  for (const [name, bv, mode] of LIST) {
    try {
      const d = await view(bv);
      evidence.push({
        img: name,
        bvid: bv,
        title: d.title,
        up: d.owner.name,
        mid: d.owner.mid,
        face: d.owner.face,
        play: d.stat.view,
        like: d.stat.like,
        desc: (d.desc || '').replace(/\s+/g, ' ').slice(0, 200)
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
      console.log('ok', name, mode, bv, (mode === 'face' ? d.owner.name : d.title.slice(0, 24)));
    } catch (e) {
      console.log('FAIL', name, bv, e.message);
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  fs.writeFileSync('up_evidence.json', JSON.stringify(evidence, null, 1), 'utf8');
  console.log('evidence:', evidence.length);
})();
