import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { classifyPost } from '../../src/content/classifier';
import { extractPostFeatures } from '../../src/content/extractor';

function loadFixture(name: string): HTMLElement {
  const html = readFileSync(resolve('tests/fixtures/feed', name), 'utf8');
  const container = document.createElement('div');
  container.innerHTML = html;

  const root = container.firstElementChild;
  if (!root || !(root instanceof HTMLElement)) {
    throw new Error(`Invalid fixture: ${name}`);
  }

  return root;
}

describe('classifier fixtures', () => {
  it('ad fixture has ad label', () => {
    const post = extractPostFeatures(loadFixture('ad-positive.html'));
    const result = classifyPost(post);
    expect(result.labels.has('ad')).toBe(true);
  });

  it('video fixture has video label', () => {
    const post = extractPostFeatures(loadFixture('video-positive.html'));
    const result = classifyPost(post);
    expect(result.labels.has('video')).toBe(true);
  });

  it('link fixture has link label', () => {
    const post = extractPostFeatures(loadFixture('link-positive.html'));
    const result = classifyPost(post);
    expect(result.labels.has('link')).toBe(true);
  });

  it('unknown fixture has no labels', () => {
    const post = extractPostFeatures(loadFixture('unknown-negative.html'));
    const result = classifyPost(post);
    expect(result.labels.size).toBe(0);
  });

  it('following fixture has followed label', () => {
    const post = extractPostFeatures(loadFixture('followed-following-positive.html'));
    const result = classifyPost(post);
    expect(result.labels.has('followed')).toBe(true);
  });
});
