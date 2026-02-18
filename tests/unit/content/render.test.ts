import { afterEach, describe, expect, it } from 'vitest';
import {
  applyPostRendering,
  clearAllHiddenBadges,
  clearTemporaryReveals,
  ensureFloatingOptionsPanel,
  removeFloatingOptionsPanel
} from '../../../src/content/render';
import { ALL_CATEGORIES } from '../../../src/shared/schema';
import type { CategoryActions, FilterSettings, PostDecision, PostFeatures } from '../../../src/shared/types';

function createCategoryActions(action: 'show' | 'hide' = 'show'): CategoryActions {
  return ALL_CATEGORIES.reduce(
    (acc, category) => {
      acc[category] = action;
      return acc;
    },
    {} as CategoryActions
  );
}

function emptyReasonContext(): PostDecision['reasonContext'] {
  return {
    matchedKeyword: null,
    missingKeywords: [],
    matchedName: null,
    matchedConnectionLevel: null,
    matchedProfileType: null,
    ageLimitDays: null
  };
}

const settings: FilterSettings = {
  enabled: true,
  categoryActions: {
    ...createCategoryActions('show'),
    ad: 'hide'
  },
  showBadgeOnHidden: true,
  showInFeedOptionsPanel: true,
  includeKeywords: [],
  includeKeywordsAction: 'off',
  excludeKeywords: [],
  excludeKeywordsAction: 'off',
  hiddenNames: [],
  hiddenNamesAction: 'off',
  connectionLevelActions: {
    following: 'show',
    first: 'show',
    second: 'show',
    third_plus: 'show'
  },
  profileTypeActions: {
    individual: 'show',
    group: 'show',
    company: 'show',
    other: 'show'
  },
  ageFilter: { maxAgeDays: null, action: 'off' },
  debug: false,
  schemaVersion: 6
};

const hideDecision: PostDecision = {
  hide: true,
  reasons: ['category_match'],
  isUnknown: false,
  hiddenCategory: 'ad',
  reasonContext: emptyReasonContext()
};

function buildPost(): PostFeatures {
  const root = document.createElement('article');
  root.setAttribute('data-urn', 'urn:li:activity:test');
  document.body.appendChild(root);

  return {
    postId: 'urn:li:activity:test',
    root,
    hasTimestamp: false,
    ageHours: null,
    leadText: 'test',
    actorNames: [],
    connectionLevel: null,
    profileType: null,
    labels: new Set(['ad']),
    textContent: 'test',
    links: []
  };
}

afterEach(() => {
  clearTemporaryReveals();
  clearAllHiddenBadges();
  removeFloatingOptionsPanel();
  document.body.innerHTML = '';
});

describe('render temporary reveal lifecycle', () => {
  it('resets temporary reveal when clearTemporaryReveals is called', () => {
    const post = buildPost();

    applyPostRendering(post, hideDecision, settings);
    expect(post.root.classList.contains('cleanedin-hidden')).toBe(true);
    expect(document.querySelector('.cleanedin-badge span')?.textContent).toBe('Post hidden: ads/promoted');

    const badgeButton = document.querySelector<HTMLButtonElement>('.cleanedin-badge button');
    expect(badgeButton).not.toBeNull();
    badgeButton?.click();

    applyPostRendering(post, hideDecision, settings);
    expect(post.root.classList.contains('cleanedin-hidden')).toBe(false);

    clearTemporaryReveals();
    applyPostRendering(post, hideDecision, settings);
    expect(post.root.classList.contains('cleanedin-hidden')).toBe(true);

    post.root.remove();
  });

  it('renders category badge with actor name for reactions', () => {
    const post = buildPost();
    post.labels = new Set(['liked']);
    post.actorNames = ['Jane Doe'];

    const decision: PostDecision = {
      hide: true,
      reasons: ['category_match'],
      isUnknown: false,
      hiddenCategory: 'liked',
      reasonContext: emptyReasonContext()
    };

    applyPostRendering(post, decision, settings);
    expect(document.querySelector('.cleanedin-badge span')?.textContent).toBe('Post hidden: liked by Jane Doe');

    post.root.remove();
  });

  it('renders connection-level badge context for following authors filter', () => {
    const post = buildPost();
    post.connectionLevel = 'following';

    const decision: PostDecision = {
      hide: true,
      reasons: ['connection_level_match'],
      isUnknown: false,
      hiddenCategory: null,
      reasonContext: {
        ...emptyReasonContext(),
        matchedConnectionLevel: 'following'
      }
    };

    applyPostRendering(post, decision, settings);
    expect(document.querySelector('.cleanedin-badge span')?.textContent).toBe('Post hidden (following)');

    post.root.remove();
  });

  it('renders keyword and name context in badges', () => {
    const post = buildPost();

    const keywordDecision: PostDecision = {
      hide: true,
      reasons: ['exclude_keyword_match'],
      isUnknown: false,
      hiddenCategory: null,
      reasonContext: {
        ...emptyReasonContext(),
        matchedKeyword: 'crypto'
      }
    };

    applyPostRendering(post, keywordDecision, settings);
    expect(document.querySelector('.cleanedin-badge span')?.textContent).toBe('Post hidden (keyword: "crypto")');

    const nameDecision: PostDecision = {
      hide: true,
      reasons: ['hidden_name_match'],
      isUnknown: false,
      hiddenCategory: null,
      reasonContext: {
        ...emptyReasonContext(),
        matchedName: 'acme inc'
      }
    };

    applyPostRendering(post, nameDecision, settings);
    expect(document.querySelector('.cleanedin-badge span')?.textContent).toBe('Post hidden (name: Acme Inc)');

    post.root.remove();
  });
});


