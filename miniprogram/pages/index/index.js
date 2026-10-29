'use strict';

const content = require('../../services/content');
const historyStore = require('../../services/history');
const { toast, copy, chromeMetrics } = require('../../utils/ui');
const { clip, utf8Bytes } = require('../../utils/format');
const secCheck = require('../../services/sec');
const { syncChrome } = require('../../utils/pageBase');

const MAX_LEN = 500;
// 分享 path/query 有约 1024 字符硬上限，encodeURIComponent 后 1 个汉字 ≈ 9 字符，
// 原文按 UTF-8 字节约束在 300 字节内（约 60 汉字），超出则不带原文（A2）
const SHARE_TEXT_MAX_BYTES = 300;
const SHARE_TITLE = '淋语翻译器 · 把中文翻译成淋语♥';
const SAMPLES = ['你今天真好看！', '我不知道呢，感觉很开心', '太可爱了吧哈哈哈哈', '谢谢宝贝的抱抱'];

Page({
  data: {
    theme: 'white',
    counts: content.counts,
    input: '',
    inputLength: 0,
    inputTrimmed: false,
    output: '',
    outputLength: 0,
    maxLen: MAX_LEN,
    liveOn: true,
    polishOn: false,
    disamOn: false,
    polishedFlag: false,
    previewing: false,
    isPreview: false,
    historyNote: '已写入本机历史',
    samples: SAMPLES,
    hint: '翻译结果会出现在这里，保证淋味十足♥',
    statusBar: 20,
    navBarH: 64,
    navTop: 82,
  },

  onLoad(options) {
    const app = getApp();
    this._secSeq = 0;
    // 一次 setData 合并主题、实时翻译开关与自绘导航尺寸，减少首屏渲染次数（B10）
    this.setData(
      Object.assign(
        { theme: app.globalData.theme, liveOn: app.globalData.live, polishOn: app.globalData.polish, disamOn: app.globalData.disambiguate },
        chromeMetrics()
      )
    );

    const raw = options && options.text ? String(options.text) : '';
    if (String((options && options.overflow) || '') === '1') {
      toast('原文过长未带出，可自行输入');
    }
    if (!raw.trim()) return;
    let shared = raw;
    if (/%[0-9A-Fa-f]{2}/.test(shared)) {
      try {
        shared = decodeURIComponent(shared);
      } catch (err) {
        // 保持原样
      }
    }
    const sliced = shared.slice(0, MAX_LEN);
    this.setData(
      {
        input: sliced,
        inputLength: sliced.length,
        inputTrimmed: Boolean(sliced.trim()),
      },
      () => this.runPreview()
    );
  },

  onShow() {
    const app = getApp();
    syncChrome(this, 0);
    this.setData({ liveOn: app.globalData.live, polishOn: app.globalData.polish, disamOn: app.globalData.disambiguate });

    const pending = app.globalData.pendingInput;
    if (pending) {
      app.globalData.pendingInput = '';
      this.applyInput(pending, true);
    }
  },

  onHide() {
    clearTimeout(this._previewTimer);
    historyStore.flush();
  },

  onUnload() {
    clearTimeout(this._previewTimer);
    historyStore.flush();
  },

  onInput(e) {
    const value = e.detail.value;
    this.setData({
      input: value,
      inputLength: value.length,
      inputTrimmed: Boolean(value.trim()),
    });

    clearTimeout(this._previewTimer);
    if (!this.data.liveOn) {
      this.setData({ output: '', outputLength: 0, previewing: false, isPreview: false });
      return;
    }
    if (!value.trim()) {
      this.setData({ output: '', outputLength: 0, previewing: false, isPreview: false });
      return;
    }

    this.setData({ previewing: true });
    this._previewTimer = setTimeout(() => this.runPreview(), 300);
  },

  runPreview() {
    const input = this.data.input;
    if (!input.trim()) {
      this.setData({ output: '', outputLength: 0, previewing: false, isPreview: false });
      return;
    }
    const output = this.safeTranslate(input);
    this.setData({
      output,
      outputLength: output.length,
      previewing: false,
      isPreview: true,
    });
  },

  // 翻译主链路兜底：数据异常导致抛错时原样返回，保证预览/翻译流程不中断（A5）
  safeTranslate(input) {
    try {
      return content.translate(input, this.data.disamOn);
    } catch (err) {
      const app = getApp();
      if (app && app.reportError) app.reportError('translate_error', err);
      try {
        if (wx.reportEvent) wx.reportEvent('linyu_translate_error', { msg: String(err).slice(0, 100) });
      } catch (e) {
        // ignore
      }
      return input;
    }
  },

  applyInput(value, translateNow) {
    const input = String(value || '').slice(0, MAX_LEN);
    clearTimeout(this._previewTimer);
    this.setData(
      {
        input,
        inputLength: input.length,
        inputTrimmed: Boolean(input.trim()),
        previewing: false,
      },
      () => {
        if (translateNow) {
          this.doTranslate();
        } else if (this.data.liveOn) {
          this.runPreview();
        } else {
          this.setData({ output: '', outputLength: 0, isPreview: false });
        }
      }
    );
  },

  useSample(e) {
    this.applyInput(e.currentTarget.dataset.text, false);
  },

  pasteInput() {
    wx.getClipboardData({
      success: (res) => {
        const raw = String(res.data || '');
        if (!raw.trim()) {
          toast('剪贴板里没有文字');
          return;
        }
        this.applyInput(raw, false);
        if (raw.length > MAX_LEN) toast(`已截取前 ${MAX_LEN} 字`);
      },
      fail: (err) => {
        console.error('[linyu] getClipboardData 失败', err);
        toast('读取剪贴板失败');
      },
    });
  },

  clearInput() {
    clearTimeout(this._previewTimer);
    this._lastOutput = '';
    this.setData({
      input: '',
      inputLength: 0,
      inputTrimmed: false,
      output: '',
      outputLength: 0,
      previewing: false,
      isPreview: false,
    });
  },

  toggleLive() {
    this.setLive(!this.data.liveOn);
  },

  setLive(on) {
    const next = Boolean(on);
    getApp().setLive(next);
    this.setData({ liveOn: next });
    if (!next) {
      clearTimeout(this._previewTimer);
      this.setData({ previewing: false });
      return;
    }
    if (this.data.input.trim()) this.runPreview();
  },

  toggleDisam() {
    this.setDisam(!this.data.disamOn);
  },

  setDisam(on) {
    const next = Boolean(on);
    getApp().setDisambiguate(next);
    this.setData({ disamOn: next });
    if (next && this.data.input.trim()) this.runPreview();
  },

  togglePolish() {
    this.setPolish(!this.data.polishOn);
  },

  setPolish(on) {
    const next = Boolean(on);
    getApp().setPolish(next);
    // 作废正在进行中的润色请求，避免旧结果覆盖新状态
    this._polishSeq = (this._polishSeq || 0) + 1;
    this.setData({ polishOn: next, polishedFlag: false });
    if (next && !getApp().globalData.cloudReady) {
      toast('云开发未初始化，润色暂不可用');
    }
  },

  // 本地翻译是同步毫秒级，直接完成，不需要 setTimeout 与假 loading（C4）
  doTranslate() {
    const input = this.data.input;
    if (!input.trim()) {
      toast('先输入要翻译的中文哦');
      return;
    }

    clearTimeout(this._previewTimer);
    const output = this.safeTranslate(input);
    const wantPolish = this.data.polishOn;
    this.setData({
      output,
      outputLength: output.length,
      previewing: false,
      isPreview: false,
      polishedFlag: false,
      historyNote: wantPolish ? '润色中…' : '校验中…',
    });

    if (!wantPolish) {
      this.vibrateOnce(output);
      this.secCheckAndRemember(input, output);
      return;
    }

    // 云端润色：本地草稿先展示，润色结果回来再替换；用 seq 丢弃过期结果
    const seq = (this._polishSeq = (this._polishSeq || 0) + 1);
    content.polishViaCloud(input, output).then((polished) => {
      if (seq !== this._polishSeq) return;
      const finalText = polished && polished !== output ? polished : output;
      this.setData({
        output: finalText,
        outputLength: finalText.length,
        polishedFlag: finalText !== output,
      });
      this.vibrateOnce(finalText);
      this.secCheckAndRemember(input, finalText);
    });
  },

  // 只有输出真正变化时才震动，避免重复点击重复震动（C5）
  vibrateOnce(output) {
    if (output && output !== this._lastOutput) {
      this._lastOutput = output;
      try {
        wx.vibrateShort({ type: 'light' });
      } catch (err) {
        // 部分机型不支持震动，忽略即可
      }
    }
  },

  // UGC 兜底：msgSecCheck 通过才写入历史；接口失败时 fail-open 不阻塞主流程（A3）
  secCheckAndRemember(input, output) {
    const seq = (this._secSeq || 0) + 1;
    this._secSeq = seq;
    const finish = (note) => {
      if (seq !== this._secSeq) return;
      this.setData({ historyNote: note });
    };
    this._checked = { content: output, ok: null };
    secCheck
      .checkText(output)
      .then((ok) => {
        if (seq !== this._secSeq) return;
        this._checked = { content: output, ok };
        if (ok) {
          historyStore.addHistory(input, output);
          finish('已写入本机历史');
        } else {
          finish('未通过校验，未写入历史');
          toast('该内容未通过内容安全校验，本次不写入历史');
        }
      })
      .catch((err) => {
        if (seq !== this._secSeq) return;
        const app = getApp();
        if (app && app.reportError) app.reportError('sec_check_error', err);
        historyStore.addHistory(input, output);
        finish('已写入本机历史');
      });
  },

  copyOutput() {
    copy(this.data.output, '已复制♥');
  },

  // 分享参数后缀：原文 ≤300 字节才带 text，超长只带 overflow 标记，落地页提示（A2）
  shareQuerySuffix() {
    const input = this.data.input.trim();
    if (!input) return '';
    if (utf8Bytes(input) > SHARE_TEXT_MAX_BYTES) return 'overflow=1';
    return 'text=' + encodeURIComponent(input);
  },

  // 分享前先过内容安全校验：不通过则降级为固定标题、不带原文参数（A3）
  resolveShare() {
    const input = this.data.input.trim();
    const output = this.data.output.trim();
    const target = output || input;
    if (!target) return Promise.resolve({ title: SHARE_TITLE, suffix: '' });
    const cached = this._checked && this._checked.content === target ? this._checked.ok : null;
    const verify = cached === null ? secCheck.checkText(target) : Promise.resolve(cached);
    return verify
      .then((ok) => {
        this._checked = { content: target, ok };
        if (!ok) return { title: SHARE_TITLE, suffix: '' };
        return {
          title: output ? '淋语版：' + clip(output, 24) : SHARE_TITLE,
          suffix: this.shareQuerySuffix(),
        };
      })
      .catch(() => ({ title: SHARE_TITLE, suffix: '' }));
  },

  onShareAppMessage() {
    return this.resolveShare().then((r) => ({
      title: r.title,
      path: '/pages/index/index' + (r.suffix ? '?' + r.suffix : ''),
    }));
  },

  // onShareTimeline 不支持返回 Promise，只能用缓存过的校验结果：
  // 未通过 / 尚未校验时降级为固定标题且不带原文（A3 兜底）
  onShareTimeline() {
    const input = this.data.input.trim();
    const output = this.data.output.trim();
    const target = output || input;
    const cached = this._checked && this._checked.content === target ? this._checked.ok : null;
    if (cached !== true) {
      return { title: SHARE_TITLE, query: '' };
    }
    return {
      title: output ? '淋语版：' + clip(output, 24) : SHARE_TITLE,
      query: this.shareQuerySuffix(),
    };
  },
});
