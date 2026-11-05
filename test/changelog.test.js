'use strict';

// 版本公告（1.34.0）的契约测试。
//
// 这一块最容易坏在两个地方：
//   1) 版本号对不上——改了 package.json 忘补 CHANGELOG（或反过来），公告就会显示上一版内容；
//   2) 公告自己弹出来——onMounted / onShow / 版本变化回调里顺手把它置 true，
//      观感非常差，而且这类改动很难在人工点测里被发现。
// 所以这里守四条线：
//   · 生成数据的版本号 === package.json 的 version，且概述 / 要点非空
//   · 四端同一份文件（src/core 与 miniprogram/data 逐字一致）
//   · 渲染层 showChangelog 初始为 false，`= true` 只出现在用户点击的 openChangelog() 里
//   · 小程序 data.showChangelog 初始为 false，打开入口只有 openChangelog

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const data = require('../src/core/changelog.js');

const corePath = path.join(ROOT, 'src', 'core', 'changelog.js');
const mpPath = path.join(ROOT, 'miniprogram', 'data', 'changelog.js');
const rendererHtml = fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'index.html'), 'utf8');
const rendererJs = fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'app.js'), 'utf8');
const aboutJs = fs.readFileSync(path.join(ROOT, 'miniprogram', 'pages', 'about', 'about.js'), 'utf8');
const aboutWxml = fs.readFileSync(path.join(ROOT, 'miniprogram', 'pages', 'about', 'about.wxml'), 'utf8');
const changelogMd = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8');

let failed = 0;
function ok(name, cond, detail) {
  if (cond) console.log(`PASS [${name}]`);
  else {
    failed++;
    console.log(`FAIL [${name}] ${detail || ''}`);
  }
}

// 取一个函数 / 对象方法的函数体（含花括号），跳过字符串与注释，避免被文案里的括号骗到
function blockOf(src, marker) {
  const at = src.indexOf(marker);
  if (at < 0) return null;
  const open = src.indexOf('{', at + marker.length);
  if (open < 0) return null;
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'" || c === '`') {
      const q = c;
      i++;
      while (i < src.length) {
        if (src[i] === '\\') {
          i += 2;
          continue;
        }
        if (src[i] === q) break;
        i++;
      }
      continue;
    }
    if (c === '/' && src[i + 1] === '/') {
      const nl = src.indexOf('\n', i);
      if (nl < 0) break;
      i = nl;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      i = end < 0 ? src.length : end + 1;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  return null;
}

function count(hay, needle) {
  return hay.split(needle).length - 1;
}

// ---- 1) 生成数据 ----
ok('数据模块导出完整', data && typeof data === 'object', typeof data);
ok('version 与 package.json 一致', data.version === pkg.version, `${data.version} vs ${pkg.version}`);
ok('date 是 YYYY-MM-DD', /^\d{4}-\d{2}-\d{2}$/.test(data.date || ''), data.date);
ok('概述非空', typeof data.summary === 'string' && data.summary.trim().length > 0);
ok(
  '要点至少 1 条且都非空',
  Array.isArray(data.items) && data.items.length >= 1 && data.items.every((t) => typeof t === 'string' && t.trim()),
  `items=${Array.isArray(data.items) ? data.items.length : 'n/a'}`
);
ok('没有残留 Markdown 标记', !/\*\*|`/.test(data.summary) && data.items.every((t) => !/\*\*|`/.test(t)));

// CHANGELOG 顶部那条必须就是当前版本（脚本门禁的另一半，这里离线复验一次）
const mdHeading = /^##\s+(\d+\.\d+\.\d+)/m.exec(changelogMd);
ok('CHANGELOG.md 顶部版本与 package.json 一致', Boolean(mdHeading) && mdHeading[1] === pkg.version, mdHeading && mdHeading[1]);

// ---- 2) 四端同源 ----
const coreRaw = fs.readFileSync(corePath, 'utf8');
const mpRaw = fs.readFileSync(mpPath, 'utf8');
ok('src/core/changelog.js 与 miniprogram/data/changelog.js 逐字一致', coreRaw === mpRaw);
ok('生成物带「勿手改」声明', coreRaw.includes('不要手改这个文件'));
ok('双端导出（module.exports / window.CHANGELOG_DATA）', coreRaw.includes('module.exports = __export') && coreRaw.includes('window.CHANGELOG_DATA = __export'));

// ---- 3) 渲染层：不自动弹 ----
ok('顶栏有公告按钮', /class="gear announce"[^>]*@click="openChangelog"/.test(rendererHtml));
ok('弹层用 v-show="showChangelog" 控制', rendererHtml.includes('v-show="showChangelog"'));
ok(
  'core/changelog.js 在 app.js 之前加载',
  rendererHtml.indexOf('src="core/changelog.js"') > 0 &&
    rendererHtml.indexOf('src="core/changelog.js"') < rendererHtml.indexOf('src="app.js"')
);
ok('showChangelog 初始为 false', /const showChangelog = ref\(false\)/.test(rendererJs));

const openFn = blockOf(rendererJs, 'function openChangelog(');
ok('存在 openChangelog()', Boolean(openFn));
ok('openChangelog() 里把 showChangelog 置 true', Boolean(openFn) && openFn.includes('showChangelog.value = true'));

const setTrue = count(rendererJs, 'showChangelog.value = true');
const setTrueInOpen = openFn ? count(openFn, 'showChangelog.value = true') : 0;
ok(
  '全文件 showChangelog = true 只出现在 openChangelog() 里',
  setTrue === 1 && setTrueInOpen === 1,
  `全文 ${setTrue} 次 / openChangelog ${setTrueInOpen} 次`
);

const mounted = blockOf(rendererJs, 'onMounted(async () =>');
ok('onMounted 存在', Boolean(mounted));
ok('onMounted 里不会打开公告', Boolean(mounted) && !mounted.includes('showChangelog.value = true'));
ok('onMounted 里没有 openChangelog 调用', Boolean(mounted) && !mounted.includes('openChangelog('));

// ---- 4) 小程序：同样只能点开 ----
ok('about 页 data.showChangelog 初始为 false', /showChangelog:\s*false/.test(aboutJs));
const mpOpen = blockOf(aboutJs, 'openChangelog()');
ok('about 页存在 openChangelog()', Boolean(mpOpen));
ok(
  'about 页 showChangelog: true 只在 openChangelog() 里出现',
  count(aboutJs, 'showChangelog: true') === 1 && Boolean(mpOpen) && mpOpen.includes('showChangelog: true'),
  `全文 ${count(aboutJs, 'showChangelog: true')} 次`
);
const mpLoad = blockOf(aboutJs, 'onLoad()');
ok('onLoad 里不会打开公告', Boolean(mpLoad) && !mpLoad.includes('showChangelog'));
ok('关于页有「版本公告」入口', aboutWxml.includes('bindtap="openChangelog"'));
ok('公告弹层默认不渲染（wx:if="showChangelog"）', aboutWxml.includes('wx:if="{{showChangelog}}"'));
ok('关于页读的是同一份数据文件', aboutJs.includes("require('../../data/changelog')"));
ok('缺失数据时降级为「暂无公告」', aboutWxml.includes('暂无公告'));

console.log('');
if (failed) {
  console.log(`FAILED: ${failed} 条断言未通过`);
  process.exit(1);
}
console.log('changelog: 全部断言通过');
