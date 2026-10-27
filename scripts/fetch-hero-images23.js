'use strict';
// 第二十三轮配图抓取（146 人图文不符修复）。
// 来源路由：user（B站用户搜索头像）/ bv（代表作 BV owner 头像）/ cover（BV 视频封面）/
//           baidu（百度图库消歧检索）/ baike（百度百科词条主图）/ pool（复用 evidence 既有候选，本地拷贝）。
// 产出 evidence/qc23-cand/<名>/<src>-<N>.jpg + evidence/qc23-cand.json
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'evidence', 'qc23-cand');
const OUT_JSON = path.join(ROOT, 'evidence', 'qc23-cand.json');
fs.mkdirSync(OUT_DIR, { recursive: true });

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- 工作清单：name | 路由串 | 百度检索词 | 百科词条名 | BV ----------
// 路由串可组合：user bv cover baidu baike pool
const W = [
  // == A1 瓦罗特工（17）==
  ['幻棱', 'baidu pool', '无畏契约 幻棱 官方立绘', ''],
  ['猎枭', 'baidu pool', '无畏契约 猎枭 官方立绘', ''],
  ['铁臂', 'baidu pool', '无畏契约 铁臂 官方立绘', ''],
  ['斯凯', 'baidu pool', '无畏契约 斯凯 官方立绘', ''],
  ['盖可', 'baidu pool', '无畏契约 盖可 官方立绘', ''],
  ['钛狐', 'baidu pool', '无畏契约 钛狐 官方立绘', ''],
  ['炼狱', 'baidu pool', '无畏契约 炼狱 官方立绘', ''],
  ['星礈', 'baidu pool', '无畏契约 星礈 官方立绘', ''],
  ['幽影', 'baidu pool', '无畏契约 幽影 官方立绘', ''],
  ['海神', 'baidu pool', '无畏契约 海神 官方立绘', ''],
  ['瑟符', 'baidu pool', '无畏契约 瑟符 官方立绘', ''],
  ['贤者', 'baidu pool', '无畏契约 贤者 官方立绘', ''],
  ['尚勃勒', 'baidu pool', '无畏契约 尚勃勒 官方立绘', ''],
  ['钢锁', 'baidu pool', '无畏契约 钢锁 官方立绘', ''],
  ['维斯', 'baidu pool', '无畏契约 维斯 官方立绘', ''],
  ['遐思', 'baidu pool', '无畏契约 遐思 官方立绘', ''],
  ['K/O', 'baidu pool', '无畏契约 KAY/O 官方立绘', ''],
  // == A2 召唤物（4）+ 黑梦的狗 ==
  ['皮蛋', 'baidu pool', '无畏契约 盖可 皮蛋', ''],
  ['奇乐的机器人', 'baidu pool', '无畏契约 奇乐 炮台', ''],
  ['丢丢', 'baidu pool', '无畏契约 盖可 丢丢', ''],
  ['鲨鲨', 'baidu pool', '无畏契约 盖可 鲨鲨', ''],
  ['黑梦的狗', 'baidu pool', '无畏契约 黑梦 追猎者', ''],
  // == A3 瓦罗 UP主（20）：user 优先，bv 兜底，baidu 最后 ==
  ['地才女特务', 'user bv baidu', '地才女特务 无畏契约 主播', ''],
  ['仔仔无畏契约', 'user bv baidu', '仔仔无畏契约 主播', ''],
  ['无畏契约情报员啊', 'user bv baidu', '无畏契约情报员啊 主播', ''],
  ['谋生者白言', 'user bv baidu', '谋生者白言 无畏契约 主播', ''],
  ['乃酱', 'user bv baidu', '乃酱 无畏契约 主播', ''],
  ['绿泡泡Reyna', 'user bv baidu', '绿泡泡Reyna 无畏契约 主播', ''],
  ['无畏辐能联盟', 'user bv baidu', '无畏辐能联盟 主播', ''],
  ['无畏战术大师兄', 'user bv baidu', '无畏战术大师兄 主播', ''],
  ['汉堡_无畏契约', 'user bv baidu', '汉堡 无畏契约 主播', ''],
  ['布锅锅', 'user bv baidu', '布锅锅 无畏契约 主播', ''],
  ['无畏契约皮肤', 'user bv baidu', '无畏契约皮肤 主播', ''],
  ['喜欢看星星的派大星', 'user bv baidu', '喜欢看星星的派大星 无畏契约', ''],
  ['老老老老老鱼干', 'user bv baidu', '老鱼干 无畏契约 主播', ''],
  ['冰可乐Raze', 'user bv baidu', '冰可乐Raze 无畏契约', ''],
  ['404就是小刘', 'user bv baidu', '404就是小刘 无畏契约', ''],
  ['木彡1', 'user bv baidu', '木彡1 无畏契约', ''],
  ['胡里奥小朋友', 'user bv baidu', '胡里奥小朋友 无畏契约', ''],
  ['夜光山雀', 'user bv baidu', '夜光山雀 无畏契约', ''],
  ['欧阳风5019', 'user bv baidu', '欧阳风5019 无畏契约', ''],
  ['大东彦', 'user bv baidu', '大东彦 无畏契约', ''],
  // == A4 选手（11）==
  ['康康', 'user baidu', '无畏契约 康康 ZmjjKK 选手', ''],
  ['Aspas', 'user baidu', '无畏契约 Aspas 选手', ''],
  ['kaajak', 'user baidu', '无畏契约 kaajak 选手', ''],
  ['Eggsterr', 'user baidu', '无畏契约 Eggsterr 选手', ''],
  ['lukxo', 'user baidu', '无畏契约 lukxo 选手', ''],
  ['grim', 'user baidu', '无畏契约 grim 选手', ''],
  ['ziptie', 'user baidu', '无畏契约 ziptie 选手', ''],
  ['SpiritZ1', 'user baidu', '无畏契约 SpiritZ1 选手', ''],
  ['Evnii', 'user baidu', '无畏契约 Evnii 选手', ''],
  ['SoMarcus', 'user baidu', '无畏契约 SoMarcus 选手', ''],
  ['张钊', 'user baidu', '无畏契约 张钊 选手', ''],
  // == B 第五淋格（11）==
  ['小丑', 'baidu baike', '第五人格 小丑 官方立绘', '小丑(第五人格)'],
  ['鹿头', 'baidu baike', '第五人格 鹿头 官方立绘', '鹿头(第五人格)'],
  ['宿伞之魂', 'baidu baike', '第五人格 宿伞之魂 官方立绘', '宿伞之魂(第五人格)'],
  ['蜡像师', 'baidu baike pool', '第五人格 蜡像师 菲利普 图鉴', '蜡像师(第五人格)'],
  ['机械师', 'baidu baike pool', '第五人格 机械师 特蕾西 图鉴', '机械师(第五人格)'],
  ['舞女', 'baidu baike pool', '第五人格 舞女 玛格丽莎 图鉴', '舞女(第五人格)'],
  ['调酒师', 'baidu baike pool', '第五人格 调酒师 黛米 图鉴', '调酒师(第五人格)'],
  ['杂技演员', 'baidu baike pool', '第五人格 杂技演员 麦克 图鉴', '杂技演员(第五人格)'],
  ['病患', 'baidu baike pool', '第五人格 病患 埃米尔 图鉴', '病患(第五人格)'],
  ['玩具商', 'baidu baike pool', '第五人格 玩具商 安妮 图鉴', '玩具商(第五人格)'],
  ['空军', 'baidu baike pool', '第五人格 空军 玛尔塔 图鉴', '空军(第五人格)'],
  // == C 守望淋锋（16）==
  ['金驭', 'baidu pool', '守望先锋 金驭 官方', ''],
  ['探奇', 'baidu pool', '守望先锋 探奇 Venture 官方', ''],
  ['斩仇', 'baidu pool', '守望先锋 斩仇 Vendetta 官方', ''],
  ['安燃', 'baidu pool', '守望先锋 安燃 Anran 官方', ''],
  ['西拉', 'baidu pool', '守望先锋 西拉 Sierra 官方', ''],
  ['死怨', 'baidu pool', '守望先锋 死怨 Wraith 官方', ''],
  ['飞天猫', 'baidu pool', '守望先锋 飞天猫 Jetpack Cat 官方', ''],
  ['瑞稀', 'baidu pool', '守望先锋 瑞稀 Mizuki 官方', ''],
  ['血律', 'baidu pool', '守望先锋 血律 官方', ''],
  ['骇灾', 'baidu pool', '守望先锋 骇灾 Hazard 官方', ''],
  ['禅雅塔', 'baidu pool', '守望先锋 禅雅塔 官方立绘', ''],
  ['阿三', 'baidu pool', '守望先锋 秩序之光 官方立绘', ''],
  ['血律Daddy', 'baidu pool', '守望先锋 血律 官方', ''],
  ['摩西女', 'baidu pool', '守望先锋 天使 官方立绘', ''],
  ['守望淋锋 · 阿三专题区', 'baidu pool', '守望先锋 秩序之光 官方立绘', ''],
  ['摩西女专题区', 'baidu pool', '守望先锋 天使 官方立绘', ''],
  // == D 原神 / 淋神（10）==
  ['珊瑚宫心海', 'baidu baike', '原神 珊瑚宫心海 官方立绘', '珊瑚宫心海'],
  ['腋淋', 'baidu baike', '原神 夜兰 官方立绘', '夜兰'],
  ['雷电将军', 'baidu baike', '原神 雷电将军 官方立绘', '雷电将军'],
  ['流浪者', 'baidu baike', '原神 流浪者 散兵 官方立绘', '流浪者'],
  ['胡桃', 'baidu baike', '原神 胡桃 官方立绘', '胡桃'],
  ['刻晴', 'baidu baike', '原神 刻晴 官方立绘', '刻晴'],
  ['妮露', 'baidu baike', '原神 妮露 官方立绘', '妮露'],
  ['我雅', 'baidu baike', '原神 八重神子 官方立绘', '八重神子'],
  ['纳阴妲', 'baidu baike', '原神 纳西妲 官方立绘', '纳西妲'],
  ['莱欧斯利', 'baidu baike', '原神 莱欧斯利 官方立绘', '莱欧斯利'],
  // == E 王者 / 淋者（12）==
  ['庄周', 'baidu baike', '王者荣耀 庄周 官方皮肤', '庄周'],
  ['元歌', 'baidu baike', '王者荣耀 元歌 官方皮肤', '元歌'],
  ['妮蔻', 'baidu baike', '英雄联盟 妮蔻 万花通灵 官方', '妮蔻'],
  ['孙策', 'baidu baike', '王者荣耀 孙策 官方皮肤', '孙策'],
  ['我华', 'baidu baike', '王者荣耀 伽罗 太华 官方皮肤', '伽罗'],
  ['我泔', 'baidu baike', '王者荣耀 甄姬 官方皮肤', '甄姬'],
  ['我妲', 'baidu baike', '王者荣耀 妲己 官方皮肤', '妲己'],
  ['我虞', 'baidu baike', '王者荣耀 虞姬 官方皮肤', '虞姬'],
  ['蒜姐', 'baidu baike', '王者荣耀 上官婉儿 官方皮肤', '上官婉儿'],
  ['我米', 'baidu baike', '王者荣耀 米莱狄 官方皮肤', '米莱狄'],
  ['我月', 'baidu baike', '王者荣耀 海月 官方皮肤', '海月'],
  ['我曌', 'baidu baike', '王者荣耀 武则天 官方皮肤', '武则天'],
  // == F 英雄淋盟（4）==
  ['我琴', 'baidu baike', '英雄联盟 娑娜 官方立绘', '娑娜'],
  ['我光', 'baidu baike', '英雄联盟 拉克丝 光辉女郎 官方', '拉克丝'],
  ['琴女', 'baidu pool', '英雄联盟 娑娜 官方皮肤', ''],
  ['薇恩', 'baidu baike', '英雄联盟 薇恩 暗夜猎手 官方', '薇恩'],
  // == G 星淋铁道（3）==
  ['我鸟', 'baidu baike cover', '星穹铁道 知更鸟 官方立绘', '知更鸟', 'BV1y1s7gL'],
  ['火淋', 'cover baidu', '崩坏星穹铁道 火淋', '', 'BV1mAL26DE2e'],
  ['淋光', 'cover baidu', '崩坏星穹铁道 淋光', '', 'BV1RgAUzDEVD'],
  // == H 其它游戏（8）==
  ['拉比克', 'baidu baike', 'DOTA2 拉比克 官方立绘', '拉比克'],
  ['杀生院', 'baidu baike', 'FGO 杀生院祈荒 立绘', '杀生院祈荒'],
  ['枝性美克里斯', 'baidu cover', '黎明杀机 克里斯 官方立绘', '', 'BV1dzTEos'],
  ['威龙daddy', 'baidu cover', '三角洲行动 威龙 官方', '', 'BV1Mz8EhA'],
  ['杂技女亡帕克', 'baidu baike', 'DOTA2 帕克 官方立绘', '帕克'],
  ['铁T成长', 'cover baidu', '决战平安京 铁T 射手', '', 'BV16LeEz9EwM'],
  ['大天狗', 'baidu baike', '阴阳师 大天狗 官方立绘', '大天狗'],
  ['黑天鹅', 'baidu pool', '崩坏星穹铁道 黑天鹅 官方立绘', ''],
  // == I 真人 / 淋文化 / UP主（23）==
  ['淋淋', 'user baidu', '蔡依林 高清 写真', ''],
  ['周阴婷', 'user baidu', '周阴婷 淋语', ''],
  ['三梦奇缘', 'user baidu', '三梦奇缘 直播', ''],
  ['郭老师', 'user baidu', '郭老师 郭语 直播', ''],
  ['霉霉', 'baidu baike', '泰勒·斯威夫特 高清 写真', '泰勒·斯威夫特'],
  ['鹅妈妈', 'user baidu', '鹅妈妈 秦豪 直播', ''],
  ['肘姐', 'user baidu', '肘姐 直播 连麦', ''],
  ['完颜慧德', 'user baidu', '完颜慧德 直播', ''],
  ['玛莎', 'user baidu', '玛莎 郭语 大师姐', ''],
  ['何老师', 'user baidu', '心理咨询何老师 直播', ''],
  ['埃及艳后', 'user baidu', '爱及艳后', ''],
  ['开心姐', 'user baidu', '开心姐 主播', ''],
  ['施柔儿', 'user baidu', '施柔儿 主播', ''],
  ['大啵仙女', 'user bv baidu', '大啵仙女 淋语', ''],
  ['暴躁的鹿鹿', 'user bv baidu', '暴躁的鹿鹿 阴雄淋盟', ''],
  ['凤仙子', 'baidu baike', '罗玉凤 高清', '罗玉凤'],
  ['阴婷宝', 'user bv baidu', '阴婷宝 AI 周阴婷', ''],
  ['FLY 组合工作室', 'user bv baidu', 'FLY组合工作室', ''],
  ['英中啊英中', 'user baidu pool', '英中啊英中', ''],
  ['FLY组合', 'user baidu pool', '淋凤阴 FLY组合', ''],
  ['杯糕姐', 'user cover baidu', '杯糕姐 淋语', '', 'BV1QWpK68Eg3'],
  ['淋形针LinerClip', 'user cover baidu', '淋形针 淋语 教程', '', 'BV1y1T7d3'],
  ['胡艺莲', 'user baidu', '胡艺莲 地铁歌姬', ''],
  // == J 洛克淋国（5）+ 火花 ==
  ['锤头鹳', 'baidu pool', '洛克王国 锤头鹳 图鉴', ''],
  ['夜枭', 'baidu pool', '洛克王国 夜枭 图鉴', ''],
  ['可丽希亚', 'baidu pool', '洛克王国 可丽希亚 图鉴', ''],
  ['阿洛', 'baidu pool', '洛克王国 阿洛 图鉴', ''],
  ['加尔', 'baidu pool', '洛克王国 加尔 图鉴', ''],
  ['火花', 'baidu pool', '洛克王国 火花 图鉴', ''],
];

