import { test, expect } from '@playwright/test';

const gatewayStorageKey = 'ipfs-hls-selected-gateway';
const localGatewayBase = 'http://127.0.0.1:8080/ipfs/';
const testGatewayBase = 'https://dweb.link/ipfs/';
const mirroredGatewayBases = [localGatewayBase, 'https://dweb.link/ipfs/', 'https://ipfs.io/ipfs/'];
const mockGatewayHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,HEAD,OPTIONS',
  'access-control-allow-headers': '*',
  'cache-control': 'no-store',
};

const viewportMatrix = [
  { name: 'iphone-13-mini', width: 375, height: 812, mobile: true, desktop: false },
  { name: 'ipad-portrait', width: 768, height: 1024, mobile: true, desktop: false },
  { name: 'laptop', width: 1366, height: 768, mobile: false, desktop: true },
  { name: 'fhd', width: 1920, height: 1080, mobile: false, desktop: true },
  { name: 'qhd', width: 2560, height: 1440, mobile: false, desktop: true },
  { name: '4k', width: 3840, height: 2160, mobile: false, desktop: true },
];

function buildDirectVideoRoutes(cid, overrides = {}) {
  const title = overrides.title || 'Standalone Episode';
  const uploader = overrides.uploader || 'Single Team';
  const durationString = overrides.durationString || '00:05';
  const routeMap = {};

  mirroredGatewayBases.forEach((gatewayBase) => {
    routeMap[`${gatewayBase}${cid}/playlist.json`] = {
      status: 404,
      contentType: 'application/json',
      body: '{}',
    };
    routeMap[`${gatewayBase}${cid}/index.m3u8`] = {
      contentType: 'application/vnd.apple.mpegurl',
      body: '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360\n360p/streaminglist-360p.m3u8\n',
    };
    routeMap[`${gatewayBase}${cid}/360p/streaminglist-360p.m3u8`] = {
      contentType: 'application/vnd.apple.mpegurl',
      body: '#EXTM3U\n#EXT-X-TARGETDURATION:5\n#EXTINF:5,\nsegment_000.ts\n#EXT-X-ENDLIST\n',
    };
    routeMap[`${gatewayBase}${cid}/360p/segment_000.ts`] = {
      contentType: 'video/mp2t',
      body: Buffer.alloc(188),
    };
    routeMap[`${gatewayBase}${cid}/info.json`] = {
      contentType: 'application/json',
      body: JSON.stringify({
        title,
        uploader,
        duration_string: durationString,
      }),
    };
    routeMap[`${gatewayBase}${cid}/subtitles.json`] = {
      status: 404,
      contentType: 'application/json',
      body: '{}',
    };
    routeMap[`${gatewayBase}${cid}/cover.webp`] = {
      status: 404,
      contentType: 'image/webp',
      body: '',
    };
    routeMap[`${gatewayBase}${cid}/avatar.jpg`] = {
      status: 404,
      contentType: 'image/jpeg',
      body: '',
    };
  });

  return routeMap;
}

async function mountGatewayRoutes(page, routeMap = {}) {
  await page.route('https://dweb.link/**', async (route) => {
    const mock = routeMap[route.request().url()];
    await route.fulfill(
      mock
        ? {
            status: mock.status ?? 200,
            contentType: mock.contentType,
            headers: mockGatewayHeaders,
            body: mock.body,
          }
        : { status: 404, headers: mockGatewayHeaders, body: '' }
    );
  });
  await page.route('https://ipfs.io/**', async (route) => {
    const mock = routeMap[route.request().url()];
    await route.fulfill(
      mock
        ? {
            status: mock.status ?? 200,
            contentType: mock.contentType,
            headers: mockGatewayHeaders,
            body: mock.body,
          }
        : { status: 404, headers: mockGatewayHeaders, body: '' }
    );
  });
  await page.route('http://127.0.0.1:8080/ipfs/**', async (route) => {
    const mock = routeMap[route.request().url()];

    if (!mock) {
      await route.fulfill({ status: 404, headers: mockGatewayHeaders, body: '' });
      return;
    }

    await route.fulfill({
      status: mock.status ?? 200,
      contentType: mock.contentType,
      headers: mockGatewayHeaders,
      body: mock.body,
    });
  });
}

async function openApp(page, url = './', options = {}) {
  await page.route('https://images.unsplash.com/**', (route) => route.abort());
  await page.route('https://api.dicebear.com/**', (route) => route.abort());
  if (options.routeMap) {
    await page.addInitScript(({ storageKey, gatewayUrl }) => {
      window.localStorage.setItem(storageKey, gatewayUrl);
    }, { storageKey: gatewayStorageKey, gatewayUrl: testGatewayBase });
    await mountGatewayRoutes(page, options.routeMap);
  }
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('app-header')).toBeVisible();
  await expect(page.getByTestId('main-content')).toBeVisible();
}

