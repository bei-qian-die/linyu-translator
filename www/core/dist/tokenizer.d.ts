/** 词库里的一个候选条目：原词 + 拆好的码点数组 + 码点长度 */
interface DictEntry {
    str: string;
    cps: string[];
    len: number;
}
/**
 * 词库条目按首字符分桶，桶内按长度降序；返回的分词器做最大正向匹配。
 * @param dictWords 词库的中文侧（words[].zh）
 */
declare function buildTokenizer(dictWords: Iterable<string>): (text: string) => string[];
