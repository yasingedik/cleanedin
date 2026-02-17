import { afterEach, describe, expect, it } from 'vitest';
import { findPostRoots, resolveFeedRoot } from '../../../src/content/feed-root';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('feed root detection', () => {
  it('prefers mainFeed container over generic feed view-name nodes', () => {
    document.body.innerHTML = `
      <main>
        <button data-view-name="feed-nav-feed-sort-toggle">Sort</button>
        <div data-testid="mainFeed">
          <div data-view-tracking-scope='[{"breadcrumbType":"FEED_UPDATE_SERVED"}]'>
            <div data-view-name="feed-full-update">
              <a href="/feed/update/urn:li:activity:1">Post</a>
            </div>
          </div>
        </div>
      </main>
    `;

    const feedRoot = resolveFeedRoot(document);
    expect(feedRoot?.getAttribute('data-testid')).toBe('mainFeed');
  });

  it('finds tracked sponsored containers as post roots', () => {
    document.body.innerHTML = `
      <main>
        <div data-testid="mainFeed">
          <div data-view-tracking-scope='[{"breadcrumbType":"SPONSORED_UPDATE_SERVED"}]'>
            <div data-view-name="feed-full-update">
              <a href="/feed/update/urn:li:activity:1">Sponsored post</a>
              <time>1h</time>
              <button aria-label="Like">Like</button>
              <button aria-label="Comment">Comment</button>
            </div>
          </div>
        </div>
      </main>
    `;

    const feedRoot = resolveFeedRoot(document);
    expect(feedRoot).not.toBeNull();

    const roots = findPostRoots(feedRoot as HTMLElement);
    expect(roots.length).toBeGreaterThan(0);
    expect(
      roots.some((root) => (root.getAttribute('data-view-tracking-scope') ?? '').includes('SPONSORED_UPDATE_SERVED'))
    ).toBe(true);
  });

  it('does not treat cleanedin badges as post roots', () => {
    document.body.innerHTML = `
      <main>
        <div data-testid="mainFeed">
          <article data-urn="urn:li:activity:100">
            <time>1h</time>
            <a href="/in/jane">Jane</a>
            <button aria-label="Like">Like</button>
          </article>
          <div class="cleanedin-badge" data-cleanedin-ui="1">
            <span>Post hidden</span>
            <button type="button">Show once</button>
          </div>
        </div>
      </main>
    `;

    const feedRoot = resolveFeedRoot(document);
    const roots = findPostRoots(feedRoot as HTMLElement);

    expect(roots.some((root) => root.classList.contains('cleanedin-badge'))).toBe(false);
  });

  it('does not treat post action rows with update links as standalone roots', () => {
    document.body.innerHTML = `
      <main>
        <div data-testid="mainFeed">
          <article data-urn="urn:li:activity:200">
            <header>
              <a href="/in/john-doe">John Doe</a>
              <time>3h</time>
            </header>
            <p>Promoted content should hide as one full post container.</p>
            <div class="social-actions">
              <a href="/feed/update/urn:li:activity:200">1 comment</a>
              <button aria-label="Like">Like</button>
              <button aria-label="Comment">Comment</button>
              <button aria-label="Repost">Repost</button>
            </div>
          </article>
        </div>
      </main>
    `;

    const feedRoot = resolveFeedRoot(document);
    const roots = findPostRoots(feedRoot as HTMLElement);
    const actionRows = roots.filter((root) => root.classList.contains('social-actions'));
    const articleRoots = roots.filter((root) => root.matches('article'));

    expect(actionRows.length).toBe(0);
    expect(articleRoots.length).toBeGreaterThan(0);
  });

  it('keeps long tracked feed-update containers as post roots', () => {
    const longCommentText = 'comment '.repeat(2200);

    document.body.innerHTML = `
      <main>
        <div data-testid="mainFeed">
          <div id="tracked-post" data-view-tracking-scope='[{"breadcrumbType":"FEED_UPDATE_SERVED"}]'>
            <div data-view-name="feed-full-update">
              <a href="/in/mike-piccolo">Mike Piccolo</a>
              <span> • Following</span>
              <time>9h</time>
              <p>${longCommentText}</p>
              <button aria-label="Like">Like</button>
              <button aria-label="Comment">Comment</button>
              <button aria-label="Repost">Repost</button>
            </div>
          </div>
        </div>
      </main>
    `;

    const feedRoot = resolveFeedRoot(document);
    const roots = findPostRoots(feedRoot as HTMLElement);

    expect(roots.some((root) => root.id === 'tracked-post')).toBe(true);
  });
});
