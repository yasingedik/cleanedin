import { expect, test, type Page } from '@playwright/test';
import { launchExtensionSession } from './helpers/extension';
import { startFixtureServer } from './helpers/server';

async function openSection(page: Page, key: string) {
  const section = page.locator(`details[data-section-key="${key}"]`);
  if (!(await section.evaluate((node) => (node as HTMLDetailsElement).open))) {
    await section.locator('summary').click();
  }
}

async function stored(page: Page) {
  return page.evaluate(async () => ({
    sync: await chrome.storage.sync.get(null),
    local: await chrome.storage.local.get(null)
  }));
}

test('keyword input changes real filtering and persists through popup reopen and export', async () => {
  const server = await startFixtureServer();
  const session = await launchExtensionSession();
  try {
    const popup = await session.context.newPage();
    await popup.goto(session.popupUrl);
    await expect(popup.locator('#enabled')).toBeChecked();
    await openSection(popup, 'keywords');
    await popup.locator('#excludeKeywords').fill('  PLAIN  \nplain\n');
    await popup.locator('#excludeKeywords').press('Tab');
    await expect
      .poll(async () => (await stored(popup)).local.excludeKeywords)
      .toEqual(['plain']);
    await popup.locator('#excludeKeywordsAction').click();
    await expect
      .poll(async () => (await stored(popup)).local.excludeKeywordsAction)
      .toBe('hide');

    const feed = await session.context.newPage();
    await feed.goto(`${server.baseUrl}/feed`);
    await expect(feed.locator('#post-unknown')).toHaveClass(/cleanedin-hidden/);
    await expect(feed.locator('#post-unknown')).toBeHidden();
    await expect(
      feed.locator('#post-unknown').locator('xpath=preceding-sibling::*[1]')
    ).toContainText('keyword: "plain"');
    await popup.close();
    const reopened = await session.context.newPage();
    await reopened.goto(session.popupUrl);
    await openSection(reopened, 'keywords');
    await expect(reopened.locator('#excludeKeywords')).toHaveValue('plain');
    await expect(reopened.locator('#excludeKeywordsAction')).toHaveText('Hide');

    await openSection(reopened, 'data');
    const downloaded = reopened.waitForEvent('download');
    await reopened.locator('#exportBtn').click();
    const download = await downloaded;
    const stream = await download.createReadStream();
    if (!stream) throw new Error('Missing settings export stream');
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    const exported = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    expect(exported).toMatchObject({
      schemaVersion: 6,
      excludeKeywords: ['plain'],
      excludeKeywordsAction: 'hide'
    });

    await openSection(reopened, 'power');
    await reopened.locator('#enabled').uncheck();
    await expect
      .poll(async () => (await stored(reopened)).sync.enabled)
      .toBe(false);
    await expect(feed.locator('#post-unknown')).not.toHaveClass(
      /cleanedin-hidden/
    );
    await expect(feed.locator('#post-ad')).not.toHaveClass(/cleanedin-hidden/);
    await expect(feed.locator('#post-unknown')).toBeVisible();
    await expect(feed.locator('.cleanedin-badge')).toHaveCount(0);
  } finally {
    await session.close();
    await server.close();
  }
});

test('imported values persist and render safely; invalid JSON leaves settings intact', async () => {
  const server = await startFixtureServer();
  const session = await launchExtensionSession();
  try {
    const popup = await session.context.newPage();
    await popup.goto(session.popupUrl);
    await expect(popup.locator('#enabled')).toBeChecked();
    const payload = '<img src=x onerror=alert(1)>';
    await popup.locator('#importFile').setInputFiles({
      name: 'synthetic-settings.json',
      mimeType: 'application/json',
      buffer: Buffer.from(
        JSON.stringify({
          excludeKeywords: [payload, payload, null, 7],
          excludeKeywordsAction: 'hide',
          hiddenNames: ['Fixture Mention'],
          hiddenNamesAction: 'hide'
        })
      )
    });
    await expect(popup.locator('#status')).toHaveText('Imported');
    await expect
      .poll(async () => (await stored(popup)).local.excludeKeywords)
      .toEqual([payload]);
    const saved = await stored(popup);
    await popup.reload();
    await openSection(popup, 'keywords');
    await expect(popup.locator('#excludeKeywords')).toHaveValue(payload);
    await openSection(popup, 'identity');
    await expect(popup.locator('#hiddenNames')).toHaveValue('fixture mention');

    const feed = await session.context.newPage();
    let dialogs = 0;
    feed.on('dialog', async (dialog) => {
      dialogs += 1;
      await dialog.dismiss();
    });
    await feed.goto(`${server.baseUrl}/feed`);
    await expect(feed.locator('#post-ad')).toHaveClass(/cleanedin-hidden/);
    await feed.evaluate((text) => {
      const post = document.createElement('article');
      post.id = 'literal-payload';
      post.setAttribute('data-urn', 'urn:li:activity:9002');
      post.textContent = text;
      document.querySelector('#feed-root')!.append(post);
    }, payload);
    const post = feed.locator('#literal-payload');
    await expect(post).toHaveClass(/cleanedin-hidden/);
    await expect(post).toBeHidden();
    const badge = post.locator('xpath=preceding-sibling::*[1]');
    await expect(badge.locator('span')).toHaveText(
      `Post hidden (keyword: "${payload}")`
    );
    await expect(badge.locator('img, svg, script, [onerror]')).toHaveCount(0);
    await badge.getByRole('button', { name: 'Show once' }).click();
    await expect(post).not.toHaveClass(/cleanedin-hidden/);
    await expect(post).toBeVisible();
    expect(dialogs).toBe(0);

    await popup.locator('#importFile').setInputFiles({
      name: 'invalid.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{invalid')
    });
    await expect(popup.locator('#status')).toHaveText('Invalid settings file');
    expect(await stored(popup)).toEqual(saved);
  } finally {
    await session.close();
    await server.close();
  }
});
