'use strict';
// 第十三轮人物配图（最终版）：从已人工核对过的百度候选缩略图里裁出 256x256 PNG。
// 复用 scripts/fetch-hero-images11.js 的落盘/裁剪/证据结构：
//   - 取图依据 = evidence/hero-cand13/<人物>__<idx>.jpg（联络表里已逐张看过的那张缩略图）；
//   - 统一用 scripts/crop-hero.py 裁成 256x256 RGB PNG，写到 src/renderer/img/hero-N.png；
//   - 每张图的来源、命中标题、尺寸与被否决候选写进 evidence/hero-images13.json。
// 全程只用百度图库真实官方立绘，绝不使用 AI 图 / cos / 手办 / 真人 / 游戏内截图 / 同人。
//
// 用法:
//   node scripts/fetch-hero-images13.js            裁剪并落盘
//   node scripts/fetch-hero-images13.js --dry-run  只打印计划
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const IMG_DIR = path.join(ROOT, 'src', 'renderer', 'img');
const CAND_DIR = path.join(ROOT, 'evidence', 'hero-cand13');
const RAW_DIR = path.join(ROOT, 'evidence', 'hero-img-raw13');
const CAND_MANIFEST = path.join(ROOT, 'evidence', 'hero-cand13.json');
const OUT_EVI = path.join(ROOT, 'evidence', 'hero-images13.json');
fs.mkdirSync(RAW_DIR, { recursive: true });

const DRY = process.argv.includes('--dry-run');
const PY = process.env.PY || 'py';

const cands = JSON.parse(fs.readFileSync(CAND_MANIFEST, 'utf8')).items;
function cand(name, idx) {
  const it = cands.find((c) => c.name === name && c.idx === idx);
  if (!it) throw new Error('候选缺失: ' + name + ' #' + idx);
  return it;
}

