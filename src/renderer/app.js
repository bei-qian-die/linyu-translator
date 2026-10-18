'use strict';

/* global Vue */
const { createApp, ref, reactive, computed, onMounted, watch } = Vue;

const PAGE_SIZE = 50;

// 搜索框共用：任意一个字段命中即保留
function matchRows(list, query, keys) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return list;
  return list.filter((row) => keys.some((k) => String(row[k] == null ? '' : row[k]).toLowerCase().includes(q)));
}

createApp({
  setup() {
    const tabs = [
      { key: 'translate', label: '翻译' },
      { key: 'words', label: '词库' },
      { key: 'rules', label: '句式' },
      { key: 'cards', label: '词卡' },
      { key: 'heroes', label: '人物传' },
      { key: 'quotes', label: '名言' },
      { key: 'history', label: '历史' },
    ];
    const view = ref('translate');

    const input = ref('');
    const output = ref('');
    const loading = ref(false);
    const previewing = ref(false);
    const isPreview = ref(false);
    const liveOn = ref(true);
    const trace = ref(null);
    const uncovered = ref([]);
    const samples = ref(['你今天真好看！', '我不知道呢，感觉很开心', '太可爱了吧哈哈哈哈', '谢谢宝贝的抱抱']);

    const toast = reactive({ text: '', undo: null });
    let toastTimer = null;
    function say(msg, undo) {
      toast.text = msg;
      toast.undo = undo || null;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        toast.text = '';
        toast.undo = null;
      }, undo ? 5400 : 2600);
    }

    // ---- 外观主题 / 界面偏好（存在库的 settings 表里，换机器导出也能带上） ----
    const themeList = [
      { key: 'white', label: '简洁纯白', cls: 'sw-white' },
      { key: 'black', label: '简洁黑', cls: 'sw-black' },
      { key: 'pink', label: '经典粉紫', cls: 'sw-pink' },
    ];
    const theme = ref('white');
    const historyLimit = ref(200);
    const showSettings = ref(false);
    function applyTheme(t) {
      theme.value = t;
      document.body.dataset.theme = t;
    }
    function setTheme(t) {
      applyTheme(t);
      window.api.setPref('ui.theme', JSON.stringify(t)).catch(() => {});
      say('主题已切换♥');
    }
    function openSettings() {
      showSettings.value = true;
      if (isDev.value) loadBackups();
    }

    async function call(promise) {
      const r = await promise;
      if (!r.ok) throw new Error(r.error || '出错了');
      return r.data;
    }
    function fail(err) {
      say('出错了：' + err.message);
    }

    // ---- 分页 ----
    function usePaged(sourceRef) {
      const page = ref(1);
      const total = computed(() => sourceRef.value.length);
      const pages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)));
      const rows = computed(() => {
        const start = (page.value - 1) * PAGE_SIZE;
        return sourceRef.value.slice(start, start + PAGE_SIZE);
      });
      function go(p) {
        page.value = Math.min(Math.max(1, p), pages.value);
        window.scrollTo(0, 0);
      }
      function reset() {
        page.value = 1;
      }
      watch(pages, (n) => {
        if (page.value > n) page.value = n;
      });
      return { page, pages, total, rows, go, reset };
    }

    // ---- 开发者模式 ----
    const dev = reactive({ unlocked: false, user: '', needsSetup: false, defaultPass: false, lockLeft: 0 });
    const isDev = computed(() => dev.unlocked);
    const defaultPassword = ref('');
    const appVersion = ref('');
    const loginForm = reactive({ user: '', pass: '' });
    const pwForm = reactive({ old: '', next: '' });
    const devBusy = ref(false);

    // ---- 数据可移植 / 备份 / 体检 ----
    const io = reactive({ busy: false, plan: null, file: '', strategy: 'merge', includeMedia: true, result: null });
    const backups = ref([]);
    const backupBusy = ref(false);
    const check = reactive({ busy: false, open: false, data: null });

    async function reloadAll() {
      await Promise.all([loadWords(), loadRules(), loadCards(), loadHeroes(), loadQuotes()]);
    }

    function resetEditForms() {
      resetWordForm();
      resetRuleForm();
      resetCardForm();
      resetQuoteForm();
      heroEditing.value = false;
    }

    function applyAuth(s) {
      dev.unlocked = s.unlocked;
      dev.user = s.user;
      dev.needsSetup = s.needsSetup;
      dev.defaultPass = s.defaultPass;
      dev.lockLeft = s.lockLeft;
      if (!dev.unlocked) {
        resetEditForms();
        io.plan = null;
        check.data = null;
        check.open = false;
      }
    }
    async function refreshAuth() {
      try {
        applyAuth(await call(window.api.authStatus()));
      } catch (err) {
        fail(err);
      }
    }
    async function login() {
      if (devBusy.value) return;
      const user = loginForm.user || dev.user;
      if (!user || !loginForm.pass) return say('账号和密码都要填哦');
      devBusy.value = true;
      try {
        applyAuth(await call(window.api.login(user, loginForm.pass)));
        loginForm.pass = '';
        say('开发者模式已开启，现在可以增删改内容了♥');
      } catch (err) {
        fail(err);
        try {
          applyAuth(await call(window.api.authStatus()));
        } catch {
          /* 状态查询失败已由登录报错覆盖 */
        }
      } finally {
        devBusy.value = false;
      }
    }
    async function logout() {
      try {
        applyAuth(await call(window.api.logout()));
        pwForm.old = '';
        pwForm.next = '';
        say('已退出开发者模式，内容恢复只读');
      } catch (err) {
        fail(err);
      }
    }
    async function submitPassword() {
      if (!pwForm.old || !pwForm.next) return say('原密码和新密码都要填哦');
      try {
        await call(window.api.changePassword(pwForm.old, pwForm.next));
        pwForm.old = '';
        pwForm.next = '';
        await refreshAuth();
        say('密码已修改♥');
      } catch (err) {
        fail(err);
      }
    }

    const syncing = ref(false);
    async function runSync() {
      if (syncing.value) return;
      if (!confirm('把内置词库/句式/词卡/人物/名言中新增的条目补进当前库？\n（已有内容不会被覆盖）')) return;
      syncing.value = true;
      try {
        const r = await call(window.api.syncSeed());
        await reloadAll();
        say('已补种 ' + r.added + ' 条内置内容♥');
      } catch (err) {
        fail(err);
      } finally {
        syncing.value = false;
      }
    }

    // ---- 撤销刚才的删除 ----
    async function doUndo() {
      const slot = toast.undo;
      toast.undo = null;
      if (!slot) return;
      try {
        const r = await call(window.api.undoDelete());
        if (r.kind === 'word') await loadWords();
        else if (r.kind === 'rule') await loadRules();
        else if (r.kind === 'card') await loadCards();
        else if (r.kind === 'quote') await loadQuotes();
        else if (r.kind === 'hero') await loadHeroes();
        else if (r.kind === 'history') await loadHistory();
        say('已撤销，内容回来了♥');
      } catch (err) {
        fail(err);
      }
    }

    // ---- 翻译 ----
    let previewSeq = 0;
    let previewTimer = null;

    async function runPreview() {
      const text = input.value;
      if (!text.trim()) {
        output.value = '';
        trace.value = null;
        uncovered.value = [];
        isPreview.value = false;
        return;
      }
      const seq = ++previewSeq;
      previewing.value = true;
      try {
        const r = await call(window.api.translate(text, 'preview'));
        if (seq !== previewSeq) return;
        output.value = r.dst;
        trace.value = r.trace;
        uncovered.value = r.uncovered || [];
        isPreview.value = true;
      } catch (err) {
        if (seq === previewSeq) fail(err);
      } finally {
        if (seq === previewSeq) previewing.value = false;
      }
    }

    watch(input, () => {
      if (!liveOn.value) return;
      clearTimeout(previewTimer);
      previewTimer = setTimeout(runPreview, 300);
    });

    function toggleLive() {
      liveOn.value = !liveOn.value;
      window.api.setPref('ui.live', JSON.stringify(liveOn.value)).catch(() => {});
      if (!liveOn.value) {
        clearTimeout(previewTimer);
        previewing.value = false;
      } else {
        runPreview();
      }
    }

    async function doTranslate() {
      if (!input.value.trim() || loading.value) return;
      clearTimeout(previewTimer);
      loading.value = true;
      try {
        const r = await call(window.api.translate(input.value));
        output.value = r.dst;
        trace.value = r.trace;
        uncovered.value = r.uncovered || [];
        isPreview.value = false;
      } catch (err) {
        fail(err);
      } finally {
        loading.value = false;
      }
    }

    async function copyOutput() {
      try {
        await navigator.clipboard.writeText(output.value);
        say('已复制♥');
      } catch {
        const ta = document.createElement('textarea');
        ta.value = output.value;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        say('已复制♥');
      }
    }
    // 未覆盖片段直接送去词库补条目（开发者模式下才有 trace，按钮只在这时有意义）
    function addWordFor(zh) {
      if (!isDev.value) return say('登录开发者模式才能补词条');
      resetWordForm();
      wordForm.zh = zh;
      wordForm.linyu = '';
      switchView('words');
      say('填上淋语翻译再保存♥');
    }

    // ---- 词库 ----
    const words = ref([]);
    const wordSearch = ref('');
    const wordForm = reactive({ id: null, zh: '', linyu: '', alias: '', sense: '', source: '', pop: '', relText: '' });
    const editingWordId = computed(() => wordForm.id);
    const popLevels = ['高', '中', '低'];
    const wordCount = computed(() => words.value.length);
    const filteredWords = computed(() => matchRows(words.value, wordSearch.value, ['zh', 'linyu', 'alias', 'sense', 'source']));
    const wordsView = usePaged(filteredWords);
    const { page: wordsPage, pages: wordsPages, total: wordsTotal, rows: pagedWords, go: goWordsPage, reset: resetWordsPage } = wordsView;
    watch(wordSearch, resetWordsPage);

    async function loadWords() {
      try {
        words.value = await call(window.api.listWords());
      } catch (err) {
        fail(err);
      }
    }
    function resetWordForm() {
      wordForm.id = null;
      wordForm.zh = '';
      wordForm.linyu = '';
      wordForm.alias = '';
      wordForm.sense = '';
      wordForm.source = '';
      wordForm.pop = '';
      wordForm.relText = '';
    }
    function editWord(w) {
      wordForm.id = w.id;
      wordForm.zh = w.zh;
      wordForm.linyu = w.linyu;
      wordForm.alias = w.alias || '';
      wordForm.sense = w.sense || '';
      wordForm.source = w.source || '';
      wordForm.pop = w.pop || '';
      wordForm.relText = (w.rel || []).join('、');
    }
    async function saveWord() {
      if (!wordForm.zh || !wordForm.linyu) return say('中文和淋语都要填哦');
      try {
        const payload = {
          zh: wordForm.zh,
          linyu: wordForm.linyu,
          alias: wordForm.alias,
          sense: wordForm.sense,
          source: wordForm.source,
          pop: wordForm.pop,
          rel: splitList(wordForm.relText),
        };
        if (wordForm.id) await call(window.api.updateWord(wordForm.id, payload));
        else await call(window.api.addWord(payload));
        resetWordForm();
        await loadWords();
        say('保存成功♥');
      } catch (err) {
        fail(err);
      }
    }
    async function removeWord(w) {
      if (!confirm(`删除词条「${w.zh} → ${w.linyu}」？`)) return;
      try {
        const r = await call(window.api.deleteWord(w.id));
        if (wordForm.id === w.id) resetWordForm();
        await loadWords();
        say(`已删除词条「${r.undo.label}」`, r.undo);
      } catch (err) {
        fail(err);
      }
    }

    // ---- 句式 ----
    const rules = ref([]);
    const ruleSearch = ref('');
    const ruleForm = reactive({ id: null, pattern: '', template: '', note: '', scene: '', examples: '', src: '' });
    const editingRuleId = computed(() => ruleForm.id);
    // 正则要当场试编译，等保存才发现非法就太晚了
    const rulePatternOk = computed(() => {
      if (!ruleForm.pattern) return null;
      try {
        new RegExp(ruleForm.pattern);
        return true;
      } catch {
        return false;
      }
    });
    const filteredRules = computed(() => matchRows(rules.value, ruleSearch.value, ['pattern', 'template', 'note', 'scene', 'examples', 'src']));
    const rulesView = usePaged(filteredRules);
    const { page: rulesPage, pages: rulesPages, total: rulesTotal, rows: pagedRules, go: goRulesPage, reset: resetRulesPage } = rulesView;
    watch(ruleSearch, resetRulesPage);

    async function loadRules() {
      try {
        rules.value = await call(window.api.listRules());
      } catch (err) {
        fail(err);
      }
    }
    function resetRuleForm() {
      for (const k of ['id', 'pattern', 'template', 'note', 'scene', 'examples', 'src']) ruleForm[k] = '';
    }
    function editRule(r) {
      ruleForm.id = r.id;
      ruleForm.pattern = r.pattern;
      ruleForm.template = r.template;
      ruleForm.note = r.note || '';
      ruleForm.scene = r.scene || '';
      ruleForm.examples = r.examples || '';
      ruleForm.src = r.src || '';
    }
    async function saveRule() {
      if (!ruleForm.pattern || !ruleForm.template) return say('正则和模板都要填哦');
      if (rulePatternOk.value === false) return say('正则表达式不合法，先改好再保存');
      try {
        const payload = {
          pattern: ruleForm.pattern,
          template: ruleForm.template,
          note: ruleForm.note,
          scene: ruleForm.scene,
          examples: ruleForm.examples,
          src: ruleForm.src,
        };
        if (ruleForm.id) await call(window.api.updateRule(ruleForm.id, payload));
        else await call(window.api.addRule(payload));
        resetRuleForm();
        await loadRules();
        say('句式已保存♥');
      } catch (err) {
        fail(err);
      }
    }
    async function removeRule(r) {
      if (!confirm(`删除句式「${r.pattern}」？`)) return;
      try {
        const res = await call(window.api.deleteRule(r.id));
        if (ruleForm.id === r.id) resetRuleForm();
        await loadRules();
        say(`已删除句式 #${r.id}`, res.undo);
      } catch (err) {
        fail(err);
      }
    }

    // ---- 词卡 ----
    const cards = ref([]);
    const cardFilter = ref('all');
    const cardSearch = ref('');
    const flipped = reactive(new Set());
    const cardTypes = [
      { key: 'all', label: '全部' },
      { key: 'particle', label: '语气词' },
      { key: 'slang', label: '俚语梗' },
      { key: 'lyric', label: '歌词典故' },
      { key: 'meme', label: '网络梗' },
    ];
    const cardTypeOpts = cardTypes.slice(1);
    const typeLabelMap = { particle: '语气词', slang: '俚语梗', lyric: '歌词典故', meme: '网络梗' };
    function typeLabel(t) {
      return typeLabelMap[t] || t;
    }
    const filteredCards = computed(() => {
      const byType = cardFilter.value === 'all' ? cards.value : cards.value.filter((c) => c.type === cardFilter.value);
      return matchRows(byType, cardSearch.value, ['term', 'meaning', 'detail', 'example', 'source', 'hero', 'rel']);
    });
    const cardsView = usePaged(filteredCards);
    const { page: cardsPage, pages: cardsPages, total: cardsTotal, rows: pagedCards, go: goCardsPage, reset: resetCardsPage } = cardsView;
    watch([cardSearch, cardFilter], resetCardsPage);

    function flipCard(term) {
      if (flipped.has(term)) flipped.delete(term);
      else flipped.add(term);
    }
    const cardForm = reactive({
      id: null,
      term: '',
      type: 'slang',
      meaning: '',
      detail: '',
      example: '',
      source: '',
      hero: '',
      aliasesText: '',
      relText: '',
    });
    const editingCardId = computed(() => cardForm.id);

    async function loadCards() {
      try {
        cards.value = await call(window.api.listCards());
      } catch (err) {
        fail(err);
      }
    }
    function resetCardForm() {
      cardForm.id = null;
      cardForm.term = '';
      cardForm.type = 'slang';
      cardForm.meaning = '';
      cardForm.detail = '';
      cardForm.example = '';
      cardForm.source = '';
      cardForm.hero = '';
      cardForm.aliasesText = '';
      cardForm.relText = '';
    }
    function editCard(c) {
      cardForm.id = c.id;
      cardForm.term = c.term;
      cardForm.type = c.type || 'slang';
      cardForm.meaning = c.meaning || '';
      cardForm.detail = c.detail || '';
      cardForm.example = c.example || '';
      cardForm.source = c.source || '';
      cardForm.hero = c.hero || '';
      cardForm.aliasesText = (c.aliases || []).join('、');
      cardForm.relText = (c.rel || []).join('、');
      flipped.delete(c.term);
    }
    async function saveCard() {
      if (!cardForm.term || !cardForm.meaning) return say('词名和释义都要填哦');
      try {
        const payload = {
          term: cardForm.term,
          type: cardForm.type,
          meaning: cardForm.meaning,
          detail: cardForm.detail,
          example: cardForm.example,
          source: cardForm.source,
          hero: cardForm.hero,
          aliases: splitList(cardForm.aliasesText),
          rel: splitList(cardForm.relText),
        };
        if (cardForm.id) await call(window.api.updateCard(cardForm.id, payload));
        else await call(window.api.addCard(payload));
        resetCardForm();
        await loadCards();
        say('词卡已保存♥');
      } catch (err) {
        fail(err);
      }
    }
    async function removeCard(c) {
      if (!confirm(`删除词卡「${c.term}」？`)) return;
      try {
        const r = await call(window.api.deleteCard(c.id));
        if (cardForm.id === c.id) resetCardForm();
        await loadCards();
        say(`已删除词卡「${c.term}」`, r.undo);
      } catch (err) {
        fail(err);
      }
    }

    // ---- 名言 ----
    const quotes = ref([]);
    const quoteSearch = ref('');
    const quoteForm = reactive({ id: null, text: '', author: '', hero: '', src: '', scene: '', relText: '' });
    const editingQuoteId = computed(() => quoteForm.id);
    const filteredQuotes = computed(() => matchRows(quotes.value, quoteSearch.value, ['text', 'author', 'hero', 'src', 'scene', 'rel']));
    const quotesView = usePaged(filteredQuotes);
    const { page: quotesPage, pages: quotesPages, total: quotesTotal, rows: pagedQuotes, go: goQuotesPage, reset: resetQuotesPage } = quotesView;
    watch(quoteSearch, resetQuotesPage);

    async function loadQuotes() {
      try {
        quotes.value = await call(window.api.listQuotes());
      } catch (err) {
        fail(err);
      }
    }
    function resetQuoteForm() {
      for (const k of ['id', 'text', 'author', 'hero', 'src', 'scene', 'relText']) quoteForm[k] = '';
    }
    function editQuote(q) {
      quoteForm.id = q.id;
      quoteForm.text = q.text;
      quoteForm.author = q.author || '';
      quoteForm.hero = q.hero || '';
      quoteForm.src = q.src || '';
      quoteForm.scene = q.scene || '';
      quoteForm.relText = (q.rel || []).join('、');
    }
    async function saveQuote() {
      if (!quoteForm.text) return say('名言内容不能空着');
      try {
        const payload = {
          text: quoteForm.text,
          author: quoteForm.author,
          hero: quoteForm.hero,
          src: quoteForm.src,
          scene: quoteForm.scene,
          rel: splitList(quoteForm.relText),
        };
        if (quoteForm.id) await call(window.api.updateQuote(quoteForm.id, payload));
        else await call(window.api.addQuote(payload));
        resetQuoteForm();
        await loadQuotes();
        say('名言已保存♥');
      } catch (err) {
        fail(err);
      }
    }
    async function removeQuote(q) {
      if (!confirm('删除这条名言？')) return;
      try {
        const r = await call(window.api.deleteQuote(q.id));
        if (quoteForm.id === q.id) resetQuoteForm();
        await loadQuotes();
        say('已删除名言', r.undo);
      } catch (err) {
        fail(err);
      }
    }
    const heroNameOpts = computed(() => heroes.value.map((h) => h.name));

    // ---- 人物传 ----
    const heroes = ref([]);
    const heroSearch = ref('');
    const imgFailed = reactive({});
    const selectedHero = ref(null);
    const heroGroups = [
      { key: 'real', label: '通讯录真人' },
      { key: 'game', label: '游戏角色' },
      { key: 'up', label: '淋语UP主' },
    ];
    const heroGroup = ref('real');
    function heroCount(key) {
      return heroes.value.filter((h) => (h.group || 'real') === key).length;
    }
    // 分区取自 rank 的 "分区 · 称号" 前缀：游戏角色按区筛选，真人/UP 主不参与分区
    function heroZoneOf(h) {
      if ((h.group || 'real') !== 'game') return '';
      const rank = String(h.rank || '');
      const cut = rank.indexOf('·');
      return cut > 0 ? rank.slice(0, cut).trim() : '';
    }
    const heroZone = ref('');
    const heroZones = computed(() => {
      const seen = [];
      for (const h of heroes.value) {
        const z = heroZoneOf(h);
        if (z && !seen.includes(z)) seen.push(z);
      }
      return seen.sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
    });
    function heroZoneCount(key) {
      return heroes.value.filter(
        (h) => (h.group || 'real') === heroGroup.value && heroZoneOf(h) === key
      ).length;
    }
    function switchHeroZone(key) {
      heroZone.value = key;
    }
    function markImgFail(name) {
      imgFailed[name] = true;
    }

    // 开发者上传的图片存在 userData/media，库只记 media:<name> 引用，取用时转 data URL
    const mediaMap = reactive({});
    async function loadMedia(list) {
      for (const h of list) {
        const ref = h.img;
        if (!ref || !ref.startsWith('media:') || mediaMap[ref] !== undefined) continue;
        mediaMap[ref] = '';
        const r = await window.api.mediaData(ref);
        if (r.ok) mediaMap[ref] = r.data;
      }
    }
    function heroSrc(h) {
      const img = h && h.img ? h.img : '';
      if (!img) return '';
      return img.startsWith('media:') ? mediaMap[img] || '' : img;
    }

    async function loadHeroes() {
      try {
        heroes.value = await call(window.api.listHeroes());
        loadMedia(heroes.value).catch(() => {});
      } catch (err) {
        fail(err);
      }
    }
    const filteredHeroes = computed(() =>
      matchRows(
        heroes.value
          .filter((h) => (h.group || 'real') === heroGroup.value)
          .filter((h) => !heroZone.value || heroZoneOf(h) === heroZone.value),
        heroSearch.value,
        ['name', 'alias', 'rank', 'intro', 'tags', 'works']
      )
    );
    function switchHeroGroup(key) {
      heroGroup.value = key;
      heroZone.value = '';
      selectedHero.value = null;
    }
    // 词卡归属谁，直接读 cards.hero。这份归属以前是在这里用一段正则临时猜的，
    // 猜完就丢，库里始终是空的；现在推断规则已经下沉到 core/lore.js，
    // 入库与升级回填时就把 hero 写进库里，界面上也能直接看到和修改。
    function cardHero(c) {
      return (c && c.hero) || null;
    }
    async function openHero(h) {
      selectedHero.value = h;
      heroEditing.value = false;
      try {
        if (!cards.value.length) await loadCards();
        if (!quotes.value.length) await loadQuotes();
        if (!words.value.length) await loadWords();
        if (!rules.value.length) await loadRules();
      } catch (err) {
        fail(err);
      }
      window.scrollTo(0, 0);
    }
    function backToHeroes() {
      selectedHero.value = null;
      heroEditing.value = false;
    }
    function heroSearchUrl(h) {
      return 'https://search.bilibili.com/all?keyword=' + encodeURIComponent(h.name + ' 淋语');
    }
    function openLink(url) {
      call(window.api.openExternal(url)).catch((err) => fail(err));
    }
    const heroCards = computed(() => {
      if (!selectedHero.value) return [];
      const n = selectedHero.value.name;
      return cards.value.filter((c) => cardHero(c) === n);
    });
    const heroQuotes = computed(() => {
      if (!selectedHero.value) return [];
      const n = selectedHero.value.name;
      return quotes.value.filter((q) => (q.hero || q.author) === n);
    });
    const heroWords = computed(() => {
      if (!selectedHero.value || !selectedHero.value.words) return [];
      return selectedHero.value.words
        .map((zh) => words.value.find((w) => w.zh === zh))
        .filter(Boolean);
    });
    // 句式（rules）与人物没有外键列，这里按人物名/别名在 pattern/template/note 中的
    // 精确子串命中来关联；只做正向命中、不硬塞，避免把通用句式强挂到某个英雄造成污染。
    const heroRules = computed(() => {
      if (!selectedHero.value) return [];
      const h = selectedHero.value;
      const keys = [h.name].concat(
        String(h.alias || '').split(/[/,、，\s]+/).filter((s) => s.length >= 2)
      );
      return rules.value.filter((r) => {
        const hay = [r.pattern, r.template, r.note].join('\n');
        return keys.some((k) => hay.includes(k));
      });
    });

    const heroForm = reactive({
      id: null,
      name: '',
      alias: '',
      rank: '',
      intro: '',
      baike: '',
      tagsText: '',
      worksText: '',
      wordsText: '',
      img: '',
      group: 'real',
      linksText: '',
    });
    const heroEditing = ref(false);
    const picking = ref(false);

    function splitList(text) {
      return String(text || '')
        .split(/[\n,，、]/)
        .map((s) => s.trim())
        .filter(Boolean);
    }
    function parseLinks(text) {
      return String(text || '')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => {
          const i = l.indexOf('|');
          return i < 0 ? { label: '', url: l } : { label: l.slice(0, i).trim(), url: l.slice(i + 1).trim() };
        })
        .filter((l) => /^https?:\/\//.test(l.url))
        .map((l) => ({ label: l.label || l.url, url: l.url }));
    }
    function resetHeroForm() {
      heroForm.id = null;
      for (const k of ['name', 'alias', 'rank', 'intro', 'baike', 'tagsText', 'worksText', 'wordsText', 'img', 'linksText']) {
        heroForm[k] = '';
      }
      heroForm.group = heroGroup.value;
    }
    function startAddHero() {
      resetHeroForm();
      heroEditing.value = true;
      window.scrollTo(0, 0);
    }
    function editHero(h) {
      heroForm.id = h.id;
      heroForm.name = h.name;
      heroForm.alias = h.alias || '';
      heroForm.rank = h.rank || '';
      heroForm.intro = h.intro || '';
      heroForm.baike = h.baike || '';
      heroForm.tagsText = (h.tags || []).join('、');
      heroForm.worksText = (h.works || []).join('、');
      heroForm.wordsText = (h.words || []).join('、');
      heroForm.img = h.img || '';
      heroForm.group = h.group || 'real';
      heroForm.linksText = (h.links || []).map((l) => l.label + '|' + l.url).join('\n');
      heroEditing.value = true;
      window.scrollTo(0, 0);
    }
    function cancelHeroForm() {
      heroEditing.value = false;
      resetHeroForm();
    }
    function heroPayload() {
      return {
        name: heroForm.name,
        alias: heroForm.alias,
        rank: heroForm.rank,
        intro: heroForm.intro,
        baike: heroForm.baike,
        tags: splitList(heroForm.tagsText),
        works: splitList(heroForm.worksText),
        words: splitList(heroForm.wordsText),
        img: heroForm.img,
        group: heroForm.group,
        links: parseLinks(heroForm.linksText),
      };
    }
    async function saveHero() {
      if (!heroForm.name) return say('英雄名字不能空着');
      try {
        const payload = heroPayload();
        if (heroForm.id) await call(window.api.updateHero(heroForm.id, payload));
        else await call(window.api.addHero(payload));
        const id = heroForm.id;
        cancelHeroForm();
        await loadHeroes();
        // 图片加载失败是按名字缓存的。换掉 URL 或改了名字之后不清 key，
        // 头像会一直停在空白上，哪怕新图其实是好的。这里清掉本次保存的名字，
        // 再把已不存在的英雄残留的缓存一并丢弃（改名时旧名正好在这里被清掉）。
        delete imgFailed[payload.name];
        const alive = new Set(heroes.value.map((h) => h.name));
        for (const k of Object.keys(imgFailed)) if (!alive.has(k)) delete imgFailed[k];
        if (id) {
          const still = heroes.value.find((h) => h.id === id);
          selectedHero.value = still || null;
        }
        say('人物已保存♥');
      } catch (err) {
        fail(err);
      }
    }
    async function removeHero(h) {
      if (!confirm(`删除人物「${h.name}」？\n（只删人物本身，关联的词卡和名言不受影响）`)) return;
      try {
        const r = await call(window.api.deleteHero(h.id));
        cancelHeroForm();
        selectedHero.value = null;
        await loadHeroes();
        say(`已删除人物「${r.undo.label}」`, r.undo);
      } catch (err) {
        fail(err);
      }
    }
    async function pickImage() {
      if (picking.value) return;
      picking.value = true;
      try {
        const r = await call(window.api.pickImage());
        if (r.canceled) return;
        heroForm.img = r.ref;
        const got = await window.api.mediaData(r.ref);
        if (got.ok) mediaMap[r.ref] = got.data;
        say('图片已选好，保存后生效♥');
      } catch (err) {
        fail(err);
      } finally {
        picking.value = false;
      }
    }
    const heroImgPreview = computed(() => {
      const img = heroForm.img;
      if (!img) return '';
      return img.startsWith('media:') ? mediaMap[img] || '' : img;
    });

    // ---- 历史 ----
    const history = ref([]);
    const histSearch = ref('');
    const filteredHistory = computed(() => matchRows(history.value, histSearch.value, ['src', 'dst']));
    async function loadHistory() {
      try {
        history.value = await call(window.api.listHistory());
      } catch (err) {
        fail(err);
      }
    }
    async function clearHistory() {
      if (!confirm('清空全部翻译历史？')) return;
      try {
        const r = await call(window.api.clearHistory());
        await loadHistory();
        say('已清空翻译历史', r.undo);
      } catch (err) {
        fail(err);
      }
    }
    // 历史不该只是看过就算，点一条就回填重翻
    function reuseHistory(h) {
      input.value = h.src;
      switchView('translate');
      doTranslate();
    }
    async function setHistoryLimit(n) {
      try {
        await call(window.api.setPref('history.limit', JSON.stringify(Number(n))));
        historyLimit.value = Number(n);
        await loadHistory();
        say('历史保留条数已改为 ' + n + ' 条♥');
      } catch (err) {
        fail(err);
      }
    }
    function fmtTime(iso) {
      const d = new Date(iso);
      const p = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
    }
    function fmtSize(bytes) {
      if (!bytes) return '0 KB';
      return (bytes / 1024).toFixed(0) + ' KB';
    }

    // ---- 备份与恢复 ----
    async function loadBackups() {
      try {
        backups.value = await call(window.api.listBackups());
      } catch (err) {
        fail(err);
      }
    }
    async function restoreBackup(b) {
      if (!confirm(`用「${b.name}」（${fmtTime(b.mtime)}）覆盖当前数据库？\n当前状态会先存成 linyu.db.before-restore，可以退回来。`)) return;
      backupBusy.value = true;
      try {
        await call(window.api.restoreBackup(b.name));
        await Promise.all([reloadAll(), loadHistory()]);
        await loadBackups();
        say('已从备份恢复，当前库是那一刻的状态♥');
      } catch (err) {
        fail(err);
      } finally {
        backupBusy.value = false;
      }
    }
    async function restoreBefore() {
      backupBusy.value = true;
      try {
        await call(window.api.restoreBefore());
        await Promise.all([reloadAll(), loadHistory()]);
        say('已退回恢复前的状态♥');
      } catch (err) {
        fail(err);
      } finally {
        backupBusy.value = false;
      }
    }

    // ---- 导入导出 ----
    async function exportData() {
      if (io.busy) return;
      io.busy = true;
      try {
        const r = await call(window.api.exportData({ includeMedia: io.includeMedia }));
        if (r.canceled) return;
        io.result = `已导出 ${r.file}（词库 ${r.counts.words} / 句式 ${r.counts.rules} / 词卡 ${r.counts.cards} / 名言 ${r.counts.quotes} / 人物 ${r.counts.heroes}${r.media ? '，图片 ' + r.media + ' 张' : ''}）`;
        say('数据已导出♥');
      } catch (err) {
        fail(err);
      } finally {
        io.busy = false;
      }
    }
    async function pickImport() {
      if (io.busy) return;
      io.busy = true;
      io.plan = null;
      io.result = null;
      try {
        const r = await call(window.api.pickImport());
        if (r.canceled) return;
        io.plan = r;
      } catch (err) {
        fail(err);
      } finally {
        io.busy = false;
      }
    }
    async function applyImport() {
      if (!io.plan) return;
      io.busy = true;
      try {
        const r = await call(window.api.applyImport({ strategy: io.strategy }));
        await reloadAll();
        io.plan = null;
        io.result = `导入完成：新增 ${r.add} 条 / 更新 ${r.update} 条 / 跳过 ${r.skip} 条`;
        say('数据已导入♥');
      } catch (err) {
        fail(err);
      } finally {
        io.busy = false;
      }
    }
    // 换合并策略要按新策略重算一遍增/更/跳，否则预览数字和确认结果不一致
    async function replanImport() {
      if (!io.plan) return;
      io.busy = true;
      try {
        io.plan = await call(window.api.replanImport({ strategy: io.strategy }));
      } catch (err) {
        fail(err);
      } finally {
        io.busy = false;
      }
    }
    async function cancelImport() {
      io.plan = null;
      try {
        await call(window.api.cancelImport());
      } catch {
        /* 取消预览失败不用打扰用户 */
      }
    }

    // ---- 内容体检 ----
    async function runInspect() {
      if (check.busy) return;
      check.busy = true;
      try {
        check.data = await call(window.api.inspect());
        check.open = true;
      } catch (err) {
        fail(err);
      } finally {
        check.busy = false;
      }
    }
    const checkIssues = computed(() => {
      const d = check.data;
      if (!d) return [];
      const out = [];
      if (d.totals.invalidWords) out.push({ key: 'invalid', label: `中文和淋语完全相同的无效词条 ${d.totals.invalidWords} 条`, fix: '删掉它们' });
      if (d.totals.dupLinyu) out.push({ key: 'dup', label: `${d.dupLinyu.length} 组词条共用同一个淋语翻译`, fix: '' });
      if (d.totals.orphanCards) out.push({ key: 'oc', label: `${d.totals.orphanCards} 张词卡的归属人物已不存在`, fix: '' });
      if (d.totals.orphanQuotes) out.push({ key: 'oq', label: `${d.totals.orphanQuotes} 条名言的归属人物已不存在`, fix: '' });
      if (d.totals.orphanHeroWords) out.push({ key: 'oh', label: `${d.totals.orphanHeroWords} 个人物还挂着已被删除的词库词条`, fix: '清理这些引用' });
      if (!out.length) out.push({ key: 'clean', label: '五板块内容干净，没有发现悬空引用或无效词条', fix: '' });
      return out;
    });
    async function cleanHeroWords() {
      if (!check.data || !check.data.orphanHeroWords.length) return;
      try {
        const r = await call(window.api.cleanHeroWords(check.data.orphanHeroWords));
        await loadHeroes();
        say(`已清理 ${r.fixed} 个人物的悬空词条引用♥`);
        check.data = await call(window.api.inspect());
      } catch (err) {
        fail(err);
      }
    }
    async function deleteInvalidWords() {
      if (!check.data || !check.data.invalidWords.length) return;
      if (!confirm(`删除 ${check.data.invalidWords.length} 条「中文 = 淋语」的无效词条？\n（这类词条对翻译没有任何作用）`)) return;
      try {
        for (const w of check.data.invalidWords) await call(window.api.deleteWord(w.id));
        await loadWords();
        check.data = await call(window.api.inspect());
        say('无效词条已删除♥');
      } catch (err) {
        fail(err);
      }
    }

    async function openLogs() {
      try {
        await call(window.api.openLogs());
        say('已打开日志目录♥');
      } catch (err) {
        fail(err);
      }
    }

    // ---- 搜索框聚焦（Ctrl+F） ----
    const searchRefs = {};
    function setSearchRef(key, el) {
      if (el) searchRefs[key] = el;
    }
    function focusSearch() {
      const el = searchRefs[view.value];
      if (!el) return;
      el.focus();
      el.select();
    }

    function switchView(key) {
      view.value = key;
      if (key !== 'heroes') {
        selectedHero.value = null;
        heroEditing.value = false;
      }
      window.api.setPref('last.view', JSON.stringify(key)).catch(() => {});
      if (key === 'words') loadWords();
      if (key === 'rules') loadRules();
      if (key === 'history') loadHistory();
      if (key === 'cards') loadCards();
      if (key === 'heroes') loadHeroes();
      if (key === 'quotes') loadQuotes();
    }

    onMounted(async () => {
      let prefs = {};
      try {
        prefs = await call(window.api.getPrefs());
      } catch {
        /* 偏好读不到就用默认值，不影响使用 */
      }
      applyTheme(parsePref(prefs['ui.theme'], 'white'));
      historyLimit.value = Number(parsePref(prefs['history.limit'], 200)) || 200;
      if (!parsePref(prefs['ui.live'], true)) liveOn.value = false;

      loadWords();
      // 词卡/名言的「归属人物」输入框要靠 datalist 提示人名
      loadHeroes();
      refreshAuth();
      try {
        const m = await call(window.api.meta());
        defaultPassword.value = m.defaultPassword || '';
        appVersion.value = m.version || '';
        historyLimit.value = m.historyLimit || historyLimit.value;
      } catch {
        /* 默认凭据只是提示，取不到不影响使用 */
      }

      document.addEventListener('keydown', (e) => {
        const mod = e.ctrlKey || e.metaKey;
        if (mod && e.key === 'Enter') {
          if (view.value === 'translate') {
            e.preventDefault();
            doTranslate();
          }
        } else if (mod && (e.key === 'f' || e.key === 'F')) {
          if (view.value !== 'translate') {
            e.preventDefault();
            focusSearch();
          }
        } else if (mod && e.key === ',') {
          e.preventDefault();
          openSettings();
        } else if (e.key === 'Escape') {
          if (showSettings.value) showSettings.value = false;
          else if (view.value === 'heroes' && selectedHero.value) backToHeroes();
          else if (view.value === 'heroes' && heroEditing.value) cancelHeroForm();
        }
      });

      const last = parsePref(prefs['last.view'], 'translate');
      if (last && last !== 'translate' && tabs.some((t) => t.key === last)) switchView(last);
    });

    function parsePref(raw, fallback) {
      if (raw == null || raw === '') return fallback;
      try {
        return JSON.parse(raw);
      } catch {
        return raw;
      }
    }

    return {
      tabs, view, switchView,
      input, output, loading, previewing, isPreview, liveOn, toggleLive, trace, uncovered, addWordFor,
      samples, doTranslate, copyOutput,
      words, wordSearch, wordForm, editingWordId, wordCount, popLevels, filteredWords, pagedWords,
      wordsPage, wordsPages, wordsTotal, goWordsPage, setSearchRef,
      saveWord, resetWordForm, editWord, removeWord,
      rules, ruleSearch, ruleForm, editingRuleId, rulePatternOk, pagedRules,
      rulesPage, rulesPages, rulesTotal, goRulesPage,
      saveRule, resetRuleForm, editRule, removeRule,
      history, histSearch, filteredHistory, setHistoryLimit, historyLimit, reuseHistory, clearHistory, fmtTime, fmtSize,
      cards, cardFilter, cardSearch, cardTypes, cardTypeOpts, filteredCards, pagedCards,
      cardsPage, cardsPages, cardsTotal, goCardsPage,
      flipped, flipCard, typeLabel, cardForm, editingCardId, saveCard, resetCardForm, editCard, removeCard,
      quotes, quoteSearch, pagedQuotes, quotesPage, quotesPages, quotesTotal, goQuotesPage,
      quoteForm, editingQuoteId, saveQuote, resetQuoteForm, editQuote, removeQuote, heroNameOpts,
      heroes, heroSearch, imgFailed, markImgFail, selectedHero, openHero, backToHeroes, heroSrc,
      heroCards, heroQuotes, heroWords, heroRules, heroSearchUrl, openLink,
      heroGroups, heroGroup, switchHeroGroup, filteredHeroes, heroCount,
      heroZone, heroZones, heroZoneCount, switchHeroZone,
      heroForm, heroEditing, startAddHero, editHero, saveHero, removeHero, cancelHeroForm, resetHeroForm,
      pickImage, picking, heroImgPreview,
      dev, isDev, defaultPassword, loginForm, pwForm, devBusy,
      refreshAuth, login, logout, submitPassword, syncing, runSync,
      io, exportData, pickImport, applyImport, cancelImport, replanImport,
      backups, backupBusy, loadBackups, restoreBackup, restoreBefore,
      check, checkIssues, runInspect, cleanHeroWords, deleteInvalidWords, openLogs,
      toast, say, doUndo, appVersion,
      theme, themeList, setTheme, showSettings, openSettings,
    };
  },
}).mount('#app');
