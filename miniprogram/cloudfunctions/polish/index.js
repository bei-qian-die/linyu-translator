'use strict';

// 淋语翻译器 · 云开发润色函数
// ------------------------------------------------------------------
// 一个云函数同时服务两端：
//   · 小程序：wx.cloud.callFunction('polish', { source, draft }) → { text }
//   · Web   ：云开发「HTTP 访问服务」→ POST /polish，body={source,draft} → {text}
//
// 提示词为「glm-4-flash 优化版」：授权词表 + 三选其三的淋语判定 + 弃权规则，
// 比桌面端/server 那套宽松版严格（两套已经不同源，改一处不影响另一处）。
// API Key 只存在云函数环境变量里（云开发控制台 → 云函数 → polish → 配置 → 环境变量），
// 永不下发到前端。
//
// 环境变量：
//   LLM_API_BASE   OpenAI 兼容 base，含 /v1，例如 https://api.deepseek.com/v1
//   LLM_API_KEY    对应服务的 API Key
//   LLM_MODEL      模型名，默认 glm-4-flash（智谱）
//   LLM_TIMEOUT_MS 单次超时，默认 25000
//
// 说明：这里用原生 https 模块发请求，不引 node-fetch，避免云函数 Node 版本差异带来的依赖问题。

// wx-server-sdk 只在需要云数据库 / OPENID 时才用得上；本函数只做「出网调大模型」，
// 因此把它做成可选：即使依赖没装、或云端安装依赖失败，函数依然能跑。
// （这也是本函数能做到「零依赖、秒部署」的原因）
let cloud = null;
try {
  cloud = require('wx-server-sdk');
  cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
} catch (e) {
  cloud = null;
}

const http = require('http');
const https = require('https');

const LINYU_GLYPHS = '♥惹噜厚';
const CJK_RE = /[\u4e00-\u9fff]/;

// 淋语润色师 · glm-4-flash 优化版
// 词表全部来自 src/core/seed.json 实测存在项，未收录的一律视为假淋语
// 已剔除 seed.json 查不到的两条（小仙女下凡 / 命大惹），其余均可在 linyu 或 alias 字段命中
const LINYU_LEXICON = {
  self: '本可 / 本可儿 / 本可人儿 / 本仙女 / 本仙子 / 本小仙女 / 本宝 / 本宝宝 / 本猪妞 / 本猪猪女孩 / 本土妞 / 本村妞 / 本宫 / 本座 / 本尊 / 本娘娘 / 奴家 / 小女子 / 咱家 / 本淋',
  you:  '小仙女 / 集美 / 小主 / 贵人',
  he:   '塔',
  marker: '是→素 / 这→这 / 什么→神马 / 怎么→肿么办 / 这样→酱紫 / 没有→木有 / 真→珍 / 说→缩 / 吃→呲 / 玩→丸 / 一起→一企 / 谢谢→靴靴',
  tail:  '惹 / 噜 / 厚 / 捏 / 呀 / 啦 / 哦 / 靴靴 / ♥',
  emo:   '笑鼠 / 吓鼠 / 夭寿 / 天啦噜 / 厚礼蟹 / 服惹'
};