// [人物, 选中候选 idx, 裁剪模式 fit|contain, 来源说明, 被否决候选 [{idx, reason}]]
const PLAN = [
  ['安妮', 0, 'fit', '百度图库 · 《英雄联盟》安妮（黑暗之女）官方原画，红发小女孩与泰迪熊提伯斯', [
    { idx: 4, reason: '非安妮本体（蓝色法师形象，疑为其他英雄/皮肤）' },
    { idx: 9, reason: '皮肤立绘（暗黑哥特皮肤），非经典原画' },
  ]],
  ['瑟庄妮', 0, 'fit', '百度图库 · 《英雄联盟》瑟庄妮（北地之怒）官方原画，骑乘战猪', [
    { idx: 3, reason: '加载界面，画面叠加大字「北地之怒」' },
    { idx: 6, reason: '右下角「游戏狗」站点水印' },
    { idx: 8, reason: '非瑟庄妮本体（紫色铠甲形象）' },
  ]],
  ['卡特琳娜', 0, 'fit', '百度图库 · 《英雄联盟》卡特琳娜（不祥之刃）官方原画，红发双匕', [
    { idx: 3, reason: '黑发旧版/皮肤立绘，与主流红发卡特琳娜形象不符' },
    { idx: 6, reason: '皮肤立绘（女武神皮肤）' },
  ]],
  ['丽桑卓', 0, 'fit', '百度图库 · 《英雄联盟》丽桑卓（冰霜女皇）官方原画', [
    { idx: 2, reason: '加载界面，叠加「冰霜女巫 丽桑卓」文字' },
    { idx: 8, reason: '粉色可爱皮肤，非经典原画' },
  ]],
  ['婕拉', 0, 'fit', '百度图库 · 《英雄联盟》婕拉（荆棘之兴）官方原画', [
    { idx: 3, reason: '加载界面，叠加「荆棘之兴 婕拉」文字' },
    { idx: 9, reason: '叠加「新英雄 婕拉」宣传文字' },
  ]],
  ['克烈', 0, 'fit', '百度图库 · 《英雄联盟》克烈（暴怒骑士）官方原画，约德尔人骑蜥蜴', [
    { idx: 5, reason: '皮肤（掠夺者克烈）带「MARAUDER KLED」英文标' },
    { idx: 8, reason: '加载界面，叠加「克烈 暴怒骑士」文字' },
    { idx: 3, reason: '游戏内模型/技能网格图' },
  ]],
  ['阿木木', 0, 'fit', '百度图库 · 《英雄联盟》阿木木（殇之木乃伊）官方原画', [
    { idx: 2, reason: '非阿木木本体（火焰英雄形象）' },
    { idx: 6, reason: '节日皮肤插画，非经典原画' },
  ]],
  ['芮尔', 3, 'fit', '百度图库 · 《英雄联盟》芮尔（铁铠冥魂）官方原画，持链锤骑影', [
    { idx: 1, reason: '只有武器链锤，无人物' },
    { idx: 6, reason: '概念设计稿，带「RELL CONCEPT ART」标注' },
  ]],
  ['奈德丽', 1, 'fit', '百度图库 · 《英雄联盟》奈德丽（狂野女猎手）官方原画，丛林持矛', [
    { idx: 4, reason: '加载界面，叠加「狂野女猎手 奈德丽」文字' },
    { idx: 2, reason: '皮肤立绘（哥特/女仆皮肤）' },
  ]],
  ['厄运小姐', 5, 'fit', '百度图库 · 《英雄联盟》厄运小姐（赏金猎人）官方原画，红发双枪', [
    { idx: 1, reason: '皮肤立绘（紫色礼服皮肤）' },
    { idx: 3, reason: '角色三视图概念稿' },
  ]],
  ['乐芙娜', 0, 'fit', '百度图库 · 《英雄联盟》乐芙娜（诡术妖姬）官方原画', [
    { idx: 2, reason: '皮肤立绘（花嫁/法老皮肤）' },
    { idx: 8, reason: '皮肤（哑剧/ mime 皮肤）' },
  ]],
  ['凝光', 2, 'fit', '百度图库 · 《原神》凝光（天权星）官方角色演示立绘', [
    { idx: 1, reason: '同人/二创插画，非官方立绘' },
    { idx: 8, reason: '游戏内角色界面截图，带 UI' },
  ]],
  ['坎蒂丝', 2, 'fit', '百度图库 · 《原神》坎蒂丝官方角色立绘（持水与盾枪）', [
    { idx: 1, reason: '角色三视图/转身模型图' },
    { idx: 9, reason: '手办/实物模型照片' },
  ]],
  ['梦见月瑞希', 2, 'fit', '百度图库 · 《原神》梦见月瑞希官方角色立绘', [
    { idx: 5, reason: '同人插画' },
    { idx: 9, reason: '游戏内截图，带场景' },
  ]],
  ['翡翠', 0, 'contain', '百度图库 · 《崩坏：星穹铁道》翡翠官方角色立绘（持皮鞭全身像）', [
    { idx: 3, reason: '同人/二创插画（坐姿），非官方立绘' },
    { idx: 8, reason: '游戏内角色界面截图，带 UI' },
  ]],
  ['灵砂', 8, 'fit', '百度图库 · 《崩坏：星穹铁道》灵砂官方角色立绘', [
    { idx: 3, reason: '多角色拼接长图' },
    { idx: 2, reason: '游戏内截图带 UI' },
  ]],
  ['黑塔', 1, 'contain', '百度图库 · 《崩坏：星穹铁道》黑塔官方角色立绘（持大锤人偶）', [
    { idx: 0, reason: '屏幕截图，带绿色描边与 Follow 按钮' },
    { idx: 7, reason: '同人插画' },
  ]],
  ['女娲', 1, 'fit', '百度图库 · 《王者荣耀》女娲官方英雄立绘', [
    { idx: 7, reason: '非女娲（疑为其他法师英雄）' },
    { idx: 8, reason: '非女娲（白发男性英雄）' },
  ]],
  ['安琪拉', 0, 'fit', '百度图库 · 《王者荣耀》安琪拉官方英雄立绘', [
    { idx: 2, reason: '游戏内对局截图' },
    { idx: 9, reason: '右下角「9game 九游」水印' },
  ]],
  ['芈月', 5, 'contain', '百度图库 · 《王者荣耀》芈月官方英雄立绘', [
    { idx: 1, reason: '真人照片（模特/Coser），非游戏立绘' },
    { idx: 7, reason: '非芈月（蓝发男性英雄）' },
  ]],
  ['镜', 2, 'fit', '百度图库 · 《王者荣耀》镜（破镜之刃）官方英雄立绘', [
    { idx: 0, reason: 'Q版/二头身形象，非标准立绘' },
    { idx: 8, reason: '「同人原创印象曲」封面，属二创' },
  ]],
  ['海诺', 1, 'contain', '百度图库 · 《王者荣耀》海诺官方英雄立绘', [
    { idx: 7, reason: '皮肤立绘（红色皮肤）' },
    { idx: 5, reason: '角色转身模型图' },
  ]],
  ['重岳', 0, 'fit', '百度图库 · 《明日方舟》重岳官方干员立绘', [
    { idx: 4, reason: '游戏内图鉴界面截图，带 UI' },
    { idx: 2, reason: '宣传 banner，叠加文字' },
  ]],
  ['玛恩纳', 0, 'fit', '百度图库 · 《明日方舟》玛恩纳官方干员立绘', [
    { idx: 5, reason: '皮肤立绘（金色礼服皮肤）' },
    { idx: 7, reason: '游戏内截图' },
  ]],
  ['龙舌兰', 2, 'fit', '百度图库 · 《明日方舟》龙舌兰官方干员立绘（持吉他）', [
    { idx: 8, reason: '新干员宣传 banner，叠加「TEQUILA 龙舌兰」文字' },
    { idx: 7, reason: '同人插画（半裸）' },
  ]],
  ['能天使', 0, 'contain', '百度图库 · 《明日方舟》能天使官方干员立绘（红发光环持枪）', [
    { idx: 7, reason: '周年宣传图，带 UI 与文字' },
    { idx: 1, reason: '皮肤立绘' },
  ]],
  ['红蝶', 0, 'contain', '百度图库 · 《第五人格》红蝶官方监管者立绘', [
    { idx: 2, reason: '带胶片边框装饰' },
    { idx: 7, reason: '游戏内场景截图' },
  ]],
  ['杰克', 0, 'fit', '百度图库 · 《第五人格》开膛手杰克官方监管者立绘', [
    { idx: 2, reason: '档案卡片，叠加「开膛手杰克」文字排版' },
    { idx: 3, reason: '游戏内截图' },
  ]],
  ['孔雀明王', 0, 'contain', '百度图库 · 《阴阳师》孔雀明王官方式神立绘', [
    { idx: 7, reason: '皮肤（绯翎玫冠）宣传图，带文字' },
    { idx: 8, reason: '游戏内场景截图' },
  ]],
  ['三角头', 0, 'fit', '百度图库 · 《黎明杀机》×《寂静岭》三角头（处刑者）官方形象', [
    { idx: 2, reason: '游戏内对局截图' },
    { idx: 9, reason: '游戏内截图，叠加「三角头」文字' },
  ]],
  ['德古拉', 0, 'fit', '百度图库 · 《黎明杀机》×《恶魔城》德古拉官方杀手形象', [
    { idx: 4, reason: 'BBC 剧集《DRACULA》海报，与游戏无关' },
    { idx: 7, reason: '动画《精灵旅社》形象，与游戏无关' },
    { idx: 5, reason: '历史人物黑白照片，与游戏无关' },
  ]],
];

