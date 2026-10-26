/*
 * 运行期全局的类型声明。
 *
 * 这个项目是「Node / WebView 双栖」的：core/*.js 在桌面走 require，在 Capacitor WebView
 * 里靠 <script> 直接挂全局。这些名字没有 import 语句可以推导，只能在声明文件里告诉 tsc
 * 它们是存在的——加这个文件是为了让 tsc 能检查，一行运行时代码都不改。
 */

/** src/mobile/scrypt.js 挂载；Electron 主进程与 WebView 各自注入实现 */
declare const linyuScrypt: {
  hashPassword(password: string, salt: string): string;
};

/** src/mobile/fsAdapter.js 的 UMD 在浏览器分支挂载 */
declare const linyuFsAdapter: any;

interface Window {
  /** 各 core 模块在 WebView 下挂的入口 */
  createAuth?: unknown;
  LINYU_TOKENIZER?: unknown;
  LINYU_TRANSLATOR?: unknown;
  lore?: any;
  fsAdapter?: any;
  /** sql.js 的 UMD 在 WebView 下挂的初始化函数 */
  initSqlJs?: (opts?: any) => Promise<any>;
  /** 移动端注入的 scrypt 实现 */
  linyuScrypt?: { hashPassword(password: string, salt: string): string };
  /** 移动端入口把 seed/lore 作为全局喂进来，避免 WebView 里 fetch 相对路径失败 */
  SEED_DATA?: any;
  LORE_DATA?: any;
  LINYU_DEPRECATED?: any;
  /** lore-extra3..13 在 WebView 下挂的全局 */
  LORE_EXTRA3?: any;
  LORE_EXTRA4?: any;
  LORE_EXTRA5?: any;
  LORE_EXTRA6?: any;
  LORE_EXTRA7?: any;
  LORE_EXTRA8?: any;
  LORE_EXTRA9?: any;
  LORE_EXTRA10?: any;
  LORE_EXTRA11?: any;
  LORE_EXTRA12?: any;
  LORE_EXTRA13?: any;
  LORE_EXTRA14?: any;
  LORE_EXTRA15?: any;
  createDb?: unknown;
  SECTIONS?: any;
  /** 业务层：桌面主进程与移动端 api.js 都从这里取 */
  LINYU_SERVICE?: { createService: (deps: any) => any };
  /** preload.js 通过 contextBridge 暴露 / mobile 入口替换 */
  api?: any;
}
