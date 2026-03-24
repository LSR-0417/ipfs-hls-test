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
      mobileMenu: {
        label: 'Quick actions',
        title: 'Open quick actions',
        ariaLabel: 'Open quick actions',
      },
      gateway: {
        label: 'Gateway',
        ariaLabel: 'Switch gateway. Current gateway: {gateway}',
      },
      infoJson: {
        label: 'Metadata',
        title: 'Info JSON',
        ariaLabel: 'Open the info.json builder',
      },
    },
  },
  infoJson: {
    title: 'Generate info.json',
    subtitle: 'Fill in the video metadata, preview the JSON live, and export a sidecar file that matches the player contract.',
    form: {
      title: 'Video Metadata',
      caption: 'If a video is already loaded, the form opens prefilled with its metadata. You can also clear it and start from scratch.',
    },
    preview: {
      title: 'JSON Preview',
      caption: 'This content will be saved as the sidecar info.json file.',
      summary: '{count} fields will be exported',
      omitEmpty: 'Empty fields are omitted from the JSON output',
    },
    status: {
      copied: 'JSON copied',
      downloaded: 'info.json downloaded',
    },
    actions: {
      clear: 'Clear Form',
      close: 'Close',
      copy: 'Copy JSON',
      download: 'Download info.json',
    },
    fields: {
      title: {
        label: 'Title',
        placeholder: 'Example: IPFS Demo Stream',
      },
      uploader: {
        label: 'Uploader',
        placeholder: 'Example: AstraStream',
      },
      id: {
        label: 'Video ID',
        placeholder: 'Example: UdGk5Qv0C1M',
      },
      channelId: {
        label: 'Channel ID',
        placeholder: 'Example: UCxxxxxxxxxxxx',
      },
      uploadDate: {
        label: 'Upload Date',
        placeholder: 'YYYYMMDD or YYYY-MM-DD',
      },
      durationString: {
        label: 'Duration',
        placeholder: 'Example: 10:16',
      },
      resolution: {
        label: 'Resolution',
        placeholder: 'Example: 1920x1080',
      },
      fps: {
        label: 'FPS',
        placeholder: 'Example: 30',
      },
      description: {
        label: 'Description',
        placeholder: 'Enter a multiline description for the video.',
      },
      tags: {
        label: 'Tags',
        placeholder: 'IPFS, Web3, Decentralized',
        hint: 'Separate entries with commas or line breaks.',
      },
      categories: {
        label: 'Categories',
        placeholder: 'Technology, Education',
        hint: 'Separate entries with commas or line breaks.',
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
