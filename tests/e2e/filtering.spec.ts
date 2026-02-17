import { expect, test, type Locator, type Page } from '@playwright/test';
import { launchExtensionSession } from './helpers/extension';
import { startFixtureServer } from './helpers/server';

const CATEGORIES = [
  'ad',
  'suggested',
  'recommendation',
  'liked',
  'loved',
  'supported',
  'celebrated',
  'funny',
  'insightful',
  'commented',
  'followed',
  'shared',
  'video',
  'poll',
  'image',
  'link',
  'carousel'
] as const;

async function waitForSave(popup: Page): Promise<void> {
  await expect(popup.locator('#status')).toContainText(/Saved|Imported/);
}

async function setAction(button: Locator, value: 'Hide' | 'Show', popup: Page): Promise<void> {
  for (let i = 0; i < 3; i += 1) {
    const current = (await button.textContent())?.trim();
    if (current === value) {
      return;
    }

    await button.click();
    await waitForSave(popup);
  }

  throw new Error(`Unable to set action switch to ${value}`);
}

async function setCategoryActions(
  popup: Page,
  target: Partial<Record<(typeof CATEGORIES)[number], 'Hide' | 'Show'>>
): Promise<void> {
  for (const category of CATEGORIES) {
    const next = target[category] ?? 'Show';
    await setAction(popup.locator(`button[data-category="${category}"]`), next, popup);
  }
}

async function setCheckedIfChanged(popup: Page, selector: string, checked: boolean): Promise<void> {
  const input = popup.locator(selector);
  const current = await input.isChecked();
  if (current === checked) {
    return;
  }

  if (checked) {
    await input.check();
  } else {
    await input.uncheck();
  }

  await waitForSave(popup);
}

async function waitForFeedProcessing(feed: Page): Promise<void> {
  await expect
    .poll(async () => feed.evaluate(() => document.documentElement?.getAttribute('data-cleanedin-content-boot') ?? ''), {
      timeout: 10000
    })
    .toBe('1');

  await expect
    .poll(
      async () => feed.evaluate(() => Number(document.documentElement?.getAttribute('data-cleanedin-observed-posts') ?? '0')),
      { timeout: 15000 }
    )
    .toBeGreaterThan(0);
}

test('show/hide action switches control filtering and temporary reveal works end-to-end', async () => {
  const server = await startFixtureServer();
  const session = await launchExtensionSession();

  try {
    const popup = await session.context.newPage();
    await popup.goto(session.popupUrl);

    await popup.locator('button[data-category="ad"]').waitFor();
    await setCheckedIfChanged(popup, '#enabled', true);

    await setCategoryActions(popup, { ad: 'Show' });
    await setCategoryActions(popup, { ad: 'Hide' });

    const feed = await session.context.newPage();
    await feed.goto(`${server.baseUrl}/feed`);
    await waitForFeedProcessing(feed);

    await expect(feed.locator('#post-ad')).toHaveClass(/cleanedin-hidden/);
    await expect(feed.locator('#post-video')).not.toHaveClass(/cleanedin-hidden/);
    await expect(feed.locator('#post-unknown')).not.toHaveClass(/cleanedin-hidden/);

    await setCategoryActions(popup, { video: 'Hide' });

    await expect(feed.locator('#post-ad')).not.toHaveClass(/cleanedin-hidden/);
    await expect(feed.locator('#post-video')).toHaveClass(/cleanedin-hidden/);
    await expect(feed.locator('#post-unknown')).not.toHaveClass(/cleanedin-hidden/);

    const videoBadgeButton = feed.locator('#post-video').locator('xpath=preceding-sibling::*[1]//button');
    await expect(videoBadgeButton).toBeVisible();
    await videoBadgeButton.click();

    await expect(feed.locator('#post-video')).not.toHaveClass(/cleanedin-hidden/);

    await feed.reload();

    await expect(feed.locator('#post-video')).toHaveClass(/cleanedin-hidden/);
  } finally {
    await session.close();
    await server.close();
  }
});