async function getBox(locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box;
}

async function mockPlayerActivity(page, { isPlaying, isUserActive }) {
  const didApply = await page.evaluate(({ isPlaying: nextPlaying, isUserActive: nextUserActive }) => {
    const player = window.videojs?.getAllPlayers?.()?.[0];
    if (!player) {
      return false;
    }

    player.__codexMockPaused = !nextPlaying;
    player.__codexMockUserActive = nextUserActive;
    player.paused = () => player.__codexMockPaused;
    player.userActive = (value) => {
      if (typeof value === 'boolean') {
        player.__codexMockUserActive = value;
      }

      return player.__codexMockUserActive;
    };

    player.trigger(nextPlaying ? 'play' : 'pause');
    player.trigger(nextUserActive ? 'useractive' : 'userinactive');
    return true;
  }, { isPlaying, isUserActive });

  expect(didApply).toBe(true);
}

async function mockPlayerFullscreen(page, isFullscreen) {
  const didApply = await page.evaluate((nextFullscreen) => {
    const player = window.videojs?.getAllPlayers?.()?.[0];
    if (!player) {
      return false;
    }

    player.__codexMockFullscreen = nextFullscreen;
    player.isFullscreen = () => player.__codexMockFullscreen;
    player.trigger('fullscreenchange');
    return true;
  }, isFullscreen);

  expect(didApply).toBe(true);
}

async function installFullscreenApiMock(page) {
  await page.addInitScript(() => {
    let fullscreenElement = null;

    const setFullscreenElement = (nextElement) => {
      fullscreenElement = nextElement;
      Object.defineProperty(document, 'fullscreenElement', {
        configurable: true,
        get: () => fullscreenElement,
      });
      Object.defineProperty(document, 'webkitFullscreenElement', {
        configurable: true,
        get: () => fullscreenElement,
      });
    };

    setFullscreenElement(null);
    window.__codexFullscreenMock = {
      requests: [],
      exits: 0,
    };

    Element.prototype.requestFullscreen = function requestFullscreenMock() {
      setFullscreenElement(this);
      window.__codexFullscreenMock.requests.push({
        tagName: this.tagName,
        className: this.className,
        testId: this.getAttribute?.('data-testid') || null,
      });
      document.dispatchEvent(new Event('fullscreenchange'));
      document.dispatchEvent(new Event('webkitfullscreenchange'));
      return Promise.resolve();
    };

    Document.prototype.exitFullscreen = function exitFullscreenMock() {
      setFullscreenElement(null);
      window.__codexFullscreenMock.exits += 1;
      document.dispatchEvent(new Event('fullscreenchange'));
      document.dispatchEvent(new Event('webkitfullscreenchange'));
      return Promise.resolve();
    };
  });
}

async function getInlineVolumeMetrics(locator) {
  return locator.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    const styles = window.getComputedStyle(node);
    return {
      width: rect.width,
      opacity: parseFloat(styles.opacity || '1'),
    };
  });
}

async function getButtonSurface(locator) {
  return locator.evaluate((node) => {
    const styles = window.getComputedStyle(node);
    const readAlpha = (value) => {
      if (!value || value === 'transparent') {
        return 0;
      }

      const match = value.match(/rgba?\(([^)]+)\)/);
      if (!match) {
        return 1;
      }

      const parts = match[1].split(',').map((part) => Number.parseFloat(part.trim()));
      return parts.length >= 4 && Number.isFinite(parts[3]) ? parts[3] : 1;
    };

    return {
      backgroundAlpha: readAlpha(styles.backgroundColor),
      borderAlpha: readAlpha(styles.borderTopColor),
    };
  });
}

async function openGatewayDialog(page) {
  const directGatewayButton = page.getByTestId('gateway-button');

  if (await directGatewayButton.isVisible()) {
    await directGatewayButton.click();
    return;
  }

  const mobileActionsButton = page.getByTestId('header-mobile-actions-button');
  await expect(mobileActionsButton).toBeVisible();
  await mobileActionsButton.click();

  const mobileGatewayButton = page.getByTestId('header-mobile-gateway-button');
  await expect(mobileGatewayButton).toBeVisible();
  await mobileGatewayButton.click();
}

async function openShareDialog(page) {
  const directShareButton = page.getByTestId('video-info-share-button');

  if (await directShareButton.isVisible().catch(() => false)) {
    await directShareButton.click();
    return;
  }

  await page.getByTestId('video-info-overflow-trigger').click();
  const overflowShareButton = page.getByTestId('video-info-overflow-item-share');
  await expect(overflowShareButton).toBeVisible();
  await overflowShareButton.click();
}

