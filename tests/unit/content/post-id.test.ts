import { describe, expect, it } from 'vitest';
import { derivePostIdentity, derivePostId } from '../../../src/content/post-id';

function createRoot(markup: string): HTMLElement {
  const container = document.createElement('div');
  container.innerHTML = markup.trim();
  const root = container.firstElementChild;
  if (!root || !(root instanceof HTMLElement)) {
    throw new Error('Invalid test markup');
  }

  return root;
}

describe('post identity derivation', () => {
  it('extracts canonical urn from feed update URLs', () => {
    const root = createRoot(`
      <div role="listitem">
        <div data-view-name="feed-full-update" id="feature">
          <a href="https://www.linkedin.com/feed/update/urn:li:ugcPost:7429393023018557441/?originTrackingId=abc123">Open</a>
        </div>
      </div>
    `);

    const feature = root.querySelector<HTMLElement>('#feature');
    expect(feature).not.toBeNull();

    const identity = derivePostIdentity(root, feature as HTMLElement);
    expect(identity.postId).toBe('urn:li:ugcPost:7429393023018557441');
    expect(identity.source).toBe('feed_update_url');
  });

  it('extracts urn from known componentkey patterns', () => {
    const root = createRoot(`
      <div role="listitem">
        <div data-view-name="feed-full-update" id="feature">
          <div componentkey="replaceableComment_urn:li:comment:(urn:li:ugcPost:7427082032855281664,7427416215230296066)"></div>
        </div>
      </div>
    `);

    const feature = root.querySelector<HTMLElement>('#feature');
    expect(feature).not.toBeNull();

    const identity = derivePostIdentity(root, feature as HTMLElement);
    expect(identity.postId).toBe('urn:li:ugcPost:7427082032855281664');
    expect(identity.source).toBe('componentkey');
  });

  it('ignores non-unique company posts urls as canonical ids', () => {
    const root = createRoot(`
      <div role="listitem">
        <div data-view-name="feed-full-update" id="feature">
          <a href="https://www.linkedin.com/company/example-co/posts/">Company posts</a>
          <p>Some post body content without stable identity attributes.</p>
        </div>
      </div>
    `);

    const feature = root.querySelector<HTMLElement>('#feature');
    expect(feature).not.toBeNull();

    const identity = derivePostIdentity(root, feature as HTMLElement);
    expect(identity.postId.startsWith('generated:')).toBe(true);
    expect(identity.source).toBe('fallback_hash');
  });

  it('keeps fallback hash stable across render-root noise changes', () => {
    const rootOne = createRoot(`
      <div role="listitem">
        <div class="volatile">View count 10</div>
        <div data-view-name="feed-full-update" id="feature-one">
          <a href="https://www.linkedin.com/in/sample-person/">Sample Person</a>
          <p data-view-name="feed-commentary">Stable feature content only.</p>
        </div>
      </div>
    `);

    const rootTwo = createRoot(`
      <div role="listitem">
        <div class="volatile">View count 999</div>
        <div data-view-name="feed-full-update" id="feature-two">
          <a href="https://www.linkedin.com/in/sample-person/">Sample Person</a>
          <p data-view-name="feed-commentary">Stable feature content only.</p>
        </div>
      </div>
    `);

    const featureOne = rootOne.querySelector<HTMLElement>('#feature-one');
    const featureTwo = rootTwo.querySelector<HTMLElement>('#feature-two');
    expect(featureOne).not.toBeNull();
    expect(featureTwo).not.toBeNull();

    const idOne = derivePostId(rootOne, featureOne as HTMLElement);
    const idTwo = derivePostId(rootTwo, featureTwo as HTMLElement);

    expect(idOne.startsWith('generated:')).toBe(true);
    expect(idOne).toBe(idTwo);
  });
});
