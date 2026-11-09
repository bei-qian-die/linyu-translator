'use strict';

// 人物配图已从代码包移出（project.config.json 的 packOptions.ignore 排除了 pkg-hero/img）。
// 557 张 hero-*.webp 现从已上线的静态站取，图片本身与 www-web/img/thumb/ 同源。
//
// 【上线前必做】微信小程序后台 → 开发管理 → 开发设置 → 服务器域名，
// 把下面的域名加进 downloadFile 合法域名，否则真机上 <image> 会全部加载失败
// （失败时页面已有 binderror 回退到首字占位，不会白屏）。
//
// 【建议后续替换】这个域名是分享托管域，资源必须带 sharecode 才能访问（不带返回 403），
// 长期建议换成自有 CDN 或微信云开发云存储：
//   · 自有 CDN：把 HERO_IMG_BASE 换成 CDN 目录，HERO_IMG_QUERY 置空
//   · 云存储：HERO_IMG_BASE 换成 'cloud://<env>.<bucket>/hero/'，HERO_IMG_QUERY 置空，
//     <image> 可直接渲染 cloud:// fileID，且不需要配 downloadFile 合法域名
const HERO_IMG_BASE = 'https://linyu-translator.app.workbuddy.host/img/thumb/';
const HERO_IMG_QUERY = '?sharecode=KYSNKQPHS7';

function heroImage(imgNum) {
  if (!imgNum) return '';
  return HERO_IMG_BASE + imgNum + '.webp' + HERO_IMG_QUERY;
}

module.exports = { HERO_IMG_BASE, HERO_IMG_QUERY, heroImage };
