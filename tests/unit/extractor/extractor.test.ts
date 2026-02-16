import { describe, expect, it } from 'vitest';
import { extractPostFeatures, parseAgeHours } from '../../../src/content/extractor';

describe('parseAgeHours', () => {
  it('aggregates mixed relative tokens', () => {
    const ageHours = parseAgeHours('1w 2d 3h');

    expect(ageHours).toBe(24 * 7 + 24 * 2 + 3);
  });

  it('parses iso timestamps', () => {
    const ageHours = parseAgeHours('2020-01-01T00:00:00.000Z');

    expect(ageHours).not.toBeNull();
    expect(ageHours).toBeGreaterThan(24);
  });

  it('returns null for unknown timestamps', () => {
    expect(parseAgeHours('recently')).toBeNull();
  });
});

function createPostRoot(markup: string): HTMLElement {
  const container = document.createElement('div');
  container.innerHTML = markup.trim();
  const root = container.firstElementChild;
  if (!root || !(root instanceof HTMLElement)) {
    throw new Error('Invalid test markup');
  }

  return root;
}

describe('extractPostFeatures connection levels', () => {
  it('detects following from actor metadata', () => {
    const root = createPostRoot(`
      <article data-urn="urn:li:activity:1001">
        <div data-view-name="feed-actor">Jane Doe • Following • 2d</div>
        <p>Regular feed update text.</p>
      </article>
    `);

    const features = extractPostFeatures(root);
    expect(features.connectionLevel).toBe('following');
  });

  it('detects following when token has no bullet separators', () => {
    const root = createPostRoot(`
      <article data-urn="urn:li:activity:1003">
        <div data-view-name="feed-actor">Jane Doe Following 2d</div>
        <p>Regular feed update text.</p>
      </article>
    `);

    const features = extractPostFeatures(root);
    expect(features.connectionLevel).toBe('following');
  });

  it('does not treat plain body text as following connection level', () => {
    const root = createPostRoot(`
      <article data-urn="urn:li:activity:1002">
        <div data-view-name="feed-actor">Jane Doe • 2d</div>
        <p>I am following up next week with a hiring update.</p>
      </article>
    `);

    const features = extractPostFeatures(root);
    expect(features.connectionLevel).toBeNull();
  });
});

describe('extractPostFeatures profile type fallback', () => {
  it('defaults to individual when actor names are detected', () => {
    const root = createPostRoot(`
      <article data-urn="urn:li:activity:2001">
        <div data-view-name="feed-actor">Jane Doe • 2d</div>
        <p>Thoughts on product strategy.</p>
      </article>
    `);

    const features = extractPostFeatures(root);
    expect(features.profileType).toBe('individual');
  });
});
