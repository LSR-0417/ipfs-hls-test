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
        label: '下書き',
        title: '素材を整理',
        ariaLabel: '素材整理ツールを開く',
      },
    },
  },
  infoJson: {
    title: '動画素材を整理',
    subtitle: '動画情報の入力、字幕の取り込み、処理設定までを 1 か所で進められます。準備ができたら sidecar ファイルをダウンロードしたり、あとで動画と一緒に使えます。',
    tabs: {
      ariaLabel: 'sidecar 下書きタブ',
      metadata: {
        label: 'メタデータ',
      },
      subtitles: {
        label: '字幕',
      },
      video: {
        label: '動画処理',
      },
    },
    form: {
      caption: '動画が読み込まれている場合は、その metadata を初期値として使用します。必要ならフォームを空にして最初から入力できます。',
    },
    assets: {
      localOnly: '現在のブラウザ session のみ',
      upload: 'ファイルを選択',
      replace: '差し替え',
      remove: '削除',
      subtitles: {
        caption: '複数の .vtt / .srt をまとめて取り込み、整ったら subtitles.json をダウンロードできます。',
        empty: 'まだ字幕は取り込まれていません',
        count: '字幕 {count} 本',
        uploadAction: '字幕を追加',
        replaceAction: '字幕を差し替え',
        download: 'subtitles.json をダウンロード',
      },
      video: {
        title: '元動画',
        caption: '先に動画を選んでおくと、このあとの設定をまとめて確認できます。',
        empty: 'まだ動画は選択されていません',
      },
    },
    file: {
      name: 'ファイル名',
      type: '種類',
      size: 'サイズ',
      updatedAt: '更新日時',
      unknownName: '無題ファイル',
      unknownType: 'MIME type なし',
      unknownUpdatedAt: '不明',
    },
    status: {
      ready: '現在 {info} 件の動画情報、{subtitles} 本の字幕、{assets} 件のローカル素材を整理しています',
      infoDownloaded: 'info.json をダウンロードしました',
      subtitleManifestDownloaded: 'subtitles.json をダウンロードしました',
      subtitlesImported: '{count} 本のローカル字幕を取り込みました',
      subtitlesPartial: '{count} 本の字幕を取り込みましたが、一部のファイルは失敗しました:',
      subtitlesFailed: '字幕の取り込みに失敗しました',
      subtitlesCleared: 'ローカル字幕をクリアしました',
      videoSelected: '動画を選択しました: {name}',
      videoRejected: '動画ファイルを選択してください',
      videoCleared: '動画ドラフトを削除しました',
    },
    actions: {
      clear: 'フォームをクリア',
      clearSubtitles: '字幕をクリア',
      clearVideo: '動画をクリア',
      close: '閉じる',
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
    },
    video: {
      pending: 'まだ動画は選択されていません',
      missingResolutions: '少なくとも 1 つの解像度を選んでください',
      ready: '処理の準備ができました',
      resolutionsTitle: '出力解像度',
      resolutionsCaption: '残したい画質の組み合わせを選びます。',
      selectedResolutions: '{count} 件の解像度を選択中',
      noResolutionSelected: '少なくとも 1 つの解像度を選択してください',
      resolutionsHint: '実際に出力できる解像度は、元動画の画質に応じて調整されます。',
      attachmentsTitle: '一緒に使うファイル',
      attachmentsCaption: '動画と一緒に、準備済みの sidecar ファイルを含めるか選びます。',
      includeInfo: 'info.json を添付',
      includeInfoHintReady: '動画情報タブで整えた info.json を一緒に使います。',
      includeInfoHintUnavailable: '先に動画情報を入力してから info.json を添付してください。',
      includeSubtitles: 'subtitles.json を添付',
      includeSubtitlesHintReady: '字幕タブで生成した subtitles.json を一緒に送ります。',
      includeSubtitlesHintUnavailable: '先に字幕を取り込んでから subtitles.json を添付してください。',
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
          hint: '元の画質を保持',
        },
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
  seriesPlaylist: {
    title: 'エピソード一覧',
    loading: 'playlist.json とエピソード一覧を読み込んでいます...',
    empty: 'このプレイリストには再生できるエピソードがまだありません。',
    selected: '待機中',
    unavailable: '再生不可',
  },
});
