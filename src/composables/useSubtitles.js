export function useSubtitles() {
  const detectSubtitles = async (baseUrl) => {
    if (!baseUrl) return [];

    const possibleSubtitles = [
      { lang: 'en', label: 'English', filename: 'en.vtt' },
      { lang: 'zh-TW', label: '繁體中文', filename: 'zh-TW.vtt' },
      { lang: 'zh-CN', label: '簡體中文', filename: 'zh-CN.vtt' },
      { lang: 'ko', label: '韓文', filename: 'ko.vtt' },
      { lang: 'ja', label: '日本語', filename: 'ja.vtt' },
    ];

    const detectionPromises = possibleSubtitles.map(async (sub, index) => {
      try {
        const url = `${baseUrl}${sub.filename}`;
        const res = await fetch(url, { method: 'HEAD', mode: 'cors' });
        if (res.ok) {
          return {
            lang: sub.lang,
            label: sub.label,
            src: url,
            orderIdx: index,
          };
        }
      } catch (e) {}
      return null;
    });

    const results = await Promise.all(detectionPromises);

    // Filter out nulls and sort by original array index to guarantee Plyr order
    const foundSubtitles = results
      .filter((s) => s !== null)
      .sort((a, b) => a.orderIdx - b.orderIdx);

    return foundSubtitles;
  };

  return {
    detectSubtitles,
  };
}
