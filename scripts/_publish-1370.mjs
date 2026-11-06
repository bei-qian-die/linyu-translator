// 一次性发布脚本：GitHub 传完整桌面 zip + apk；Gitee 仅传 apk（附件配额只剩 196MB，分卷会挤掉 apk）。
// 用法：node scripts/_publish-1370.mjs [github|gitee|both]
// 凭据走 `git credential fill`，不落盘到代码或日志。
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TAG = 'v1.37.0';
const NAME = '淋语翻译器 1.37.0 · 音乐双平台补货';
const NOTES = fs.readFileSync(path.join(ROOT, 'release', '1.37.0-notes.md'), 'utf8');
const ONLY = process.argv[2] || 'both';
const BRANCH = execFileSync('git', ['branch', '--show-current'], { cwd: ROOT }).toString().trim();

const GH_ASSETS = [
  'release/linyu-translator-1.37.0-win-unpacked.zip',
  'release/linyu-translator-1.37.0-debug.apk',
];
const GITEE_ASSETS = ['release/linyu-translator-1.37.0-debug.apk'];

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

async function uploadGitHubAsset(token, releaseId, file) {
  const name = path.basename(file);
  const size = fs.statSync(file).size;
  const url = `https://uploads.github.com/repos/bei-qian-die/linyu-translator/releases/${releaseId}/assets?name=${encodeURIComponent(name)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
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

  const exist = await fetch(`${base}/releases/tags/${TAG}`, { headers: H });
  let rel = null;
  if (exist.ok) {
    rel = await exist.json();
    console.log('[github] Release 已存在:', rel.html_url);
  } else {
    const res = await fetch(`${base}/releases`, {
      method: 'POST',
      headers: H,
      body: JSON.stringify({ tag_name: TAG, target_commitish: BRANCH, name: NAME, body: NOTES, draft: false, prerelease: false }),
    });
    rel = await res.json();
    if (!res.ok) throw new Error('github release ' + res.status + ' ' + JSON.stringify(rel).slice(0, 200));
    console.log('[github] Release 已创建:', rel.html_url);
  }

  const have = new Set();
  if (rel.assets_url) {
    const al = await fetch(`${rel.assets_url}?per_page=100`, { headers: H });
    if (al.ok) for (const a of await al.json()) have.add(a.name);
  }
  for (const rel_path of GH_ASSETS) {
    const file = path.join(ROOT, rel_path);
    if (!fs.existsSync(file)) { console.log('[github] 跳过（不存在）:', rel_path); continue; }
    if (have.has(path.basename(file))) { console.log('[github] 已上传过:', path.basename(file)); continue; }
    try {
      const u = await uploadGitHubAsset(token, rel.id, file);
      console.log('[github] 资产已上传:', u);
    } catch (e) {
      console.log('[github] 资产上传失败:', path.basename(file), e.message);
    }
  }
  return rel.html_url;
}

async function gitee() {
  const token = cred('gitee.com').password;
  const base = 'https://gitee.com/api/v5/repos/north-shallow-butterfly/linyu-translator';
  const q = `access_token=${encodeURIComponent(token)}`;

  const ex = await fetch(`${base}/releases/tags/${TAG}?${q}`);
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

  const form = new URLSearchParams({ tag_name: TAG, name: NAME, body: NOTES, target_commitish: BRANCH });
  const res = await fetch(`${base}/releases?${q}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  const rel = await res.json();
  if (!res.ok) throw new Error('gitee release ' + res.status + ' ' + JSON.stringify(rel).slice(0, 200));
  console.log('[gitee] Release 已创建:', rel.html_url || rel.tag_name, 'id=' + rel.id);

  for (const rel_path of GITEE_ASSETS) {
    const file = path.join(ROOT, rel_path);
    if (!fs.existsSync(file)) { console.log('[gitee] 跳过（不存在）:', rel_path); continue; }
    try {
      const fd = new FormData();
      fd.append('file', new Blob([fs.readFileSync(file)]), path.basename(file));
      const up = await fetch(`${base}/releases/${rel.id}/attach_files?${q}`, { method: 'POST', body: fd });
      const j = await up.json();
      console.log('[gitee] 资产', path.basename(file), up.ok ? '上传成功' : '上传失败', j.browser_download_url || JSON.stringify(j).slice(0, 160));
    } catch (e) {
      console.log('[gitee] 资产上传失败:', path.basename(file), e.message);
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
