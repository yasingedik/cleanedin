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

  it('labels promoted company posts using lead markers when structural ad attrs are absent', () => {
    const post = buildPost(`
      <a href="https://www.linkedin.com/company/example-industry-group/posts/">Example Industry Group</a>
      <p>710,237 followers</p>
      <p>Promoted</p>
      <a data-view-name="feed-call-to-action" href="https://example.com">Learn more</a>
    `);

    const result = classifyPost(post);
    expect(result.labels.has('ad')).toBe(true);
  });

  it('labels promoted company video post when promoted marker appears in header row', () => {
    const post = buildPost(`
      <div data-view-name="feed-full-update">
        <div>
          <a data-view-name="feed-actor-image" href="https://www.linkedin.com/company/example-student-finance/posts/">Example Student Finance</a>
          <a href="https://www.linkedin.com/company/example-student-finance/posts/">
            <p>Example Student Finance</p>
            <p>28,779 followers</p>
            <p>Promoted</p>
          </a>
          <button data-view-name="feed-control-menu" aria-label="View more options">More</button>
        </div>
        <p data-view-name="feed-commentary">$2,000 Scholarship - No Essay!</p>
        <video src="blob:test"></video>
        <a data-view-name="feed-call-to-action" href="https://example.com/lp/scholarships-core?utm_source=linkedin">Apply</a>
      </div>
    `);

    const result = classifyPost(post);
    expect(result.labels.has('ad')).toBe(true);
  });

  it('labels promoted company post with follow-action header variant', () => {
    const post = buildPost(`
      <div data-view-name="feed-full-update">
        <div>
          <a data-view-name="feed-actor-image" href="https://www.linkedin.com/company/example-ops-partners/posts/">Example Ops Partners</a>
          <a href="https://www.linkedin.com/company/example-ops-partners/posts/">
            <p>Example Ops Partners</p>
            <p>1,405 followers</p>
            <p>Promoted</p>
          </a>
          <div data-view-name="edge-creation-follow-action"><button>Follow</button></div>
          <button data-view-name="feed-control-menu" aria-label="View more options">More</button>
        </div>
        <p data-view-name="feed-commentary">Leadership update post copy.</p>
      </div>
    `);

    const result = classifyPost(post);
    expect(result.labels.has('ad')).toBe(true);
  });

  it('labels promoted post when header words collapse without whitespace separators', () => {
    const post = buildPost(`
      <div data-view-name="feed-full-update">
        <div data-view-name="feed-actor">
          <a data-view-name="feed-actor-image" href="https://www.linkedin.com/company/example-growth-lab/posts/">Example Growth Lab</a>
          <a href="https://www.linkedin.com/company/example-growth-lab/posts/">
            <span>Example Growth Lab</span><span>5,441 followers</span><span>Promoted</span>
          </a>
          <button data-view-name="feed-control-menu" aria-label="View more options">More</button>
        </div>
        <p data-view-name="feed-commentary">Leadership update.</p>
      </div>
    `);

    const result = classifyPost(post);
    expect(result.labels.has('ad')).toBe(true);
  });

  it('labels video posts by structure', () => {
    const post = buildPost('<video src="blob:test"></video>');
    const result = classifyPost(post);

    expect(result.labels.has('video')).toBe(true);
  });

  it('labels suggested posts from feed activity header text', () => {
    const post = buildPost('<p>Feed postSuggestedSample Person • 3rd+2h • Follow</p>');
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

  it('labels reaction activity without feedpost prefix when header context exists', () => {
    const post = buildPost(
      '<div>Sample Person liked this • 2h</div><time datetime="2026-02-17T10:00:00.000Z">2h</time><button aria-label="Like">Like</button>'
    );
    const result = classifyPost(post);

    expect(result.labels.has('liked')).toBe(true);
  });

  it('labels liked activity when other-connections header text is compacted', () => {
    const post = buildPost(`
      <div data-view-name="feed-full-update">
        <div data-view-name="feed-header">
          <span>Feed postAlex and 2 other connections</span><span>liked</span><span>thisJamie • 2nd</span>
        </div>
        <p data-view-name="feed-commentary">Interesting article.</p>
      </div>
    `);

    const result = classifyPost(post);
    expect(result.labels.has('liked')).toBe(true);
  });

  it('labels commented/shared posts from feed activity header text', () => {
    const commented = buildPost('<p>Feed postTaylor commented on thisMorgan • 2nd</p>');
    const shared = buildPost('<p>Feed postAcme Inc reposted thisRobin • 2nd</p>');

    expect(classifyPost(commented).labels.has('commented')).toBe(true);
    expect(classifyPost(shared).labels.has('shared')).toBe(true);
  });

  it('labels follows activity when feed header text indicates actor follows another profile', () => {
    const post = buildPost(`
      <div data-view-name="feed-full-update">
        <div data-view-name="feed-header">
          <a data-view-name="feed-header-text" href="https://www.linkedin.com/in/sample-person/"><strong>SAMPLE PERSON</strong></a>
          follows
          <a data-view-name="feed-header-text" href="https://www.linkedin.com/company/example-advisory/posts/"><strong>Example Advisory</strong></a>
        </div>
        <p data-view-name="feed-commentary">Follow us for clear, data-driven consultancy.</p>
      </div>
    `);
    const result = classifyPost(post);

    expect(result.labels.has('followed')).toBe(true);
  });

  it('labels follows activity when follows marker is compacted in actor header text', () => {
    const post = buildPost(`
      <div data-view-name="feed-full-update">
        <div data-view-name="feed-actor">
          <span>Sample Person</span><span>follows</span><span>Example Advisory</span>
        </div>
        <p data-view-name="feed-commentary">Follow us for updates.</p>
      </div>
    `);
    const result = classifyPost(post);

    expect(result.labels.has('followed')).toBe(true);
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

  it('does not classify organic company post that mentions promoted only in commentary', () => {
    const post = buildPost(`
      <div data-view-name="feed-full-update">
        <div>
          <a data-view-name="feed-actor-image" href="https://www.linkedin.com/company/exampleco/posts/">Example Co</a>
          <a href="https://www.linkedin.com/company/exampleco/posts/">
            <p>Example Co</p>
            <p>12,000 followers</p>
          </a>
          <button data-view-name="feed-control-menu" aria-label="View more options">More</button>
        </div>
        <p data-view-name="feed-commentary">Our team was promoted for outstanding delivery.</p>
      </div>
    `);
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

  it('does not classify followed from plain body copy containing follow language', () => {
    const post = buildPost('<p>Follow us for updates. What follows next is a product walkthrough.</p>');
    const result = classifyPost(post);

    expect(result.labels.has('followed')).toBe(false);
  });

  it('avoids image classification on zero-dimension assets', () => {
    const post = buildPost('<img src=\"x.png\" width=\"0\" height=\"0\" />');
    const result = classifyPost(post);

    expect(result.labels.has('image')).toBe(false);
  });
});
