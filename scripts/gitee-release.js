'use strict';
/* 把本地产物发布到 Gitee 发行版（Release）：先确保 tag 对应的发行版存在，再上传附件。
 *
 *   node scripts/gitee-release.js --check
 *   node scripts/gitee-release.js --update --name 标题 --notes release/1.13.0-notes.md --file release/xxx.apk
 *
 * 令牌从 GITEE_TOKEN 环境变量读；或写进 release/.gitee-token（release/ 已被 .gitignore 忽略）。
 * 令牌只进 Authorization 头和 attach_files 的 access_token 字段，不打印、不入库。
 *
 * Gitee API 踩过的三个坑，别再改回去：
 *   改发行版只有 PATCH 能用，PUT 回 405；PATCH 少了 body 字段回 400 "body is missing"。
 *   上传附件是 POST /releases/{id}/attach_files（multipart，file + access_token），GitHub 那套 /assets 在 Gitee 是 404。
 *   附件列表没有独立端点，就在 GET 发行版返回的 assets 里（含 Gitee 自动生成的源码包 zip/tar.gz）。 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const API = 'https://gitee.com/api/v5';
const ROOT = path.resolve(__dirname, '..');

function arg(name, dflt) {
  const i = process.argv.indexOf('--' + name);
  if (i < 0) return dflt;
  const v = process.argv[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
}

function ownerRepo() {
  const url = execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: ROOT }).toString().trim();
  const m = url.match(/gitee\.com[:/]([^/]+)\/([^/.]+?)(\.git)?$/);
  if (!m) throw new Error('origin 不是 gitee 地址：' + url);
  return m[1] + '/' + m[2];
}

function token() {
  if (process.env.GITEE_TOKEN) return process.env.GITEE_TOKEN.trim();
  const f = path.join(ROOT, 'release', '.gitee-token');
  if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8').trim();
  throw new Error('没找到令牌：设 GITEE_TOKEN 环境变量，或把令牌写进 release/.gitee-token');
}

async function req(method, url, { body, form, auth } = {}) {
  const headers = {};
  // 公开仓库的 GET 不需要令牌，写操作才强制要
  let t = null;
  try { t = token(); } catch (e) { if (method !== 'GET') throw e; }
  if (t && auth !== false) headers.Authorization = 'token ' + t;
  // form 交给 fetch 自己拼 boundary，手写 Content-Type 会让服务端读不到字段
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(url, { method, headers, body: form || (body ? JSON.stringify(body) : undefined) });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* Gitee 偶尔回 HTML */ }
  if (!res.ok) {
    const e = new Error(method + ' ' + url + ' -> HTTP ' + res.status + ' ' + (json && (json.message || json.error) || text).slice(0, 300));
    e.status = res.status;
    throw e;
  }
  return json || text;
}

async function main() {
  const repo = ownerRepo();
  const tag = arg('tag', 'v' + require(path.join(ROOT, 'package.json')).version);
  const file = arg('file') ? path.resolve(ROOT, arg('file')) : null;
  const ref = arg('ref', 'master');
  const name = arg('name', '淋语翻译器 ' + tag.replace(/^v/, ''));
  const notes = arg('notes') ? path.resolve(ROOT, arg('notes')) : null;
  const body = notes ? fs.readFileSync(notes, 'utf8') : '详见 CHANGELOG';
  if (file && !fs.existsSync(file)) throw new Error('附件不存在：' + file);

  console.log('仓库 ' + repo + ' · tag ' + tag);

  // 1. 发行版：按 tag 查，没有就建
  let rel = null;
  try { rel = await req('GET', API + '/repos/' + repo + '/releases/tags/' + encodeURIComponent(tag)); }
  catch (e) { if (e.status !== 404 && !/不存在|not found/i.test(e.message)) throw e; }
  if (!rel || !rel.id) {
    if (arg('check')) { console.log('发行版 ' + tag + ' 还不存在'); return; }
    rel = await req('POST', API + '/repos/' + repo + '/releases', {
      body: { tag_name: tag, name, body, target_commitish: ref, prerelease: false },
    });
    console.log('已创建发行版 #' + rel.id + ' → ' + (rel.html_url || 'https://gitee.com/' + repo + '/releases/tag/' + tag));
  } else {
    console.log('发行版已存在 #' + rel.id + ' → ' + (rel.html_url || 'https://gitee.com/' + repo + '/releases/tag/' + tag));
    // Gitee 推 tag 会自动建一个空发行版，网页手建的也可能只有一句占位描述，--update 才覆盖标题/描述
    if (arg('update') && !arg('check')) {
      // 发行版记的是建它那一刻的 commit，tag 挪过之后要顺手改指当前 tag 的提交
      let commit = arg('commit') || '';
      if (!commit) { try { commit = execFileSync('git', ['rev-parse', '--verify', tag + '^{}'], { cwd: ROOT }).toString().trim(); } catch { /* 本地没这个 tag */ } }
      // 只有 PATCH 能用：PUT 直接被 Gitee 挡成 405，而 PATCH 缺 body 字段会回 400 "body is missing"
      await req('PATCH', API + '/repos/' + repo + '/releases/' + rel.id, {
        body: { name, body, tag_name: tag, target_commitish: commit || rel.target_commitish || ref, prerelease: Boolean(rel.prerelease) },
      });
      console.log('已更新标题与描述' + (commit ? '（指 ' + commit.slice(0, 7) + '）' : ''));
    }
  }

  // 2. 附件：真正的端点是 POST /releases/{id}/attach_files（multipart），/assets 那套是 GitHub 的、Gitee 不存在
  const fresh = await req('GET', API + '/repos/' + repo + '/releases/tags/' + encodeURIComponent(tag)).catch(() => rel);
  const list = (fresh && fresh.assets) || rel.assets || [];
  console.log('现有附件：' + (list.length ? list.map((a) => a.name).join(', ') : '（无）'));
  if (!file) { console.log('没给 --file，只到检查为止'); return; }
  const want = path.basename(file);
  if (list.some((a) => a.name === want)) {
    console.log('!! 附件 ' + want + ' 已在发行版里。同名重传会留两份，要换包请先在网页编辑发行版删掉旧附件，再重跑本脚本。');
    return;
  }
  if (arg('check')) { console.log('--check：不上传'); return; }

  const buf = fs.readFileSync(file);
  console.log('上传 ' + want + '（' + (buf.length / 1048576).toFixed(1) + ' MB）…');
  const form = new FormData();
  form.append('access_token', token());
  form.append('file', new Blob([buf], { type: 'application/octet-stream' }), want);
  const up = await req('POST', API + '/repos/' + repo + '/releases/' + rel.id + '/attach_files', { form });
  const url = up && up.browser_download_url;
  console.log('完成：' + (typeof up === 'string' ? up.slice(0, 200) : JSON.stringify(up).slice(0, 300)));
  console.log('下载直链：' + (url || 'https://gitee.com/' + repo + '/releases/download/' + tag + '/' + encodeURIComponent(want)));
}

main().catch((e) => { console.error('失败：' + e.message); process.exit(1); });
