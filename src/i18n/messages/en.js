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
        label: 'Drafts',
        title: 'Sidecar Draft',
        ariaLabel: 'Open the local sidecar draft tool',
      },
    },
  },
  infoJson: {
    title: 'Prepare a local sidecar draft',
    subtitle: 'Split the workflow into three tabs for video metadata, subtitle metadata, and video processing. Each tab stands on its own so we can prepare sidecars and the backend upload draft step by step.',
    panels: {
      metadata: {
        title: 'Video Metadata',
        caption: 'Prepare the video metadata and download info.json when it is ready.',
      },
      subtitles: {
        title: 'Subtitle Metadata',
        caption: 'Import local subtitle files, review the manifest, and download subtitles.json.',
      },
      video: {
        title: 'Video Processing',
        caption: 'Choose the source video, pick renditions, and decide whether the sidecar JSON files should travel with the backend upload.',
      },
    },
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
      title: 'Video Metadata',
      caption: 'If a video is already loaded, the form opens prefilled with its metadata. You can also clear it and start from scratch.',
    },
    assets: {
      title: 'Local Assets',
      caption: 'Organize the avatar, subtitles, and source video in the browser first. Nothing is uploaded to the backend yet.',
      localOnly: 'Local session only',
      none: 'No local assets selected yet',
      upload: 'Choose file',
      replace: 'Replace file',
      remove: 'Remove',
      avatar: {
        title: 'Avatar',
        caption: 'Accepts image files and keeps a local avatar preview.',
        previewAlt: 'Local avatar preview',
      },
      subtitles: {
        title: 'Subtitles',
        caption: 'Import multiple .vtt / .srt files and generate a subtitles.json draft at the same time.',
        empty: 'No subtitles imported yet',
        count: '{count} subtitle tracks',
        download: 'Download subtitles.json',
      },
      video: {
        title: 'Source Video',
        caption: 'Select a local source video now so we can connect a backend processor later.',
        empty: 'No video selected yet',
        draftTitle: 'Processor Draft',
        draftCaption: 'This is only a local draft for now. No real upload happens yet.',
        pending: 'Processor pending',
        ready: 'Local draft ready',
      },
    },
    manifests: {
      infoTitle: 'info.json Preview',
      infoCaption: 'This content will be saved as the sidecar info.json file.',
      infoEmpty: 'Fill in the metadata to generate info.json here.',
      subtitlesTitle: 'subtitles.json Preview',
      subtitlesCaption: 'Generated from the local subtitles currently imported.',
      subtitlesEmpty: 'Import subtitles to generate subtitles.json here.',
    },
    preview: {
      summary: '{count} fields will be exported',
      omitEmpty: 'Empty fields are omitted from the JSON output',
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
      ready: '{info} metadata fields, {subtitles} subtitle tracks, and {assets} local assets are currently prepared',
      infoCopied: 'info.json copied',
      infoDownloaded: 'info.json downloaded',
      subtitleManifestDownloaded: 'subtitles.json downloaded',
      avatarSelected: 'Avatar selected: {name}',
      avatarRejected: 'Please choose an image file for the avatar',
      avatarCleared: 'Avatar removed',
      subtitlesImported: '{count} local subtitle tracks imported',
      subtitlesPartial: '{count} subtitle tracks imported, and some files failed:',
      subtitlesFailed: 'Subtitle import failed',
      subtitlesCleared: 'Local subtitles cleared',
      videoSelected: 'Video selected: {name}',
      videoRejected: 'Please choose a video file',
      videoCleared: 'Video draft removed',
      localAssetsCleared: 'Local assets cleared',
    },
    actions: {
      clear: 'Clear Form',
      clearAssets: 'Clear Local Assets',
      clearSubtitles: 'Clear Subtitles',
      clearVideo: 'Clear Video',
      close: 'Close',
      previous: 'Back',
      next: 'Next',
      copy: 'Copy info.json',
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
      categories: {
        label: 'Categories',
        placeholder: 'Technology, Education',
        hint: 'Separate entries with commas or line breaks.',
      },
    },
    video: {
      pending: 'No video selected',
      missingResolutions: 'Pick at least one rendition',
      ready: 'Upload draft ready',
      resolutionsTitle: 'Target Renditions',
      resolutionsCaption: 'Choose which renditions the backend processor should produce.',
      selectedResolutions: '{count} renditions selected',
      noResolutionSelected: 'Select at least one rendition',
      resolutionsHint: 'The backend will still filter unsupported renditions based on the source video height.',
      attachmentsTitle: 'Send Alongside the Video',
      attachmentsCaption: 'Choose whether the generated sidecar JSON files should be attached to the backend request.',
      includeInfo: 'Attach info.json',
      includeInfoHintReady: 'The current info.json draft from the metadata tab will be attached.',
      includeInfoHintUnavailable: 'Fill in metadata first before attaching info.json.',
      includeSubtitles: 'Attach subtitles.json',
      includeSubtitlesHintReady: 'The current subtitles.json draft from the subtitles tab will be attached.',
      includeSubtitlesHintUnavailable: 'Import subtitles first before attaching subtitles.json.',
      draftTitle: 'Backend Upload Draft',
      draftCaption: 'This is only a local request payload preview for now. Nothing is sent yet.',
      summaryAttachments: '{count} sidecar files will be attached',
      summaryNoAttachments: 'No sidecar files attached',
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
