import { expect, test } from '@playwright/test';

const gatewayStorageKey = 'ipfs-hls-selected-gateway';
const historyStorageKey = 'ipfs-hls-watch-history';
const savedStorageKey = 'ipfs-hls-saved-videos';
const localGatewayBase = 'http://127.0.0.1:8080/ipfs/';
const tinyPosterPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wn6zk8AAAAASUVORK5CYII=',
  'base64'
);

function buildSeriesRoutes(seriesCid) {
  const episodes = [
    {
      id: 'ep01',
      cid: 'bafy-episode-01',
      number: 1,
      title: 'Series Episode 1',
      uploader: 'Series Channel',
      durationString: '12:34',
      path: 'ep01',
      playable: true,
      sidecar: {
        title: 'Series Episode 1',
        uploader: 'Series Channel',
        durationString: '12:34',
      },
    },
    {
      id: 'ep02',
      cid: 'bafy-episode-02',
      number: 2,
      title: 'Series Episode 2',
      uploader: 'Series Channel',
      durationString: '08:21',
      path: 'ep02',
      playable: true,
      sidecar: {
        title: 'Wrong Episode 2 Title',
        uploader: 'Wrong Channel Name',
        durationString: '99:59',
      },
    },
  ];

  return buildSeriesRoutesFromEpisodes(seriesCid, episodes, 'Demo Series');
}

function buildSeriesRoutesFromEpisodes(seriesCid, episodes = [], title = 'Demo Series') {
  const routeMap = {
    [`${localGatewayBase}${seriesCid}/playlist.json`]: {
      contentType: 'application/json',
      body: JSON.stringify({
        version: 1,
        title,
        episodes: episodes.map(({ sidecar, ...episode }) => episode),
      }),
    },
  };

  episodes.forEach((episode) => {
    const sidecar = episode.sidecar || {};

    routeMap[`${localGatewayBase}${episode.cid}/index.m3u8`] = {
      contentType: 'application/vnd.apple.mpegurl',
      body: '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360\n360p/streaminglist-360p.m3u8\n',
    };
    routeMap[`${localGatewayBase}${episode.cid}/360p/streaminglist-360p.m3u8`] = {
      contentType: 'application/vnd.apple.mpegurl',
      body: '#EXTM3U\n#EXT-X-TARGETDURATION:5\n#EXTINF:5,\nsegment_000.ts\n#EXT-X-ENDLIST\n',
    };
    routeMap[`${localGatewayBase}${episode.cid}/360p/segment_000.ts`] = {
      contentType: 'video/mp2t',
      body: Buffer.alloc(188),
      isBinary: true,
    };
    routeMap[`${localGatewayBase}${episode.cid}/info.json`] = {
      contentType: 'application/json',
      body: JSON.stringify({
        title: sidecar.title || episode.title,
        uploader: sidecar.uploader || episode.uploader,
        duration_string: sidecar.durationString || episode.durationString,
      }),
    };
    routeMap[`${localGatewayBase}${episode.cid}/subtitles.json`] = {
      status: 404,
      contentType: 'application/json',
      body: '{}',
    };
    routeMap[`${localGatewayBase}${episode.cid}/cover.webp`] = {
      contentType: 'image/png',
      body: tinyPosterPng,
      isBinary: true,
    };
    routeMap[`${localGatewayBase}${episode.cid}/avatar.jpg`] = {
      status: 404,
      contentType: 'image/jpeg',
      body: '',
    };
  });

  return routeMap;
}

