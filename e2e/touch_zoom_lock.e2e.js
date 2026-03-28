import { test, expect } from '@playwright/test';

async function openApp(page, { touchDevice = false } = {}) {
  await page.route('https://images.unsplash.com/**', (route) => route.abort());
  await page.route('https://api.dicebear.com/**', (route) => route.abort());

  if (touchDevice) {
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, 'maxTouchPoints', {
        configurable: true,
        get() {
          return 5;
        },
      });
    });
  }

  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('app-header')).toBeVisible();
}

test.describe('Touch zoom lock', () => {
  test('locks viewport zoom on touch-capable devices', async ({ page }) => {
    await openApp(page, {
      touchDevice: true,
    });

    const viewportContent = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewportContent).toBe('width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no');

    const touchMoveResult = await page.evaluate(() => {
      const event = new Event('touchmove', {
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, 'touches', {
        configurable: true,
        value: [{ identifier: 1 }, { identifier: 2 }],
      });

      const dispatched = document.dispatchEvent(event);

      return {
        defaultPrevented: event.defaultPrevented,
        dispatched,
      };
    });

    expect(touchMoveResult.defaultPrevented).toBe(true);
    expect(touchMoveResult.dispatched).toBe(false);
  });

  test('keeps non-touch devices on the default viewport rules', async ({ page }) => {
    await openApp(page);

    const viewportContent = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewportContent).toBe('width=device-width, initial-scale=1.0');

    const touchMoveResult = await page.evaluate(() => {
      const event = new Event('touchmove', {
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, 'touches', {
        configurable: true,
        value: [{ identifier: 1 }, { identifier: 2 }],
      });

      const dispatched = document.dispatchEvent(event);

      return {
        defaultPrevented: event.defaultPrevented,
        dispatched,
      };
    });

    expect(touchMoveResult.defaultPrevented).toBe(false);
    expect(touchMoveResult.dispatched).toBe(true);
  });
});
