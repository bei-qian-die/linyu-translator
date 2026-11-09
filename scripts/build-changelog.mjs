#!/usr/bin/env node
/*
 * npm run changelog:build
 *
 * 版本公告数据管线：根目录 CHANGELOG.md（人写的那一份）
 *   → src/core/changelog.js        （四端共用：桌面 require / 浏览器 window.CHANGELOG_DATA）
 *   → miniprogram/data/changelog.js（小程序 require）
 *
 * 为什么过一道生成：公告要「升版本就自动更新，前端一行代码都不改」。
 * 唯一的事实来源是 package.json 的 version + CHANGELOG.md 顶部那一条，前端只读生成物。
 *
 * 校验即门禁（仿 scripts/build-music.mjs）：
 *   · CHANGELOG.md 里找不到 `## <版本号>（<日期>）` 标题 → 退出
 *   · 最新那条的版本号 ≠ package.json 的 version → 退出（这是最容易出的错：改了版本号忘写日志）
 *   · 概述为空 / 要点列表为空 → 退出
 * 任一不过直接非零退出，且不写任何文件，不留半成品。
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const SRC_MD = path.join(root, 'CHANGELOG.md');
const SRC_PKG = path.join(root, 'package.json');
const OUT_CORE = path.join(root, 'src', 'core', 'changelog.js');
const OUT_MP = path.join(root, 'miniprogram', 'data', 'changelog.js');

// `## 1.33.0（2026-11-01）`；也容得下 `## 1.30.0 桌面端补丁（2026-10-29）` 这种带后缀的写法
const HEADING_RE = /^##\s+(\d+\.\d+\.\d+)(?:[^\n（(]*?)[（(](\d{4}-\d{2}-\d{2})[）)]\s*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function die(msg) {
  console.error('[build-changelog] ' + msg);
  process.exit(1);
}

// 中文段落按行拆开再拼回去时不能无脑加空格，否则「···公告层」会变成「··· 公告层」；
// 只有两侧都是 ASCII 字母数字（英文单词被换行切断）才补一个空格。
function joinLines(lines) {
  let out = '';
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (!out) {
      out = line;
      continue;
    }
    const prev = out[out.length - 1];
    const next = line[0];
    const needSpace = /[0-9A-Za-z]$/.test(prev) && /^[0-9A-Za-z]/.test(next);
    out += (needSpace ? ' ' : '') + line;
  }
  return out;
}

// CHANGELOG 是写给人看的 Markdown，公告层只做纯文本渲染：**粗体** 与 `代码` 的标记
// 在界面上会原样露出星号和反引号，所以在生成时去掉标记、保留文字。
function plain(text) {
  return String(text)
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .trim();
}

/**
 * 解析 CHANGELOG.md 的最新一条（文件顶部第一条，按约定就是当前版本）。
 * 返回 { version, date, summary, items }，解析不出来就抛错交给上层。
 */
export function parseLatest(markdown) {
  const lines = markdown.split(/\r?\n/);
  let start = -1;
  let version = '';
  let date = '';

  for (let i = 0; i < lines.length; i++) {
    const m = HEADING_RE.exec(lines[i].trim());
    if (m) {
      start = i;
      version = m[1];
      date = m[2];
      break;
    }
  }
  if (start < 0) {
    throw new Error('CHANGELOG.md 里没有找到 `## <版本号>（YYYY-MM-DD）` 形式的版本标题');
  }

  const block = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i])) break;
    block.push(lines[i]);
  }

  const summaryLines = [];
  const items = [];
  let inItems = false;

  for (const raw of block) {
    const line = raw.trimEnd();
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (/^[-*]\s+/.test(trimmed)) {
      inItems = true;
      items.push(trimmed.replace(/^[-*]\s+/, '').trim());
      continue;
    }
    // 其它二级标题（### 小标题）当作分段，不当正文
    if (/^#{2,}\s/.test(trimmed)) continue;

    if (!inItems) {
      summaryLines.push(trimmed);
    } else if (items.length) {
      // 被手动折行的长要点：续行并到上一条
      items[items.length - 1] = joinLines([items[items.length - 1], trimmed]);
    }
  }

  return {
    version,
    date,
    summary: plain(joinLines(summaryLines)),
    items: items.map(plain).filter(Boolean),
  };
}

