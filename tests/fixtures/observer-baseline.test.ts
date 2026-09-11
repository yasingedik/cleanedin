import { afterEach, expect, it, vi } from 'vitest';
import { FeedObserver } from '../../src/content/observer';
import { decidePostVisibility } from '../../src/content/decision';
import {
  applyPostRendering,
  clearTemporaryReveals
} from '../../src/content/render';
import { element, features, settings } from './baseline/helpers';

afterEach(() => {
  document.body.innerHTML = '';
  clearTemporaryReveals();
  vi.useRealTimers();
});

it('records missing attribute/text invalidation until an element is inserted (#29)', async () => {
  vi.useFakeTimers();
  document.body.innerHTML =
    '<main><article data-urn="urn:li:activity:7001"><p>Plain fixture</p></article></main>';
  const config = settings({
    excludeKeywordsAction: 'hide',
    excludeKeywords: ['blocked']
  });
  let evaluations = 0;
  const observer = new FeedObserver({
    getRoot: () => element('main'),
    onPosts: (roots) => {
      for (const root of roots) {
        evaluations += 1;
        const post = features(root);
        applyPostRendering(post, decidePostVisibility(post, config), config);
      }
    }
  });
  try {
    observer.start();
    await vi.advanceTimersByTimeAsync(160);
    const initial = evaluations;
    expect(initial).toBeGreaterThan(0);
    const root = element('article');
    root.setAttribute('data-sponsored-update', 'true');
    element('p').firstChild!.textContent = 'Blocked fixture';
    await vi.advanceTimersByTimeAsync(160);
    // This is a known limitation, not the desired #29 behavior.
    expect(evaluations).toBe(initial);
    expect(root.classList.contains('cleanedin-hidden')).toBe(false);
    expect(decidePostVisibility(features(root), config).hide).toBe(true);
    root.append(document.createElement('span'));
    await vi.advanceTimersByTimeAsync(160);
    expect(evaluations).toBeGreaterThan(initial);
    expect(root.classList.contains('cleanedin-hidden')).toBe(true);
  } finally {
    observer.stop();
  }
});
