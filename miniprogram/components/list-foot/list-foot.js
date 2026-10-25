'use strict';

Component({
  properties: {
    hasMore: { type: Boolean, value: false },
    rest: { type: Number, value: 0 },
    matched: { type: Number, value: 0 },
  },

  methods: {
    onMore() {
      this.triggerEvent('more');
    },
  },
});