const SYSTEM = [
  '# 角色',
  '你是「淋语」润色师。淋语是目标语言，草稿已经是合格淋语，绝不是需要纠正的错误中文。',
  '你只做一件事：把草稿改得更像真淋语。',
  '',
  '# 什么叫「像真淋语」（五选其三以上才算合格）',
  '1. 有圈层标志词：素/神马/肿么办/酱紫/木有/珍/缩/呲/丸/一企 中至少 1 个；',
  '2. 自称带家族感：本可系(中性)/本仙女系(卖萌)/本猪妞系(自嘲)/本宫系(清宫)；',
  '3. 句尾有语气词：惹/噜/厚/捏/靴靴/♥；',
  '4. 情绪夸张化：笑鼠/吓鼠/夭寿/厚礼蟹；',
  '5. 语序仍是中文语序，不要机翻腔、不要倒装。',
  '',
  '# 授权词表（只能用这些，自造的一律算错）',
  '自称：' + LINYU_LEXICON.self,
  '称呼对方：' + LINYU_LEXICON.you,
  '第三人称：' + LINYU_LEXICON.he,
  '标志词：' + LINYU_LEXICON.marker,
  '句尾语气：' + LINYU_LEXICON.tail,
  '情绪词：' + LINYU_LEXICON.emo,
  '',
  '# 允许的改动（只有这三类）',
  'A. 把中文实词换成授权词表里的淋语词（素/神马/肿么办/酱紫/木有/珍/缩/呲/丸/一企）；',
  'B. 把自称换成同风格的授权自称（只换自称词，不换别处）；',
  'C. 句尾语气词增、删、换；句末可加 呀/啦/哦。',
  '',
  '# 严禁',
  '1. 把淋语词换回中文：是→不写成「是」，神马→不写成「什么」，肿么办→不写成「怎么」，珍→不写成「真」，塔→不写成「他/她」，本可→不写成「我」；',
  '2. 增删或替换上表之外的实词、改变语义、调整语序、拆句合句；',
  '3. 使用授权词表以外的淋语词（例：中意、破防、寄了、绝绝子 一律不许出现）；',
  '4. 输出多行、解释、引号、markdown、「润色后：」等任何多余内容。',
  '',
  '# 风格自选（看原文线索，不要问）',
  '原文含 本宫/臣妾/娘娘/哀家/太后 → 用清宫系自称 + 端着的语气；',
  '原文含 人家/宝宝/嘤/喵/仙女/小可爱 → 用卖萌系自称 + 软语气；',
  '原文含 救命/猪/妞/村姑 → 用自嘲系自称 + 夸张语气；',
  '否则 → 用本可系中性自称。',
  '同一条句子里，自称、语气、标志词必须属于同一风格，不能混搭。',
  '',
  '# 弃权规则',
  '如果不确定该改什么，就原样输出草稿。宁可不动，也不要改成假淋语或中文。',
  '',
  '# 输出',
  '只输出一行润色后的淋语，不要任何其他内容。'
].join('\n');

// 4 条 few-shot：全部使用词库真实词面，覆盖 4 类改动
const SHOT_PAIRS = [
  { u: '原文：她来了。\n草稿：塔来惹。\n润色后：', a: '塔来啦惹♥' },
  { u: '原文：这是什么情况？\n草稿：这是啥情况。\n润色后：', a: '这素啥情况惹' },
  { u: '原文：谢谢你，太厉害了！\n草稿：谢谢你厚礼蟹。\n润色后：', a: '靴靴，厚礼蟹惹♥' },
  { u: '原文：救命，气死我了。\n草稿：救命，我气死了。\n润色后：', a: '夭寿惹，本可气死惹' }
];

function buildPolishMessages({ source, draft }) {
  const messages = [{ role: 'system', content: SYSTEM }];
  for (const s of SHOT_PAIRS) {
    messages.push({ role: 'user', content: s.u });
    messages.push({ role: 'assistant', content: s.a });
  }
  messages.push({ role: 'user', content: `原文：${source || ''}\n草稿：${draft || ''}\n润色后：` });
  return messages;
}

