/** 句式规则：pattern 是匹配正则，template 里的 $1 $2 指代捕获组 */
interface Rule {
    pattern: string;
    template?: string;
    id?: number;
    note?: string;
}
/** 词库条目 */
interface Word {
    zh: string;
    linyu: string;
}
interface TranslateOptions {
    words: Word[];
    rules: Rule[];
    trace?: any[] | null;
    uncovered?: string[] | null;
    traceLimit?: number;
}
interface TraceEntry {
    kind: 'rule' | 'word';
    id?: number;
    pattern?: string;
    note?: string;
    from: string;
    to?: string;
}
interface TranslateCtx {
    trace: TraceEntry[] | null;
    traceLimit: number;
    uncovered: string[] | null;
    unseen: Set<string>;
}
interface CompiledRule {
    re: RegExp;
    parts: Array<{
        lit?: string;
        group?: number;
    }>;
    pattern: string;
    id?: number;
    note: string;
}
type Item = {
    raw: string;
    parts?: undefined;
    groups?: undefined;
} | {
    raw?: undefined;
    parts: CompiledRule['parts'];
    groups: RegExpExecArray;
};
declare const tokenizerMod: {
    buildTokenizer: (dictWords: Iterable<string>) => (text: string) => string[];
};
declare const buildTokenizer: (dictWords: Iterable<string>) => (text: string) => string[];
declare const END_FLAVOR: string[];
declare const SPLIT_RE: RegExp;
declare const CJK_RE: RegExp;
/** 把规则的 template 预编译成 [{lit}|{group}] 序列 */
declare function compileRules(rules: Rule[]): CompiledRule[];
declare function pushTrace(ctx: TranslateCtx, entry: TraceEntry): void;
declare let tokCache: {
    sig: string;
    map: Map<string, string>;
    segment: (text: string) => string[];
};
declare let ruleCache: {
    sig: string;
    compiled: CompiledRule[];
};
/**
 * 把句子按规则拆成 [{raw} | {parts, groups}] 序列，规则按声明顺序串行套用。
 * re 直接复用 compileRules 编译好的实例（循环里显式清零 lastIndex）——
 * 旧写法每条规则 × 每个片段都 new RegExp，一次翻译要编译几千次正则。
 */
declare function applyRules(text: string, compiled: CompiledRule[], ctx: TranslateCtx): Item[];
declare function collectUncovered(ctx: TranslateCtx, run: string): void;
declare function wordPass(items: Item[], segment: (text: string) => string[], map: Map<string, string>, ctx: TranslateCtx): string;
/**
 * @param text 待翻译的中文
 * @param options words/rules 必填；trace 与 uncovered 只在开发者模式下回传
 */
declare function translateText(text: string, options: TranslateOptions): string;
