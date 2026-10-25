# 淋语翻译器 · 微信小程序端

把普通话翻译成淋语。纯本地离线翻译，不发起翻译网络请求。

## 目录约定

```
miniprogram/
├── app.js / app.json / app.wxss     入口与全局样式
├── core/                            翻译引擎（由 src/core 同步生成，勿手改）
│   ├── tokenizer.js                 分词器
│   └── translator.js                翻译器
├── data/                            构建产物（由 scripts/build-weapp-data.mjs 生成，勿手改）
│   ├── seed.js                      词库+句式（42KB，翻译链路最小数据集）
│   ├── counts.js                    各内容表计数
│   └── lore*.js                     词卡/名言/人物（331KB，按需加载）
├── services/                        业务服务层
│   ├── content.js                   词库/句式查询与翻译（含耗时采样）
│   ├── lore.js                      词卡/名言/人物聚合（词库页/人物页按需 require）
│   ├── history.js                   历史记录（内存缓存 + 异步写 + 300ms 节流）
│   ├── prefs.js                     偏好设置与主题
│   └── sec.js                       msgSecCheck 内容安全校验封装
├── utils/
│   ├── pageBase.js                  syncChrome：主题/导航/自定义 tabBar 统一应用
│   ├── ui.js                        toast/confirm/copy/chromeMetrics
│   └── format.js                    clip/utf8Bytes
├── pages/                           index(翻译) lexicon(词库) history(历史) about(关于) hero(人物)
├── custom-tab-bar/                  自定义 tabBar（列表与 app.json 保持一致）
└── project.config.json              urlCheck 开启、不上传 sourcemap
```

## 构建与同步

核心引擎与词库以 `src/core` 为唯一数据源，小程序副本由脚本同步，**禁止直接手改 miniprogram/core 与 miniprogram/data**：

```bash
npm run weapp:sync      # 同步 core/*.js 与生成 data/（构建期已自动执行）
npm run verify:weapp    # 小程序端一致性/性能/结构检查（含字节级同步断言）
npm test                # 桌面端 + 小程序端全部测试
```

## 提审检查清单

- [ ] `npm run weapp:sync` 后无 diff（core/data 与 src 字节一致）
- [ ] `npm run verify:weapp` 全绿
- [ ] 开发者工具「详情 → 本地设置」：合法域名校验开启（urlCheck）
- [ ] 代码上传关闭 sourcemap（project.config.json `uploadWithSourceMap: false`）
- [ ] 隐私接口：剪贴板已在 app.json 声明，未使用任何网络上传 API
- [ ] 主包体积 < 2MB，不含图片