test.describe('Responsive Page Shell', () => {
  for (const viewport of viewportMatrix) {
    test(`${viewport.name} keeps the main shell stable`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openApp(page);

      const overflow = await page.evaluate(() => {
        const main = document.querySelector('[data-testid="main-content"]');
        const header = document.querySelector('[data-testid="app-header"]');

        return {
          pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          mainOverflow: main ? main.scrollWidth - main.clientWidth : 0,
          headerOverflow: header ? header.scrollWidth - header.clientWidth : 0,
        };
      });

      expect(overflow.pageOverflow).toBeLessThanOrEqual(2);
      expect(overflow.mainOverflow).toBeLessThanOrEqual(2);
      expect(overflow.headerOverflow).toBeLessThanOrEqual(2);

      const searchBarBox = await getBox(page.getByTestId('header-search-bar'));
      expect(searchBarBox.width).toBeGreaterThan(80);

      const playerBox = await getBox(page.getByTestId('player-container'));
      const playerRatio = playerBox.width / playerBox.height;
      expect(Math.abs(playerRatio - 16 / 9)).toBeLessThan(0.08);

      const watchBox = await getBox(page.getByTestId('watch-page'));
      const recommendationsBox = await getBox(page.getByTestId('recommendations-page'));

      if (viewport.desktop) {
        expect(recommendationsBox.x).toBeGreaterThan(watchBox.x + watchBox.width * 0.55);
        expect(Math.abs(recommendationsBox.y - watchBox.y)).toBeLessThanOrEqual(24);
        expect(recommendationsBox.width).toBeGreaterThan(340);
        expect(recommendationsBox.width).toBeLessThan(420);
      } else {
        expect(recommendationsBox.y).toBeGreaterThan(watchBox.y + watchBox.height - 4);
      }

      const sidebarStyle = await page.getByTestId('app-sidebar').evaluate((node) => {
        const styles = window.getComputedStyle(node);
        return {
          position: styles.position,
          width: parseFloat(styles.width),
          height: parseFloat(styles.height),
          opacity: parseFloat(styles.opacity),
          pointerEvents: styles.pointerEvents,
        };
      });

      if (viewport.width <= 768) {
        expect(sidebarStyle.position).toBe('fixed');
        expect(sidebarStyle.height).toBeGreaterThanOrEqual(58);
      } else {
        expect(sidebarStyle.position).toBe('fixed');
        expect(sidebarStyle.width).toBeGreaterThanOrEqual(200);
        expect(sidebarStyle.opacity).toBeLessThanOrEqual(0.05);
        expect(sidebarStyle.pointerEvents).toBe('none');
      }
    });
  }

  test('opens the desktop sidebar as a left drawer from the header toggle', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await openApp(page);

    const sidebar = page.getByTestId('app-sidebar');
    const toggle = page.getByTestId('header-sidebar-toggle');
    const readSidebarOpacity = () =>
      sidebar.evaluate((node) => {
        const styles = window.getComputedStyle(node);
        return parseFloat(styles.opacity);
      });
    const readSidebarRightEdge = () =>
      sidebar.evaluate((node) => {
        const rect = node.getBoundingClientRect();
        return rect.x + rect.width;
      });

    expect(await readSidebarOpacity()).toBeLessThanOrEqual(0.05);
    expect(await readSidebarRightEdge()).toBeLessThanOrEqual(24);
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByTestId('sidebar-backdrop')).toHaveCount(0);

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('sidebar-backdrop')).toBeVisible();
    await expect.poll(readSidebarOpacity).toBeGreaterThan(0.95);
    await expect.poll(readSidebarRightEdge).toBeGreaterThan(220);

    await page.getByTestId('sidebar-backdrop').click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByTestId('sidebar-backdrop')).toHaveCount(0);
    await expect.poll(readSidebarOpacity).toBeLessThanOrEqual(0.05);
  });
});