(async () => {
  const onDisk = fs.readdirSync(IMG_DIR);
  let next = 0;
  for (const f of onDisk) {
    const m = f.match(/^hero-(\d+)\.png$/);
    if (m) next = Math.max(next, Number(m[1]) + 1);
  }

  const report = [];
  const assign = {};

  for (const [name, idx, mode, how, rejected] of PLAN) {
    const it = cand(name, idx);
    const file = `hero-${next}.png`;
    const src = path.join(CAND_DIR, it.file);
    const raw = path.join(RAW_DIR, file.replace(/\.png$/, '.raw'));
    const out = path.join(IMG_DIR, file);
    console.log(`[pick] ${name} ← #${idx}  ${it.title.slice(0, 50)}`);
    if (DRY) {
      report.push({ hero: name, status: 'dry-run', idx, how });
      continue;
    }
    fs.copyFileSync(src, raw);
    try {
      execFileSync(PY, [path.join(ROOT, 'scripts', 'crop-hero.py'), raw, out, mode], { stdio: 'ignore' });
    } catch (e) {
      report.push({ hero: name, status: '待补图', reason: '裁剪失败：' + e.message });
      console.error(`[crop-fail] ${name}`);
      continue;
    }
    assign[name] = 'img/' + file;
    report.push({
      hero: name,
      file: 'img/' + file,
      sourceUrl: it.url,
      sourceKind: 'baidu',
      title: it.title,
      width: it.w,
      height: it.h,
      how,
      rejected: rejected || [],
    });
    next += 1;
    console.error(`[ok] ${name} -> ${file}`);
  }

  if (!DRY) {
    fs.writeFileSync(
      OUT_EVI,
      JSON.stringify({ fetchedAt: new Date().toISOString(), assign, report }, null, 2),
      'utf8'
    );
  }
  console.error(`\n[done] 成功 ${Object.keys(assign).length} / 计划 ${PLAN.length}`);
})();
