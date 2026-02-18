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
        <div data-view-name="feed-actor">Sample Person • Following • 2d</div>
        <p>Regular feed update text.</p>
      </article>
    `);

    const features = extractPostFeatures(root);
    expect(features.connectionLevel).toBe('following');
  });

  it('detects following when token has no bullet separators', () => {
    const root = createPostRoot(`
      <article data-urn="urn:li:activity:1003">
        <div data-view-name="feed-actor">Sample Person Following 2d</div>
        <p>Regular feed update text.</p>
      </article>
    `);

    const features = extractPostFeatures(root);
    expect(features.connectionLevel).toBe('following');
  });

  it('does not treat plain body text as following connection level', () => {
    const root = createPostRoot(`
      <article data-urn="urn:li:activity:1002">
        <div data-view-name="feed-actor">Sample Person • 2d</div>
        <p>I am following up next week with a hiring update.</p>
      </article>
    `);

    const features = extractPostFeatures(root);
    expect(features.connectionLevel).toBeNull();
  });

  it('detects following from follow control aria-label when actor line omits following token', () => {
    const root = createPostRoot(`
      <article data-urn="urn:li:activity:1004">
        <div data-view-name="feed-actor">Sample Person • 2d</div>
        <button data-control-name="follow">Following Sample Person</button>
        <p>Regular feed update text.</p>
      </article>
    `);

    const features = extractPostFeatures(root);
    expect(features.connectionLevel).toBe('following');
  });

  it('detects following from unfollow control when follow control metadata is missing', () => {
    const root = createPostRoot(`
      <article data-urn="urn:li:activity:1004b">
        <div data-view-name="feed-actor">Sample Person • 2d</div>
        <button aria-label="Unfollow Sample Person">Following</button>
        <p>Regular feed update text.</p>
      </article>
    `);

    const features = extractPostFeatures(root);
    expect(features.connectionLevel).toBe('following');
  });

  it('does not treat plain follow button as already following', () => {
    const root = createPostRoot(`
      <article data-urn="urn:li:activity:1005">
        <div data-view-name="feed-actor">Sample Person • 2d</div>
        <button data-control-name="follow">Follow</button>
        <p>Regular feed update text.</p>
      </article>
    `);

    const features = extractPostFeatures(root);
    expect(features.connectionLevel).toBeNull();
  });

  it('detects following when actor text collapses with adjacent words', () => {
    const root = createPostRoot(`
      <article data-urn="urn:li:activity:1006">
        <div data-view-name="feed-actor">Sample Person A • FollowingExample Bank</div>
        <p>Starting a new position</p>
      </article>
    `);

    const features = extractPostFeatures(root);
    expect(features.connectionLevel).toBe('following');
  });

  it('detects following from profile link text without actor data-view-name attributes', () => {
    const root = createPostRoot(`
      <article data-urn="urn:li:activity:1007">
        <a href="https://www.linkedin.com/in/sample-person-a/">
          <p>Sample Person A<span> • Following</span></p>
          <p>Example Bank, Senior Vice President</p>
          <p>2w •</p>
        </a>
        <p>Starting a new position</p>
      </article>
    `);

    const features = extractPostFeatures(root);
    expect(features.connectionLevel).toBe('following');
  });

  it('prefers top-level author following signal over commenter connection labels', () => {
    const root = createPostRoot(`
      <article data-urn="urn:li:ugcPost:7422990358483214336">
        <div data-view-name="feed-full-update">
          <a href="https://www.linkedin.com/in/sample-author/">
            <p>Sample Author <span> • Following</span></p>
            <p>2w •</p>
          </a>
          <div data-testid="commentList">
            <div data-view-name="comment-container">
              <a href="https://www.linkedin.com/in/sample-commenter/">
                <p>Sample Commenter <span> • 3rd+</span></p>
                <p>2w</p>
              </a>
              <p>I am following up next week with a hiring update.</p>
            </div>
          </div>
        </div>
      </article>
    `);

    const contentRoot = root.querySelector<HTMLElement>('[data-view-name="feed-full-update"]');
    if (!contentRoot) {
      throw new Error('Missing content root');
    }

    const features = extractPostFeatures(root, contentRoot);
    expect(features.connectionLevel).toBe('following');
  });
});

describe('extractPostFeatures profile type fallback', () => {
  it('defaults to individual when actor names are detected', () => {
    const root = createPostRoot(`
      <article data-urn="urn:li:activity:2001">
        <div data-view-name="feed-actor">Sample Person • 2d</div>
        <p>Thoughts on product strategy.</p>
      </article>
    `);

    const features = extractPostFeatures(root);
    expect(features.profileType).toBe('individual');
  });
});
