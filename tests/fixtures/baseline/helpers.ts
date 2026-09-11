import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { classifyPost } from '../../../src/content/classifier';
import { extractPostFeatures } from '../../../src/content/extractor';
import {
  DEFAULT_LOCAL_SETTINGS,
  DEFAULT_SYNC_SETTINGS,
  migrateLocalSettings,
  migrateSyncSettings
} from '../../../src/shared/schema';
import type { FilterSettings } from '../../../src/shared/types';

export function loadBaseline(name: string): void {
  document.body.innerHTML = readFileSync(
    resolve('tests/fixtures/baseline', name),
    'utf8'
  );
}

export function settings(patch: Partial<FilterSettings> = {}): FilterSettings {
  return {
    ...migrateSyncSettings({
      ...structuredClone(DEFAULT_SYNC_SETTINGS),
      ...patch
    }),
    ...migrateLocalSettings({
      ...structuredClone(DEFAULT_LOCAL_SETTINGS),
      ...patch
    })
  };
}

export function features(root: HTMLElement, featureRoot = root) {
  const post = extractPostFeatures(root, featureRoot);
  post.labels = classifyPost(post).labels;
  return post;
}

export function element(selector: string): HTMLElement {
  const root = document.querySelector<HTMLElement>(selector);
  if (!root) throw new Error(`Missing fixture element: ${selector}`);
  return root;
}