test.describe('Custom Player Controls', () => {
  test('shows the custom control layer and hides the user-visible video.js chrome', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await openApp(page);

    await expect(page.getByTestId('video-player-controls')).toBeVisible();
    await expect(page.getByTestId('video-player-play-toggle')).toBeVisible();
    await expect(page.getByTestId('video-player-progress-slider')).toBeVisible();
    const muteToggle = page.getByTestId('video-player-mute-toggle');
    await expect(muteToggle).toBeVisible();
    await expect(page.getByTestId('video-player-fullscreen-toggle')).toBeVisible();

    const volumeInline = page.getByTestId('video-player-volume-inline');
    const volumeControl = page.getByTestId('video-player-volume-control');

    const collapsedMetrics = await getInlineVolumeMetrics(volumeControl);
    expect(collapsedMetrics.width).toBeLessThanOrEqual(4);

    const idleButtonSurface = await getButtonSurface(muteToggle);
    expect(idleButtonSurface.backgroundAlpha).toBeLessThanOrEqual(0.02);
    expect(idleButtonSurface.borderAlpha).toBeLessThanOrEqual(0.02);

    await muteToggle.hover();
    await expect.poll(async () => (await getButtonSurface(muteToggle)).backgroundAlpha).toBeGreaterThan(0.08);
    await expect.poll(async () => (await getButtonSurface(muteToggle)).borderAlpha).toBeGreaterThan(0.12);

    await volumeInline.hover();
    await expect.poll(async () => (await getInlineVolumeMetrics(volumeControl)).width).toBeGreaterThan(40);

    const chromeState = await page.evaluate(() => {
      const controlBar = document.querySelector('.vjs-control-bar');
      const bigPlay = document.querySelector('.vjs-big-play-button');

      const readDisplay = (node) => (node ? window.getComputedStyle(node).display : 'missing');

      return {
        controlBarDisplay: readDisplay(controlBar),
        bigPlayDisplay: readDisplay(bigPlay),
      };
    });

    expect(chromeState.controlBarDisplay).toBe('none');
    expect(chromeState.bigPlayDisplay).toBe('none');

    const subtitleSafeArea = await page.evaluate(() => {
      const shell = document.querySelector('.video-player-shell');
      const bar = document.querySelector('.player-control-bar');
      const safeArea = parseFloat(getComputedStyle(shell).getPropertyValue('--player-control-safe-area')) || 0;
      const barHeight = bar ? bar.getBoundingClientRect().height : 0;

      return { safeArea, barHeight };
    });

    expect(subtitleSafeArea.safeArea).toBeGreaterThanOrEqual(subtitleSafeArea.barHeight + 20);
  });

  test('auto-hides the control bar on idle regardless of playback state and wakes it again on interaction', async ({
    page,
  }) => {
    const cid = 'bafycustomcontrolsautohide123';

    await page.setViewportSize({ width: 1366, height: 768 });
    await openApp(page, `./?cid=${cid}&t=1`, { routeMap: buildDirectVideoRoutes(cid) });

    const controls = page.getByTestId('video-player-controls');
    const playToggle = page.getByTestId('video-player-play-toggle');
    const playerBox = await getBox(page.getByTestId('player-container'));

    await expect(controls).toHaveAttribute('data-controls-visible', 'true');
    await expect(playToggle).toBeVisible();

    await mockPlayerActivity(page, { isPlaying: true, isUserActive: false });
    await expect(controls).toHaveAttribute('data-controls-visible', 'false');

    await page.mouse.move(playerBox.x + playerBox.width / 2, playerBox.y + playerBox.height / 2);
    await expect(controls).toHaveAttribute('data-controls-visible', 'true');

    await page.mouse.move(Math.max(1, playerBox.x - 24), Math.max(1, playerBox.y - 24));
    await expect(controls).toHaveAttribute('data-controls-visible', 'false');

    await page.mouse.move(playerBox.x + playerBox.width / 2, playerBox.y + playerBox.height / 2);
    await expect(controls).toHaveAttribute('data-controls-visible', 'true');

    await mockPlayerActivity(page, { isPlaying: false, isUserActive: false });
    await expect(controls).toHaveAttribute('data-controls-visible', 'false');

    await page.mouse.move(playerBox.x + playerBox.width / 2, playerBox.y + playerBox.height / 2);
    await expect(controls).toHaveAttribute('data-controls-visible', 'true');
  });

  test('keeps sub-Pro-Max phones on a two-tier compact bar and moves secondary controls into settings', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openApp(page);

    const play = page.getByTestId('video-player-play-toggle');
    const progress = page.getByTestId('video-player-progress-slider');
    const time = page.getByTestId('video-player-time-display');
    const settings = page.getByTestId('video-player-settings-trigger');

    await expect(play).toBeVisible();
    await expect(progress).toBeVisible();
    await expect(time).toBeVisible();
    await expect(settings).toBeVisible();
    await expect(page.getByTestId('video-player-mute-toggle')).toHaveCount(0);
    await expect(page.getByTestId('video-player-volume-control')).toHaveCount(0);
    await expect(page.getByTestId('video-player-fullscreen-toggle')).toHaveCount(0);

    const playBox = await getBox(play);
    const progressBox = await getBox(progress);
    const timeBox = await getBox(time);
    const settingsBox = await getBox(settings);

    expect(playBox.height).toBeGreaterThanOrEqual(34);
    expect(progressBox.height).toBeGreaterThanOrEqual(4);
    expect(timeBox.height).toBeGreaterThanOrEqual(30);
    expect(settingsBox.height).toBeGreaterThanOrEqual(34);
    expect(progressBox.y + progressBox.height).toBeLessThan(playBox.y - 4);
    expect(Math.abs(playBox.y - timeBox.y)).toBeLessThanOrEqual(2);
    expect(Math.abs(timeBox.y - settingsBox.y)).toBeLessThanOrEqual(2);
    expect(progressBox.width).toBeGreaterThan(timeBox.width * 2);
    expect(timeBox.width).toBeGreaterThanOrEqual(58);
    expect(settingsBox.x).toBeGreaterThan(timeBox.x + timeBox.width - 4);

    await settings.click();
    await expect(page.getByTestId('video-player-settings-panel')).toBeVisible();
    await expect(page.getByTestId('video-player-settings-backdrop')).toBeVisible();
    await expect(page.getByTestId('video-player-mute-toggle')).toBeVisible();
    await expect(page.getByTestId('video-player-volume-control')).toBeVisible();
    await expect(page.getByTestId('video-player-subtitle-toggle')).toBeVisible();
    await expect(page.getByTestId('video-player-quality-trigger')).toBeVisible();
    await expect(page.getByTestId('video-player-fullscreen-toggle')).toBeVisible();

    const volumeControlBox = await getBox(page.getByTestId('video-player-volume-control'));
    expect(volumeControlBox.width).toBeGreaterThan(volumeControlBox.height);

    await page.getByTestId('video-player-settings-backdrop').click({ position: { x: 8, y: 8 } });
    await expect(page.getByTestId('video-player-settings-panel')).toHaveCount(0);
  });

  test('keeps Pro-Max-width mobile on a two-tier bar without collapsing into the settings trigger', async ({ page }) => {
    await page.setViewportSize({ width: 430, height: 932 });
    await openApp(page);

    const play = page.getByTestId('video-player-play-toggle');
    const progress = page.getByTestId('video-player-progress-slider');
    const time = page.getByTestId('video-player-time-display');
    const mute = page.getByTestId('video-player-mute-toggle');
    const volumeControl = page.getByTestId('video-player-volume-control');
    const fullscreen = page.getByTestId('video-player-fullscreen-toggle');
    const actions = page.getByTestId('video-player-secondary-actions');

    await expect(page.getByTestId('video-player-settings-trigger')).toHaveCount(0);
    await expect(play).toBeVisible();
    await expect(progress).toBeVisible();
    await expect(mute).toBeVisible();
    await expect(time).toBeVisible();
    await expect(fullscreen).toBeVisible();

    const collapsedVolumeMetrics = await getInlineVolumeMetrics(volumeControl);
    expect(collapsedVolumeMetrics.width).toBeLessThanOrEqual(4);

    await page.getByTestId('video-player-volume-inline').hover();
    await expect.poll(async () => (await getInlineVolumeMetrics(volumeControl)).width).toBeGreaterThan(32);

    const playBox = await getBox(play);
    const progressBox = await getBox(progress);
    const timeBox = await getBox(time);
    const muteBox = await getBox(mute);
    const volumeControlBox = await getBox(volumeControl);
    const fullscreenBox = await getBox(fullscreen);

    expect(progressBox.y + progressBox.height).toBeLessThan(playBox.y - 4);
    expect(Math.abs(playBox.y - timeBox.y)).toBeLessThanOrEqual(2);
    expect(Math.abs(timeBox.y - muteBox.y)).toBeLessThanOrEqual(3);
    expect(Math.abs(muteBox.y - fullscreenBox.y)).toBeLessThanOrEqual(2);
    expect(volumeControlBox.width).toBeGreaterThan(volumeControlBox.height);
    expect(volumeControlBox.x).toBeGreaterThan(muteBox.x + muteBox.width - 2);
    expect(fullscreenBox.x).toBeGreaterThan(volumeControlBox.x + volumeControlBox.width - 2);

    const actionStyles = await actions.evaluate((node) => {
      const styles = window.getComputedStyle(node);
      return {
        overflowX: styles.overflowX,
        flexWrap: styles.flexWrap,
      };
    });

    expect(actionStyles.overflowX).toBe('auto');
    expect(actionStyles.flexWrap).toBe('nowrap');
  });

  test('expands the control bar for FHD fullscreen playback', async ({ page }) => {
    const cid = 'bafyfullscreencontrols123';

    await page.setViewportSize({ width: 1920, height: 1080 });
    await openApp(page, `./?cid=${cid}&t=1`, { routeMap: buildDirectVideoRoutes(cid) });

    await page.evaluate(() => {
      const playerContainer = document.querySelector('[data-testid="player-container"]');
      if (!playerContainer) {
        return;
      }

      playerContainer.style.position = 'fixed';
      playerContainer.style.inset = '0';
      playerContainer.style.width = '100vw';
      playerContainer.style.height = '100vh';
      playerContainer.style.aspectRatio = 'auto';
      playerContainer.style.zIndex = '999';
      playerContainer.style.margin = '0';
      playerContainer.style.borderRadius = '0';
    });

    await mockPlayerFullscreen(page, true);

    const controlBar = page.locator('.player-control-bar');
    const progress = page.getByTestId('video-player-progress-slider');
    const playerBox = await getBox(page.getByTestId('player-container'));
    const controlBarBox = await getBox(controlBar);
    const progressBox = await getBox(progress);

    await expect(controlBar).toHaveClass(/player-control-bar--fullscreen/);
    expect(controlBarBox.width).toBeGreaterThan(playerBox.width - 60);
    expect(progressBox.width).toBeGreaterThan(controlBarBox.width - 40);

    const fullscreenStyles = await controlBar.evaluate((node) => {
      const styles = window.getComputedStyle(node);
      return {
        maxWidth: styles.maxWidth,
      };
    });

    expect(fullscreenStyles.maxWidth).toBe('none');
  });

  test('uses the shell fullscreen container and wakes controls on mouse move during fullscreen playback', async ({ page }) => {
    const cid = 'bafyfullscreencontrolsawake123';

    await installFullscreenApiMock(page);
    await page.setViewportSize({ width: 1366, height: 768 });
    await openApp(page, `./?cid=${cid}&t=1`, { routeMap: buildDirectVideoRoutes(cid) });

    const controls = page.getByTestId('video-player-controls');
    const fullscreenToggle = page.getByTestId('video-player-fullscreen-toggle');

    await fullscreenToggle.click();

    const fullscreenRequest = await page.evaluate(() => window.__codexFullscreenMock.requests[0] || null);
    expect(fullscreenRequest).not.toBeNull();
    expect(fullscreenRequest.className).toContain('video-player-shell');
    await expect(page.locator('.player-control-bar')).toHaveClass(/player-control-bar--fullscreen/);

    const playerBox = await getBox(page.getByTestId('player-container'));
    await page.mouse.move(playerBox.x + playerBox.width / 2, playerBox.y + playerBox.height / 2);

    await mockPlayerActivity(page, { isPlaying: true, isUserActive: false });
    await expect(controls).toHaveAttribute('data-controls-visible', 'false');

    await page.mouse.move(playerBox.x + playerBox.width / 2, playerBox.y + playerBox.height / 2);
    await expect(controls).toHaveAttribute('data-controls-visible', 'true');
  });
});

