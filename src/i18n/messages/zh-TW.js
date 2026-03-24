export default Object.freeze({
  app: {
    name: 'AstraStream',
  },
  common: {
    language: '語言',
    unavailable: '不可用',
    actions: {
      apply: '套用',
      cancel: '取消',
    },
    status: {
      ready: '準備就緒',
      loaded: '已載入 {count} 個項目',
    },
  },
  header: {
    search: {
      placeholder: {
        compact: '搜尋 CID',
        full: '搜尋 IPFS CID（例如 Qm...）',
      },
      actions: {
        clear: {
          ariaLabel: '清除搜尋',
          title: '清除搜尋文字',
        },
        submit: {
          ariaLabel: '搜尋',
          title: '搜尋 CID',
        },
      },
    },
    actions: {
      mobileMenu: {
        label: '更多操作',
        title: '開啟更多操作',
        ariaLabel: '開啟更多操作',
      },
      gateway: {
        label: '網關',
        ariaLabel: '切換網關，目前為 {gateway}',
      },
      account: {
        label: '帳號',
        title: '登入',
        ariaLabel: '登入你的帳號',
      },
    },
  },
  sidebar: {
    menu: {
      home: '首頁',
      explore: '探索',
      library: '媒體庫',
      history: '觀看紀錄',
    },
    build: {
      version: '版本',
      worktree: '工作樹',
      branch: '分支',
    },
  },
  recommendations: {
    title: '接下來推薦',
  },
});
