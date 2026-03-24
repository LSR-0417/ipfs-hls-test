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
        title: 'Sidecar Draft',
        ariaLabel: 'ローカル sidecar 下書きツールを開く',
      },
    },
  },
  infoJson: {
    title: 'ローカル sidecar 下書きを整理',
    subtitle: '動画 metadata、字幕 metadata、動画処理設定を 3 つのタブに分けて整理します。各タブは独立しているので、sidecar と backend 送信草稿を段階的に準備できます。',
    panels: {
      metadata: {
        title: '動画メタデータ',
        caption: '動画 metadata を整理し、準備ができたら info.json をダウンロードします。',
      },
      subtitles: {
        title: '字幕メタデータ',
        caption: 'ローカル字幕を取り込み、manifest を確認してから subtitles.json をダウンロードします。',
      },
      video: {
        title: '動画処理',
        caption: '元動画、出力解像度、sidecar JSON の同送有無をまとめて決めます。',
      },
    },
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
      title: '動画メタデータ',
      caption: '動画が読み込まれている場合は、その metadata を初期値として使用します。必要ならフォームを空にして最初から入力できます。',
    },
    assets: {
      title: 'ローカル素材',
      caption: 'avatar、字幕、元動画をまずブラウザ内で整理します。まだ backend にはアップロードしません。',
      localOnly: '現在のブラウザ session のみ',
      none: 'まだローカル素材は選択されていません',
      upload: 'ファイルを選択',
      replace: '差し替え',
      remove: '削除',
      avatar: {
        title: 'アバター',
        caption: '画像ファイルを選択して、ローカル avatar プレビューとして保持します。',
        previewAlt: 'ローカル avatar プレビュー',
      },
      subtitles: {
        title: '字幕',
        caption: '複数の .vtt / .srt を取り込み、同時に subtitles.json の下書きを生成します。',
        empty: 'まだ字幕は取り込まれていません',
        count: '字幕 {count} 本',
        download: 'subtitles.json をダウンロード',
      },
      video: {
        title: '元動画',
        caption: 'backend の動画処理器にあとで接続できるよう、先にローカル動画を選択します。',
        empty: 'まだ動画は選択されていません',
        draftTitle: '処理器ドラフト',
        draftCaption: '今はローカル草稿だけを作成し、実際の upload はまだ行いません。',
        pending: '処理器待ち',
        ready: 'ローカル草稿準備完了',
      },
    },
    manifests: {
      infoTitle: 'info.json プレビュー',
      infoCaption: 'この内容が sidecar の info.json として保存されます。',
      infoEmpty: 'metadata を入力すると、ここに info.json が生成されます。',
      subtitlesTitle: 'subtitles.json プレビュー',
      subtitlesCaption: '現在取り込んでいるローカル字幕から生成されます。',
      subtitlesEmpty: '字幕を取り込むと、ここに subtitles.json が生成されます。',
    },
    preview: {
      summary: '{count} 個のフィールドを出力します',
      omitEmpty: '空欄のフィールドは JSON に含めません',
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
      ready: '現在 {info} 件の metadata、{subtitles} 本の字幕、{assets} 件のローカル素材を整理しています',
      infoCopied: 'info.json をコピーしました',
      infoDownloaded: 'info.json をダウンロードしました',
      subtitleManifestDownloaded: 'subtitles.json をダウンロードしました',
      avatarSelected: 'アバターを選択しました: {name}',
      avatarRejected: 'アバターには画像ファイルを選択してください',
      avatarCleared: 'アバターを削除しました',
      subtitlesImported: '{count} 本のローカル字幕を取り込みました',
      subtitlesPartial: '{count} 本の字幕を取り込みましたが、一部のファイルは失敗しました:',
      subtitlesFailed: '字幕の取り込みに失敗しました',
      subtitlesCleared: 'ローカル字幕をクリアしました',
      videoSelected: '動画を選択しました: {name}',
      videoRejected: '動画ファイルを選択してください',
      videoCleared: '動画ドラフトを削除しました',
      localAssetsCleared: 'ローカル素材をクリアしました',
    },
    actions: {
      clear: 'フォームをクリア',
      clearAssets: 'ローカル素材をクリア',
      clearSubtitles: '字幕をクリア',
      clearVideo: '動画をクリア',
      close: '閉じる',
      previous: '戻る',
      next: '次へ',
      copy: 'info.json をコピー',
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
      categories: {
        label: 'カテゴリ',
        placeholder: 'Technology, Education',
        hint: 'カンマまたは改行で区切ってください。',
      },
    },
    video: {
      pending: 'まだ動画は選択されていません',
      missingResolutions: '少なくとも 1 つの解像度を選んでください',
      ready: '送信草稿を作成できます',
      resolutionsTitle: '出力解像度',
      resolutionsCaption: 'backend の動画処理器に作ってほしい画質を選択します。',
      selectedResolutions: '{count} 件の解像度を選択中',
      noResolutionSelected: '少なくとも 1 つの解像度を選択してください',
      resolutionsHint: '実際に生成できる解像度は、元動画の高さに応じて backend が最終判断します。',
      attachmentsTitle: '動画と一緒に送るもの',
      attachmentsCaption: 'backend へ送るときに、sidecar JSON を同梱するかどうかを決めます。',
      includeInfo: 'info.json を添付',
      includeInfoHintReady: 'メタデータタブで生成した info.json を一緒に送ります。',
      includeInfoHintUnavailable: '先に metadata を入力してから info.json を添付してください。',
      includeSubtitles: 'subtitles.json を添付',
      includeSubtitlesHintReady: '字幕タブで生成した subtitles.json を一緒に送ります。',
      includeSubtitlesHintUnavailable: '先に字幕を取り込んでから subtitles.json を添付してください。',
      draftTitle: 'backend 送信草稿',
      draftCaption: '今は local request payload のプレビューだけを作成し、まだ実際には送信しません。',
      summaryAttachments: '{count} 件の sidecar を同梱します',
      summaryNoAttachments: 'sidecar は同梱しません',
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
});
