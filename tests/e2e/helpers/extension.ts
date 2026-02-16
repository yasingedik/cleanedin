import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { chromium, type BrowserContext } from '@playwright/test';

type Manifest = {
  host_permissions?: string[];
  content_scripts?: Array<{
    matches: string[];
    js: string[];
    run_at?: string;
  }>;
};

export interface ExtensionSession {
  context: BrowserContext;
  extensionId: string;
  popupUrl: string;
  close: () => Promise<void>;
}

function uniqueEntries(values: string[]): string[] {
  return [...new Set(values)];
}

function buildTestExtensionDir(): { extensionPath: string; userDataDir: string; cleanup: () => void } {
  const distPath = resolve('dist');
  if (!existsSync(distPath)) {
    throw new Error('dist/ not found. Run `npm run build` before e2e tests.');
  }

  const extensionPath = mkdtempSync(join(tmpdir(), 'cleanedin-extension-'));
  const userDataDir = mkdtempSync(join(tmpdir(), 'cleanedin-user-data-'));

  cpSync(distPath, extensionPath, { recursive: true });

  const manifestPath = resolve(extensionPath, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest;

  const testMatches = ['http://127.0.0.1/*', 'http://localhost/*'];
  manifest.host_permissions = uniqueEntries([...(manifest.host_permissions ?? []), ...testMatches]);

  manifest.content_scripts = (manifest.content_scripts ?? []).map((script) => ({
    ...script,
    matches: uniqueEntries([...(script.matches ?? []), ...testMatches])
  }));

  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  return {
    extensionPath,
    userDataDir,
    cleanup: () => {
      rmSync(extensionPath, { recursive: true, force: true });
      rmSync(userDataDir, { recursive: true, force: true });
    }
  };
}

export async function launchExtensionSession(): Promise<ExtensionSession> {
  const { extensionPath, userDataDir, cleanup } = buildTestExtensionDir();

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`]
  });

  let serviceWorker = context.serviceWorkers()[0];
  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent('serviceworker');
  }

  const extensionId = new URL(serviceWorker.url()).host;

  return {
    context,
    extensionId,
    popupUrl: `chrome-extension://${extensionId}/popup.html`,
    close: async () => {
      await context.close();
      cleanup();
    }
  };
}
