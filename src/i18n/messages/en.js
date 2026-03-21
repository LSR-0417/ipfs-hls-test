export default Object.freeze({
  app: {
    name: 'AstraStream',
  },
  common: {
    language: 'Language',
    unavailable: 'unavailable',
    actions: {
      apply: 'Apply',
      cancel: 'Cancel',
    },
    status: {
      ready: 'Ready',
      loaded: 'Loaded {count} items',
    },
  },
  header: {
    search: {
      placeholder: {
        compact: 'Search CID',
        full: 'Search IPFS CID (e.g. Qm...)',
      },
      actions: {
        clear: {
          ariaLabel: 'Clear search',
          title: 'Clear search text',
        },
        submit: {
          ariaLabel: 'Search',
          title: 'Search CID',
        },
      },
    },
    actions: {
      gateway: {
        label: 'Gateway',
        ariaLabel: 'Switch gateway. Current gateway: {gateway}',
      },
      account: {
        label: 'Account',
        title: 'Sign In',
        ariaLabel: 'Sign in to your account',
      },
    },
  },
  sidebar: {
    menu: {
      home: 'Home',
      explore: 'Explore',
      library: 'Library',
      history: 'History',
    },
    build: {
      version: 'Version',
      worktree: 'Worktree',
      branch: 'Branch',
    },
  },
  recommendations: {
    title: 'Recommended Next',
  },
});