function buildSingleRoutes(singleCid, overrides = {}) {
  return {
    [`${localGatewayBase}${singleCid}/playlist.json`]: {
      status: 404,
      contentType: 'application/json',
      body: '{}',
    },
    [`${localGatewayBase}${singleCid}/index.m3u8`]: {
      contentType: 'application/vnd.apple.mpegurl',
      body: '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360\n360p/streaminglist-360p.m3u8\n',
    },
    [`${localGatewayBase}${singleCid}/360p/streaminglist-360p.m3u8`]: {
      contentType: 'application/vnd.apple.mpegurl',
      body: '#EXTM3U\n#EXT-X-TARGETDURATION:5\n#EXTINF:5,\nsegment_000.ts\n#EXT-X-ENDLIST\n',
    },
    [`${localGatewayBase}${singleCid}/360p/segment_000.ts`]: {
      contentType: 'video/mp2t',
      body: Buffer.alloc(188),
      isBinary: true,
    },
    [`${localGatewayBase}${singleCid}/info.json`]: {
      contentType: 'application/json',
      body: JSON.stringify({
        title: overrides.title || 'Standalone Episode',
        uploader: overrides.uploader || 'Single Team',
        duration_string: overrides.durationString || '00:05',
      }),
    },
    [`${localGatewayBase}${singleCid}/subtitles.json`]: {
      status: 404,
      contentType: 'application/json',
      body: '{}',
    },
    [`${localGatewayBase}${singleCid}/cover.webp`]: {
      status: 404,
      contentType: 'image/webp',
      body: '',
    },
    [`${localGatewayBase}${singleCid}/avatar.jpg`]: {
      status: 404,
      contentType: 'image/jpeg',
      body: '',
    },
  };
}

async function mountMockGateway(page, routeMap) {
  await page.route('https://images.unsplash.com/**', (route) => route.abort());
  await page.route('https://api.dicebear.com/**', (route) => route.abort());
  await page.route('https://dweb.link/**', (route) => route.fulfill({ status: 404, body: '' }));
  await page.route('https://ipfs.io/**', (route) => route.fulfill({ status: 404, body: '' }));
  await page.route('http://127.0.0.1:8080/ipfs/**', async (route) => {
    const mock = routeMap[route.request().url()];

    if (!mock) {
      await route.fulfill({ status: 404, body: '' });
      return;
    }

    await route.fulfill({
      status: mock.status ?? 200,
      contentType: mock.contentType,
      body: mock.body,
    });
  });
}

async function openApp(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('app-header')).toBeVisible();
  await expect(page.getByTestId('main-content')).toBeVisible();
}

async function openSavedVideos(page) {
  await page.getByTestId('header-sidebar-toggle').click();
  await page.getByTestId('sidebar-item-library').click();
  await expect(page.getByTestId('saved-page')).toBeVisible();
}

