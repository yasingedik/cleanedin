import { describe, expect, it } from 'vitest';
import { classifyPost } from '../../../src/content/classifier';
import { extractPostFeatures } from '../../../src/content/extractor';
import type { PostCategory } from '../../../src/shared/types';

function buildPost(html: string, attrs: Record<string, string> = {}) {
  const root = document.createElement('article');
  for (const [key, value] of Object.entries(attrs)) {
    root.setAttribute(key, value);
  }
  root.innerHTML = html;

  return extractPostFeatures(root);
}

describe('classifyPost', () => {
  it('labels ad/promoted posts as ad', () => {
    const post = buildPost('<div>Sponsored update for your business</div>', {
      'data-sponsored-update': 'true'
    });

    const result = classifyPost(post);
    expect(result.labels.has('ad')).toBe(true);
  });

  it('labels ad posts using sponsored tracking metadata', () => {
    const post = buildPost('<div>Tracking-wrapped sponsored post</div>', {
      'data-view-tracking-scope': '[{"breadcrumbType":"SPONSORED_UPDATE_SERVED"}]'
    });

    const result = classifyPost(post);
    expect(result.labels.has('ad')).toBe(true);
  });

  it('labels video posts by structure', () => {
    const post = buildPost('<video src="blob:test"></video>');
    const result = classifyPost(post);

    expect(result.labels.has('video')).toBe(true);
  });

  it('labels suggested posts from feed activity header text', () => {
    const post = buildPost('<p>Feed postSuggestedJane Doe • 3rd+2h • Follow</p>');
    const result = classifyPost(post);

    expect(result.labels.has('suggested')).toBe(true);
  });

  it('labels recommendation modules from feed activity header text', () => {
    const post = buildPost('<p>Feed postRecommended for youPerson OneFollowPerson TwoFollow</p>');
    const result = classifyPost(post);

    expect(result.labels.has('recommendation')).toBe(true);
  });

  it('labels each reaction activity variant as its own category', () => {
    const cases: Array<{ text: string; expected: PostCategory }> = [
      { text: 'likes this', expected: 'liked' },
      { text: 'loves this', expected: 'loved' },
      { text: 'supports this', expected: 'supported' },
      { text: 'celebrates this', expected: 'celebrated' },
      { text: 'celebrated this', expected: 'celebrated' },
      { text: 'finds this funny', expected: 'funny' },
      { text: 'finds this insightful', expected: 'insightful' }
    ];

    for (const { text, expected } of cases) {
      const post = buildPost(`<p>Feed postAlex ${text}Jordan • 2nd</p>`);
      const result = classifyPost(post);
      expect(result.labels.has(expected)).toBe(true);
    }
  });

  it('labels commented/shared posts from feed activity header text', () => {
    const commented = buildPost('<p>Feed postTaylor commented on thisMorgan • 2nd</p>');
    const shared = buildPost('<p>Feed postAcme Inc reposted thisRobin • 2nd</p>');

    expect(classifyPost(commented).labels.has('commented')).toBe(true);
    expect(classifyPost(shared).labels.has('shared')).toBe(true);
  });

  it('labels link posts with external links', () => {
    const post = buildPost('<a href="https://example.com/story">Story</a>');
    const result = classifyPost(post);

    expect(result.labels.has('link')).toBe(true);
  });

  it('returns low confidence for unknown posts', () => {
    const post = buildPost('<p>Pure text with no known structural signals.</p>');
    const result = classifyPost(post);

    expect(result.labels.size).toBe(0);
    expect(result.confidence).toBe('low');
  });

  it('does not classify ad using text-only matches', () => {
    const post = buildPost('<p>This is a sponsored promoted message.</p>');
    const result = classifyPost(post);

    expect(result.labels.has('ad')).toBe(false);
  });

  it('does not classify engagement categories from text-only content', () => {
    const post = buildPost('<p>Alice liked, commented, followed, and reposted this.</p>');
    const result = classifyPost(post);

    expect(result.labels.has('liked')).toBe(false);
    expect(result.labels.has('commented')).toBe(false);
    expect(result.labels.has('followed')).toBe(false);
    expect(result.labels.has('shared')).toBe(false);
  });

  it('avoids image classification on zero-dimension assets', () => {
    const post = buildPost('<img src=\"x.png\" width=\"0\" height=\"0\" />');
    const result = classifyPost(post);

    expect(result.labels.has('image')).toBe(false);
  });
});
