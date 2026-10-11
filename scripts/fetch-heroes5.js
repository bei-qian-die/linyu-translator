'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// 迭代#6 追加：游戏通讯录系列 UP 主真图（取其 UP 主头像，来自 B 站 view 接口 owner.face）
const FFMPEG = process.env.FFMPEG || 'D:/tools/ffmpeg/ffmpeg.exe';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36';
const OUT = path.join(__dirname, '..', 'src', 'renderer', 'img');

// [imgName, bvid, mode, 归属]
const LIST = [
  ['hero-63.png', 'BV1nx4y1f7Em', 'face', '四乐化碳'],
  ['hero-64.png', 'BV1gYtnzbEGB', 'face', '晦暗雨季'],
  ['hero-65.png', 'BV1xevkeVETW', 'face', '爱吃脆皮肠vv'],
  ['hero-66.png', 'BV1Dr421p7xU', 'face', '女王糖糖子'],
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
    await new Promise((r) => setTimeout(r, 400));
  }
  const p = path.join(__dirname, '..', 'hero5_evidence.json');
  fs.writeFileSync(p, JSON.stringify(evidence, null, 1), 'utf8');
  console.log('evidence ->', p, evidence.length);
})();