test.describe('Responsive Video Actions', () => {
  test('keeps the FHD action row right aligned while keeping download in the overflow menu', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await openApp(page);

    const actions = page.getByTestId('video-info-actions');
    await expect(actions).toBeVisible();
    await expect(actions).not.toHaveClass(/actions-wrapped/);
    await expect(page.getByTestId('video-info-like-button')).toBeVisible();
    await expect(page.getByTestId('video-info-dislike-button')).toBeVisible();
    await expect(page.getByTestId('video-info-share-button')).toBeVisible();
    await expect(page.getByTestId('video-info-creator-text')).toBeVisible();

    const justifyContent = await actions.evaluate((node) => window.getComputedStyle(node).justifyContent);
    expect(justifyContent).toBe('flex-end');

    await page.getByTestId('video-info-overflow-trigger').click();
    await expect(page.getByTestId('video-info-overflow-menu')).toBeVisible();
    await expect(page.getByTestId('video-info-overflow-item-download')).toBeVisible();
    await expect(page.getByTestId('video-info-overflow-item-share')).toHaveCount(0);
  });

  test('collapses share into the overflow menu on iPhone 13 mini and left aligns wrapped actions', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openApp(page);

    const actions = page.getByTestId('video-info-actions');
    await expect(actions).toBeVisible();
    await expect(actions).toHaveClass(/actions-wrapped/);
    await expect(page.getByTestId('video-info-like-button')).toBeVisible();
    await expect(page.getByTestId('video-info-dislike-button')).toBeVisible();
    await expect(page.getByTestId('video-info-share-button')).toHaveCount(0);
    await expect(page.getByTestId('video-info-creator-text')).toBeVisible();
    await expect(page.getByTestId('video-info-follow-button')).toBeVisible();

    const avatarBox = await getBox(page.getByTestId('video-info-avatar'));
    const followBox = await getBox(page.getByTestId('video-info-follow-button'));
    expect(Math.abs(followBox.y - avatarBox.y)).toBeLessThanOrEqual(8);

    const justifyContent = await actions.evaluate((node) => window.getComputedStyle(node).justifyContent);
    expect(justifyContent).toBe('flex-start');

    await page.getByTestId('video-info-overflow-trigger').click();
    await expect(page.getByTestId('video-info-overflow-menu')).toBeVisible();
    await expect(page.getByTestId('video-info-overflow-item-share')).toBeVisible();
    await expect(page.getByTestId('video-info-overflow-item-download')).toBeVisible();
  });

  test('opens a YouTube-style share dialog, toggles the time parameter, and copies the generated URL', async ({ page }) => {
    const cid = 'bafysharetest123';

    await page.addInitScript(() => {
      window.__copiedShareUrl = '';
      Object.defineProperty(window, 'isSecureContext', {
        configurable: true,
        value: true,
      });
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText(text) {
            window.__copiedShareUrl = text;
            return Promise.resolve();
          },
        },
      });
    });

    await page.setViewportSize({ width: 1366, height: 768 });
    await openApp(page, `./?cid=${cid}`, { routeMap: buildDirectVideoRoutes(cid) });

    await page.evaluate(() => {
      const player = window.videojs?.getAllPlayers?.()?.[0] || null;
      if (player) {
        player.currentTime = () => 93;
        player.duration = () => 300;
        player.paused = () => false;
        player.ended = () => false;
        return;
      }

      const existingVideo = document.querySelector('video');
      const video = existingVideo || document.body.appendChild(document.createElement('video'));
      Object.defineProperty(video, 'currentTime', {
        configurable: true,
        get: () => 93,
      });
    });

    await page.getByTestId('video-info-share-button').click();

    const dialog = page.getByTestId('video-info-share-dialog');
    const urlInput = page.getByTestId('video-info-share-url-input');
    const timePanel = page.getByTestId('video-info-share-current-time');
    const startAtToggle = page.getByTestId('video-info-share-start-at-toggle');
    const copyButton = page.getByTestId('video-info-share-copy-button');

    await expect(dialog).toBeVisible();
    await expect(timePanel).toContainText('1:33');
    await expect(startAtToggle).toContainText('開始處');
    await expect(startAtToggle).toContainText('1:33');
    await expect(urlInput).toHaveValue(new RegExp(`cid=${cid}`));
    await expect(urlInput).toHaveValue(/t=93/);

    const shareBaseUrl = new URL(page.url());
    shareBaseUrl.search = `?cid=${cid}`;

    await startAtToggle.click();
    await expect(urlInput).toHaveValue(shareBaseUrl.toString());

    await startAtToggle.click();
    shareBaseUrl.search = `?cid=${cid}&t=93`;
    await expect(urlInput).toHaveValue(shareBaseUrl.toString());

    await copyButton.click();
    await expect(copyButton).toContainText('Copied!');

    const copiedUrl = await page.evaluate(() => window.__copiedShareUrl);
    expect(copiedUrl).toBe(shareBaseUrl.toString());
  });

  test('opens the share dialog on iPhone 13 mini', async ({ page }) => {
    const cid = 'bafysharemobile123';

    await page.setViewportSize({ width: 375, height: 812 });
    await openApp(page, `./?cid=${cid}`, { routeMap: buildDirectVideoRoutes(cid) });

    await openShareDialog(page);

    const dialog = page.getByTestId('video-info-share-dialog');
    await expect(dialog).toBeVisible();

    const dialogBox = await getBox(dialog);
    expect(dialogBox.width).toBeGreaterThanOrEqual(371);
    expect(dialogBox.x).toBeLessThanOrEqual(2);
    expect(dialogBox.y + dialogBox.height).toBeGreaterThanOrEqual(810);
  });

  test('opens the subtitle dialog from the overflow menu and configures primary and secondary subtitles from the subtitle list after multi-file import', async ({ page }) => {
    const cid = 'bafysubtitleimport123';

    await page.setViewportSize({ width: 1366, height: 768 });
    await openApp(page, `./?cid=${cid}`, { routeMap: buildDirectVideoRoutes(cid) });

    await page.getByTestId('video-info-overflow-trigger').click();
    await page.getByTestId('video-info-overflow-item-subtitles').click();

    const dialog = page.getByTestId('subtitle-dialog');
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId('subtitle-dialog-import-button')).toBeVisible();
    await expect(page.getByTestId('subtitle-dialog-empty')).toContainText('你仍可匯入本機字幕');

    await page.getByTestId('subtitle-dialog-file-input').setInputFiles([
      {
        name: 'episode.en.srt',
        mimeType: 'application/x-subrip',
        buffer: Buffer.from('1\n00:00:01,000 --> 00:00:02,500\nHello from SRT\n'),
      },
      {
        name: 'episode.ja.vtt',
        mimeType: 'text/vtt',
        buffer: Buffer.from('WEBVTT\n\n00:00:01.000 --> 00:00:02.500\nこんにちは\n'),
      },
    ]);

    await expect(page.getByTestId('subtitle-dialog-status')).toContainText('已匯入 2 條字幕');
    await expect(page.getByTestId('subtitle-dialog-track-list')).toContainText('English');
    await expect(page.getByTestId('subtitle-dialog-track-list')).toContainText('日本語');
    await expect(page.getByTestId('subtitle-dialog-track-list')).toContainText('episode.en.vtt');
    await expect(page.getByTestId('subtitle-dialog-track-list')).toContainText('episode.ja.vtt');
    await expect(page.getByTestId('subtitle-dialog-track-list')).toContainText('本機');

    const englishTrack = page.getByTestId('subtitle-dialog-track-local-en');
    const japaneseTrack = page.getByTestId('subtitle-dialog-track-local-ja');

    await expect(englishTrack).toHaveClass(/subtitle-track-row--primary/);
    await expect(japaneseTrack).not.toHaveClass(/subtitle-track-row--secondary/);

    await page.getByTestId('subtitle-dialog-secondary-action-local-ja').click();

    await expect(japaneseTrack).toHaveClass(/subtitle-track-row--secondary/);

    await page.getByTestId('subtitle-dialog-primary-action-local-ja').click();

    await expect(japaneseTrack).toHaveClass(/subtitle-track-row--primary/);
    await expect(japaneseTrack).not.toHaveClass(/subtitle-track-row--secondary/);
    await expect(englishTrack).not.toHaveClass(/subtitle-track-row--primary/);
  });
});

