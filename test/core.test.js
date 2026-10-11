'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { translateText } = require('../src/core/translator');
const { createDb } = require('../src/core/db');

const seed = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'seed.json'), 'utf8'));
const ctx = { words: seed.words, rules: seed.rules };

let failed = 0;

function check(name, src, expects) {
  const out = translateText(src, ctx);
  const missing = expects.filter((e) => !out.includes(e));
  if (missing.length) {
    failed++;
    console.log(`FAIL [${name}] "${src}" -> "${out}" 缺少: ${missing.join(', ')}`);
  } else {
    console.log(`PASS [${name}] ${src} -> ${out}`);
  }
}

assert.strictEqual(translateText('', ctx), '');
assert.strictEqual(translateText('   ', ctx), '');
check('基础替换', '你今天真好看！', ['小仙女', '珍', '♥']);
check('长词优先', '我不知道呢。', ['本仙女', '不造', '捏']);
check('感叹句式', '太可爱了吧哈哈哈哈', ['难道不觉得超', '阔爱']);
check('观点句式', '我觉得很好。', ['本仙女觉得', '超吼']);
check('反问句式', '是不是你喜欢我？', ['难道', '不成滴嘛', '？']);
check('感谢句式', '谢谢你！', ['靴靴', '小仙女', '♥']);
check('笑死规则', '笑死我了', ['笑到原地打滚惹吸吸']);
check('求求未命中', '求求你了', ['求求小仙女惹']);
check('英文透传', 'hello world 123', ['hello world 123']);
check('词组替换', '老板说要加班。', ['缩要鸡班']);
check('多行保留', '今天很开心\n加油哦', ['开熏', '努力一定会成功', '噢']);
check('复合词', '我的男朋友很厉害', ['本仙女滴男盆友超厉海']);
check('敏感组合', '这个人好傻', ['这个银吼莎']);
check('问句', '你在干什么呢', ['小仙女', '捏']);
check('素字', '他是我的老师', ['塔素', '本仙女滴', '老湿']);
check('鼠化', '吓死我了', ['吓鼠']);
check('语气词', '天哪，你真的来了', ['天啦噜', '尊素']);
check('疑问句式', '这是什么东西啊', ['这素在']);
check('大事不妙', '你完蛋了', ['我亲爱的你大事不妙惹']);
check('致敬句式', '全体起立', ['全体起立！']);
check('晚安句式', '晚安', ['碗安惹']);
check('致谢句式', '谢谢大家，辛苦了', ['靴靴，给你130分大银', '心疼惹本仙女']);
check('求证句式', '真的吗', ['尊素？靴靴']);
check('骑士', '我是杰斯猫的粉丝', ['素', '骑士']);
check('通讯录', '我想学淋语', ['通讯录']);
check('正宗度审判', '你这个淋语不正宗', ['鸡笼锁定']);
check('交作业句式', '我学会了', ['伦家都会了']);
check('报警句式', '我要报警了', ['本可人已经报警惹']);
check('才女句式', '她真是个才女', ['才女']);
check('用洞句式', '生命在于运动啊', ['生命在于用洞惹']);
check('吸入威胁', '这个人白嫖', ['不给硬币小心被吸了噜']);
check('造谣句式', '你在造谣', ['婷芷造谣本可']);
check('楼兰女皇句式', '请大赦天下吧', ['大赦天下']);
check('版本句式', '新英雄上线了', ['体验服', '全体起立']);
check('强度榜句式', '他什么强度', ['带狂暴就是 T0']);
check('造梗判词', '他太会造梗了', ['造梗能力最强']);
check('气拥咧', '把皇上气晕了', ['气拥咧']);
check('地才自评', '好厉害', ['厚礼蟹']);
check('孝死句式', '笑翻了', ['孝死本可惹']);
check('过气句式', '她已经过气了', ['flop']);
check('顶流句式', '她是顶流', ['母体']);
check('走着瞧', '你等着', ['渊下宫']);
check('下次见', '拜拜', ['下见惹']);
check('什么情况', '怎么回事', ['什么鬼了噜']);
check('关你什么事', '关你什么事', ['速速衮出这个舞台']);
check('灵感句式', '我突然有灵感了', ['淋光乍现惹']);
check('配音句式', '这部剧台词太差', ['配阴']);
check('人美心善', '她人美心善', ['珍素人美心善惹']);
check('美到怀孕', '真是美翻了', ['美到维纳斯怀孕惹']);
check('背景板', '她全程没镜头', ['连背景板都当不成惹']);
check('淋雨句式', '外面下雨了', ['淋雨一直走']);
check('倾诉句式', '我想听你说', ['淋听你的故事秽']);
check('去世句式', '你怎么不去死', ['请你立即去世']);
check('靴靴句式', '真的太谢谢了', ['靴靴的靴靴惹']);
check('特效句式', '这五毛特效', ['1.3毛特效']);
check('蠢死句式', '说话蠢死了', ['蠢die噜']);
check('吓到句式', '吓到我了', ['吓属惹']);

// 句式模板自带语气词时，pattern 必须吃掉结尾的「了」，否则会出现「惹惹」
for (const src of ['她笑死我了', '我学会了', '太谢谢了', '人美心善了', '灵感来了', '下雨了', '怪美的了']) {
  const out = translateText(src, ctx);
  if (/惹惹|噜噜|厚厚|了惹惹/.test(out)) {
    failed++;
    console.log(`FAIL [双语气词] "${src}" -> "${out}"`);
  } else {
    console.log(`PASS [双语气词] ${src} -> ${out}`);
  }
}

(async () => {
  const store = await createDb({ seed });
  assert.ok(store.getWords().length === seed.words.length, '种子词条应已导入');
  assert.ok(store.getRules().length === seed.rules.length, '种子句式应已导入');

  assert.ok(!store.addWord({ zh: '测试', linyu: '测血' }).error);
  assert.ok(store.addWord({ zh: '测试', linyu: '测血' }).error, '重复词条应报错');
  const w = store.getWords().find((x) => x.zh === '测试');
  assert.ok(!store.updateWord(w.id, { zh: '测试', linyu: '测穴' }).error);
  assert.strictEqual(store.getWords().find((x) => x.id === w.id).linyu, '测穴');
  assert.ok(!store.deleteWord(w.id).error);

  assert.ok(store.addRule({ pattern: '([invalid', template: 'x' }).error, '非法正则应被拒绝');
  assert.ok(!store.addRule({ pattern: '哇(呀+)', template: '哇$1淋淋', note: '测试' }).error);
  const r = store.getRules().find((x) => x.pattern === '哇(呀+)');
  assert.ok(!store.deleteRule(r.id).error);

  store.addHistory('a', 'b');
  store.addHistory('c', 'd');
  const hist = store.getHistory();
  assert.strictEqual(hist.length, 2);
  assert.strictEqual(hist[0].src, 'c', '历史应按新到旧排列');
  store.clearHistory();
  assert.strictEqual(store.getHistory().length, 0);

  const persisted = await createDb({ seed });
  persisted.addWord({ zh: '持久化测试', linyu: '久旱逢甘淋' });
  assert.ok(persisted.getWords().some((x) => x.zh === '持久化测试'));

  console.log(failed ? `\n${failed} 个用例失败` : '\n全部用例通过 ♥');
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error('测试异常:', e);
  process.exit(1);
});
