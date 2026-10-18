'use strict';
/* 把本地产物发布到 Gitee 发行版（Release）：先确保 tag 对应的发行版存在，再上传附件。
 *
 *   node scripts/gitee-release.mjs --check
 *   node scripts/gitee-release.mjs --tag v1.13.0 --file release/xxx.apk --notes release/1.13.0-notes.md
 *
 * 令牌从 GITEE_TOKEN 环境变量读；或写进 release/.gitee-token（release/ 已被 .gitignore 忽略）。
 * 令牌只进 Authorization 头，不打印、不入库。
 *
 * 已知 Gitee API 的坑：附件同名不会覆盖，也没有删除单个附件的端点 —— 重传前必须先在网页上把旧附件删掉。 */
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

async function req(method, url, { body, raw, auth } = {}) {
  const headers = {};
  // 公开仓库的 GET 不需要令牌，写操作才强制要
  let t = null;
  try { t = token(); } catch (e) { if (method !== 'GET') throw e; }
  if (t && auth !== false) headers.Authorization = 'token ' + t;
  if (raw) headers['Content-Type'] = 'application/octet-stream';
  else if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(url, { method, headers, body: raw || (body ? JSON.stringify(body) : undefined) });
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
    console.log('已创建发行版 #' + rel.id + ' → ' + rel.html_url);
  } else {
    console.log('发行版已存在 #' + rel.id + ' → ' + (rel.html_url || 'https://gitee.com/' + repo + '/releases/tag/' + tag));
    // Gitee 推 tag 会自动建一个空发行版，网页手建的也可能只有一句占位描述，--update 才覆盖标题/描述
    if (arg('update') && !arg('check')) {
      await req('PUT', API + '/repos/' + repo + '/releases/' + rel.id, {
        body: { name, body, tag_name: tag, target_commitish: rel.target_commitish || ref, prerelease: Boolean(rel.prerelease) },
      });
      console.log('已更新标题与描述');
    }
  }

  // 2. 附件：Gitee 不回 asset 的 id，也没删除端点，所以同名只能先手工删
  const assets = (await req('GET', API + '/repos/' + repo + '/releases/' + rel.id + '/assets').catch(() => [])) || [];
  const list = Array.isArray(assets) ? assets : (assets.assets || []);
  console.log('现有附件：' + (list.length ? list.map((a) => a.name).join(', ') : '（无）'));
  if (!file) { console.log('没给 --file，只到检查为止'); return; }
  const want = path.basename(file);
  if (list.some((a) => a.name === want)) {
    console.log('!! 附件 ' + want + ' 已在发行版里。Gitee 同名不覆盖，要换包请先在网页编辑发行版删掉旧附件，再重跑本脚本。');
    return;
  }
  if (arg('check')) { console.log('--check：不上传'); return; }

  const buf = fs.readFileSync(file);
  console.log('上传 ' + want + '（' + (buf.length / 1048576).toFixed(1) + ' MB）…');
  const up = await req('POST', API + '/repos/' + repo + '/releases/' + rel.id + '/assets?name=' + encodeURIComponent(want), { raw: buf });
  console.log('完成 → ' + ((up && (up.browser_download_url || up.url)) || '见发行版页面'));
  console.log('下载直链：https://gitee.com/' + repo + '/releases/download/' + tag + '/' + encodeURIComponent(want));
}

main().catch((e) => { console.error('失败：' + e.message); process.exit(1); });