function stripThink(s) {
  return String(s || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

// ---- 护栏：按新提示词的「授权词表」重写 ----
// 旧版是「最小改动」策略：LCS < 0.7 直接否决，原则上只许动句尾。
// 新提示词允许「实词替换 / 自称换系 / 句尾增删」，字面重合度天然掉到 0.4~0.6，
// 继续用 0.7 会把合法润色全掐掉（few-shot 里「靴靴，厚礼蟹惹♥」对草稿只有 0.43）→
// 改成「中文回退 + 越权造词 + 黑词 + 漂移下限」四层判定。

// ① 中文回退：原文有、草稿已换成淋语、润色又冒回中文 → 模型把词根改回去了
const REVERT_WORDS = ['我', '你', '他', '她', '它', '什么', '怎么', '这样', '没有', '真', '说', '吃', '玩', '一起', '谢谢'];

// 「中文→淋语」对照对：下标 0 是原中文，下标 1 是淋语写法（越权字表只收下标 1）
const MARKER_PAIRS = LINYU_LEXICON.marker
  .split('/')
  .map((s) => s.trim())
  .filter(Boolean)
  .map((s) => {
    const parts = s.split('→').map((x) => x.trim());
    return [parts[0], parts[1] || parts[0]];
  });

// ② 授权字表：结果里出现「草稿没有、又不在授权表」的汉字 = 自造淋语
const ALLOWED_CHARS = (() => {
  const bag = [
    LINYU_LEXICON.self,
    LINYU_LEXICON.you,
    LINYU_LEXICON.he,
    LINYU_LEXICON.tail,
    LINYU_LEXICON.emo,
    MARKER_PAIRS.map((p) => p[1]).join(' '),
  ].join(' ');
  const set = new Set();
  for (const ch of bag) if (CJK_RE.test(ch)) set.add(ch);
  return set;
})();

// ③ 提示词点名禁令的黑词表
const BANNED_WORDS = ['中意', '破防', '寄了', '绝绝子'];

/** 最长公共子序列覆盖率：衡量「润色后和草稿差多少」，用来拦住整句重写。 */
function lcsRatio(a, b) {
  const s = String(a || '');
  const t = String(b || '');
  if (!s.length || !t.length) return 0;
  const n = s.length;
  const m = t.length;
  if (n * m > 60000) return 1; // 超长句子不值得算，直接放行
  let prev = new Array(m + 1).fill(0);
  let cur = new Array(m + 1).fill(0);
  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      cur[j] = s[i - 1] === t[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    }
    const swap = prev;
    prev = cur;
    cur = swap;
    cur.fill(0);
  }
  return prev[m] / n;
}

function retentionOk(draft, polished, source) {
  if (!polished) return false;
  const src = String(source || '');
  const dr = String(draft || '');
  const po = String(polished || '');

  // ① 中文回退
  for (const w of REVERT_WORDS) {
    if (src.includes(w) && !dr.includes(w) && po.includes(w)) return false;
  }

  // ③ 黑词（提示词点名禁止的假淋语）
  for (const w of BANNED_WORDS) {
    if (po.includes(w) && !dr.includes(w)) return false;
  }

  // ② 越权造词：逐字比对草稿 ∪ 授权字表
  for (const ch of po.match(/[\u4e00-\u9fff]/g) || []) {
    if (dr.includes(ch)) continue;
    if (ALLOWED_CHARS.has(ch)) continue;
    return false;
  }

  // ④ 第三人称「塔」不许丢（提示词明令 塔 不得写成他/她）
  if (dr.includes('塔') && !po.includes('塔')) return false;

  // ⑤ 漂移下限：允许换词，不允许整句重写（旧阈值 0.7 太严，新策略放到 0.35）
  if (lcsRatio(dr, po) < 0.35) return false;

  // ⑥ 仍须带淋语气质：句尾 / 标志词 / 家族自称 / 情绪词，四选一
  const hasGlyph = LINYU_GLYPHS.split('').some((g) => po.includes(g));
  const hasMarker = MARKER_PAIRS.some(([, ly]) => ly.length > 1 && po.includes(ly));
  const hasSelf = /本可|本仙女|本仙子|本宝|本猪|本土|本村|本宫|本座|本尊|本娘|奴家|小女子|咱家|本淋/.test(po);
  const hasEmo = /笑鼠|吓鼠|夭寿|天啦噜|厚礼蟹|服惹/.test(po);
  return hasGlyph || hasMarker || hasSelf || hasEmo;
}

// 原生 POST JSON（不依赖 fetch，兼容云函数 Node16/18）
function postJson(urlStr, payload, headers, timeoutMs) {
  return new Promise((resolve, reject) => {
    let u;
    try {
      u = new URL(urlStr);
    } catch (e) {
      return reject(e);
    }
    const data = Buffer.from(JSON.stringify(payload));
    const lib = u.protocol === 'http:' ? http : https;
    const req = lib.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || (u.protocol === 'http:' ? 80 : 443),
        path: u.pathname + u.search,
        method: 'POST',
        headers: Object.assign(
          { 'Content-Type': 'application/json', 'Content-Length': data.length },
          headers || {}
        ),
      },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (c) => {
          raw += c;
        });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(raw));
            } catch (e) {
              reject(new Error('返回非 JSON'));
            }
          } else {
            // 带上响应体前 200 字，否则 400 时完全看不出是「模型名错」还是「参数不认」
            reject(new Error('LLM 返回 ' + res.statusCode + (raw ? '：' + raw.slice(0, 200) : '')));
          }
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(Number(timeoutMs) || 25000, () => {
      req.destroy(new Error('LLM 超时'));
    });
    req.write(data);
    req.end();
  });
}

