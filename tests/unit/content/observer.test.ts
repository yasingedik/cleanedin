import { afterEach, describe, expect, it, vi } from 'vitest';
import { FeedObserver } from '../../../src/content/observer';

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('FeedObserver', () => {
  it('attaches when feed root appears after start', async () => {
    const onPosts = vi.fn<(roots: HTMLElement[]) => void>();

    const observer = new FeedObserver({
      getRoot: () => document.querySelector<HTMLElement>('#feed-root'),
      onPosts,
      debounceMs: 0
    });

    try {
      observer.start();

      const main = document.createElement('main');
      main.innerHTML = '<div id="feed-root"><article data-urn="urn:li:activity:1"></article></div>';
      document.body.appendChild(main);

      await wait(20);

      expect(onPosts).toHaveBeenCalled();
      const roots = onPosts.mock.calls.at(-1)?.[0] ?? [];
      expect(roots.some((root) => root.getAttribute('data-urn') === 'urn:li:activity:1')).toBe(true);
    } finally {
      observer.stop();
    }
  });

  it('reattaches when root detaches and a new root is mounted', async () => {
    const onPosts = vi.fn<(roots: HTMLElement[]) => void>();

    const observer = new FeedObserver({
      getRoot: () => document.querySelector<HTMLElement>('#feed-root'),
      onPosts,
      debounceMs: 0
    });

    try {
      const firstMain = document.createElement('main');
      firstMain.innerHTML = '<div id="feed-root"><article data-urn="urn:li:activity:first"></article></div>';
      document.body.appendChild(firstMain);

      observer.start();
      await wait(20);

      firstMain.remove();

      const secondMain = document.createElement('main');
      secondMain.innerHTML = '<div id="feed-root"><article data-urn="urn:li:activity:second"></article></div>';
      document.body.appendChild(secondMain);

      await wait(20);

      const allObserved = onPosts.mock.calls.flatMap((call) => call[0]).map((root) => root.getAttribute('data-urn'));
      expect(allObserved).toContain('urn:li:activity:first');
      expect(allObserved).toContain('urn:li:activity:second');
    } finally {
      observer.stop();
    }
  });
});
