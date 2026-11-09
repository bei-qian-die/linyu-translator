'use strict';
// 一次性：给 Gitee v1.35.0 Release 补下载说明（PATCH 需要带 tag_name / name）
const fs = require('fs');
const { execFileSync } = require('child_process');

const o = execFileSync('git', ['credential', 'fill'], {
  input: 'protocol=https\nhost=gitee.com\n\n',
  encoding: 'utf8',
});
const tok = (o.match(/password=(.*)/) || [])[1];

const tail = [
  '',
  '---',
  '',
  '## 下载说明（Gitee 单文件限 100MB）',
  '',
  '本版 Windows 桌面产物为 191MB，超出 Gitee 单资产上限，已切成 3 段：',
  '',
  '    cat linyu-translator-1.35.0-win-unpacked.zip.001 \\',
  '        linyu-translator-1.35.0-win-unpacked.zip.002 \\',
  '        linyu-translator-1.35.0-win-unpacked.zip.003 \\',
  '        > linyu-translator-1.35.0-win-unpacked.zip',
  '',
  'Windows 下可用 copy /b 001+002+003 完整.zip，解压后直接运行「淋语翻译器.exe」。',
  'GitHub 上是完整单包，不想拼接的可走 GitHub。',
  '',
].join('\n');

const body = fs.readFileSync('release/1.35.0-notes.md', 'utf8') + tail;

(async () => {
  const r = await fetch(
    'https://gitee.com/api/v5/repos/north-shallow-butterfly/linyu-translator/releases/1270927?access_token=' +
      encodeURIComponent(tok),
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        tag_name: 'v1.35.0',
        name: '淋语翻译器 1.35.0 · 四分区开区',
        body,
      }).toString(),
    }
  );
  console.log('update', r.status, (await r.text()).slice(0, 120));
})();