function validate(data, pkgVersion) {
  const problems = [];
  if (!data.version) problems.push('解析不到版本号');
  if (!DATE_RE.test(data.date || '')) problems.push(`日期格式不对：${data.date || '(空)'}`);
  if (!data.summary) problems.push('概述段落为空');
  if (!data.items.length) problems.push('要点列表为空（一条 `- ` 都没有）');
  if (data.version !== pkgVersion) {
    problems.push(
      `CHANGELOG.md 最新版本是 ${data.version}，package.json 的 version 是 ${pkgVersion}` +
        ' —— 两边必须一致，先补 CHANGELOG.md 顶部那条再构建'
    );
  }
  if (problems.length) {
    problems.forEach((p) => console.error('  ✗ ' + p));
    throw new Error(`校验未通过，共 ${problems.length} 处问题（没有生成任何文件）`);
  }
}

function renderModule(data) {
  const lines = [];
  lines.push('// @ts-check');
  lines.push("'use strict';");
  lines.push('');
  lines.push(`// 版本公告数据 —— 当前版本 ${data.version}（${data.date}）`);
  lines.push('//');
  lines.push('// 生成物：由 `npm run changelog:build` 从根目录 CHANGELOG.md 解析生成，不要手改这个文件。');
  lines.push('// 只保留**最新一条**：公告栏只展示当前版本，不做历史版本列表。');
  lines.push('// 版本号与 package.json 的 version 强绑定（脚本里是门禁），升版本只改 package.json + CHANGELOG.md。');
  lines.push('//');
  lines.push('// 双端导出：Node/打包器走 module.exports，浏览器走 window.CHANGELOG_DATA，小程序 require。');
  lines.push('const __export = {');
  lines.push(`  version: ${JSON.stringify(data.version)},`);
  lines.push(`  date: ${JSON.stringify(data.date)},`);
  lines.push(`  summary: ${JSON.stringify(data.summary)},`);
  if (data.items.length) {
    lines.push('  items: [');
    data.items.forEach((it) => lines.push(`    ${JSON.stringify(it)},`));
    lines.push('  ],');
  } else {
    lines.push('  items: [],');
  }
  lines.push('};');
  lines.push('');
  lines.push("if (typeof module === 'object' && module.exports) module.exports = __export;");
  lines.push("else if (typeof window !== 'undefined') window.CHANGELOG_DATA = __export;");
  lines.push('');
  return lines.join('\n');
}

async function main() {
  const [markdown, pkgRaw] = await Promise.all([
    fs.readFile(SRC_MD, 'utf8'),
    fs.readFile(SRC_PKG, 'utf8'),
  ]);

  let pkg;
  try {
    pkg = JSON.parse(pkgRaw);
  } catch (err) {
    die('package.json 不是合法 JSON：' + err.message);
  }
  if (!pkg.version) die('package.json 缺 version 字段');

  let data;
  try {
    data = parseLatest(markdown);
    validate(data, pkg.version);
  } catch (err) {
    die(err.message);
  }

  const code = renderModule(data);
  await fs.writeFile(OUT_CORE, code, 'utf8');
  await fs.mkdir(path.dirname(OUT_MP), { recursive: true });
  await fs.writeFile(OUT_MP, code, 'utf8');
  console.log(
    `[build-changelog] ${data.version}（${data.date}）· ${data.items.length} 条要点 → ` +
      'src/core/changelog.js + miniprogram/data/changelog.js'
  );
}

// 被 test 直接 import 时只取 parseLatest，不跑构建
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}
