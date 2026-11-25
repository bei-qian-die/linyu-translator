// @ts-check
'use strict';

// 版本公告数据 —— 当前版本 1.41.1（2026-11-25）
//
// 生成物：由 `npm run changelog:build` 从根目录 CHANGELOG.md 解析生成，不要手改这个文件。
// 只保留**最新一条**：公告栏只展示当前版本，不做历史版本列表。
// 版本号与 package.json 的 version 强绑定（脚本里是门禁），升版本只改 package.json + CHANGELOG.md。
//
// 双端导出：Node/打包器走 module.exports，浏览器走 window.CHANGELOG_DATA，小程序 require。
const __export = {
  version: "1.41.1",
  date: "2026-11-25",
  summary: "小程序审核驳回修复版：解决「复制失败」引起的可用性驳回（《微信小程序平台运营规范常见拒绝情形》3.3），并为数据加载失败补上明确提示。",
  items: [
    "根因：app.js 注册了 wx.onNeedPrivacyAuthorization，用自绘 wx.showModal 直接 resolve({ event: 'agree' })，但没有 buttonId。微信要求自定义隐私弹窗必须在 <button open-type=\"agreePrivacyAuthorization\"> 的回调里 resolve({ buttonId, event })；缺 buttonId 时授权不会被记录，而「开发者已响应」又让微信不再兜底弹官方弹窗 —— 结果是 wx.setClipboardData 必然失败，线上表现就是审核截图里的「复制失败，请长按选择文本」",
    "修复：不再注册该事件，改用微信官方隐私弹窗；utils/ui.js 复制前先 wx.requirePrivacyAuthorize（≥2.32.3 基础库），失败按 errno 112 / 103 / 104 / privacy api banned 归类并写进实时日志",
    "兜底：新增「手动复制」面板（templates/copy-sheet.wxml + utils/copySheet.js）—— 拿不到剪贴板时把内容放进可选中的浮层，长按全选即可复制，并带「再试一次」重新走授权；翻译 / 词库 / 音乐 / 历史 / 人物五个页面全部接入，后台隐私指引是否声明「剪贴板」都不再让复制变成死路",
    "可加载性：词卡 / 名言 / 人物页加载失败由「静默空列表」改为明确的「内容加载失败 · 重新加载」；人物页 require 抛错不再中断 onLoad（此前只会剩空壳，最接近白屏）",
    "需人工确认一次：mp 后台「设置 → 服务内容声明 → 用户隐私保护指引」必须勾选「剪贴板」（读写剪贴板内容），否则 errno 112 会持续存在、兜底面板会一直走手动复制；提审「补充说明」模板见 docs/1.41.1-小程序审核驳回修复.md",
    "产物范围：本次只有小程序端行为变化，PC / 安卓安装包仍是 1.41.0 的二进制；Web 静态站随版本号重建",
  ],
};

if (typeof module === 'object' && module.exports) module.exports = __export;
else if (typeof window !== 'undefined') window.CHANGELOG_DATA = __export;