async function callLLM(messages) {
  const base = (process.env.LLM_API_BASE || '').replace(/\/$/, '');
  const key = process.env.LLM_API_KEY || '';
  const model = process.env.LLM_MODEL || 'glm-4-flash';
  if (!base || !key) throw new Error('未配置 LLM_API_BASE / LLM_API_KEY');

  const url = base + '/chat/completions';
  const headers = { Authorization: 'Bearer ' + key };
  const payload = {
    model,
    messages,
    stream: false,
    temperature: 0.45,
    top_p: 0.9,
    max_tokens: 320,
  };

  // 先带 enable_thinking:false（关掉 Qwen3 之类模型的思考链，否则 content 会是空的）。
  // 少数 OpenAI 兼容服务（如智谱）不认这个字段会返回 400/422，此时去掉它重试一次。
  let data;
  try {
    data = await postJson(
      url,
      Object.assign({}, payload, { enable_thinking: false }),
      headers,
      process.env.LLM_TIMEOUT_MS
    );
  } catch (e) {
    if (!/\b4(00|22)\b/.test(e.message)) throw e;
    data = await postJson(url, payload, headers, process.env.LLM_TIMEOUT_MS);
  }

  const content =
    data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  return content ? String(content) : '';
}

async function polish({ source, draft }) {
  if (!draft) return '';
  try {
    const out = stripThink(await callLLM(buildPolishMessages({ source, draft })));
    return retentionOk(draft, out, source) ? out : draft;
  } catch (e) {
    // 失败安全回退：模型不可用 / 超时 / 未配置 → 原样返回草稿，保证翻译器永远有可用输出
    return draft;
  }
}

exports.main = async (event) => {
  // 区分两种调用：HTTP 访问服务带 httpMethod；小程序 callFunction 不带
  const isHttp = Boolean(event && (event.httpMethod || event.requestContext));

  let payload = event || {};
  if (event && event.body !== undefined) {
    try {
      payload = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    } catch (e) {
      payload = {};
    }
  }

  const source = String((payload && payload.source) || '');
  const draft = String((payload && payload.draft) || '');

  // 自检入口：{ ping: true } → 直接回报配置状态，不调用大模型、不花钱。
  // 部署完用它确认「函数通了 / Key 配了 / 模型名对了」。
  if (payload && payload.ping) {
    const info = {
      ok: true,
      model: process.env.LLM_MODEL || 'deepseek-chat',
      hasBase: Boolean(process.env.LLM_API_BASE),
      hasKey: Boolean(process.env.LLM_API_KEY),
      sdk: Boolean(cloud),
    };
    if (isHttp) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
        body: JSON.stringify(info),
      };
    }
    return info;
  }

  const text = await polish({ source, draft });

  if (isHttp) {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: JSON.stringify({ text }),
    };
  }
  return { text };
};

// 便于本地单测：导出纯函数（云函数部署时忽略多导出的属性）
exports._internal = { buildPolishMessages, stripThink, retentionOk, lcsRatio, polish, SYSTEM, ALLOWED_CHARS, MARKER_PAIRS };
