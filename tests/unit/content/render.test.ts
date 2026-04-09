import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  applyPostRendering,
  clearAllHiddenBadges,
  clearTemporaryReveals,
  ensureFloatingOptionsPanel,
  removeFloatingOptionsPanel
} from '../../../src/content/render';
import { ALL_CATEGORIES } from '../../../src/shared/schema';
import type { CategoryActions, FilterSettings, PostDecision, PostFeatures } from '../../../src/shared/types';

const FLOATING_PANEL_LAYOUT_STORAGE_KEY = 'cleanedin:floating-panel-layout:v1';
const localStorageState = new Map<string, string>();

beforeEach(() => {
  const storageMock = {
    getItem: (key: string): string | null => localStorageState.get(key) ?? null,
    setItem: (key: string, value: string): void => {
      localStorageState.set(key, String(value));
    },
    removeItem: (key: string): void => {
      localStorageState.delete(key);
    },
    clear: (): void => {
      localStorageState.clear();
    }
  };

  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: storageMock
  });
});

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

function buildPost(postId = 'urn:li:activity:test'): PostFeatures {
  const root = document.createElement('article');
  root.setAttribute('data-urn', postId);
  document.body.appendChild(root);

  return {
    postId,
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

function mockElementRect(element: HTMLElement, width: number, height = 400): void {
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: width,
      bottom: height,
      width,
      height,
      toJSON: () => ({})
    })
  });
}

