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
        restoreDefaults: 'Restore defaults',
      },
      infoJson: {
        label: 'Drafts',
        title: 'Organize Media',
        ariaLabel: 'Open the media organizer',
      },
    },
  },
  infoJson: {
    title: 'Organize video assets',
    subtitle: 'Fill in the video details, import subtitles, and choose processing options in one place. When everything looks right, you can download the sidecar files or include them with the video later.',
    tabs: {
      ariaLabel: 'Sidecar draft sections',
      metadata: {
        label: 'Metadata',
      },
      subtitles: {
        label: 'Subtitles',
      },
      video: {
        label: 'Video Processing',
      },
    },
    form: {
      caption: 'If a video is already loaded, the form opens prefilled with its metadata. You can also clear it and start from scratch.',
    },
    assets: {
      localOnly: 'Local session only',
      upload: 'Choose file',
      replace: 'Replace file',
      remove: 'Remove',
      subtitles: {
        caption: 'Import multiple .vtt / .srt files at once, then download subtitles.json when the list looks right.',
        empty: 'No subtitles imported yet',
        count: '{count} subtitle tracks',
        uploadAction: 'Upload subtitles',
        replaceAction: 'Replace subtitles',
        download: 'Download subtitles.json',
      },
      video: {
        title: 'Source Video',
        caption: 'Select the video you want to work with so the rest of the settings can stay together.',
        empty: 'No video selected yet',
      },
    },
    file: {
      name: 'File Name',
      type: 'Type',
      size: 'Size',
      updatedAt: 'Modified',
      unknownName: 'Untitled file',
      unknownType: 'No MIME type provided',
      unknownUpdatedAt: 'Unknown',
    },
    status: {
      ready: '{info} video details, {subtitles} subtitle tracks, and {assets} local assets are currently prepared',
      infoDownloaded: 'info.json downloaded',
      subtitleManifestDownloaded: 'subtitles.json downloaded',
      subtitlesImported: '{count} local subtitle tracks imported',
      subtitlesPartial: '{count} subtitle tracks imported, and some files failed:',
      subtitlesFailed: 'Subtitle import failed',
      subtitlesCleared: 'Local subtitles cleared',
      videoSelected: 'Video selected: {name}',
      videoRejected: 'Please choose a video file',
      videoCleared: 'Video draft removed',
    },
    actions: {
      clear: 'Clear Form',
      clearSubtitles: 'Clear Subtitles',
      clearVideo: 'Clear Video',
      close: 'Close',
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
    },
    video: {
      pending: 'No video selected',
      missingResolutions: 'Pick at least one rendition',
      ready: 'Ready to process',
      resolutionsTitle: 'Target Renditions',
      resolutionsCaption: 'Choose the set of resolutions you want to keep.',
      selectedResolutions: '{count} renditions selected',
      noResolutionSelected: 'Select at least one rendition',
      resolutionsHint: 'The final set can still change based on the source video quality.',
      attachmentsTitle: 'Files to include',
      attachmentsCaption: 'Choose whether the sidecar files you prepared should travel with the video.',
      includeInfo: 'Attach info.json',
      includeInfoHintReady: 'The info.json you prepared in Video Metadata will be attached.',
      includeInfoHintUnavailable: 'Fill in the video details first before attaching info.json.',
      includeSubtitles: 'Attach subtitles.json',
      includeSubtitlesHintReady: 'The current subtitles.json draft from the subtitles tab will be attached.',
      includeSubtitlesHintUnavailable: 'Import subtitles first before attaching subtitles.json.',
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
          hint: 'Keep the original rendition',
        },
      },
    },
  },
  sidebar: {
    menu: {
      home: 'Home',
      explore: 'Explore',
      library: 'Saved',
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
  seriesPlaylist: {
    title: 'Episode Playlist',
    loading: 'Loading playlist.json and episodes...',
    empty: 'This playlist does not contain any playable episodes yet.',
    selected: 'Ready',
    unavailable: 'Unavailable',
  },
});
