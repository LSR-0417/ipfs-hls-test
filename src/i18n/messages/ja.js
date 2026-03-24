export default Object.freeze({
  app: {
    name: 'AstraStream',
  },
  common: {
    language: '言語',
    unavailable: '利用不可',
    actions: {
      apply: '適用',
      cancel: 'キャンセル',
    },
    status: {
      ready: '準備完了',
      loaded: '{count} 件を読み込みました',
    },
  },
  header: {
    search: {
      placeholder: {
        compact: 'CID を検索',
        full: 'IPFS CID を検索 (例: Qm...)',
      },
      actions: {
        clear: {
          ariaLabel: '検索をクリア',
          title: '検索文字をクリア',
        },
        submit: {
          ariaLabel: '検索',
          title: 'CID を検索',
        },
      },
    },
    actions: {
      mobileMenu: {
        label: 'その他の操作',
        title: 'その他の操作を開く',
        ariaLabel: 'その他の操作を開く',
      },
      gateway: {
        label: 'ゲートウェイ',
        ariaLabel: 'ゲートウェイを切り替え。現在: {gateway}',
      },
      infoJson: {
        label: 'メタデータ',
        title: 'Info JSON',
        ariaLabel: 'info.json ビルダーを開く',
      },
    },
  },
  infoJson: {
    title: 'info.json を生成',
    subtitle: '動画メタデータを入力すると JSON を即座にプレビューでき、プレイヤー契約に合う sidecar の info.json として書き出せます。',
    form: {
      title: '動画メタデータ',
      caption: '動画が読み込まれている場合は、その metadata を初期値として使用します。必要ならフォームを空にして最初から入力できます。',
    },
    preview: {
      title: 'JSON プレビュー',
      caption: 'この内容が sidecar の info.json として出力されます。',
      summary: '{count} 個のフィールドを出力します',
      omitEmpty: '空欄のフィールドは JSON に含めません',
    },
    status: {
      copied: 'JSON をコピーしました',
      downloaded: 'info.json をダウンロードしました',
    },
    actions: {
      clear: 'フォームをクリア',
      close: '閉じる',
      copy: 'JSON をコピー',
      download: 'info.json をダウンロード',
    },
    fields: {
      title: {
        label: 'タイトル',
        placeholder: '例: IPFS Demo Stream',
      },
      uploader: {
        label: '投稿者',
        placeholder: '例: AstraStream',
      },
      id: {
        label: '動画 ID',
        placeholder: '例: UdGk5Qv0C1M',
      },
      channelId: {
        label: 'チャンネル ID',
        placeholder: '例: UCxxxxxxxxxxxx',
      },
      uploadDate: {
        label: '投稿日',
        placeholder: 'YYYYMMDD または YYYY-MM-DD',
      },
      durationString: {
        label: '再生時間',
        placeholder: '例: 10:16',
      },
      resolution: {
        label: '解像度',
        placeholder: '例: 1920x1080',
      },
      fps: {
        label: 'FPS',
        placeholder: '例: 30',
      },
      description: {
        label: '説明',
        placeholder: '動画の説明を複数行で入力できます。',
      },
      tags: {
        label: 'タグ',
        placeholder: 'IPFS, Web3, Decentralized',
        hint: 'カンマまたは改行で区切ってください。',
      },
      categories: {
        label: 'カテゴリ',
        placeholder: 'Technology, Education',
        hint: 'カンマまたは改行で区切ってください。',
      },
    },
  },
  sidebar: {
    menu: {
      home: 'ホーム',
      explore: '探索',
      library: 'ライブラリ',
      history: '履歴',
    },
    build: {
      version: 'バージョン',
      worktree: 'ワークツリー',
      branch: 'ブランチ',
    },
  },
  recommendations: {
    title: '次のおすすめ',
  },
});
