// 第二十六轮采集：B 站「淋物大战阴尸」（植物大战僵尸淋语化）相关视频。
// 只取公开检索接口返回的标题 / 简介 / 封面，落 corpus 与 evidence，正文不改写。
// 用法：node scripts/harvest-pvz26.mjs
import fs from 'node:fs';

const KW = [
  // 主题词
  '淋物大战阴尸', '淋物大战', '阴尸', '淋物大战浆尸', '肘物大战干尸', '淋物大战僵尸',
  // 植物侧
  '植物大战僵尸 淋语', '淋语 植物大战僵尸', '植物大战僵尸 通讯录', '通讯录 植物大战僵尸',
  '淋语 豌豆射手', '淋语 向日葵', '淋语 坚果墙', '淋语 大喷菇', '淋语 玉米加农炮',
  '淋语 寒冰射手', '淋语 樱桃炸弹', '淋语 土豆雷', '淋语 小推车', '淋语 戴夫',
  '淋语 模仿者', '淋语 地刺', '淋语 西瓜投手', '淋语 火爆辣椒', '淋语 阳光菇',
  // 僵尸侧
  '淋语 铁桶僵尸', '淋语 舞王僵尸', '淋语 巨人僵尸', '淋语 撑杆僵尸', '淋语 蹦极僵尸',
  '淋语 读报僵尸', '淋语 僵王', '淋语 僵尸博士', '淋语 小鬼僵尸', '淋语 气球僵尸',
  // 场景/玩法
  '淋语 无尽模式', '淋语 天梯', '淋物大战阴尸 阵型', '植物大战僵尸 阴雄', '淋语 五阶',
  // 淋语通用（补语料）
  '高等淋语', '淋语八级', '淋语教程', '淋语 洗脚婢', '淋语 阴桃', '淋语 买榜',
];

const H = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Referer: 'https://www.bilibili.com/',
  Accept: 'application/json, text/plain, */*',
};

const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
const out = {};
const lines = [];
const seen = new Set();
let total = 0;

for (const kw of KW) {
  const url =
    'https://api.bilibili.com/x/web-interface/search/type?search_type=video&keyword=' +
    encodeURIComponent(kw) +
    '&page=1&page_size=30';
  try {
    const r = await fetch(url, { headers: H });
    const j = await r.json();
    const res = (j.data && j.data.result) || [];
    out[kw] = res.map((v) => ({
      bvid: v.bvid,
      title: String(v.title || '').replace(/<[^>]+>/g, ''),
      author: v.author,
      play: v.play,
      pic: v.pic,
      desc: String(v.description || '').slice(0, 300),
      pubdate: v.pubdate,
    }));
    for (const v of out[kw]) {
      if (!v.title) continue;
      if (!seen.has(v.bvid)) {
        seen.add(v.bvid);
        total++;
      }
      lines.push(`${kw}\t${v.title}\t${v.author}\t${v.play}\t${v.bvid}`);
      if (v.desc) lines.push(`${kw}\tDESC\t${v.desc.replace(/\s+/g, ' ')}`);
    }
    console.log(kw.padEnd(22), '=>', res.length);
  } catch (e) {
    out[kw] = [];
    console.log(kw.padEnd(22), 'ERR', e.message);
  }
  await new Promise((s) => setTimeout(s, 320));
}

fs.mkdirSync('evidence', { recursive: true });
fs.mkdirSync('corpus', { recursive: true });
fs.writeFileSync(`evidence/bili-search-pvz-${stamp}.json`, JSON.stringify(out, null, 1));
fs.writeFileSync(`corpus/corpus-bili-pvz-${stamp}.txt`, lines.join('\n'), 'utf8');
console.log('关键词', KW.length, '| 唯一视频', total, '| 语料行', lines.length, '| 时间戳', stamp);
