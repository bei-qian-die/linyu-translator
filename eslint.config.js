'use strict';

/*
 * ESLint flat config。
 *
 * 起步原则：error 级只留「真 bug」类规则（no-undef / no-dupe-keys 等），
 * 风格类一律 warn 或关掉——这个仓库有十万行存量风格，一次性收紧只会
 * 得到几万个报错和一次掩盖问题的 bulk format。先让 lint 能进 CI，再逐步加严。
 *
 * scripts/legacy/ 是归档的一次性脚本，不检查、不维护。
 */

const js = require('@eslint/js');

const nodeGlobals = {
  require: 'readonly',
  module: 'writable',
  exports: 'writable',
  process: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
  Buffer: 'readonly',
  global: 'writable',
  console: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  setImmediate: 'readonly',
  URL: 'readonly',
  TextEncoder: 'readonly',
  TextDecoder: 'readonly',
  performance: 'readonly',
  fetch: 'readonly',
  FormData: 'readonly',
  Blob: 'readonly',
  crypto: 'readonly',
};

const weappGlobals = {
  wx: 'readonly',
  App: 'readonly',
  Page: 'readonly',
  Component: 'readonly',
  getApp: 'readonly',
};

const browserGlobals = {
  window: 'readonly',
  document: 'readonly',
  navigator: 'readonly',
  location: 'readonly',
  history: 'readonly',
  localStorage: 'readonly',
  alert: 'readonly',
  confirm: 'readonly',
  screen: 'readonly',
  requestAnimationFrame: 'readonly',
  CustomEvent: 'readonly',
  FileReader: 'readonly',
  Uint8Array: 'readonly',
  WebView: 'readonly',
  Capacitor: 'readonly',
  linyuScrypt: 'writable',
  // fsAdapter.js 的 UMD 在浏览器分支挂载（root.linyuFsAdapter），供 entry.js 兜底分支使用
  linyuFsAdapter: 'readonly',
};

const relaxedRules = {
  'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }],
  'no-empty': 'warn',
  eqeqeq: 'warn',
  'no-control-regex': 'off',
  'no-irregular-whitespace': 'off',
};

/*
 * src/core 是「Node / WebView 双栖」设计：桌面走 require，WebView 走 window 全局，
 * 每个 core 文件都有 typeof window 判断。所以三组共用同一份 globals——
 * 这不是偷懒，是照着真实的运行环境配的。
 */
const allGlobals = { ...nodeGlobals, ...browserGlobals, self: 'readonly', atob: 'readonly', btoa: 'readonly', WebSocket: 'readonly' };

module.exports = [
  { ignores: ['www/**', 'release/**', 'android/**', 'build/**', 'node_modules/**', 'scripts/legacy/**'] },
  {
    files: ['src/main/**/*.js', 'src/core/**/*.js', 'scripts/**/*.js', 'test/**/*.js'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'commonjs', globals: allGlobals },
    rules: { ...js.configs.recommended.rules, ...relaxedRules },
  },
  {
    files: ['src/renderer/**/*.js', 'src/mobile/**/*.js'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'commonjs', globals: allGlobals },
    rules: { ...js.configs.recommended.rules, ...relaxedRules },
  },
  {
    files: ['scripts/**/*.mjs', 'eslint.config.js'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: allGlobals },
    rules: { ...js.configs.recommended.rules, ...relaxedRules },
  },
  {
    files: ['miniprogram/**/*.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'commonjs',
      globals: { ...allGlobals, ...weappGlobals },
    },
    rules: { ...js.configs.recommended.rules, ...relaxedRules },
  },
];
