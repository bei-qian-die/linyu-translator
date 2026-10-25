// @ts-check
'use strict';
// 第十三轮「多种译法」批量变体，由 scripts/gen-variants13.js 生成（语料逐字验真，min=2）。
// VARIANTS：给既有词条补 alias 写法；NEW_WORDS：中文词头未收录、淋语写法在语料里逐字出现过。
// 每条都带 count（语料命中行数）与 sample（原文），出处见 evidence/variants13.json。

const VARIANTS = [
 {
  "zh": "妈呀大姐",
  "linyu": "玛雅大姐",
  "add": [
   {
    "form": "妈呀哒姐",
    "count": 6,
    "sample": "[dm]妈呀哒姐。。。",
    "file": "corpus10.raw.txt"
   }
  ]
 },
 {
  "zh": "解解们",
  "linyu": "解解们",
  "add": [
   {
    "form": "姐姐们",
    "count": 5,
    "sample": "[dm]唉还是心疼这些姐姐们，歌好听人也有实力，公司真的想钱想疯了",
    "file": "corpus11.raw.txt"
   }
  ]
 },
 {
  "zh": "闭嘴惊艳",
  "linyu": "闭嘴惊艳",
  "add": [
   {
    "form": "闭嘴精咽",
    "count": 2,
    "sample": "[sub]闭嘴精咽",
    "file": "corpus11.raw.txt"
   }
  ]
 },
 {
  "zh": "玛雅大姐",
  "linyu": "玛雅大姐",
  "add": [
   {
    "form": "玛雅哒姐",
    "count": 28,
    "sample": "【评论】玛雅哒姐峰子来的吗🙄💅🏻",
    "file": "corpus-bili-20261011065020.txt"
   }
  ]
 },
 {
  "zh": "尊嘟假嘟",
  "linyu": "尊嘟假嘟",
  "add": [
   {
    "form": "真嘟假嘟",
    "count": 2,
    "sample": "[dm]真嘟假嘟",
    "file": "corpus5.txt"
   }
  ]
 }
];

const NEW_WORDS = [];

module.exports = { VARIANTS, NEW_WORDS };
