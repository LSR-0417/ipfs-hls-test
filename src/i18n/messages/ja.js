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
      gateway: {
        label: 'ゲートウェイ',
        ariaLabel: 'ゲートウェイを切り替え。現在: {gateway}',
      },
      account: {
        label: 'アカウント',
        title: 'サインイン',
        ariaLabel: 'アカウントにサインイン',
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
