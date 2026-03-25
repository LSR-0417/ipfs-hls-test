import { test, expect } from '@playwright/test';

const viewportMatrix = [
  { name: 'iphone-13-mini', width: 375, height: 812, mobile: true, desktop: false },
  { name: 'ipad-portrait', width: 768, height: 1024, mobile: true, desktop: false },
  { name: 'laptop', width: 1366, height: 768, mobile: false, desktop: true },
  { name: 'fhd', width: 1920, height: 1080, mobile: false, desktop: true },
  { name: 'qhd', width: 2560, height: 1440, mobile: false, desktop: true },
  { name: '4k', width: 3840, height: 2160, mobile: false, desktop: true },
];

async function openApp(page, url = './') {
  await page.route('https://images.unsplash.com/**', (route) => route.abort());
  await page.route('https://api.dicebear.com/**', (route) => route.abort());
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('app-header')).toBeVisible();
  await expect(page.getByTestId('main-content')).toBeVisible();
}

async function getBox(locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box;
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
    await openApp(page, './?cid=bafysharetest123');

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
    await expect(urlInput).toHaveValue(/cid=bafysharetest123/);
    await expect(urlInput).toHaveValue(/t=93/);

    const shareBaseUrl = new URL(page.url());
    shareBaseUrl.search = '?cid=bafysharetest123';

    await startAtToggle.click();
    await expect(urlInput).toHaveValue(shareBaseUrl.toString());

    await startAtToggle.click();
    shareBaseUrl.search = '?cid=bafysharetest123&t=93';
    await expect(urlInput).toHaveValue(shareBaseUrl.toString());

    await copyButton.click();
    await expect(copyButton).toContainText('Copied!');

    const copiedUrl = await page.evaluate(() => window.__copiedShareUrl);
    expect(copiedUrl).toBe(shareBaseUrl.toString());
  });

  test('opens the share dialog from the overflow menu on iPhone 13 mini', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openApp(page, './?cid=bafysharemobile123');

    await page.getByTestId('video-info-overflow-trigger').click();
    await page.getByTestId('video-info-overflow-item-share').click();

    const dialog = page.getByTestId('video-info-share-dialog');
    await expect(dialog).toBeVisible();

    const dialogBox = await getBox(dialog);
    expect(dialogBox.width).toBeGreaterThanOrEqual(371);
    expect(dialogBox.x).toBeLessThanOrEqual(2);
    expect(dialogBox.y + dialogBox.height).toBeGreaterThanOrEqual(810);
  });

  test('opens the subtitle dialog from the overflow menu and configures primary and secondary subtitles from the subtitle list after multi-file import', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await openApp(page, './?cid=bafysubtitleimport123');

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

    await expect(page.getByTestId('subtitle-dialog-status')).toContainText('次字幕已切換為 日本語');
    await expect(japaneseTrack).toHaveClass(/subtitle-track-row--secondary/);

    await page.getByTestId('subtitle-dialog-primary-action-local-ja').click();

    await expect(page.getByTestId('subtitle-dialog-status')).toContainText('主字幕已切換為 日本語');
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