test.describe('Responsive Gateway Dialog', () => {
  test('opens as a mobile bottom sheet on iPhone 13 mini', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openApp(page);

    await openGatewayDialog(page);
    const dialog = page.getByTestId('gateway-dialog');
    await expect(dialog).toBeVisible();

    const dialogBox = await getBox(dialog);
    expect(dialogBox.width).toBeGreaterThanOrEqual(371);
    expect(dialogBox.x).toBeLessThanOrEqual(2);
    expect(dialogBox.y + dialogBox.height).toBeGreaterThanOrEqual(810);

    const dialogStyles = await dialog.evaluate((node) => {
      const styles = window.getComputedStyle(node);
      return {
        backgroundColor: styles.backgroundColor,
        boxShadow: styles.boxShadow,
      };
    });
    expect(dialogStyles.backgroundColor).toContain('rgba(');
    expect(dialogStyles.boxShadow).not.toBe('none');

    const footer = page.getByTestId('gateway-dialog-footer');
    await expect(footer).toBeVisible();
    const footerStyles = await footer.evaluate((node) => {
      const styles = window.getComputedStyle(node);
      return {
        flexDirection: styles.flexDirection,
        backgroundImage: styles.backgroundImage,
      };
    });
    expect(footerStyles.flexDirection).toBe('row');
    expect(footerStyles.backgroundImage).not.toBe('none');
  });

  test('stays centered and capped on FHD desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await openApp(page);

    await openGatewayDialog(page);
    const dialog = page.getByTestId('gateway-dialog');
    await expect(dialog).toBeVisible();

    const dialogBox = await getBox(dialog);
    expect(dialogBox.width).toBeGreaterThanOrEqual(600);
    expect(dialogBox.width).toBeLessThanOrEqual(640);

    const centeredX = (1920 - dialogBox.width) / 2;
    expect(Math.abs(dialogBox.x - centeredX)).toBeLessThanOrEqual(24);
    expect(dialogBox.y).toBeGreaterThan(40);
  });

  test('reveals advanced settings only for the selected gateway type', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await openApp(page);

    await openGatewayDialog(page);
    await expect(page.getByTestId('gateway-dialog')).toBeVisible();

    const localOption = page.getByTestId('gateway-option-local');
    const dwebOption = page.getByTestId('gateway-option-dweb');
    const customOption = page.getByTestId('gateway-option-custom');
    await expect(localOption).toHaveClass(/current/);
    await expect(localOption).toHaveClass(/selected/);
    await expect(dwebOption).not.toHaveClass(/current/);
    await expect(localOption).toContainText('Current Selection');

    await expect(page.getByTestId('gateway-local-config')).toBeVisible();
    await expect(page.getByTestId('gateway-custom-config')).toHaveCount(0);
    await expect(page.getByTestId('gateway-transition-note')).toHaveCount(0);

    await customOption.click();
    await expect(page.getByTestId('gateway-custom-config')).toBeVisible();
    await expect(page.getByTestId('gateway-local-config')).toHaveCount(0);
    await expect(page.getByTestId('gateway-transition-note')).toBeVisible();
    await expect(localOption).toHaveClass(/current/);
    await expect(localOption).not.toHaveClass(/selected/);
    await expect(localOption).toContainText('Current');
    await expect(customOption).toContainText('Selected');

    await dwebOption.click();
    await expect(page.getByTestId('gateway-custom-config')).toHaveCount(0);
    await expect(page.getByTestId('gateway-local-config')).toHaveCount(0);
    await expect(page.getByTestId('gateway-transition-note')).toBeVisible();
    await expect(localOption).toHaveClass(/current/);
    await expect(localOption).not.toHaveClass(/selected/);
    await expect(dwebOption).toHaveClass(/selected/);
    await expect(dwebOption).not.toHaveClass(/current/);
    await expect(localOption).toContainText('Current');
    await expect(dwebOption).toContainText('Selected');

    await localOption.click();
    await expect(page.getByTestId('gateway-local-config')).toBeVisible();
    await expect(page.getByTestId('gateway-transition-note')).toHaveCount(0);
    await expect(localOption).toHaveClass(/current/);
    await expect(localOption).toHaveClass(/selected/);
    await expect(localOption).toContainText('Current Selection');
  });
});
