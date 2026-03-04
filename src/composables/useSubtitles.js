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
        const finalBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
        const url = `${finalBase}${sub.filename}`;

        // 改用 GET 避免部分網關對 HEAD 請求的 CORS 問題，並直接利用瀏覽器快取
        const res = await fetch(url, { method: 'GET', mode: 'cors' });

        if (res.ok) {
          // 檢查 Content-Type，確保不是代理伺服器或 Vite dev server 返回的 index.html
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('text/html')) {
            return null; // 若是 HTML，表示這不是字幕檔
          }

          return {
            lang: sub.lang,
            label: sub.label,
            src: url,
            orderIdx: index,
          };
        }
      } catch (e) {
        console.warn(`[useSubtitles] Failed to fetch ${sub.filename}:`, e);
      }
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