test.describe('Series playlist flow', () => {
  test('loads a series playlist, preselects the first playable episode, and keeps watch history untouched before play', async ({ page }) => {
    const seriesCid = 'bafy-series-demo';

    await mountMockGateway(page, buildSeriesRoutes(seriesCid));
    await page.addInitScript((storageKey) => {
      window.localStorage.removeItem(storageKey);
    }, historyStorageKey);
    await page.setViewportSize({ width: 1366, height: 900 });
    await openApp(page, `./?cid=${seriesCid}`);

    await expect(page.getByTestId('series-playlist-page')).toBeVisible();
    await expect(page.getByTestId('series-playlist-title')).toHaveText('Demo Series');
    await expect(page.getByTestId('series-playlist-item-ep01')).toBeVisible();
    await expect(page.getByTestId('series-playlist-item-ep02')).toBeVisible();
    await expect(page.getByTestId('series-playlist-item-ep01')).toContainText('Series Episode 1');
    await expect(page.getByTestId('series-playlist-item-ep02')).toContainText('Series Episode 2');
    await expect(page.getByTestId('series-playlist-item-ep01')).toContainText('Series Channel');
    await expect(page.getByTestId('series-playlist-item-ep02')).toContainText('Series Channel');
    await expect(page.getByTestId('series-playlist-poster-ep01')).toBeVisible();
    await expect(page.getByTestId('series-playlist-poster-ep02')).toBeVisible();
    await expect(page.getByTestId('series-playlist-duration-ep01')).toHaveText('12:34');
    await expect(page.getByTestId('series-playlist-duration-ep02')).toHaveText('08:21');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Series Episode 1');
    await expect(page.getByTestId('series-playlist-item-ep01')).toHaveClass(/is-selected/);

    const playerPaused = await page.evaluate(() => {
      const video = document.querySelector('video');
      return video ? video.paused : true;
    });
    expect(playerPaused).toBe(true);

    const historyValue = await page.evaluate((storageKey) => window.localStorage.getItem(storageKey), historyStorageKey);
    expect(historyValue).toBe(null);

    await page.getByTestId('series-playlist-item-ep02').click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Series Episode 2');
    await expect(page.getByTestId('series-playlist-item-ep02')).toContainText('Series Episode 2');
    await expect(page.getByTestId('series-playlist-item-ep02')).toContainText('Series Channel');
    await expect(page.getByTestId('series-playlist-duration-ep02')).toHaveText('08:21');
    await expect(page.getByTestId('series-playlist-item-ep02')).toHaveClass(/is-selected/);

    const historyAfterSelect = await page.evaluate((storageKey) => window.localStorage.getItem(storageKey), historyStorageKey);
    expect(historyAfterSelect).toBe(null);
  });

  test('keeps single-video CIDs in the existing standalone playback flow', async ({ page }) => {
    const singleCid = 'bafy-single-demo';

    await mountMockGateway(page, buildSingleRoutes(singleCid));
    await page.setViewportSize({ width: 1366, height: 900 });
    await openApp(page, `./?cid=${singleCid}`);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Standalone Episode');
    await expect(page.getByTestId('recommendations-page')).toBeVisible();
    await expect(page.getByTestId('series-playlist-page')).toHaveCount(0);
  });

  test('renders every episode from a longer playlist without mixing up titles', async ({ page }) => {
    const seriesCid = 'bafy-series-many-demo';
    const episodes = Array.from({ length: 5 }, (_, index) => {
      const number = index + 1;
      const label = String(number).padStart(2, '0');

      return {
        id: `ep${label}`,
        cid: `bafy-many-episode-${label}`,
        number,
        title: `Series Episode ${number}`,
        uploader: `Series Channel ${number}`,
        durationString: `2${number}:0${number}`,
        path: `ep${label}`,
        playable: true,
        sidecar: {
          title: `Wrong Sidecar Title ${number}`,
          uploader: `Wrong Sidecar Uploader ${number}`,
          durationString: `9${number}:9${number}`,
        },
      };
    });

    await mountMockGateway(page, buildSeriesRoutesFromEpisodes(seriesCid, episodes, 'Many Episode Series'));
    await page.setViewportSize({ width: 1366, height: 900 });
    await openApp(page, `./?cid=${seriesCid}`);

    await expect(page.getByTestId('series-playlist-title')).toHaveText('Many Episode Series');
    await expect(page.locator('[data-testid^="series-playlist-item-"]')).toHaveCount(5);

    for (const episode of episodes) {
      await expect(page.getByTestId(`series-playlist-item-${episode.id}`)).toContainText(episode.title);
      await expect(page.getByTestId(`series-playlist-item-${episode.id}`)).toContainText(episode.uploader);
      await expect(page.getByTestId(`series-playlist-duration-${episode.id}`)).toHaveText(episode.durationString);
    }

    await page.getByTestId('series-playlist-item-ep05').click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Series Episode 5');
    await expect(page.getByTestId('series-playlist-item-ep05')).toHaveClass(/is-selected/);
    await expect(page.getByTestId('series-playlist-item-ep05')).toContainText('Series Episode 5');
    await expect(page.getByTestId('series-playlist-item-ep05')).not.toContainText('Wrong Sidecar Title 5');
  });

  test('keeps saved videos ordered by manual save time and lets the watch button toggle removal', async ({ page }) => {
    const firstCid = 'bafy-save-first';
    const secondCid = 'bafy-save-second';

    await mountMockGateway(page, {
      ...buildSingleRoutes(firstCid, {
        title: 'Saved Video One',
        uploader: 'Saved Team One',
        durationString: '00:11',
      }),
      ...buildSingleRoutes(secondCid, {
        title: 'Saved Video Two',
        uploader: 'Saved Team Two',
        durationString: '00:22',
      }),
    });
    await page.addInitScript(({ historyKey, savedKey, gatewayKey, gatewayUrl, resetMarker }) => {
      if (!window.sessionStorage.getItem(resetMarker)) {
        window.localStorage.removeItem(historyKey);
        window.localStorage.removeItem(savedKey);
        window.sessionStorage.setItem(resetMarker, '1');
      }

      window.localStorage.setItem(gatewayKey, gatewayUrl);
    }, {
      historyKey: historyStorageKey,
      savedKey: savedStorageKey,
      gatewayKey: gatewayStorageKey,
      gatewayUrl: localGatewayBase,
      resetMarker: 'series-playlist-saved-videos-reset',
    });
    await page.setViewportSize({ width: 1366, height: 900 });

    await openApp(page, `./?cid=${firstCid}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Saved Video One');
    await page.getByTestId('video-info-save-button').click();
    await expect(page.getByTestId('video-info-save-button')).toHaveClass(/is-active/);

    await openApp(page, `./?cid=${secondCid}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Saved Video Two');
    await page.getByTestId('video-info-save-button').click();
    await expect(page.getByTestId('video-info-save-button')).toHaveClass(/is-active/);

    await openSavedVideos(page);
    await expect(page.locator('[data-testid^="saved-item-"]')).toHaveCount(2);

    const savedBeforeRemoval = await page.locator('[data-testid^="saved-item-"]').evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('data-testid'))
    );
    expect(savedBeforeRemoval).toEqual([`saved-item-${secondCid}`, `saved-item-${firstCid}`]);

    await openApp(page, `./?cid=${firstCid}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Saved Video One');
    await expect(page.getByTestId('video-info-save-button')).toHaveClass(/is-active/);
    await page.getByTestId('video-info-save-button').click();
    await expect(page.getByTestId('video-info-save-button')).not.toHaveClass(/is-active/);

    const savedAfterToggleRemove = await page.evaluate((storageKey) => {
      const rawValue = window.localStorage.getItem(storageKey);
      return rawValue ? JSON.parse(rawValue) : [];
    }, savedStorageKey);
    expect(savedAfterToggleRemove.map((item) => item.cid)).toEqual([secondCid]);
    expect(savedAfterToggleRemove).toHaveLength(1);

    await openSavedVideos(page);
    await expect(page.locator('[data-testid^="saved-item-"]')).toHaveCount(1);
    await expect(page.getByTestId(`saved-item-${firstCid}`)).toHaveCount(0);

    await openApp(page, `./?cid=${secondCid}`);
    await openSavedVideos(page);
    await expect(page.locator('[data-testid^="saved-item-"]')).toHaveCount(1);
    await expect(page.getByTestId(`saved-item-${secondCid}`)).toBeVisible();
  });

  test('saves the selected series episode instead of the playlist cid and keeps watch history untouched', async ({ page }) => {
    const seriesCid = 'bafy-series-save-demo';

    await mountMockGateway(page, buildSeriesRoutes(seriesCid));
    await page.addInitScript(({ historyKey, savedKey, gatewayKey, gatewayUrl }) => {
      window.localStorage.removeItem(historyKey);
      window.localStorage.removeItem(savedKey);
      window.localStorage.setItem(gatewayKey, gatewayUrl);
    }, {
      historyKey: historyStorageKey,
      savedKey: savedStorageKey,
      gatewayKey: gatewayStorageKey,
      gatewayUrl: localGatewayBase,
    });
    await page.setViewportSize({ width: 1366, height: 900 });
    await openApp(page, `./?cid=${seriesCid}`);

    await page.getByTestId('series-playlist-item-ep02').click();
    await page.getByTestId('video-info-save-button').click();

    const historyValue = await page.evaluate((storageKey) => window.localStorage.getItem(storageKey), historyStorageKey);
    expect(historyValue).toBe(null);

    const savedItems = await page.evaluate((storageKey) => {
      const rawValue = window.localStorage.getItem(storageKey);
      return rawValue ? JSON.parse(rawValue) : [];
    }, savedStorageKey);

    expect(savedItems).toHaveLength(1);
    expect(savedItems[0].cid).toBe('bafy-episode-02');
    expect(savedItems[0].seriesCid).toBe(seriesCid);
    expect(savedItems[0].episodePath).toBe('ep02');
    expect(savedItems[0].gateway).toBe(localGatewayBase);

    await openSavedVideos(page);
    await page.getByTestId('saved-item-bafy-episode-02').getByRole('button').first().click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Series Episode 2');
    await expect(page.getByTestId('series-playlist-item-ep02')).toHaveClass(/is-selected/);
  });
});
