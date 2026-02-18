import { afterEach, describe, expect, it } from 'vitest';
import { findPostRoots, findPostTargets, isPostRootNode, resolveFeedRoot } from '../../../src/content/feed-root';

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

  it('accepts list-item post containers when they contain update links and action controls', () => {
    document.body.innerHTML = `
      <main>
        <div data-testid="mainFeed">
          <ul>
            <li id="li-post">
              <div>
                <a href="/feed/update/urn:li:activity:300">View post</a>
                <div>
                  This compact layout still represents a feed post container even when article/data-urn wrappers are absent.
                </div>
                <button>Like</button>
                <button>Comment</button>
                <button>Repost</button>
              </div>
            </li>
          </ul>
        </div>
      </main>
    `;

    const feedRoot = resolveFeedRoot(document);
    const roots = findPostRoots(feedRoot as HTMLElement);

    expect(roots.some((root) => root.id === 'li-post')).toBe(true);
  });

  it('accepts compact list-item post containers with update and actor links', () => {
    document.body.innerHTML = `
      <main>
        <div data-testid="mainFeed">
          <ul>
            <li id="li-post-compact">
              <a href="/in/sample-person">Sample Person</a>
              <a href="/feed/update/urn:li:activity:301">View update</a>
              <span>1h</span>
            </li>
          </ul>
        </div>
      </main>
    `;

    const feedRoot = resolveFeedRoot(document);
    const roots = findPostRoots(feedRoot as HTMLElement);

    expect(roots.some((root) => root.id === 'li-post-compact')).toBe(true);
  });

  it('ignores update links inside left rail modules', () => {
    document.body.innerHTML = `
      <main>
        <div class="scaffold-layout__sidebar">
          <ul>
            <li id="rail-li">
              <a href="/feed/update/urn:li:activity:rail">Rail update link</a>
              <button>Like</button>
            </li>
          </ul>
        </div>
        <div data-testid="mainFeed">
          <ul>
            <li id="feed-li">
              <a href="/in/sample-person">Sample Person</a>
              <a href="/feed/update/urn:li:activity:302">Feed update</a>
              <button>Like</button>
              <button>Comment</button>
            </li>
          </ul>
        </div>
      </main>
    `;

    const feedRoot = resolveFeedRoot(document);
    const roots = findPostRoots(feedRoot as HTMLElement);

    expect(roots.some((root) => root.id === 'rail-li')).toBe(false);
    expect(roots.some((root) => root.id === 'feed-li')).toBe(true);
  });

  it('prefers outer listitem container over nested feed-* nodes in listitem layouts', () => {
    document.body.innerHTML = `
      <main>
        <div data-testid="mainFeed">
          <div role="listitem" id="li-shell">
            <div data-view-name="feed-full-update" id="post-root">
              <a href="/in/sample-person">Sample Person <span>• Following</span></a>
              <p data-view-name="feed-commentary" id="nested-commentary">
                Text with <a href="/feed/update/urn:li:activity:777">permalink</a>
              </p>
              <button aria-label="Like">Like</button>
              <button aria-label="Comment">Comment</button>
            </div>
          </div>
        </div>
      </main>
    `;

    const feedRoot = resolveFeedRoot(document);
    const roots = findPostRoots(feedRoot as HTMLElement);

    expect(roots.some((root) => root.id === 'li-shell')).toBe(true);
    expect(roots.some((root) => root.id === 'post-root')).toBe(false);
    expect(roots.some((root) => root.id === 'nested-commentary')).toBe(false);
  });

  it('maps outer listitem as render root and feed-full-update as feature root', () => {
    document.body.innerHTML = `
      <main>
        <div data-testid="mainFeed">
          <div role="listitem" id="outer-shell">
            <div data-view-name="feed-full-update" id="inner-feature">
              <a href="/in/sample-person">Sample Person</a>
              <p>Post content body</p>
              <button aria-label="Like">Like</button>
              <button aria-label="Comment">Comment</button>
            </div>
          </div>
        </div>
      </main>
    `;

    const feedRoot = resolveFeedRoot(document);
    const targets = findPostTargets(feedRoot as HTMLElement);
    const match = targets.find((target) => target.featureRoot.id === 'inner-feature');

    expect(match?.renderRoot.id).toBe('outer-shell');
    expect(match?.featureRoot.id).toBe('inner-feature');
  });

  it('does not classify nested recommendation listitems as independent post roots', () => {
    document.body.innerHTML = `
      <main>
        <div data-testid="mainFeed">
          <div role="listitem" id="outer-post">
            <div data-view-name="feed-full-update">
              <a href="/in/sample-person">Sample Person</a>
              <p>Primary post content.</p>
              <button aria-label="Like">Like</button>
              <button aria-label="Comment">Comment</button>
            </div>

            <ul>
              <li role="listitem" id="nested-follow-card">
                <a data-view-name="feed-actor" href="/in/recommended-person">Recommended Person</a>
                <button>Follow</button>
              </li>
            </ul>
          </div>
        </div>
      </main>
    `;

    const feedRoot = resolveFeedRoot(document);
    const roots = findPostRoots(feedRoot as HTMLElement);

    expect(roots.some((root) => root.id === 'outer-post')).toBe(true);
    expect(roots.some((root) => root.id === 'nested-follow-card')).toBe(false);
  });

  it('treats only the actual post container as a post root node', () => {
    document.body.innerHTML = `
      <main>
        <div data-testid="mainFeed">
          <div role="listitem" id="li-shell">
            <div data-view-name="feed-full-update" id="post-root">
              <p data-view-name="feed-commentary" id="nested-commentary">
                Inner content
              </p>
            </div>
          </div>
        </div>
      </main>
    `;

    const listItemRoot = document.getElementById('li-shell');
    const postRoot = document.getElementById('post-root');
    const nestedCommentary = document.getElementById('nested-commentary');

    expect(listItemRoot).not.toBeNull();
    expect(postRoot).not.toBeNull();
    expect(nestedCommentary).not.toBeNull();
    expect(isPostRootNode(listItemRoot as HTMLElement)).toBe(true);
    expect(isPostRootNode(postRoot as HTMLElement)).toBe(false);
    expect(isPostRootNode(nestedCommentary as HTMLElement)).toBe(false);
  });
});