// BV 表（从 lore links 提取，供 user/bv/cover 路由用）
const lore = require(path.join(ROOT, 'src/core/lore'));
const heroes = (lore.__export || lore).heroes || [];
const byName = new Map(heroes.map((h) => [h.name, h]));
const BVS = {};
for (const h of heroes) {
  const bvs = [...new Set((h.links || []).map((l) => {
    const u = typeof l === 'string' ? l : (l && l.url) || '';
    const m = /BV[0-9A-Za-z]{10}/.exec(u);
    return m ? m[0] : null;
  }).filter(Boolean))];
  if (bvs.length) BVS[h.name] = bvs;
}
// 路由 'bv' 需要代表作 BV：用缓存中的 owner 匹配本人姓名
let viewCache = {};
try { viewCache = JSON.parse(fs.readFileSync(path.join(ROOT, 'work/bili-view-cache.json'), 'utf8')); } catch {}

const CACHE_MISS = [];
async function view(bvid) {
  if (viewCache[bvid]) return viewCache[bvid];
  try {
    const r = await fetch('https://api.bilibili.com/x/web-interface/view?bvid=' + bvid, {
      headers: { 'User-Agent': UA, Referer: 'https://www.bilibili.com/' },
    });
    const j = await r.json();
    if (j.code === 0 && j.data) {
      viewCache[bvid] = { code: 0, owner: j.data.owner, title: j.data.title, pic: j.data.pic };
    } else {
      viewCache[bvid] = { code: j.code, msg: j.msg };
    }
  } catch (e) { viewCache[bvid] = { code: -1, msg: String(e) }; }
  fs.writeFileSync(path.join(ROOT, 'work/bili-view-cache.json'), JSON.stringify(viewCache));
  return viewCache[bvid];
}

