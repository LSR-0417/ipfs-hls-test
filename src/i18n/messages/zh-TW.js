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
        label: '素材草稿',
        title: '整理素材',
        ariaLabel: '開啟素材整理工具',
      },
    },
  },
  infoJson: {
    title: '整理影片素材',
    subtitle: '依序填寫影片資訊、匯入字幕，再設定影片處理選項。準備完成後，可以下載 sidecar 檔案，或在之後和影片一起使用。',
    panels: {
      metadata: {
        title: '影片資訊',
        caption: '填寫標題、描述與標籤等內容，整理好後就能下載 info.json。',
      },
      subtitles: {
        title: '字幕資訊',
        caption: '匯入字幕檔並整理語言清單，完成後可直接下載 subtitles.json。',
      },
      video: {
        title: '影片處理',
        caption: '選取影片、勾選想保留的畫質，並決定是否附上已整理好的 sidecar 檔案。',
      },
    },
    tabs: {
      ariaLabel: 'sidecar 草稿分頁',
      metadata: {
        label: '影片資訊',
      },
      subtitles: {
        label: '字幕資訊',
      },
      video: {
        label: '影片處理',
      },
    },
    form: {
      title: '影片資訊',
      caption: '若目前已有載入影片，表單會先帶入它的 metadata。你也可以清空後自行填寫。',
    },
    assets: {
      title: '本地素材',
      caption: '先在瀏覽器裡整理 sidecar 用到的 avatar、字幕與來源影片；尚未真正上傳到後端。',
      localOnly: '僅保留於目前瀏覽器 session',
      none: '尚未選取任何本地素材',
      upload: '選取檔案',
      replace: '更換檔案',
      remove: '移除',
      avatar: {
        title: '大頭貼',
        caption: '支援圖片檔，先作為本地 avatar 預覽。',
        previewAlt: '本地大頭貼預覽',
      },
      subtitles: {
        title: '字幕',
        caption: '可一次匯入多個 .vtt / .srt 檔，整理好後就能下載 subtitles.json。',
        listTitle: '已匯入字幕',
        empty: '尚未匯入字幕',
        count: '共 {count} 條字幕',
        uploadAction: '上傳字幕',
        replaceAction: '更換字幕',
        download: '下載 subtitles.json',
      },
      video: {
        title: '來源影片',
        caption: '先選取要處理的影片檔，後面就能沿用這份設定。',
        empty: '尚未選取影片',
        draftTitle: '處理設定摘要',
        draftCaption: '這裡會整理你目前選擇的影片與處理選項，方便檢查。',
        pending: '先選取影片',
        ready: '設定已準備完成',
      },
    },
    file: {
      name: '檔名',
      type: '類型',
      size: '大小',
      updatedAt: '修改時間',
      unknownName: '未命名檔案',
      unknownType: '未提供 MIME 類型',
      unknownUpdatedAt: '未知',
    },
    status: {
      ready: '目前已整理 {info} 項影片資訊、{subtitles} 條字幕與 {assets} 份本地素材',
      infoDownloaded: '已下載 info.json',
      subtitleManifestDownloaded: '已下載 subtitles.json',
      avatarSelected: '已選取大頭貼：{name}',
      avatarRejected: '請選擇圖片檔作為大頭貼',
      avatarCleared: '已移除大頭貼',
      subtitlesImported: '已匯入 {count} 條本地字幕',
      subtitlesPartial: '已匯入 {count} 條字幕，另有部分檔案失敗：',
      subtitlesFailed: '字幕匯入失敗',
      subtitlesCleared: '已清空本地字幕',
      videoSelected: '已選取影片：{name}',
      videoRejected: '請選擇影片檔',
      videoCleared: '已移除影片草稿',
      localAssetsCleared: '已清空本地素材',
    },
    actions: {
      clear: '清空表單',
      clearAssets: '清空本地素材',
      clearSubtitles: '清空字幕',
      clearVideo: '清空影片',
      close: '關閉',
      previous: '上一頁',
      next: '下一頁',
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
    },
    video: {
      pending: '尚未選取影片',
      missingResolutions: '尚未勾選解析度',
      ready: '設定可供處理',
      resolutionsTitle: '轉檔解析度',
      resolutionsCaption: '選擇希望保留的畫質組合。',
      selectedResolutions: '已選 {count} 個解析度',
      noResolutionSelected: '請至少勾選一個解析度',
      resolutionsHint: '可輸出的解析度仍會依原始影片的實際畫質調整。',
      attachmentsTitle: '一起附上的檔案',
      attachmentsCaption: '決定處理影片時，是否同時帶上已整理好的 sidecar 檔案。',
      includeInfo: '附上 info.json',
      includeInfoHintReady: '會把影片資訊分頁目前生成的 info.json 一起附上。',
      includeInfoHintUnavailable: '先填寫影片資訊後，才能附上 info.json。',
      includeSubtitles: '附上 subtitles.json',
      includeSubtitlesHintReady: '會把字幕資訊分頁目前生成的 subtitles.json 一起附上。',
      includeSubtitlesHintUnavailable: '先匯入字幕後，才能附上 subtitles.json。',
      draftTitle: '目前設定摘要',
      draftCaption: '這裡會整理你目前的影片、解析度與附加檔案設定。',
      draftBadge: '目前設定',
      summaryAttachments: '會附上 {count} 份 sidecar',
      summaryNoAttachments: '這次不附上 sidecar',
      resolutionOptions: {
        '4k': {
          label: '4K',
          hint: '2160p / UHD',
        },
        '2k': {
          label: '2K',
          hint: '1440p / QHD',
        },
        '1080p': {
          label: '1080p',
          hint: 'Full HD',
        },
        '720p': {
          label: '720p',
          hint: 'HD',
        },
        '480p': {
          label: '480p',
          hint: 'SD',
        },
        orig: {
          label: 'Orig',
          hint: '保留原始畫質',
        },
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
