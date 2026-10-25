'use strict';

Component({
  properties: {
    icon: { type: String, value: '♥' },
    title: { type: String, value: '' },
    sub: { type: String, value: '' },
    showReset: { type: Boolean, value: false },
    resetText: { type: String, value: '清空搜索' },
    primaryText: { type: String, value: '' },
  },

  methods: {
    onReset() {
      this.triggerEvent('reset');
    },
    onPrimary() {
      this.triggerEvent('primary');
    },
  },
});