async function grab(url, referer) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Referer: referer || url } });
    if (!r.ok) return null;
    const ct = r.headers.get('content-type') || '';
    if (!/^image\//.test(ct)) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 8000) return null;
    return buf;
  } catch { return null; }
}

// 用户搜索关键词覆盖（默认用英雄名；真人/主播用本人账号名）
const USER_Q = {
  淋淋: '蔡依林',
  三梦奇缘: '三梦奇缘',
  鹅妈妈: '鹅妈妈 秦豪',
  肘姐: '肘姐',
  何老师: '心理咨询师-何老师',
  周阴婷: '周阴婷',
};

// ---------- user：B 站用户搜索精确匹配头像 ----------
async function userAvatar(name) {
  const kw0 = USER_Q[name] || name;
  const kw = kw0.replace(/[_\s]/g, '');
  try {
    const r = await fetch('https://api.bilibili.com/x/web-interface/wbi/search/type?search_type=bili_user&keyword=' +
      encodeURIComponent(kw0), { headers: { 'User-Agent': UA, Referer: 'https://www.bilibili.com/' } });
    const j = await r.json();
    if (j.code !== 0 || !j.data || !j.data.result) return null;
    const users = j.data.result;
    const pick = async (u) => {
      if (!u.upic || /noface\.jpg/.test(u.upic)) return null;
      const face = u.upic.startsWith('http') ? u.upic : 'https:' + u.upic;
      const buf = await grab(face, 'https://www.bilibili.com/');
      return buf ? { buf, url: face, title: `B站头像：${u.uname}` } : null;
    };
    // 第一遍：完全同名
    for (const u of users) {
      const uname = String(u.uname || '').replace(/[_\s]/g, '');
      if (uname === kw) { const r = await pick(u); if (r) return r; }
    }
    // 第二遍：包含匹配
    for (const u of users) {
      const uname = String(u.uname || '').replace(/[_\s]/g, '');
      if (uname.includes(kw) || kw.includes(uname)) { const r = await pick(u); if (r) return r; }
    }
    return null;
  } catch { return null; }
}

