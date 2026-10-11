'use strict';
const fs = require('fs');
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const HD = { 'User-Agent': UA, Referer: 'https://www.bilibili.com/', Cookie: 'buvid3=1ABC2DEF-3456-7890-ABCD-EF012345678939623infoc' };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function json(url) {
  const r = await fetch(url, { headers: HD });
  return r.json();
}

async function search(keyword, limit) {
  const u =
    'https://api.bilibili.com/x/web-interface/search/type?search_type=video&page_size=30&keyword=' +
    encodeURIComponent(keyword) +
    '&page=1';
  const j = await json(u);
  if (j.code !== 0) {
    console.error('search fail', keyword, j.code, j.message);
    return [];
  }
  const res = (j.data && j.data.result) || [];
  return res
    .map((v) => ({ bvid: v.bvid, title: (v.title || '').replace(/<[^>]*>/g, ''), author: v.author, play: v.play, like: v.like }))
    .filter((v) => v.bvid)
    .sort((a, b) => (b.play || 0) - (a.play || 0))
    .slice(0, limit);
}

function parseDm(xml) {
  const out = [];
  const re = /<d p="[^"]*"[^>]*>([^<]*)<\/d>/g;
  let m;
  while ((m = re.exec(xml))) out.push(m[1]);
  return out
    .join('\n')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .split('\n');
}

async function pull(v, tag, dmN, cmtN) {
  const lines = [];
  const vr = await json('https://api.bilibili.com/x/web-interface/view?bvid=' + v.bvid);
  if (vr.code !== 0) {
    console.error(' view fail', v.bvid, vr.code);
    return lines;
  }
  const d = vr.data;
  lines.push(`\n==== [${tag}] ${v.bvid} ${d.title} ==== up:${d.owner.name} play:${d.stat.view} like:${d.stat.like}`);
  if (d.desc && d.desc.trim()) lines.push('[desc] ' + d.desc.trim().replace(/\s+/g, ' ').slice(0, 400));
  try {
    const dr = await fetch('https://api.bilibili.com/x/v1/dm/list.so?oid=' + d.cid, { headers: HD });
    const buf = Buffer.from(await dr.arrayBuffer());
    parseDm(buf.toString('utf8'))
      .slice(0, dmN)
      .forEach((x) => x.trim() && lines.push('[dm] ' + x.replace(/\s+/g, ' ')));
  } catch (e) {
    console.error(' dm fail', v.bvid, e.message);
  }
  const PAGES = Number(process.env.PAGES || 2);
  for (let pn = 1; pn <= PAGES; pn++) {
    try {
      const rj = await json(`https://api.bilibili.com/x/v2/reply?type=1&oid=${d.aid}&sort=2&ps=20&pn=${pn}`);
      if (rj.code === 0 && rj.data && rj.data.replies) {
        for (const c of rj.data.replies) {
          lines.push('[cmt] ' + c.content.message.replace(/\s+/g, ' ').slice(0, 300));
          for (const s of (c.replies || []).slice(0, 3)) lines.push('[sub] ' + s.content.message.replace(/\s+/g, ' ').slice(0, 200));
        }
      }
    } catch (e) {
      console.error(' reply fail', v.bvid, e.message);
    }
    await sleep(350);
  }
  console.error('ok', tag, v.bvid, d.title.slice(0, 26));
  await sleep(350);
  return lines;
}

const P1 = [
  ['淋语', 8],
  ['高等淋语', 6],
  ['淋语教程', 5],
  ['淋言淋语', 5],
  ['淋语十级', 4],
  ['淋语翻译', 4],
  ['淋学', 4],
  ['淋语语录', 4],
  ['蔡依林 淋语', 4],
  ['淋淋 语录', 4],
  ['通讯录 语录', 5],
  ['花露水', 3],
  ['郭言郭语', 4],
  ['完颜慧德', 4]
];

const P2 = [
  ['肘姐', 4],
  ['梵谷', 3],
  ['那艺娜', 4],
  ['三梦奇缘', 4],
  ['万人迷', 3],
  ['施柔儿', 3],
  ['埋汰姐', 3],
  ['开心姐 抖音', 3],
  ['老地瓜', 3],
  ['埃及艳后 东北', 3],
  ['鹅妈妈', 3],
  ['玛莎 康熙', 4],
  ['曲婉婷', 3],
  ['指南杰斯猫', 4],
  ['庄周 荣耀 主播', 4],
  ['元歌 国服', 3],
  ['妮蔻 主播', 3],
  ['拉比克', 3],
  ['人类早期驯服', 3],
  ['网络热词 梗', 6]
];

