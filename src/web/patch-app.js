/*
 * Web 端渲染层适配（patch-app.js）
 *
 * 在构建阶段追加到 www-web/app.js 末尾（由 build-web.mjs 负责）。
 *
 * 内容：
 *   1. hash 路由：监听 hashchange，驱动 Vue view 切换，支持前进后退
 *   2. URL 分享参数 ?t= 自动回填翻译
 *   3. Web 端 body class 设置（覆盖仅在 Electron 窗口中有意义的 overflow:hidden）
 *   4. 持久化降级时监听 linyu-db-ready 事件，设置 persistence-fallback class
 *   5. 主题跟随系统偏好（新增 system 主题选项）
 *   6. / 键聚焦搜索框
 *
 * 这里的代码在 app.js 的 createApp({...}).mount('#app') 之后执行，
 * 此时 Vue 实例已挂载，可以通过 window.__vueApp 间接访问（我们给 app 挂一个引用）。
 */

(function () {
  // 等 Vue 挂载完成后再操作
  function patch() {
    // 获取 Vue 组件实例（暴露在 window）
    var appEl = document.getElementById('app');
    if (!appEl || !appEl.__vue_app__) {
      // Vue 还没挂载
      setTimeout(patch, 50);
      return;
    }
    var vm = appEl.__vue_app__;

    // ---- 0. Web body class ----
    document.body.classList.add('web-app');

    // ---- 1. hash 路由 ----
    function routeTo(key) {
      if (vm.switchView) {
        vm.switchView(key);
        // 同步更新 hash（不触发 hashchange）
        var current = window.location.hash.replace(/^#/, '');
        if (current !== key) {
          history.replaceState(null, '', '#' + key);
        }
      }
    }

    window.addEventListener('hashchange', function () {
      var hash = window.location.hash.replace(/^#/, '') || 'translate';
      // 处理人物详情直链：#/heroes/12
      if (hash.startsWith('heroes/')) {
        var heroName = decodeURIComponent(hash.slice('heroes/'.length));
        if (vm.switchView) vm.switchView('heroes');
        // 等 heroes 数据加载完成后打开
        setTimeout(function () {
          if (vm.heroes && vm.heroes.value && vm.heroes.value.length > 0) {
            var h = vm.heroes.value.find(function (h) {
              return h.name === heroName || String(h.id) === heroName;
            });
            if (h && vm.openHero) vm.openHero(h);
          }
        }, 600);
        return;
      }
      // 标准 hash：#/translate, #/words, #/rules, #/cards, #/heroes, #/quotes, #/history
      if (hash.indexOf('/') === -1 && vm.switchView) {
        vm.switchView(hash);
      }
    });

    // 初始路由
    var initHash = window.location.hash.replace(/^#/, '');
    if (initHash && initHash !== 'translate') {
      if (initHash.startsWith('heroes/')) {
        var heroName = decodeURIComponent(initHash.slice('heroes/'.length));
        if (vm.switchView) vm.switchView('heroes');
        setTimeout(function () {
          // 等加载完成
          var checkHero = setInterval(function () {
            if (vm.heroes && vm.heroes.value && vm.heroes.value.length > 0) {
              clearInterval(checkHero);
              var h = vm.heroes.value.find(function (h) {
                return h.name === heroName || String(h.id) === heroName;
              });
              if (h && vm.openHero) vm.openHero(h);
            }
          }, 200);
        }, 300);
      } else {
        routeTo(initHash);
      }
    }

    // ---- 2. 分享链接 ?t= + ?v= ----
    var params = new URLSearchParams(window.location.search);
    var shareText = params.get('t');
    if (shareText && vm.input) {
      vm.input.value = shareText;
      if (vm.doTranslate) setTimeout(function () { vm.doTranslate(); }, 800);
    }

    // ---- 3. 持久化降级提示 ----
    window.addEventListener('linyu-db-ready', function () {
      if (window.__WEB_PERSISTENCE_FAILED) {
        document.body.classList.add('persistence-fallback');
      }
    });

    // ---- 4. 主题跟随系统 ----
    // 增加一个 "system" 主题：跟随 prefers-color-scheme
    var systemQuery = window.matchMedia('(prefers-color-scheme: dark)');
    function applySystemTheme(e) {
      if (vm.theme && vm.theme.value === 'system') {
        document.body.dataset.theme = e.matches ? 'black' : 'white';
      }
    }
    systemQuery.addEventListener('change', applySystemTheme);

    // 在设置弹窗中追加「跟随系统」选项（在 themeList 后插入）
    if (vm.themeList && !vm.themeList.find(function (t) { return t.key === 'system'; })) {
      vm.themeList.push({ key: 'system', label: '跟随系统', cls: 'sw-system' });
    }

    // 拦截 setTheme：如果是 system → 读系统偏好
    var origSetTheme = vm.setTheme;
    if (origSetTheme) {
      vm.setTheme = function (t) {
        if (t === 'system') {
          vm.theme.value = 'system';
          var dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          document.body.dataset.theme = dark ? 'black' : 'white';
          // 存储偏好到 localStorage（Web 端 prefs 走 localStorage）
          try { localStorage.setItem('linyu.pref.ui.theme', JSON.stringify('system')); } catch {}
        } else {
          origSetTheme.call(vm, t);
        }
      };
    }

    // 初始化主题：读取 localStorage 中的 system 偏好
    try {
      var savedTheme = JSON.parse(localStorage.getItem('linyu.pref.ui.theme') || '""');
      if (savedTheme === 'system') {
        var dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.body.dataset.theme = dark ? 'black' : 'white';
        vm.theme.value = 'system';
      }
    } catch {}

    // ---- 5. / 键聚焦搜索 ----
    document.addEventListener('keydown', function (e) {
      if (e.key === '/' && e.target === document.body) {
        e.preventDefault();
        if (vm.focusSearch) vm.focusSearch();
      }
    });

    // ---- 6. toggleOrient 在 Web 端不应该渲染，强制隐藏 ----
    if (vm.orientSupported !== undefined) {
      vm.orientSupported.value = false;
    }
  }

  // 等待 DOM 和 Vue 就绪
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(patch, 100); });
  } else {
    setTimeout(patch, 100);
  }
})();