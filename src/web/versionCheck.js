'use strict';
/*
 * 版本自检：覆盖发布后手机浏览器常常把旧的 HTML / JS 一直缓存住，
 * 典型症状就是「网页上还是旧数据，新增内容看不到」（1.38.0 音乐板块踩过）。
 *
 * 构建时给每个资源 URL 打上 ?v=<buildTag>，并在 <html> 上写 data-build。
 * 这里拉一份 no-store 的 version.json 比对 buildTag；不一致说明当前页是旧缓存，
 * 就带一个 _v 参数重载一次 —— URL 变了，HTML 与其引用的资源都必然重新拉取。
 * sessionStorage 按目标版本去重，避免 CDN 边缘缓存不一致时来回跳转。
 */
(function () {
  var build = document.documentElement.getAttribute('data-build') || '';
  if (!build || typeof window.fetch !== 'function') return;

  var search = window.location.search || '';
  var url = 'version.json' + (search ? search + '&' : '?') + '_t=' + Date.now();

  window.fetch(url, { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (info) {
      if (!info) return;
      // 兼容旧版 version.json（没有 build 字段，只有 version）
      if (!info.build && build.indexOf(String(info.version || '') + '-') === 0) return;
      var latest = info.build || info.version;
      if (!latest || latest === build) return;

      var key = 'linyu.build.reload.' + latest;
      try {
        if (window.sessionStorage.getItem(key)) return;
        window.sessionStorage.setItem(key, '1');
      } catch (err) {
        /* 隐私模式禁用 storage 也允许刷新一次，配合上面的 URL 变化不会死循环 */
      }

      var next = window.location.href.split('#')[0];
      next += (next.indexOf('?') < 0 ? '?' : '&') + '_v=' + encodeURIComponent(latest);
      if (window.location.hash) next += window.location.hash;
      window.location.replace(next);
    })
    .catch(function () { /* 版本探测失败不影响正常使用 */ });
})();
