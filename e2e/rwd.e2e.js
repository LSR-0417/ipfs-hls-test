import { test, expect } from '@playwright/test';

const viewportMatrix = [
  { name: 'iphone-13-mini', width: 375, height: 812, mobile: true, desktop: false },
  { name: 'ipad-portrait', width: 768, height: 1024, mobile: true, desktop: false },
  { name: 'laptop', width: 1366, height: 768, mobile: false, desktop: true },
  { name: 'fhd', width: 1920, height: 1080, mobile: false, desktop: true },
  { name: 'qhd', width: 2560, height: 1440, mobile: false, desktop: true },
  { name: '4k', width: 3840, height: 2160, mobile: false, desktop: true },
];

async function openApp(page) {
  await page.route('https://images.unsplash.com/**', (route) => route.abort());
  await page.route('https://api.dicebear.com/**', (route) => route.abort());
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('app-header')).toBeVisible();
  await expect(page.getByTestId('main-content')).toBeVisible();
}

async function getBox(locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box;
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

      const primaryBox = await getBox(page.getByTestId('primary-column'));
      const secondaryBox = await getBox(page.getByTestId('secondary-column'));

      if (viewport.desktop) {
        expect(secondaryBox.x).toBeGreaterThan(primaryBox.x + primaryBox.width * 0.55);
        expect(Math.abs(secondaryBox.y - primaryBox.y)).toBeLessThanOrEqual(24);
        expect(secondaryBox.width).toBeGreaterThan(340);
        expect(secondaryBox.width).toBeLessThan(420);
      } else {
        expect(secondaryBox.y).toBeGreaterThan(primaryBox.y + primaryBox.height - 4);
      }

      const sidebarStyle = await page.getByTestId('app-sidebar').evaluate((node) => {
        const styles = window.getComputedStyle(node);
        return {
          position: styles.position,
          width: parseFloat(styles.width),
          height: parseFloat(styles.height),
        };
      });

      if (viewport.width <= 768) {
        expect(sidebarStyle.position).toBe('fixed');
        expect(sidebarStyle.height).toBeGreaterThanOrEqual(58);
      } else {
        expect(sidebarStyle.position).not.toBe('fixed');
        expect(sidebarStyle.width).toBeGreaterThanOrEqual(80);
      }
    });
  }
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
});

test.describe('Responsive Gateway Dialog', () => {
  test('opens as a mobile bottom sheet on iPhone 13 mini', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openApp(page);

    await page.getByTestId('gateway-button').click();
    const dialog = page.getByTestId('gateway-dialog');
    await expect(dialog).toBeVisible();

    const dialogBox = await getBox(dialog);
    expect(dialogBox.width).toBeGreaterThanOrEqual(371);
    expect(dialogBox.x).toBeLessThanOrEqual(2);
    expect(dialogBox.y + dialogBox.height).toBeGreaterThanOrEqual(810);

    const footer = page.getByTestId('gateway-dialog-footer');
    await expect(footer).toBeVisible();
    const footerFlexDirection = await footer.evaluate((node) => window.getComputedStyle(node).flexDirection);
    expect(footerFlexDirection).toBe('row');
  });

  test('stays centered and capped on FHD desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await openApp(page);

    await page.getByTestId('gateway-button').click();
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

    await page.getByTestId('gateway-button').click();
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
