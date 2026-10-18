# Android 版本（Capacitor 套壳）说明

桌面版是 Electron + Vue 3 + sql.js，Android 版用 [Capacitor](https://capacitorjs.com/) 把同一份 web 资源打包成 APK。代码侧核心与渲染层完全复用，只替换了 Electron 主进程能力（IPC/文件对话框/scrypt/单实例）。

## 已实现的 30 个 IPC 通道（与桌面版逐一对位）

| 桌面 IPC                       | 移动实现                                                |
| ------------------------------ | ------------------------------------------------------- |
| `ly:translate`                 | `api.translate` — 直接调用 `core/translator.js`         |
| `ly:auth:*`                    | `api.authStatus/login/logout/changePassword` — 走 scrypt |
| `ly:words / rules / cards / quotes / heroes` 五大板块 CRUD × 5 | `api.listWords/addWord/...` 全部同名同形                 |
| `ly:undo:delete / undo:state`  | `api.undoDelete / undoState / onUndoChange`              |
| `ly:data:export / pickImport / replanImport / applyImport / cancelImport` | 同名 API；导出走 `@capacitor/share`，导入走 `<input type="file">` |
| `ly:data:syncSeed / inspect / cleanHeroWords` | 同名 API                                                  |
| `ly:backups:list / restore / restoreBefore` | `api.listBackups / restoreBackup / restoreBefore`        |
| `ly:media:pick / media:data`   | 选图走 `<input type="file" accept="image/*">` + Filesystem；`mediaData(ref)` 取回 data:URL |
| `ly:history:*`                 | 同名 API                                                  |
| `ly:prefs:get / set`           | 同名 API（写库的 settings 表）                          |
| `ly:logs:open`                 | 简化为返回最近 60 行日志（Android 没有目录打开概念）    |
| `ly:openExternal`              | `@capacitor/browser` 打开 http/https 外链               |
| `ly:meta`                      | 同名 API                                                  |
| —（桌面窗口可调大小，没有这回事） | `api.orientationState / initOrientation / setOrientation / setAutoRotate / onOrientationChange` — 走 `@capacitor/screen-orientation`；桌面 `preload.js` 保留同名 API 但一律回 `supported:false` |

## 目录结构（与桌面版对比）

```
src/
  core/                       # 桌面和移动共用
    db.js                     # 重写：fsAdapter 替代 fs/path
    auth.js                   # 重写：scrypt module 替代 crypto.scryptSync
    lore.js / lore-extra3..7.js # 加 UMD 兼容（require / window 双分支）
    tokenizer.js / translator.js
    seed.json                 # 移动入口 fetch 它
  renderer/                   # 桌面和移动共用（基本不动）
  main/                       # 仅 Electron
    main.js, preload.js       # 桌面专用
  mobile/                     # 仅移动
    fsAdapter.js              # 文件 IO 抽象：Node + Capacitor 双后端
    scrypt.js                 # scrypt 跨环境（Node crypto / 浏览器 scrypt-js）
    api.js                    # 30 通道实现，对位 preload.js
    entry.js                  # 浏览器入口：拼装 db / auth / api，挂 window.api
scripts/
  build-mobile.mjs            # 把 renderer/core/mobile 拼成 www/
capacitor.config.json
android/                      # npx cap add android 产物
```

## 一次完整的 Android 构建

### 前置

| 项      | 版本 / 路径                             |
| ------- | --------------------------------------- |
| Node    | 18+ (本项目用 22)                        |
| JDK     | 17+（本项目用 21，安装于 `C:\Program Files\Java\jdk-21`） |
| Android SDK | platform-tools / platforms;android-34 / build-tools;34.0.0 |

环境变量（本项目当前）：
- `ANDROID_HOME = D:\Android\Sdk`
- `JAVA_HOME = C:\Program Files\Java\jdk-21`

### 一行命令

```bash
npm install
npm run mobile:build     # 生成 www/，把 renderer + core + mobile + vendor 拼起来
npx cap sync android     # 把 www/ 拷进 android/app/src/main/assets/public
cd android
gradlew.bat -I init.gradle assembleDebug
# 产物：android/app/build/outputs/apk/debug/app-debug.apk
```

### 国内网络的小贴士

`android/gradle/wrapper/gradle-wrapper.properties` 已改为腾讯云镜像（绕过 `services.gradle.org` 超时）：
```
distributionUrl=https\://mirrors.cloud.tencent.com/gradle/gradle-8.2.1-all.zip
```

`android/init.gradle` 把 `google()` / `mavenCentral()` 替换为阿里云镜像：
```
maven { url 'https://maven.aliyun.com/repository/google' }
maven { url 'https://maven.aliyun.com/repository/public'   }
maven { url 'https://maven.aliyun.com/repository/gradle-plugin' }
maven { url 'https://mirrors.cloud.tencent.com/nexus/repository/maven-public/' }
```

如果还是下载受阻，参考 [SwitchHosts](https://github.com/oldj/SwitchHosts) 或腾讯云/DevSidecar 在代理后调用 gradle。

### 安装 / 验证

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.qiuzh.linyutranslator/.MainActivity
adb logcat | findstr "linyu Capacitor"
```

启动器 / 启动页 / 图标都已被以下覆盖：
- `android/app/src/main/res/mipmap-{m,h,xh,xxh,xxxh}dpi/ic_launcher{,_round,_foreground}.png`：来自桌面版的 `build/icon.png`，统一占位（如果你想用 Android Studio 的 Image Asset Studio 重做一遍也可以）
- `strings.xml`：已生成 `淋语翻译器` 应用名

## 横竖屏（1.13.0）

方向由 `@capacitor/screen-orientation` 控制，界面靠 CSS 媒体查询跟随：

- 进 App 默认 `lock('portrait')`；只有设置页「跟随设备旋转」打开时才 `unlock()`，偏好存在 `settings` 表的 `ui.autoRotate`（已进 `db.js` 的 `PREF_KEYS` 白名单）
- 顶栏右上角的方向钮手动切换横竖屏，切一次会顺手关掉「跟随设备旋转」，否则用户一转身方向又被传感器抢回去
- 桌面版没有"锁屏"概念：`preload.js` 保留 5 个同名 API 但一律回 `supported:false`，渲染层据此不画按钮，`npm start` 出来的窗口行为不变
- 两套布局的规则**全部**挂在 `body[data-mobile]` 上，这个标记由 `src/mobile/entry.js` 在确认确实是 Capacitor WebView 后才打。桌面 exe 加载同一份 `style.css` 也不会变样

断点分三层（见 `style.css` 末尾）：不带 `orientation` 的是两种朝向共用的（表格卡片化、安全区、热区尺寸），`portrait` 折顶栏为两行 + 翻译双栏变单栏，`landscape` 保持一行并压缩纵向。另有一档 `(orientation: landscape) and (max-width: 720px)` 给 640dp 一类小横屏。

### 没有设备怎么验：`/fit.html` 探针

```bash
npm run mobile:build
node scripts/serve-www.js          # 127.0.0.1:8787
# 打开 http://127.0.0.1:8787/fit.html
```

- `scripts/cap-stub.js`：假的原生桥（Filesystem 用内存 Map，ScreenOrientation 只记 `locked`，另有 `__rotate()` 假装传感器），注入进 `/harness.html`
- `scripts/fit-harness.html`：把 App 装在 iframe 里，改 iframe 尺寸就能量 390x844 / 844x390 两套布局，`__probe.overflowX()` 找横向溢出（"不留拉条"的判据），`__probe.fit()` 报 `body[data-mobile]`、`data-orient`、`__errs`
- iframe 处于后台时 `setTimeout` 会被节流、CSS transition 会冻在 0%，量尺寸前先给文档塞一条 `*{transition:none!important}`，否则圆钮看着没变形其实是动画没走完
- 量过的横屏宽度：844 / 740 / 667 / 640 单行不溢出，600 / 560 靠顶栏 `flex-wrap` 兜底折行，圆钮始终 34x34

## 数据兼容
桌面版的 `linyu.db` 格式与移动版完全一致（sql.js + 同一套 SCHEMA）。**注意：本项目当前实现是两个独立库**，并没有自动同步机制：
- 桌面：`%APPDATA%\linyu-translator\linyu.db`
- 移动：`/data/data/com.qiuzh.linyutranslator/files/linyu.db`（Capacitor Directory.DATA）

要走两边互导数据，做现有 `导出 JSON → 分享 → 导入 JSON` 这一对 API 就行：桌面导出 → 通过任意 IM 发给自己 → 移动端从 `设置 → 数据 → 导入` 选这个 JSON。反过来一样。

## V1 已对位 / V1.1 计划（如果有）

| 项                     | 桌面    | 移动版 V1                       |
| ---------------------- | ------- | ------------------------------- |
| 五大板块 CRUD          | ✅      | ✅                              |
| 翻译（含 trace）       | ✅      | ✅                              |
| 开发者登录（scrypt）   | ✅      | ✅（scrypt-js 浏览器版本）       |
| 撤销                   | ✅      | ✅                              |
| 导入 / 导出 JSON       | ✅      | ✅（导出走 Share Sheet，导入走文件选取） |
| 备份恢复               | ✅      | ✅（直接走 fsAdapter）          |
| 媒体上传与展示         | ✅      | ✅                              |
| 历史 / 偏好            | ✅      | ✅                              |
| 外链打开               | ✅      | ✅（@capacitor/browser）         |
| 日志查看               | 系统 log | 最近 60 行 → 设置里"复制全部"     |

## 后续可补的（按需）

- Android Auto Backup（`android:allowBackup` 默认 true，会自动备份 files/）—— 已经开
- App 内更新检查（暂未做；目前要更新就是下新版 APK 覆盖安装）
- 平板（≥1024dp 横屏）没上真机验过：断点写的是 `orientation` 不是 `width`，逻辑上会走横屏档，但 34px 圆钮在大屏上偏小
- 启动闪屏
- 应用签名（debug APK 用 Android 默认的 debug.keystore；上架需要正式签名）

## 备注：源码不变性

`src/main/` 与 `src/preload.js` 只在 Electron 流程被引用，移动流程不读它们。Capacitor 模板里没有这些，所以这次改造**不动桌面版任何代码**——你 `npm start` 启动 Electron 桌面版完全不受影响。