// ---------- cover：BV 视频封面 ----------
async function coverOf(bvid) {
  let v = await view(bvid);
  // 旧缓存条目可能没有 pic 字段（先前的会话只存了 owner/title），补一次完整抓取
  if (v && v.code === 0 && !v.pic) {
    try {
      const r = await fetch('https://api.bilibili.com/x/web-interface/view?bvid=' + bvid, {
        headers: { 'User-Agent': UA, Referer: 'https://www.bilibili.com/' },
      });
      const j = await r.json();
      if (j.code === 0 && j.data) {
        viewCache[bvid] = { code: 0, owner: j.data.owner, title: j.data.title, pic: j.data.pic };
        fs.writeFileSync(path.join(ROOT, 'work/bili-view-cache.json'), JSON.stringify(viewCache));
        v = viewCache[bvid];
      }
    } catch {}
  }
  if (!v || v.code !== 0 || !v.pic) return null;
  const pic = v.pic.startsWith('http') ? v.pic : 'https:' + v.pic;
  const buf = await grab(pic, 'https://www.bilibili.com/');
  if (!buf) return null;
  return { buf, url: pic, title: 'B站封面：' + String(v.title || '').slice(0, 60) };
}

// ---------- baidu ----------
const BAD = /第五人格|identity v|无畏契约|valorant|瓦罗兰特|守望|王者荣耀|原神|明日方舟|三国|表情包|梗图|排行榜|强度|手绘|同人|绘画|教程|攻略|cos|真人|ai还原|ai生成|aigc/i;
// 真人名检索放宽：写真/真人等词不再排除，只排除二创与 AI
const BAD_REAL = /手绘|同人|绘画|ai还原|ai生成|aigc|表情包|梗图|cos/i;
const ONLY = {
  无畏契约: /无畏契约|瓦罗兰特|valorant|立绘|皮肤|图鉴|头像|技能/i,
  第五人格: /第五人格|identity v|监管者|求生者|庄园|立绘|皮肤|头像|图鉴/i,
  守望: /守望先锋|overwatch|立绘|皮肤|图鉴|头像|英雄/i,
  原神: /原神|genshin|立绘|皮肤|图鉴|头像|角色/i,
  王者: /王者荣耀|王者|皮肤|立绘|图鉴|头像|英雄/i,
  英雄联盟: /英雄联盟|lol|皮肤|立绘|图鉴|头像/i,
  DOTA: /dota|刀塔|立绘|头像/i,
  星铁: /星穹铁道|崩坏|立绘|头像/i,
  阴阳师: /阴阳师|式神|立绘|头像/i,
  黎明杀机: /黎明杀机|杀鸡|dbd|立绘|头像/i,
  三角洲: /三角洲|delta/i,
  FGO: /fate|fgo|杀生院|立绘/i,
  平安京: /平安京|决战|射手|立绘/i,
  洛克: /洛克王国|宠物|图鉴|精灵/i,
};
const GAME_OF = (q) => {
  if (q.startsWith('无畏契约')) return '无畏契约';
  if (q.startsWith('第五人格')) return '第五人格';
  if (q.startsWith('守望先锋')) return '守望';
  if (q.startsWith('原神')) return '原神';
  if (q.startsWith('王者荣耀')) return '王者';
  if (q.startsWith('英雄联盟')) return '英雄联盟';
  if (q.startsWith('DOTA')) return 'DOTA';
  if (q.startsWith('星穹铁道') || q.startsWith('崩坏星穹铁道')) return '星铁';
  if (q.startsWith('阴阳师')) return '阴阳师';
  if (q.startsWith('黎明杀机')) return '黎明杀机';
  if (q.startsWith('三角洲')) return '三角洲';
  if (q.startsWith('FGO')) return 'FGO';
  if (q.startsWith('决战平安京')) return '平安京';
  if (q.startsWith('洛克王国')) return '洛克';
  return '真人';
};

