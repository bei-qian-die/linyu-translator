// 把 Web 构建产物同步到一体服务的 public/ 目录。
// 部署前跑一次：npm run web:build && npm run server:prepare
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'www-web');
const DST = path.join(ROOT, 'linyu-server', 'public');

async function main() {
  await fs.access(path.join(SRC, 'index.html')).catch(() => {
    throw new Error('www-web/index.html 不存在，先跑 npm run web:build');
  });

  // 只清 public 目录内容，保留 linyu-server 本身的文件
  await fs.rm(DST, { recursive: true, force: true });
  await fs.mkdir(DST, { recursive: true });
  await fs.cp(SRC, DST, { recursive: true });

  let files = 0;
  let bytes = 0;
  async function walk(dir) {
    for (const ent of await fs.readdir(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) await walk(p);
      else {
        files += 1;
        bytes += (await fs.stat(p)).size;
      }
    }
  }
  await walk(DST);
  console.log(`[server:prepare] public/ 已同步 ${files} 个文件 / ${(bytes / 1048576).toFixed(1)}MB`);
}

main().catch((e) => {
  console.error('[server:prepare] 失败:', e.message);
  process.exit(1);
});
