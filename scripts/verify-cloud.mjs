#!/usr/bin/env node
/*
 * 云服务链路验证（Node 侧，无需浏览器）
 *
 * 验证内容：
 *   1. SDK 能用 publicConfig 初始化
 *   2. 匿名（仅 publishableKey）能读到 words 表 —— 证明 endpoint / key / GRANT / SELECT 策略通了
 *   3. 匿名写 words 被 RLS 拒绝 —— 证明写保护生效，不是裸奔的表
 *   4. history / settings 匿名不可读 —— 证明用户私有表隔离生效
 *
 * 登录态下的写（需要真实验证码）不在本脚本范围，由页面手工验证。
 *
 * 用法：node scripts/verify-cloud.mjs
 */

import { createWorkBuddyCloud } from '@tencent-ai/workbuddy-cloud-sdk';

// ---- 浏览器 API 最小垫片：SDK 默认把会话存 localStorage ----
function makeStore() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    clear: () => m.clear(),
    key: (i) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
  };
}

if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = makeStore();
}
if (typeof globalThis.sessionStorage === 'undefined') {
  globalThis.sessionStorage = makeStore();
}

const PUBLIC_CONFIG = {
  endpoint: 'https://linyu-translator.app.workbuddy.host',
  oauthRelayBaseUrl: 'https://www.workbuddy.cn/v2/as/genie-baas/oauth',
  publishableKey: 'wbpk_Sd4kigAmHhvYV7chB2LAcw_MZ3UuUaOBD6IjNlyQDc1EnfXIveVZwTI',
};

let pass = 0;
let fail = 0;

function ok(name, detail) {
  pass += 1;
  console.log(`  OK  ${name}${detail ? ' — ' + detail : ''}`);
}

function bad(name, detail) {
  fail += 1;
  console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`);
}

async function main() {
  console.log('1. 初始化 SDK…');
  let cloud;
  try {
    cloud = createWorkBuddyCloud({
      endpoint: PUBLIC_CONFIG.endpoint,
      oauthRelayBaseUrl: PUBLIC_CONFIG.oauthRelayBaseUrl,
      publishableKey: PUBLIC_CONFIG.publishableKey,
    });
    if (!cloud || !cloud.database || !cloud.auth) throw new Error('client 结构不完整');
    ok('createWorkBuddyCloud 初始化');
  } catch (err) {
    bad('createWorkBuddyCloud 初始化', err.message);
    return;
  }

  console.log('2. 匿名读 words（应成功，返回条数）…');
  try {
    const res = await cloud.database.from('words').select('id', { count: 'exact', head: true });
    if (res.error) {
      bad('匿名读 words', `${res.error.code || ''} ${res.error.message || res.error}`);
    } else {
      ok('匿名读 words', `云端现有 ${res.count ?? 0} 条`);
    }
  } catch (err) {
    bad('匿名读 words', err.message);
  }

  console.log('3. 匿名写 words（应被 RLS 拒绝）…');
  try {
    const res = await cloud.database
      .from('words')
      .insert({ zh: '__verify_probe__', linyu: '__probe__' })
      .select();
    if (res.error) {
      ok('匿名写被拒绝', `${res.error.code || ''} ${res.error.message || ''}`.trim());
    } else if (Array.isArray(res.data) && res.data.length === 0) {
      ok('匿名写被拒绝', '返回空数组（RLS 过滤）');
    } else {
      bad('匿名写被拒绝', '竟然写成功了，RLS 有漏洞');
    }
  } catch (err) {
    ok('匿名写被拒绝', err.message);
  }

  console.log('4. 匿名读 history（应无权限或空）…');
  try {
    const res = await cloud.database.from('history').select('id', { count: 'exact', head: true });
    if (res.error) {
      ok('history 对匿名不可读', `${res.error.code || ''} ${res.error.message || ''}`.trim());
    } else if (!res.count) {
      ok('history 对匿名不可读', '返回 0 行');
    } else {
      bad('history 对匿名不可读', `泄露了 ${res.count} 行`);
    }
  } catch (err) {
    ok('history 对匿名不可读', err.message);
  }

  console.log('5. 匿名读 settings（应无权限或空）…');
  try {
    const res = await cloud.database.from('settings').select('id', { count: 'exact', head: true });
    if (res.error) {
      ok('settings 对匿名不可读', `${res.error.code || ''} ${res.error.message || ''}`.trim());
    } else if (!res.count) {
      ok('settings 对匿名不可读', '返回 0 行');
    } else {
      bad('settings 对匿名不可读', `泄露了 ${res.count} 行`);
    }
  } catch (err) {
    ok('settings 对匿名不可读', err.message);
  }

  console.log('6. 未登录时 getSession 应为空…');
  try {
    const res = await cloud.auth.getSession();
    if (res.error) ok('getSession 无会话', `${res.error.code || ''} ${res.error.message || ''}`.trim());
    else if (!res.data) ok('getSession 无会话', '返回 null');
    else bad('getSession 无会话', '未登录却拿到了会话');
  } catch (err) {
    ok('getSession 无会话', err.message);
  }

  console.log(`\n=== Results: ${pass} passed, ${fail} failed ===`);
  if (fail > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('verify-cloud 异常:', err);
  process.exitCode = 1;
});
