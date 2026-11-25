// 第二十七轮采集：近 30 天（2026-10-26 ～ 2026-11-25）淋语 / 通讯录 / 淋穹铁道 相关公开视频。
// 只取 B 站公开检索接口返回的标题 / 简介 / 封面 / 发布时间，落 corpus 与 evidence，正文不改写。
// 用法：node scripts/harvest-new27.mjs
import fs from 'node:fs';

const WIN_START = Date.UTC(2026, 9, 26) / 1000; // 2026-10-26
const WIN_END = Date.UTC(2026, 10, 26) / 1000; // 2026-11-26（含边界）

const KW = [
  // A. 主题 tag
  '淋语', '通讯录 淋语', '高等淋语', '淋语八级', '淋语教程', '淋语试题', '淋语速成',
  '淋语 教学', '淋语 梗', '抽象文化', '淋语 新梗', '淋语 2026',
  // B. 候选新分区：淋穹铁道
  '淋穹铁道', '淋穹', '星穹铁道 淋语', '星铁 淋语', '星穹铁道 通讯录', '崩坏星穹铁道 淋语',
  '星铁 通讯录', '星穹铁道 淋名',
  // C. 淋穹铁道角色（通讯录高频）
  '淋语 花火', '淋语 砂金', '淋语 知更鸟', '淋语 流萤', '淋语 星期日', '淋语 黄泉',
  '淋语 卡芙卡', '淋语 银枝', '淋语 镜流', '淋语 景元', '淋语 饮月', '淋语 开拓者',
  '花火 淋语 通讯录', '砂金 通讯录', '知更鸟 淋语 唱', '流萤 通讯录', '黄泉 拔刀 淋语',
  // D. 既有分区近 30 天
  '淋角洲行动', '瓦罗淋特', '王者淋耀', '英雄淋盟 淋语', '淋神 淋语', '第五淋格', '守望淋锋',
  '淋威争锋', '洛克淋国', '绝区淋', '淋可梦',
  // E. 通讯录英雄 / 圈层
  '通讯录英雄', '通讯录 大合集', '通讯录 强度榜', '通讯录 女明星', '通讯录 梗',
  '淋语 买榜', '淋语 阴桃', '淋语 鸡笼', '淋语 吸入', '淋语 洗脚婢',
  // F. 新近抽象热梗（用于判定主窗口内爆发）
  '抽象 新梗', '抖音 淋语', '贴吧 淋语', '通讯录 整活',
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
const recent = [];
const seen = new Set();
let total = 0;

for (const kw of KW) {
  const url =
    'https://api.bilibili.com/x/web-interface/search/type?search_type=video&keyword=' +
    encodeURIComponent(kw) +
    '&order=pubdate&page=1&page_size=30';
  try {
    const r = await fetch(url, { headers: H });
    const j = await r.json();
    const res = (j.data && j.data.result) || [];
    out[kw] = res.map((v) => ({
      bvid: v.bvid,
      title: String(v.title || '').replace(/<[^>]+>/g, ''),
      author: v.author,
      mid: v.mid,
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
      lines.push(`${kw}\t${v.title}\t${v.author}\t${v.play}\t${v.bvid}\t${v.pubdate}`);
      if (v.desc) lines.push(`${kw}\tDESC\t${v.desc.replace(/\s+/g, ' ')}`);
      if (v.pubdate >= WIN_START && v.pubdate <= WIN_END) recent.push({ kw, ...v });
    }
    console.log(kw.padEnd(20), '=>', res.length, '| 主窗口内', out[kw].filter((v) => v.pubdate >= WIN_START && v.pubdate <= WIN_END).length);
  } catch (e) {
    out[kw] = [];
    console.log(kw.padEnd(20), 'ERR', e.message);
  }
  await new Promise((s) => setTimeout(s, 320));
}

fs.mkdirSync('evidence', { recursive: true });
fs.mkdirSync('corpus', { recursive: true });
fs.writeFileSync(`evidence/bili-search-new27-${stamp}.json`, JSON.stringify(out, null, 1));
fs.writeFileSync(`evidence/bili-search-new27-recent.json`, JSON.stringify(recent, null, 1));
fs.writeFileSync(`corpus/corpus-bili-new27-${stamp}.txt`, lines.join('\n'), 'utf8');
console.log(
  '关键词',
  KW.length,
  '| 唯一视频',
  total,
  '| 语料行',
  lines.length,
  '| 主窗口内视频',
  recent.length,
  '| 时间戳',
  stamp
);
