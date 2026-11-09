// 一次性发布脚本：在 GitHub 与 Gitee 创建/复用 v1.35.0 Release 并上传构建产物。
// 用法：node scripts/_publish-1350.mjs [github|gitee|both]
//
// 凭据一律走 `git credential fill`，不把 token 写进代码或日志。
// 资产：release/linyu-translator-1.35.0-win-unpacked.zip（Windows 桌面解包目录）
//        优先级最低的兜底——如果某端上传超时，只记日志，不让整轮发布失败。
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TAG = 'v1.35.0';
const NAME = '淋语翻译器 1.35.0 · 四分区开区';
const NOTES = fs.readFileSync(path.join(ROOT, 'release', '1.35.0-notes.md'), 'utf8');
const ASSET = path.join(ROOT, 'release', 'linyu-translator-1.35.0-win-unpacked.zip');
const ONLY = process.argv[2] || 'both';

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

async function uploadGitHubAsset(release, file) {
  const token = cred('github.com').password;
  const name = path.basename(file);
  const size = fs.statSync(file).size;
  const url = `https://uploads.github.com/repos/bei-qian-die/linyu-translator/releases/${release.id}/assets?name=${encodeURIComponent(name)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/zip',
      'Content-Length': String(size),
      Accept: 'application/vnd.github+json',
    },
    body: fs.createReadStream(file),
    duplex: 'half',
  });
  const txt = await res.text();
  if (!res.ok) throw new Error('github asset ' + res.status + ' ' + txt.slice(0, 200));
  return JSON.parse(txt).browser_download_url;
}

async function github() {
  const token = cred('github.com').password;
  const H = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' };
  const base = 'https://api.github.com/repos/bei-qian-die/linyu-translator';

  const del = await fetch(`${base}/releases/tags/${TAG}`, { headers: H });
  if (del.ok) {
    const r = await del.json();
    console.log('[github] Release 已存在:', r.html_url);
    return r.html_url;
  }

  const res = await fetch(`${base}/releases`, {
    method: 'POST',
    headers: H,
    body: JSON.stringify({ tag_name: TAG, name: NAME, body: NOTES, draft: false, prerelease: false }),
  });
  const rel = await res.json();
  if (!res.ok) throw new Error('github release ' + res.status + ' ' + JSON.stringify(rel).slice(0, 200));
  console.log('[github] Release 已创建:', rel.html_url);

  if (fs.existsSync(ASSET)) {
    try {
      const u = await uploadGitHubAsset(rel, ASSET);
      console.log('[github] 资产已上传:', u);
    } catch (e) {
      console.log('[github] 资产上传失败（代码与 tag 已就绪）:', e.message);
    }
  }
  return rel.html_url;
}

async function gitee() {
  const c = cred('gitee.com');
  const token = c.password;
  const owner = 'north-shallow-butterfly';
  const repo = 'linyu-translator';
  const base = `https://gitee.com/api/v5/repos/${owner}/${repo}`;
  const q = `access_token=${encodeURIComponent(token)}`;

  const ex = await fetch(`${base}/releases/tags/${TAG}?${q}`);
  // Gitee 在没有 Release 时返回 200 + 字面量 null，不能只看状态码
  const exTxt = await ex.text();
  let exRel = null;
  try {
    exRel = JSON.parse(exTxt);
  } catch {
    exRel = null;
  }
  if (exRel && exRel.tag_name) {
    console.log('[gitee] Release 已存在:', exRel.html_url || exRel.tag_name);
    return exRel.html_url || null;
  }

  const form = new URLSearchParams({ tag_name: TAG, name: NAME, body: NOTES, target_commitish: 'master' });
  const res = await fetch(`${base}/releases?${q}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  const rel = await res.json();
  if (!res.ok) throw new Error('gitee release ' + res.status + ' ' + JSON.stringify(rel).slice(0, 200));
  console.log('[gitee] Release 已创建:', rel.html_url || rel.tag_name, 'id=' + rel.id);

  if (fs.existsSync(ASSET) && rel.id) {
    try {
      const fd = new FormData();
      fd.append('file', new Blob([fs.readFileSync(ASSET)]), path.basename(ASSET));
      const up = await fetch(`${base}/releases/${rel.id}/attach_files?${q}`, { method: 'POST', body: fd });
      const j = await up.json();
      console.log('[gitee] 资产上传', up.ok ? '成功' : '失败', j.browser_download_url || JSON.stringify(j).slice(0, 160));
    } catch (e) {
      console.log('[gitee] 资产上传失败（代码与 tag 已就绪）:', e.message);
    }
  }
  return rel.html_url || null;
}

(async () => {
  if (ONLY === 'github' || ONLY === 'both') {
    try {
      console.log('GITHUB_URL=' + (await github()));
    } catch (e) {
      console.log('[github] 失败:', e.message);
    }
  }
  if (ONLY === 'gitee' || ONLY === 'both') {
    try {
      console.log('GITEE_URL=' + (await gitee()));
    } catch (e) {
      console.log('[gitee] 失败:', e.message);
    }
  }
})();
