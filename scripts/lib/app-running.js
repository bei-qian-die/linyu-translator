'use strict';

// 直连真实 %APPDATA%\linyu-translator\linyu.db 的脚本，必须先确认 App 没在跑。
// Electron 的单实例锁只拦「第二个 App」，拦不住外部 Node 进程；App 运行期间
// 可能随时把内存库整体落盘，脚本同时写就会互相覆盖，滚动备份与回滚都不可信。
const { execFileSync } = require('child_process');

const APP_IMAGE = '淋语翻译器.exe';

function runningAppProcesses() {
  if (process.platform !== 'win32') return [];
  try {
    const out = execFileSync('tasklist', ['/FO', 'CSV', '/NH'], { encoding: 'utf8', windowsHide: true, timeout: 15000 });
    return out
      .split(/\r?\n/)
      .filter((line) => line.toLowerCase().includes(APP_IMAGE.toLowerCase()))
      .map((line) => (line.split('","')[0] || '').replace(/^"/, '').trim())
      .filter(Boolean);
  } catch {
    // tasklist 拿不到就放行：守卫失效不该让正常维护脚本直接跑不起来
    return [];
  }
}

function requireAppClosed(action) {
  const pids = runningAppProcesses();
  if (!pids.length) return true;
  console.error(`x 检测到「${APP_IMAGE}」正在运行（PID ${pids.join(', ')}），已中止：${action}`);
  console.error('  App 运行期间会持有本地库并随时落盘，直写该库会让备份与回滚都不可信。');
  console.error('  请先完全退出「淋语翻译器」（含托盘与后台进程）再重试。');
  process.exit(2);
}

module.exports = { APP_IMAGE, runningAppProcesses, requireAppClosed };
