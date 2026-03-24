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
      infoJson: {
        label: '影片資訊',
        title: 'Info JSON',
        ariaLabel: '開啟 info.json 產生器',
      },
    },
  },
  infoJson: {
    title: '產生 info.json',
    subtitle: '填寫影片資訊後即時預覽 JSON，下載的內容會符合目前播放器讀取的 sidecar metadata 格式。',
    form: {
      title: '影片資訊',
      caption: '若目前已有載入影片，表單會先帶入它的 metadata。你也可以清空後自行填寫。',
    },
    preview: {
      title: 'JSON 預覽',
      caption: '這份內容會直接作為 sidecar 目錄中的 info.json。',
      summary: '將輸出 {count} 個欄位',
      omitEmpty: '空欄位不會寫入 JSON',
    },
    status: {
      copied: '已複製 JSON',
      downloaded: '已下載 info.json',
    },
    actions: {
      clear: '清空表單',
      close: '關閉',
      copy: '複製 JSON',
      download: '下載 info.json',
    },
    fields: {
      title: {
        label: '標題',
        placeholder: '例如：IPFS Demo Stream',
      },
      uploader: {
        label: '上傳者',
        placeholder: '例如：AstraStream',
      },
      id: {
        label: '影片 ID',
        placeholder: '例如：UdGk5Qv0C1M',
      },
      channelId: {
        label: '頻道 ID',
        placeholder: '例如：UCxxxxxxxxxxxx',
      },
      uploadDate: {
        label: '上傳日期',
        placeholder: 'YYYYMMDD 或 YYYY-MM-DD',
      },
      durationString: {
        label: '時長',
        placeholder: '例如：10:16',
      },
      resolution: {
        label: '解析度',
        placeholder: '例如：1920x1080',
      },
      fps: {
        label: 'FPS',
        placeholder: '例如：30',
      },
      description: {
        label: '描述',
        placeholder: '輸入影片描述，支援多行文字。',
      },
      tags: {
        label: '標籤',
        placeholder: 'IPFS, Web3, Decentralized',
        hint: '可用逗號或換行分隔。',
      },
      categories: {
        label: '分類',
        placeholder: 'Technology, Education',
        hint: '可用逗號或換行分隔。',
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
