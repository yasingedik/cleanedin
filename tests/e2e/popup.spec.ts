import { test, expect, type Locator, type Page } from '@playwright/test';
import { launchExtensionSession } from './helpers/extension';

async function waitForSave(page: Page): Promise<void> {
  await expect(page.locator('#status')).toContainText(/Saved|Imported/);
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

async function ensureSectionOpen(page: Page, sectionKey: string): Promise<void> {
  const section = page.locator(`details[data-section-key="${sectionKey}"]`);
  await section.waitFor();

  const isOpen = await section.evaluate((node) => (node as HTMLDetailsElement).open);
  if (isOpen) {
    return;
  }

  await section.locator('summary').click();
}

test('popup settings persist across reopen', async () => {
  const session = await launchExtensionSession();

  try {
    const popup = await session.context.newPage();
    await popup.goto(session.popupUrl);

    await ensureSectionOpen(popup, 'power');
    await popup.locator('button[data-category="ad"]').waitFor();

    await popup.locator('#enabled').uncheck();
    await waitForSave(popup);

    await setAction(popup.locator('button[data-category="ad"]'), 'Show', popup);
    await ensureSectionOpen(popup, 'identity');
    await setAction(popup.locator('button[data-connection-level-action="following"]'), 'Hide', popup);

    await popup.close();

    const popupReloaded = await session.context.newPage();
    await popupReloaded.goto(session.popupUrl);

    await expect(popupReloaded.locator('#enabled')).not.toBeChecked();
    await expect(popupReloaded.locator('button[data-category="ad"]')).toHaveText('Show');
    await ensureSectionOpen(popupReloaded, 'identity');
    await expect(popupReloaded.locator('button[data-connection-level-action="following"]')).toHaveText('Hide');

    await popupReloaded.close();
  } finally {
    await session.close();
  }
});