afterEach(() => {
  clearTemporaryReveals();
  clearAllHiddenBadges();
  removeFloatingOptionsPanel();
  localStorageState.delete(FLOATING_PANEL_LAYOUT_STORAGE_KEY);
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
    post.actorNames = ['Sample Person'];

    const decision: PostDecision = {
      hide: true,
      reasons: ['category_match'],
      isUnknown: false,
      hiddenCategory: 'liked',
      reasonContext: emptyReasonContext()
    };

    applyPostRendering(post, decision, settings);
    expect(document.querySelector('.cleanedin-badge span')?.textContent).toBe('Post hidden: liked by Sample Person');

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

  it('keeps a single badge per hidden post across repeated renders', () => {
    const post = buildPost();

    applyPostRendering(post, hideDecision, settings);
    applyPostRendering(post, hideDecision, settings);

    expect(document.querySelectorAll('.cleanedin-badge').length).toBe(1);
    expect(post.root.classList.contains('cleanedin-hidden')).toBe(true);

    post.root.remove();
  });

  it('removes stale orphan badge when a post rerenders with the same post id', () => {
    const firstPost = buildPost('urn:li:activity:rerender');
    applyPostRendering(firstPost, hideDecision, settings);
    expect(document.querySelectorAll('.cleanedin-badge').length).toBe(1);

    firstPost.root.remove();

    const rerenderedRoot = document.createElement('article');
    rerenderedRoot.setAttribute('data-urn', 'urn:li:activity:rerender');
    document.body.appendChild(rerenderedRoot);
    const secondPost: PostFeatures = {
      ...firstPost,
      root: rerenderedRoot
    };

    applyPostRendering(secondPost, hideDecision, settings);

    const badges = document.querySelectorAll<HTMLElement>('.cleanedin-badge');
    expect(badges.length).toBe(1);
    expect(badges[0]?.nextElementSibling).toBe(rerenderedRoot);

    rerenderedRoot.remove();
  });

  it('preserves show once reveal across rerender for the same logical post id', () => {
    const firstPost = buildPost('urn:li:activity:show-once');
    applyPostRendering(firstPost, hideDecision, settings);
    const badgeButton = document.querySelector<HTMLButtonElement>('.cleanedin-badge button');
    expect(badgeButton).not.toBeNull();
    badgeButton?.click();
    expect(firstPost.root.classList.contains('cleanedin-hidden')).toBe(false);

    firstPost.root.remove();

    const rerenderedRoot = document.createElement('article');
    rerenderedRoot.setAttribute('data-urn', 'urn:li:activity:show-once');
    document.body.appendChild(rerenderedRoot);
    const secondPost: PostFeatures = {
      ...firstPost,
      root: rerenderedRoot
    };

    applyPostRendering(secondPost, hideDecision, settings);
    expect(rerenderedRoot.classList.contains('cleanedin-hidden')).toBe(false);

    clearTemporaryReveals();
    applyPostRendering(secondPost, hideDecision, settings);
    expect(rerenderedRoot.classList.contains('cleanedin-hidden')).toBe(true);

    rerenderedRoot.remove();
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
          <a href="https://www.linkedin.com/in/sample-person/">Sample Person</a>
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
    const thirdCard = stack?.querySelector('[data-row="3"]');
    expect(thirdCard).not.toBeNull();
    expect(thirdCard?.nextElementSibling?.id).toBe('cleanedin-floating-options');
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
                  <a href="https://www.linkedin.com/in/sample-person/">Sample Person</a>
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

  it('mounts fixed with persisted undocked layout even when a rail mount is available', () => {
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
        <div class="scaffold-layout__sidebar">
          <div class="scaffold-layout__sticky">
            <div class="rail-stack">
              <a href="https://www.linkedin.com/in/sample-person/">Sample Person</a>
              <a href="https://www.linkedin.com/groups/">Groups</a>
            </div>
          </div>
        </div>
      </main>
    `;

    window.localStorage.setItem(
      FLOATING_PANEL_LAYOUT_STORAGE_KEY,
      JSON.stringify({ undocked: true, left: 56, top: 96, width: 420, height: 500 })
    );

    ensureFloatingOptionsPanel();

    const panel = document.getElementById('cleanedin-floating-options');
    expect(panel?.getAttribute('data-mount')).toBe('fixed');
    expect(panel?.parentElement).toBe(document.body);
    expect(panel?.style.left).toBe('56px');
    expect(panel?.style.top).toBe('96px');
    expect(panel?.style.width).toBe('420px');
    expect(panel?.style.height).toBe('500px');

    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: originalChrome
    });
  });

  it('undocks and persists layout when dragging from the header', () => {
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
        <div class="scaffold-layout__sidebar">
          <div class="scaffold-layout__sticky">
            <div class="rail-stack">
              <a href="https://www.linkedin.com/in/sample-person/">Sample Person</a>
              <a href="https://www.linkedin.com/groups/">Groups</a>
            </div>
          </div>
        </div>
      </main>
    `;

    ensureFloatingOptionsPanel();

    const panel = document.getElementById('cleanedin-floating-options');
    const header = panel?.querySelector<HTMLElement>('.cleanedin-floating-options__header');
    expect(panel?.getAttribute('data-mount')).toBe('rail');
    expect(header).not.toBeNull();

    header?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 120, clientY: 120 }));
    window.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 200, clientY: 190 }));
    window.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: 200, clientY: 190 }));

    const persisted = JSON.parse(window.localStorage.getItem(FLOATING_PANEL_LAYOUT_STORAGE_KEY) ?? '{}') as {
      undocked?: boolean;
      left?: number;
      top?: number;
    };

    expect(panel?.getAttribute('data-mount')).toBe('fixed');
    expect(panel?.parentElement).toBe(document.body);
    expect(persisted.undocked).toBe(true);
    expect(typeof persisted.left).toBe('number');
    expect(typeof persisted.top).toBe('number');

    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: originalChrome
    });
  });

  it('undocks and persists size when resizing from the corner handle', () => {
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
        <div class="scaffold-layout__sidebar">
          <div class="scaffold-layout__sticky">
            <div class="rail-stack">
              <a href="https://www.linkedin.com/in/sample-person/">Sample Person</a>
              <a href="https://www.linkedin.com/groups/">Groups</a>
            </div>
          </div>
        </div>
      </main>
    `;

    ensureFloatingOptionsPanel();

    const panel = document.getElementById('cleanedin-floating-options');
    const handle = panel?.querySelector<HTMLElement>('.cleanedin-floating-options__resize-handle');
    expect(panel?.getAttribute('data-mount')).toBe('rail');
    expect(handle).not.toBeNull();

    handle?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 280, clientY: 380 }));
    window.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 360, clientY: 460 }));
    window.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: 360, clientY: 460 }));

    const persisted = JSON.parse(window.localStorage.getItem(FLOATING_PANEL_LAYOUT_STORAGE_KEY) ?? '{}') as {
      undocked?: boolean;
      width?: number;
      height?: number;
    };

    expect(panel?.getAttribute('data-mount')).toBe('fixed');
    expect(panel?.parentElement).toBe(document.body);
    expect(persisted.undocked).toBe(true);
    expect(typeof persisted.width).toBe('number');
    expect(typeof persisted.height).toBe('number');

    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: originalChrome
    });
  });

  it('docks back to the rail when Dock is clicked from fixed mode', () => {
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
        <div class="scaffold-layout__sidebar">
          <div class="scaffold-layout__sticky">
            <div class="rail-stack">
              <div class="artdeco-card" data-row="1"></div>
              <div class="artdeco-card" data-row="2"></div>
              <div class="artdeco-card" data-row="3"></div>
              <a href="https://www.linkedin.com/in/sample-person/">Sample Person</a>
              <a href="https://www.linkedin.com/groups/">Groups</a>
            </div>
          </div>
        </div>
      </main>
    `;

    window.localStorage.setItem(
      FLOATING_PANEL_LAYOUT_STORAGE_KEY,
      JSON.stringify({ undocked: true, left: 64, top: 120, width: 380, height: 500 })
    );

    ensureFloatingOptionsPanel();

    const panel = document.getElementById('cleanedin-floating-options');
    const dockButton = panel?.querySelector<HTMLButtonElement>('.cleanedin-floating-options__dock-btn');
    const leftSidebar = document.querySelector<HTMLElement>('.scaffold-layout__sidebar');
    const stack = document.querySelector<HTMLElement>('.rail-stack');

    expect(panel?.getAttribute('data-mount')).toBe('fixed');
    expect(dockButton?.hidden).toBe(false);

    if (leftSidebar) {
      leftSidebar.className = 'mutated-left-rail';
    }

    dockButton?.click();

    const persisted = JSON.parse(window.localStorage.getItem(FLOATING_PANEL_LAYOUT_STORAGE_KEY) ?? '{}') as { undocked?: boolean };
    const thirdCard = stack?.querySelector('[data-row="3"]');

    expect(panel?.getAttribute('data-mount')).toBe('rail');
    expect(panel?.parentElement).not.toBe(document.body);
    expect(thirdCard?.nextElementSibling?.id).toBe('cleanedin-floating-options');
    expect(persisted.undocked).toBe(false);

    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: originalChrome
    });
  });

  it('sizes the docked panel to the available rail width when returning from fixed mode', () => {
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
        <div class="scaffold-layout__sidebar">
          <div class="scaffold-layout__sticky">
            <div class="rail-stack">
              <div class="artdeco-card" data-row="1"></div>
              <div class="artdeco-card" data-row="2"></div>
              <div class="artdeco-card" data-row="3"></div>
              <a href="https://www.linkedin.com/in/sample-person/">Sample Person</a>
              <a href="https://www.linkedin.com/groups/">Groups</a>
            </div>
          </div>
        </div>
      </main>
    `;

    const sidebar = document.querySelector<HTMLElement>('.scaffold-layout__sidebar');
    const stack = document.querySelector<HTMLElement>('.rail-stack');
    const lastCard = stack?.querySelector<HTMLElement>('[data-row="3"]');

    if (sidebar) {
      mockElementRect(sidebar, 248);
    }
    if (stack) {
      mockElementRect(stack, 236);
    }
    if (lastCard) {
      mockElementRect(lastCard, 224);
    }

    window.localStorage.setItem(
      FLOATING_PANEL_LAYOUT_STORAGE_KEY,
      JSON.stringify({ undocked: true, left: 64, top: 120, width: 420, height: 500 })
    );

    ensureFloatingOptionsPanel();

    const panel = document.getElementById('cleanedin-floating-options');
    const dockButton = panel?.querySelector<HTMLButtonElement>('.cleanedin-floating-options__dock-btn');

    dockButton?.click();

    expect(panel?.getAttribute('data-mount')).toBe('rail');
    expect(panel?.style.width).toBe('100%');
    expect(panel?.style.minWidth).toBe('0px');
    expect(panel?.style.maxWidth).toBe('224px');

    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: originalChrome
    });
  });

  it('applies embedded popup height reports to the docked iframe', () => {
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
        <div class="scaffold-layout__sidebar">
          <div class="scaffold-layout__sticky">
            <div class="rail-stack">
              <div class="artdeco-card" data-row="1"></div>
              <div class="artdeco-card" data-row="2"></div>
              <div class="artdeco-card" data-row="3"></div>
              <a href="https://www.linkedin.com/in/sample-person/">Sample Person</a>
              <a href="https://www.linkedin.com/groups/">Groups</a>
            </div>
          </div>
        </div>
      </main>
    `;

    ensureFloatingOptionsPanel();

    const panel = document.getElementById('cleanedin-floating-options');
    const iframe = panel?.querySelector<HTMLIFrameElement>('.cleanedin-floating-options__frame');
    const frameWrap = panel?.querySelector<HTMLElement>('.cleanedin-floating-options__frame-wrap');

    expect(panel?.getAttribute('data-mount')).toBe('rail');
    expect(iframe).not.toBeNull();
    expect(frameWrap).not.toBeNull();

    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          source: 'cleanedin-popup',
          type: 'popup-height',
          height: 612
        },
        source: iframe?.contentWindow ?? null
      })
    );

    expect(frameWrap?.style.height).toBe('612px');
    expect(iframe?.style.height).toBe('612px');

    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: originalChrome
    });
  });

  it('docks into a sidebar that is a sibling of main in the current LinkedIn scaffold layout', () => {
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
      <div class="scaffold-layout">
        <div class="scaffold-layout__content scaffold-layout__content--sidebar-main-aside">
          <aside class="scaffold-layout__sidebar">
            <div class="scaffold-layout__sticky">
              <div class="scaffold-layout__sticky-content">
                <div role="region" aria-label="Side Bar">
                  <div class="artdeco-card" data-row="1">
                    <a href="https://www.linkedin.com/in/sample-person/">Sample Person</a>
                  </div>
                  <div class="artdeco-card" data-row="2">
                    <a href="https://www.linkedin.com/me/profile-views/">Profile viewers</a>
                  </div>
                  <div class="artdeco-card" data-row="3">
                    <a href="https://www.linkedin.com/groups/">Groups</a>
                    <a href="https://www.linkedin.com/events/">Events</a>
                    <a href="https://www.linkedin.com/mynetwork/network-manager/newsletters">Newsletters</a>
                  </div>
                </div>
              </div>
            </div>
          </aside>
          <main aria-label="Main Feed">
            <div class="scaffold-finite-scroll__content" data-finite-scroll-hotkey-context="FEED"></div>
          </main>
        </div>
      </div>
    `;

    const sidebar = document.querySelector<HTMLElement>('.scaffold-layout__sidebar');
    const stickyContent = document.querySelector<HTMLElement>('.scaffold-layout__sticky-content');
    const railRegion = document.querySelector<HTMLElement>('[role="region"][aria-label="Side Bar"]');
    const lastCard = railRegion?.querySelector<HTMLElement>('[data-row="3"]');

    if (sidebar) {
      mockElementRect(sidebar, 260);
    }
    if (stickyContent) {
      mockElementRect(stickyContent, 248);
    }
    if (railRegion) {
      mockElementRect(railRegion, 236);
    }
    if (lastCard) {
      mockElementRect(lastCard, 224);
    }

    window.localStorage.setItem(
      FLOATING_PANEL_LAYOUT_STORAGE_KEY,
      JSON.stringify({ undocked: true, left: 80, top: 120, width: 420, height: 500 })
    );

    ensureFloatingOptionsPanel();

    const panel = document.getElementById('cleanedin-floating-options');
    const dockButton = panel?.querySelector<HTMLButtonElement>('.cleanedin-floating-options__dock-btn');

    expect(panel?.getAttribute('data-mount')).toBe('fixed');

    dockButton?.click();

    expect(panel?.getAttribute('data-mount')).toBe('rail');
    expect(panel?.parentElement).toBe(railRegion);
    expect(railRegion?.lastElementChild?.id).toBe('cleanedin-floating-options');
    expect(panel?.style.maxWidth).toBe('224px');

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