async function baiduCand(word, n = 8) {
  const u = 'https://image.baidu.com/search/acjson?tn=resultjson_com&ipn=rj&ct=201326592&is=&fp=result&word=' +
    encodeURIComponent(word) + '&pn=0&rn=40&gsm=1e';
  let j;
  try {
    const r = await fetch(u, { headers: { 'User-Agent': UA, Referer: 'https://image.baidu.com/' } });
    j = JSON.parse((await r.text()).replace(/[\u0000-\u001f]/g, ' '));
  } catch { return []; }
  const only = ONLY[GAME_OF(word)];
  const bad = GAME_OF(word) === '真人' ? BAD_REAL : BAD;
  const out = [];
  for (const x of (j.data || []).filter((v) => v && (v.middleURL || v.thumbURL))) {
    const title = clean(x.fromPageTitle || x.fromPageTitleEnc || '');
    if (bad.test(title)) continue;
    if (only && !only.test(title + ' ' + word)) continue;
    if (x.width && x.width < 300) continue;
    const buf = await grab(x.middleURL || x.thumbURL, 'https://image.baidu.com/');
    if (!buf) continue;
    out.push({ buf, url: x.middleURL || x.thumbURL, title: title.slice(0, 90), w: x.width || 0, h: x.height || 0, from: 'baidu' });
    if (out.length >= n) break;
    await sleep(80);
  }
  return out;
}