describe('floating options panel', () => {


  it('mounts as the last box inside the left rail stack', () => {
    const originalChrome = globalThis.chrome;
    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: {
        runtime: {
          getURL: (path: string) => `chrome-extension://test/${path}`
        }
      }
    });

    const main = document.createElement('main');
    const rightAside = document.createElement('aside');
    rightAside.className = 'scaffold-layout__aside';
    rightAside.innerHTML = `<div class="artdeco-card"></div>`;

    const leftSidebar = document.createElement('div');
    leftSidebar.className = 'scaffold-layout__sidebar';
    leftSidebar.innerHTML = `
      <div class="scaffold-layout__sticky">
        <div class="rail-stack">
          <div class="artdeco-card" data-row="1"></div>
          <div class="artdeco-card" data-row="2"></div>
          <div class="artdeco-card" data-row="3"></div>
          <a href="https://www.linkedin.com/in/jane-doe/">Jane Doe</a>
          <a href="https://www.linkedin.com/groups/">Groups</a>
          <a href="https://www.linkedin.com/events/">Events</a>
          <a href="https://www.linkedin.com/newsletters/">Newsletters</a>
        </div>
      </div>
    `;

    main.append(leftSidebar, rightAside);
    document.body.appendChild(main);

    ensureFloatingOptionsPanel();

    const stack = leftSidebar.querySelector('.rail-stack');
    expect(stack?.lastElementChild?.id).toBe('cleanedin-floating-options');
    expect(stack?.querySelector('#cleanedin-floating-options')?.getAttribute('data-mount')).toBe('rail');
    expect(rightAside.querySelector('#cleanedin-floating-options')).toBeNull();

    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: originalChrome
    });
  });

  it('falls back to signal-based rail placement when scaffold classes are absent', () => {
    const originalChrome = globalThis.chrome;
    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: {
        runtime: {
          getURL: (path: string) => `chrome-extension://test/${path}`
        }
      }
    });

    document.body.innerHTML = `
      <main>
        <div id="layout">
          <div id="left-column">
            <div id="left-stack">
              <section id="card-1">
                <div data-view-name="identity-module">
                  <a href="https://www.linkedin.com/in/jane-doe/">Jane Doe</a>
                </div>
              </section>
              <section id="card-2">
                <a data-view-name="home-nav-left-rail-growth-widgets-profile-views" href="https://www.linkedin.com/me/profile-views/">
                  Profile viewers
                </a>
              </section>
              <section id="card-3">
                <a data-view-name="home-nav-left-rail-common-module-groups" href="https://www.linkedin.com/groups/">
                  Groups
                </a>
              </section>
            </div>
          </div>
        </div>
      </main>
    `;

    ensureFloatingOptionsPanel();

    const stack = document.getElementById('left-stack');
    expect(stack?.lastElementChild?.id).toBe('cleanedin-floating-options');
    expect(stack?.querySelector('#cleanedin-floating-options')?.getAttribute('data-mount')).toBe('rail');

    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: originalChrome
    });
  });

  it('does not render a header visibility switch in embedded mode', () => {
    const originalChrome = globalThis.chrome;
    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: {
        runtime: {
          getURL: (path: string) => `chrome-extension://test/${path}`
        }
      }
    });

    ensureFloatingOptionsPanel();

    const panel = document.getElementById('cleanedin-floating-options');
    expect(panel).not.toBeNull();
    expect(panel?.querySelector('input[type="checkbox"]')).toBeNull();

    removeFloatingOptionsPanel();
    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: originalChrome
    });
  });
});