const P3 = [
  ['淋者荣耀', 6],
  ['王者淋耀', 4],
  ['淋语 弹幕', 4],
  ['楼兰 完颜慧德', 4],
  ['心理咨熊师', 3],
  ['阴后咏叹调', 3],
  ['地才 淋', 3],
  ['珊瑚宫心海', 3],
  ['原神 女角色 梗', 4],
  ['荣耀 女英雄 主播', 4],
  ['元歌 王者荣耀', 3],
  ['庄周 荣耀', 3],
  ['刀塔 拉比克', 2],
  ['英雄联盟 妮蔻', 2],
  ['白袜 体育生 梗', 3],
  ['男高 小剧场', 3],
  ['那艺娜 爱如火', 3],
  ['三梦奇缘 名场面', 3],
  ['郭老师 名场面', 3],
  ['肘姐 直播名场面', 3],
  ['玛莎 康熙来了 名场面', 2],
  ['何炅 名场面 梗', 3],
  ['淋语 造句', 4],
  ['淋语 发音', 3],
  ['本质艾淋', 3]
];

const P4 = [
  ['淋语', 10],
  ['淋语大全', 4],
  ['淋语字典', 4],
  ['淋语对照', 3],
  ['淋语考试', 4],
  ['淋语听力', 3],
  ['淋语翻唱', 4],
  ['淋语说唱', 3],
  ['淋王星', 4],
  ['小语种 淋语', 3],
  ['本质艾淋', 4],
  ['地才 蔡依林', 4],
  ['特务J 蔡依林', 3],
  ['舞娘 蔡依林', 3],
  ['大艺术家 蔡依林', 3],
  ['我呸 蔡依林', 3],
  ['花露水 姐圈', 4],
  ['韩美娟 屁友', 3],
  ['尖子斗 姐圈', 3],
  ['华姐 名场面', 3],
  ['姐圈 直播 名场面', 5],
  ['通讯录 女王', 5],
  ['阴 文学 弹幕', 3],
  ['抽象语录 名场面', 5],
  ['小仙女 梗 语录', 4],
  ['网络语言 演变 梗', 5],
  ['淋语 学习 教程', 5],
  ['淋语 发音 教学', 4]
];

const P5 = [
  ['大乔 主播', 3],
  ['貂蝉 主播', 3],
  ['西施 荣耀 主播', 3],
  ['王昭君 荣耀 主播', 3],
  ['嫦娥 荣耀', 3],
  ['海月 荣耀', 3],
  ['少司缘 荣耀', 3],
  ['云缨 荣耀', 3],
  ['瑶 荣耀 主播', 3],
  ['上官婉儿 荣耀', 3],
  ['伽罗 荣耀', 3],
  ['干将莫邪 荣耀', 3],
  ['卡芙卡 星铁', 3],
  ['阮梅 星铁', 3],
  ['流萤 星铁', 3],
  ['知更鸟 星铁', 3],
  ['纳西妲 原神', 3],
  ['芙宁娜 原神', 3],
  ['闲云 原神', 3],
  ['恰斯卡 原神', 3],
  ['卡莎 英雄联盟', 3],
  ['阿卡丽 英雄联盟', 3],
  ['痛苦女王 刀塔', 2],
  ['金铲铲 女英雄', 3],
  ['荣耀 女英雄 强度榜', 4],
  ['荣耀 男 擦边 主播', 4],
  ['荣耀 白袜', 3],
  ['直播 名场面 抽象 弹幕', 5]
];

const P6 = [
  ['淋语 语法', 5],
  ['淋语 黑话', 5],
  ['淋语 谐音梗', 5],
  ['通讯录 黑话', 5],
  ['通讯录 梗 大全', 5],
  ['姐圈', 4],
  ['古早 网络 流行语 盘点', 5],
  ['淋宇宙', 4],
  ['淋语 歌曲', 4],
  ['淋语 说唱', 3],
  ['蔡依林 地才', 4],
  ['蔡依林 花蝴蝶', 3],
  ['蔡依林 Ugly Beauty', 3],
  ['特务J', 3],
  ['大艺术家 蔡依林', 3],
  ['我呸', 3],
  ['柠檬草的味道', 2],
  ['郭语 教程', 4],
  ['楼兰语', 4],
  ['完颜慧德 语录', 4],
  ['抽象 语录 盘点', 4],
  ['那艺娜 名场面', 4],
  ['三梦奇缘 语录', 3],
  ['万人迷 刘翠霞', 3],
  ['肘姐 语录', 3],
  ['第五人格 主播 梗', 3],
  ['崩坏 星穹铁道 女角色 梗', 4],
  ['无畏契约 主播 梗', 3],
  ['原神 女角色 强度榜', 3],
  ['荣耀 女英雄 台词', 4],
  ['英雄联盟 女英雄 梗', 3],
  ['主播 女 通讯录 名场面', 4]
];

