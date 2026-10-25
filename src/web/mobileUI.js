/*
 * 移动端浏览器适配入口
 * ---------------------------------------------------------------------------
 * 职责单一：判断「现在是不是手机浏览器」，是就给 <body> 挂 mobile-app，
 * 让 web/mobile.css 那套排布生效；桌面端一条规则都不加载。
 *
 * 为什么用 JS 判定而不是纯 @media：
 *   · 桌面浏览器把窗口拖窄到 400px 时不该突然变成手机版（用户预期是网页被压窄）。
 *   · iPad / Android 平板横屏宽度可能超过 1000px，但仍然是触屏单手操作，media query 判不出来。
 *   · 需要一个可覆盖的开关，方便你在电脑上直接预览手机版：加 ?ui=mobile 即可，
 *     反过来 ?ui=desktop 可以让手机看桌面版。
 *
 * 这个文件必须在 app.js 之后、Vue mount 之后运行都不影响 —— 它只加类名和一个
 * MutationObserver，不碰任何 Vue 管理的数据。
 */

(function () {
  'use strict';

  var MOBILE_CLASS = 'mobile-app';
  var OVERRIDE_KEY = 'linyu:ui-mode';

  /* ---------- 1. 判定 ---------- */

  function readOverride() {
    var q = '';
    try {
      q = new URLSearchParams(location.search).get('ui') || '';
    } catch (e) {
      q = '';
    }

    if (q === 'mobile' || q === 'desktop') {
      try {
        localStorage.setItem(OVERRIDE_KEY, q);
      } catch (e) {
        /* 隐私模式下 localStorage 可能抛错，忽略即可 */
      }
      return q;
    }

    try {
      var saved = localStorage.getItem(OVERRIDE_KEY);
      if (saved === 'mobile' || saved === 'desktop') return saved;
    } catch (e) {
      /* 同上 */
    }

    return '';
  }

  function detectMobile() {
    var ua = navigator.userAgent || '';
    var maxTouch = navigator.maxTouchPoints || 0;

    // 手机 UA 名单。MicroMessenger（微信内置浏览器）单独列出，微信里 UA 会带 Mobile，
    // 但老版本安卓微信的 Mobile 标记曾缺失，多兜一层。
    var uaMobile = /Android|iPhone|iPod|iPad|Mobile|HarmonyOS|OpenHarmony|MicroMessenger|MiuiBrowser|HeyTapBrowser/i.test(
      ua,
    );

    // iPadOS 13+ 的 UA 伪装成 Macintosh，只能靠触点数区分
    var iPadOS = /Macintosh/i.test(ua) && maxTouch > 1;

    // UA 全被改掉的极端情况：粗指针（手指）+ 窄屏，基本可以断定是手机
    var coarse = false;
    try {
      coarse =
        window.matchMedia('(pointer: coarse)').matches &&
        Math.min(window.innerWidth, window.innerHeight) <= 820;
    } catch (e) {
      coarse = false;
    }

    return uaMobile || iPadOS || coarse;
  }

  function detectDesktopBrowser() {
    var ua = navigator.userAgent || '';
    // 桌面端 UA 一定带这三个之一，且没有 Mobile 标记
    return /Windows NT|Macintosh|X11|CrOS/i.test(ua) && !/Mobile/i.test(ua);
  }

  function shouldUseMobile() {
    var override = readOverride();
    if (override === 'mobile') return true;
    if (override === 'desktop') return false;

    // 明确的桌面浏览器直接否决，避免「触屏笔记本 + 窄窗口」被误判成手机
    if (detectDesktopBrowser() && !detectMobile()) return false;

    return detectMobile();
  }

  /* ---------- 2. 应用 / 撤销 ---------- */

  var applied = false;

  function applyMobile() {
    if (applied) return;
    applied = true;

    document.body.classList.add(MOBILE_CLASS);
    document.documentElement.setAttribute('data-ui', 'mobile');

    syncThemeColor();
    observeTheme();
    observeActiveTab();
    stripDesktopHints();

    // 手机浏览器点链接/回退时可能整页从往返缓存恢复，恢复后 Viewport 尺寸已变
    window.addEventListener(
      'pageshow',
      function (e) {
        if (e.persisted) syncThemeColor();
      },
      { passive: true },
    );

    console.info('[mobile-ui] 已切换到移动端布局');
  }

  function removeMobile() {
    if (!applied) return;
    applied = false;

    document.body.classList.remove(MOBILE_CLASS);
    document.documentElement.setAttribute('data-ui', 'desktop');

    if (themeObserver) {
      themeObserver.disconnect();
      themeObserver = null;
    }
    if (tabObserver) {
      tabObserver.disconnect();
      tabObserver = null;
    }

    console.info('[mobile-ui] 已切换到桌面端布局');
  }

  /* ---------- 3. 主题色：让手机浏览器地址栏跟着主题走 ---------- */

  var THEME_COLOR = {
    white: '#ffffff',
    pink: '#fdf2f8',
    black: '#0f0f11',
  };

  function syncThemeColor() {
    if (!applied) return;

    var theme = document.body.getAttribute('data-theme') || 'white';
    var color = THEME_COLOR[theme] || THEME_COLOR.white;

    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      document.head.appendChild(meta);
    }
    if (meta.getAttribute('content') !== color) meta.setAttribute('content', color);
  }

  var themeObserver = null;

  function observeTheme() {
    if (themeObserver || !window.MutationObserver) return;
    themeObserver = new MutationObserver(syncThemeColor);
    themeObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
  }

  /* ---------- 4. 当前 tab 自动滚进可视区 ----------
   * 底部导航是横向可滑动的，切到靠后的 tab（人物传 / 名言 / 历史）时，
   * 高亮的那颗可能滑出屏幕外，用户看不出自己在哪一页。
   * 监听 .tabs button 的 class 变化（Vue 改 active 的唯一途径），把它滚到中间。
   */

  var tabObserver = null;

  function centerActiveTab() {
    if (!applied) return;
    var active = document.querySelector('.tabs button.active');
    if (!active) return;

    var bar = active.parentElement;
    if (!bar || bar.scrollWidth <= bar.clientWidth + 1) return;

    // 只滚导航自身，不带动整个页面（block: 'nearest' 是关键）
    var target = active.offsetLeft - (bar.clientWidth - active.offsetWidth) / 2;
    var max = bar.scrollWidth - bar.clientWidth;
    if (target < 0) target = 0;
    if (target > max) target = max;

    try {
      bar.scrollTo({ left: target, behavior: 'smooth' });
    } catch (e) {
      bar.scrollLeft = target;
    }
  }

  function observeActiveTab() {
    if (tabObserver || !window.MutationObserver) return;

    var bar = document.querySelector('.tabs');
    if (!bar) return;

    tabObserver = new MutationObserver(function (records) {
      for (var i = 0; i < records.length; i++) {
        if (records[i].attributeName === 'class') {
          centerActiveTab();
          return;
        }
      }
    });

    tabObserver.observe(bar, {
      attributes: true,
      attributeFilter: ['class'],
      subtree: true,
    });
  }

  /* ---------- 5. 去掉桌面快捷键提示 ----------
   * 搜索框 placeholder 里的「（Ctrl+F）」在手机上没有任何意义，还占掉半个输入框。
   * placeholder 是模板里的静态属性，Vue 只会在 mount 时写一次，之后不会再 patch，
   * 所以这里改掉不会被覆盖回来。Vue 挂载是异步的（等数据库初始化），
   * 用短轮询兜住「脚本跑得比渲染快」的情况。
   */

  var HINT_RE = /\s*[（(]\s*Ctrl\s*\+\s*[A-Za-z,]\s*[)）]/g;

  function stripDesktopHints() {
    if (!applied) return;

    var done = 0;
    var timer = setInterval(function () {
      if (!applied || done >= 12) {
        clearInterval(timer);
        return;
      }
      done++;

      var nodes = document.querySelectorAll('.search, .add-row input');
      for (var i = 0; i < nodes.length; i++) {
        var ph = nodes[i].getAttribute('placeholder');
        if (!ph) continue;
        var next = ph.replace(HINT_RE, '');
        if (next !== ph) nodes[i].setAttribute('placeholder', next);
      }
    }, 250);
  }

  /* ---------- 6. 断点重算（只在用户没手动覆盖时生效） ---------- */

  var resizeTimer = null;

  function onViewportChange() {
    if (readOverride()) return; // 手动指定过就尊重用户选择
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      resizeTimer = null;
      if (shouldUseMobile()) applyMobile();
      else removeMobile();
    }, 220);
  }

  function boot() {
    if (shouldUseMobile()) applyMobile();

    window.addEventListener('resize', onViewportChange, { passive: true });
    window.addEventListener('orientationchange', onViewportChange, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  // 调试用：控制台里 linyuMobile.off() / linyuMobile.on() 可即时切换
  window.linyuMobile = {
    get active() {
      return applied;
    },
    on: applyMobile,
    off: removeMobile,
    detect: shouldUseMobile,
  };
})();
