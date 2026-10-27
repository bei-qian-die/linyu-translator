// 一次性发布脚本：在 GitHub 与 Gitee 创建/复用当前版本 tag 的 Release 并上传安装包。
// 与 _publish-1190.mjs 的差别：版本号 / 标题 / 说明 / 资产清单全部从 package.json + release/ 自动推导，
// 不再为每个版本手写一份。用法：node scripts/_publish-release.mjs [github|gitee|both]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const VERSION = PKG.version;
const TAG = 'v' + VERSION;
const NAME = '淋语翻译器 ' + VERSION;
const NOTES = path.join(ROOT, 'release', VERSION + '-notes.md');
const BODY = fs.existsSync(NOTES) ? fs.readFileSync(NOTES, 'utf8') : `${NAME} 发布`;

// 资产清单：同版本号的两个 exe + apk，存在才上传（blockmap 不上传）。
const ASSETS = [
  path.join(ROOT, 'release', `淋语翻译器 Setup ${VERSION}.exe`),
  path.join(ROOT, 'release', `淋语翻译器 ${VERSION}.exe`),
  path.join(ROOT, 'release', `linyu-translator-${VERSION}-debug.apk`),
].filter((f) => fs.existsSync(f));

function cred(host) {
  const out = execFileSync('git', ['credential', 'fill'], {
    input: `protocol=https\nhost=${host}\n\n`,
    encoding: 'utf8',
  });
  return out.split('\n').reduce((acc, line) => {
    const i = line.indexOf('=');
    if (i > 0) acc[line.slice(0, i)] = line.slice(i + 1);
    return acc;
  }, {});
}

const BRANCH = execFileSync('git', ['branch', '--show-current'], { cwd: ROOT }).toString().trim();

async function gh(method, url, payload, raw) {
  const token = cred('github.com').password;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(payload && !raw ? { 'Content-Type': 'application/json' } : {}),
    },
    body: payload ? (raw ? payload : JSON.stringify(payload)) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`GitHub ${method} ${url} -> ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

async function doGithub() {
  const repo = 'https://api.github.com/repos/bei-qian-die/linyu-translator';
  let rel;
  try {
    rel = await gh('GET', `${repo}/releases/tags/${TAG}`);
    console.log('[gh] 已有 release', rel.id);
  } catch {
    rel = await gh('POST', `${repo}/releases`, {
      tag_name: TAG,
      target_commitish: BRANCH,
      name: NAME,
      body: BODY,
      draft: false,
      prerelease: false,
    });
    console.log('[gh] 新建 release', rel.id);
  }
  const have = new Set((rel.assets || []).map((a) => a.name));
  for (const file of ASSETS) {
    const base = path.basename(file);
    if (have.has(base)) {
      console.log('[gh] 跳过已存在资产', base);
      continue;
    }
    const buf = fs.readFileSync(file);
    const up = await ghUpload(rel.id, base, buf);
    console.log('[gh] 上传', base, (buf.length / 1048576).toFixed(1) + 'MB', '->', up.state || 'ok');
  }

  async function ghUpload(releaseId, name, buf) {
    const token = cred('github.com').password;
    const url = `https://uploads.github.com/repos/bei-qian-die/linyu-translator/releases/${releaseId}/assets?name=${encodeURIComponent(name)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(buf.length),
      },
      body: buf,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`上传 ${name} 失败: ${res.status} ${text.slice(0, 300)}`);
    return JSON.parse(text);
  }
  console.log('[gh] 完成:', rel.html_url);
}

async function doGitee() {
  const token = cred('gitee.com').password;
  const repo = 'https://gitee.com/api/v5/repos/north-shallow-butterfly/linyu-translator';
  const list = await (await fetch(`${repo}/releases?access_token=${encodeURIComponent(token)}`)).json();
  let rel = Array.isArray(list) ? list.find((r) => r.tag_name === TAG) : null;
  if (!rel) {
    const res = await fetch(`${repo}/releases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_token: token,
        tag_name: TAG,
        name: NAME,
        body: BODY,
        target_commitish: BRANCH,
        prerelease: false,
      }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Gitee 建 release 失败: ${res.status} ${text.slice(0, 300)}`);
    rel = JSON.parse(text);
    console.log('[gitee] 新建 release', rel.id);
  } else {
    console.log('[gitee] 已有 release', rel.id);
  }

  const have = new Set((rel.assets || []).map((a) => a.name));
  // Gitee 单文件上限 100MB（GitHub 是 2GB）。桌面安装包从 1.24.0 起涨到 101MB，
  // 直接传会被 400 打回；这里跳过并提示「请走 GitHub」，别让整轮发布卡在一个资产上。
  const GITEE_MAX = 100 * 1024 * 1024;
  for (const file of ASSETS) {
    const base = path.basename(file);
    if (have.has(base)) {
      console.log('[gitee] 跳过已存在资产', base);
      continue;
    }
    const size = fs.statSync(file).size;
    if (size > GITEE_MAX) {
      console.log(
        `[gitee] 跳过 ${base}（${(size / 1024 / 1024).toFixed(1)}MB 超过 Gitee 单文件 100MB 上限，桌面版请从 GitHub Release 下载）`
      );
      continue;
    }
    const form = new FormData();
    form.append('access_token', token);
    form.append('file', new Blob([fs.readFileSync(file)]), base);
    const res = await fetch(`${repo}/releases/${rel.id}/attach_files`, { method: 'POST', body: form });
    const text = await res.text();
    if (!res.ok) throw new Error(`Gitee 上传 ${base} 失败: ${res.status} ${text.slice(0, 300)}`);
    console.log('[gitee] 上传', base, '-> ok');
  }
  console.log('[gitee] 完成:', rel.html_url || `https://gitee.com/north-shallow-butterfly/linyu-translator/releases/tag/${TAG}`);
}

const which = process.argv[2] || 'both';
console.log(`[publish] ${TAG} / ${NAME} / 资产 ${ASSETS.length} 个 / 分支 ${BRANCH}`);
if (which === 'github' || which === 'both') await doGithub();
if (which === 'gitee' || which === 'both') await doGitee();
