import { describe, expect, it } from 'vitest';
import { hasExternalLink } from '../../../../src/content/rules/helpers';
import type { PostCategory, PostFeatures } from '../../../../src/shared/types';

function buildPostWithLinks(links: string[]): PostFeatures {
  const root = document.createElement('article');

  return {
    postId: 'post-1',
    root,
    hasTimestamp: false,
    ageHours: null,
    leadText: '',
    actorNames: [],
    connectionLevel: null,
    profileType: null,
    labels: new Set<PostCategory>(),
    textContent: '',
    links
  };
}

describe('rules/helpers hasExternalLink', () => {
  it('returns false for linkedin root and subdomain hosts', () => {
    const post = buildPostWithLinks([
      'https://linkedin.com/feed/',
      'https://www.linkedin.com/in/example/',
      'https://jobs.linkedin.com/listings',
      'https://www.linkedin.com./feed/'
    ]);

    expect(hasExternalLink(post)).toBe(false);
  });

  it('returns true for non-linkedin hosts', () => {
    const post = buildPostWithLinks(['https://example.com/story']);

    expect(hasExternalLink(post)).toBe(true);
  });

  it('returns true for deceptive hosts containing linkedin.com as a substring', () => {
    const post = buildPostWithLinks([
      'https://www.linkedin.com.evil.example/path',
      'https://evil-linkedin.com/path'
    ]);

    expect(hasExternalLink(post)).toBe(true);
  });
});