// 本轮（迭代 #6）用户点名的 tag：淋语本体 + 通讯录游戏黑话（淋神/洛克淋锅/英雄淋盟/王者淋耀/第五淋格）
const P7 = [
  ['淋神', 6],
  ['淋语 十级', 5],
  ['淋语 考试', 4],
  ['淋语 盘点', 5],
  ['淋语 大赏', 4],
  ['淋语 翻译', 4],
  ['淋语 配音', 4],
  ['淋语 广播剧', 3],
  ['淋语 说唱', 3],
  ['淋语 教学 视频', 4],
  ['淋淋 语录', 4],
  ['淋淋 语音包', 3],
  ['姐学', 4],
  ['花学', 3],
  ['地才', 3],
  ['淋逼', 3],
  ['豪姐', 3],
  ['锁姐', 3],
  ['王者淋耀', 5],
  ['王者荣耀 女英雄 台词 梗', 4],
  ['王者荣耀 语音包 梗', 3],
  ['瑶 王者荣耀 梗', 3],
  ['妲己 梗', 3],
  ['大乔 梗', 2],
  ['英雄淋盟', 5],
  ['英雄联盟 女英雄 台词', 3],
  ['拉克丝 梗', 3],
  ['卡特 英雄联盟 梗', 2],
  ['第五淋格', 5],
  ['第五人格 语音包', 3],
  ['第五人格 园丁 梗', 3],
  ['第五人格 医生 皮肤 梗', 2],
  ['红蝶 第五人格', 2],
  ['洛克淋锅', 5],
  ['洛克王国 宠物 梗', 3],
  ['洛克王国 阿布', 2],
  ['金铲铲 梗', 3],
  ['妮蔻 梗', 2],
  ['原神 语音包 梗', 3],
  ['珊瑚宫心海 梗', 3],
  ['崩坏 星穹铁道 语音包', 2],
  ['无畏契约 女 角色 梗', 2],
  ['和平精英 语音包 梗', 2],
  ['通讯录 电影 台词', 3],
  ['通讯录 电视剧 梗', 3],
  ['断背 台词 梗', 2],
  ['布尔苹果 梗', 2],
  ['淋语 手势', 3],
  ['淋语 黑话 大全', 4]
];

(async () => {
  const TAGS = process.argv.includes('--p7')
    ? P7
    : process.argv.includes('--p6')
      ? P6
      : process.argv.includes('--p5')
        ? P5
        : process.argv.includes('--p4')
          ? P4
          : process.argv.includes('--p3')
            ? P3
            : process.argv.includes('--p2')
              ? P2
              : P1;
  const DM = Number(process.env.DM || 220);
  const CN = Number(process.env.CN || 40);
  const seen = new Set();
  if (fs.existsSync('seen.json')) for (const b of JSON.parse(fs.readFileSync('seen.json', 'utf8'))) seen.add(b);
  const lines = [];
  // 边抓边写：脚本被网络错误或超时打断时不至于整批语料丢失
  const out = process.env.OUT || 'corpus5.txt';
  const flush = () => fs.writeFileSync(out, lines.join('\n'), 'utf8');
  let done = 0;
  for (const [kw, limit] of TAGS) {
    const res = await search(kw, limit);
    const fresh = res.filter((v) => !seen.has(v.bvid));
    console.error(`:: ${kw} -> ${res.length} hits, ${fresh.length} new`);
    for (const v of fresh) {
      seen.add(v.bvid);
      const l = await pull(v, kw, DM, CN);
      if (l.length) lines.push(...l);
      if (++done % 8 === 0) {
        flush();
        fs.writeFileSync('seen.json', JSON.stringify([...seen]));
      }
    }
    await sleep(500);
  }
  flush();
  fs.writeFileSync('seen.json', JSON.stringify([...seen]));
  console.log('videos with content:', (lines.join('\n').match(/^==== /gm) || []).length, 'lines:', lines.length);
})();