// ---------- baike ----------
async function baikeImg(key) {
  const u = 'https://baike.baidu.com/api/openapi/BaikeLemmaCardApi?scope=103&format=json&appid=379020&bk_key=' +
    encodeURIComponent(key) + '&bk_length=100';
  try {
    const r = await fetch(u, { headers: { 'User-Agent': UA, Referer: 'https://baike.baidu.com/' } });
    const j = await r.json();
    const img = j.image || (j.card && j.card.image) || '';
    if (!img) return null;
    const url = img.startsWith('http') ? img : 'https://baike.baidu.com' + img;
    const buf = await grab(url, 'https://baike.baidu.com/');
    if (!buf) return null;
    return { buf, url, title: '百度百科词条图：' + key, from: 'baike' };
  } catch { return null; }
}

// ---------- pool：本地拷贝 evidence 既有候选 ----------
const POOL_MAP = {};
(function () {
  const pools = ['hero-cand11', 'hero-cand15', 'hero-cand16', 'hero-cand18', 'hero-cand18b', 'hero-cand19', 'hero-cand19b', 'hero-cand21'];
  for (const p of pools) {
    const mf = path.join(ROOT, 'evidence', p + '.json');
    if (!fs.existsSync(mf)) continue;
    let items = [];
    try { const j = JSON.parse(fs.readFileSync(mf, 'utf8')); items = j.items || j; } catch { continue; }
    if (!Array.isArray(items)) continue;
    for (const it of items) {
      const nm = String(it.name || '').trim();
      if (!nm) continue;
      (POOL_MAP[nm] = POOL_MAP[nm] || []).push({ pool: p, file: it.file, url: it.url, title: it.title, good: it.good });
    }
  }
})();
const POOL_ALIAS = {
  阿三: '秩序之光', 摩西女: '天使', '守望淋锋 · 阿三专题区': '秩序之光', 摩西女专题区: '天使',
  我琴: '琴女', 妮蔻: '妮蔻', 血律Daddy: '血律',
};
function poolCopy(name, dir) {
  const hits = POOL_MAP[name] || POOL_ALIAS[name] && POOL_MAP[POOL_ALIAS[name]] || [];
  const copied = [];
  for (const hit of hits) {
    let src = path.join(ROOT, 'evidence', hit.pool, hit.file);
    if (!fs.existsSync(src) && hit.file) {
      const s2 = path.join(ROOT, 'evidence', hit.pool, String(hit.file).replace(/[_ ]+/g, '_'));
      if (fs.existsSync(s2)) src = s2;
    }
    if (!fs.existsSync(src)) continue;
    const buf = fs.readFileSync(src);
    if (buf.length < 8000) continue;
    const dst = path.join(dir, 'pool_' + path.basename(hit.pool) + '_' + (hit.file || '').replace(/[\\/:*?"<>| ]/g, '_'));
    fs.writeFileSync(dst, buf);
    copied.push({ file: path.basename(dst), url: hit.url, title: hit.title, from: 'pool:' + hit.pool, good: hit.good });
    if (copied.length >= 10) break;
  }
  // hero-cand21 目录里还有 manifest 之外的补抓文件（_fix/_v 系列），按名前缀一并纳入
  if (!copied.length) {
    const d21 = path.join(ROOT, 'evidence', 'hero-cand21');
    if (fs.existsSync(d21)) {
      const keys = [name, POOL_ALIAS[name]].filter(Boolean);
      for (const f of fs.readdirSync(d21)) {
        if (!/\.(jpg|jpeg|png)$/i.test(f)) continue;
        if (!keys.some((k) => f.startsWith(k.replace(/[ _]/g, '_')) || f.startsWith(k))) continue;
        const buf = fs.readFileSync(path.join(d21, f));
        if (buf.length < 8000) continue;
        const dst = path.join(dir, 'pool21_' + f);
        fs.writeFileSync(dst, buf);
        copied.push({ file: path.basename(dst), url: '', title: '第21轮候选：' + f, from: 'pool:hero-cand21' });
        if (copied.length >= 10) break;
      }
    }
  }
  return copied;
}

// qc22-cand 目录（第五淋格第 22 轮候选，含未入选的备选）
function pool22Copy(name, dir) {
  const srcDir = path.join(ROOT, 'evidence', 'qc22-cand', name);
  if (!fs.existsSync(srcDir)) return [];
  const copied = [];
  const files = fs.readdirSync(srcDir).filter((f) => /\.(jpg|png|jpeg)$/i.test(f));
  for (const f of files) {
    const buf = fs.readFileSync(path.join(srcDir, f));
    if (buf.length < 8000) continue;
    const dst = path.join(dir, 'pool22_' + f);
    fs.writeFileSync(dst, buf);
    copied.push({ file: path.basename(dst), url: '', title: '第22轮候选：' + f, from: 'pool:qc22' });
  }
  return copied;
}

const clean = (s) => String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

(async () => {
  const onlyArg = process.argv[2] ? new Set(process.argv[2].split(',')) : null;
  const items = [];
  for (const [name, routes, query, baikeKey, bvSpec] of W) {
    if (onlyArg && !onlyArg.has(name)) continue;
    const dir = path.join(OUT_DIR, name);
    fs.mkdirSync(dir, { recursive: true });
    const cands = [];
    const routesSet = new Set(routes.split(' '));
    const bvs = bvSpec ? [bvSpec] : (BVS[name] || []);

    // 1) user
    if (routesSet.has('user')) {
      const av = await userAvatar(name);
      if (av) {
        fs.writeFileSync(path.join(dir, 'user_0.jpg'), av.buf);
        cands.push({ url: av.url, title: av.title, from: 'bili-user-avatar', file: 'user_0.jpg', w: 0, h: 0 });
      }
      await sleep(150);
    }
    // 2) bv owner avatar（owner 与本人同名才要）
    if (routesSet.has('bv')) {
      for (const bv of bvs.slice(0, 2)) {
        const v = await view(bv);
        if (!v || v.code !== 0 || !v.owner || !v.owner.face) continue;
        const on = String(v.owner.name || '').replace(/[_\s]/g, '');
        const nn = name.replace(/[_\s]/g, '');
        if (!on.includes(nn) && !nn.includes(on)) continue;
        if (/noface\.jpg/.test(v.owner.face)) continue;
        const face = v.owner.face.startsWith('http') ? v.owner.face : 'https:' + v.owner.face;
        const buf = await grab(face, 'https://www.bilibili.com/');
        if (buf) {
          fs.writeFileSync(path.join(dir, 'bv_' + bv + '.jpg'), buf);
          cands.push({ url: face, title: 'B站头像（owner）：' + v.owner.name, from: 'bili-bv-avatar', file: 'bv_' + bv + '.jpg', w: 0, h: 0 });
        }
        await sleep(120);
      }
    }
    // 3) cover（有头像时不抓封面）
    const hasAvatar = cands.some((c) => c.from === 'bili-user-avatar' || c.from === 'bili-bv-avatar');
    if (routesSet.has('cover') && !hasAvatar) {
      for (const bv of bvs.slice(0, 1)) {
        const cv = await coverOf(bv);
        if (cv) {
          fs.writeFileSync(path.join(dir, 'cover_' + bv + '.jpg'), cv.buf);
          cands.push({ url: cv.url, title: cv.title, from: 'bili-cover', file: 'cover_' + bv + '.jpg', w: 0, h: 0 });
        }
        await sleep(120);
      }
    }
    // 4) baidu（UP主/真人已拿到头像时跳过）
    if (routesSet.has('baidu') && query && !(hasAvatar && routesSet.has('user'))) {
      const bd = await baiduCand(query, 8);
      bd.forEach((c, i) => {
        const f = 'baidu_' + i + '.jpg';
        fs.writeFileSync(path.join(dir, f), c.buf);
        cands.push({ url: c.url, title: c.title, from: 'baidu', file: f, w: c.w, h: c.h });
      });
    }
    // 5) baike
    if (routesSet.has('baike') && baikeKey) {
      const bk = await baikeImg(baikeKey);
      if (bk) {
        fs.writeFileSync(path.join(dir, 'baike_0.jpg'), bk.buf);
        cands.push({ url: bk.url, title: bk.title, from: 'baike', file: 'baike_0.jpg', w: 0, h: 0 });
      }
    }
    // 6) pool
    if (routesSet.has('pool')) {
      const pc = [...poolCopy(name, dir), ...pool22Copy(name, dir)];
      cands.push(...pc);
    }
    items.push({ name, query, routes, cands: cands.map(({ buf, ...r }) => r) });
    console.log(name, 'cands:', cands.map((c) => c.from + (c.good ? '*' : '')).join(','), cands.length ? 'OK' : 'NONE');
  }
  // only 模式：与既有清单合并，只替换本次抓取的名字
  let all = items;
  if (onlyArg && fs.existsSync(OUT_JSON)) {
    try {
      const old = JSON.parse(fs.readFileSync(OUT_JSON, 'utf8')).items || [];
      const got = new Set(items.map((i) => i.name));
      all = [...old.filter((i) => !got.has(i.name)), ...items];
    } catch {}
  }
  fs.writeFileSync(OUT_JSON, JSON.stringify({ generatedAt: new Date().toISOString(), total: all.length, items: all }, null, 1));
  console.log('done', items.length, 'fetched /', all.length, 'total -> evidence/qc23-cand.json');
})();
