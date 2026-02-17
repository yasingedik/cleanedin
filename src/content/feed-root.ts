export const FEED_ROOT_SELECTORS = [
  'main [data-testid="mainFeed"]',
  '[data-testid="mainFeed"]',
  'main .scaffold-finite-scroll__content',
  'main [data-finite-scroll-hotkey-context]',
  'main [data-view-name="feed"]',
  'main[role="main"]',
  'main'
];

export const POST_ROOT_SELECTORS = [
  'article[data-urn^="urn:li:activity:"]',
  'article[data-id^="urn:li:activity:"]',
  'article[data-activity-urn^="urn:li:activity:"]',
  'article[data-update-id]',
  'article[data-occludable-job-id]',
  'article:has(a[href*="/feed/update/"])',
  'div.feed-shared-update-v2',
  'div.occludable-update',
  'div[data-urn^="urn:li:activity:"]',
  'div[data-id^="urn:li:activity:"]',
  'div[data-activity-urn^="urn:li:activity:"]',
  'div[data-update-id]',
  'div[data-occludable-job-id]',
  'div:has(> a[href*="/feed/update/"])',
  'article',
  '[role="article"]',
  'li'
];

export const POST_ROOT_SELECTOR = POST_ROOT_SELECTORS.join(', ');

const POST_LINK_SELECTOR = ['a[href*="/feed/update/"]', 'a[href*="/posts/"]', 'a[href*="urn:li:activity:"]'].join(', ');
const FEED_TRACKING_SELECTOR = [
  '[data-view-tracking-scope*="FEED_UPDATE_SERVED"]',
  '[data-view-tracking-scope*="SPONSORED_UPDATE_SERVED"]'
].join(', ');
const POST_CONTAINER_HINT_SELECTOR = [
  '[data-urn]',
  '[data-id]',
  '[data-activity-urn]',
  '[data-update-id]',
  '[data-occludable-job-id]',
  '[data-view-tracking-scope]',
  'div[class*="feed-shared"]',
  'div[class*="occludable"]',
  'div[class*="update-components"]',
  'article',
  '[role="article"]',
  'li'
].join(', ');

function normalizeUrlPath(urlLike: string): string {
  try {
    return new URL(urlLike).pathname;
  } catch {
    return '/';
  }
}

function maybeQueryAll<T extends Element>(container: ParentNode, selector: string): T[] {
  try {
    return [...container.querySelectorAll<T>(selector)];
  } catch {
    return [];
  }
}

function isExtensionUiNode(root: HTMLElement): boolean {
  return (
    root.classList.contains('cleanedin-badge') ||
    root.closest('.cleanedin-badge') !== null ||
    root.getAttribute('data-cleanedin-ui') === '1'
  );
}

function hasStrongPostIdentity(root: HTMLElement): boolean {
  if (
    root.hasAttribute('data-urn') ||
    root.hasAttribute('data-id') ||
    root.hasAttribute('data-activity-urn') ||
    root.hasAttribute('data-update-id') ||
    root.hasAttribute('data-occludable-job-id')
  ) {
    return true;
  }

  return false;
}

function hasFeedTrackingSignal(root: HTMLElement): boolean {
  const trackingScope = root.getAttribute('data-view-tracking-scope') ?? '';
  return trackingScope.includes('FEED_UPDATE_SERVED') || trackingScope.includes('SPONSORED_UPDATE_SERVED');
}

function isGlobalContainer(root: HTMLElement): boolean {
  if (root.matches('html, body, main, [role="main"], #root, [data-testid="mainFeed"]')) {
    return true;
  }

  const feedUpdateCount = root.querySelectorAll('[data-view-name="feed-full-update"]').length;
  return feedUpdateCount > 1 && root.getAttribute('data-view-name') !== 'feed-full-update';
}

function isLikelyPostContainer(root: HTMLElement): boolean {
  if (isExtensionUiNode(root)) {
    return false;
  }

  if (isGlobalContainer(root)) {
    return false;
  }

  const hasStrongIdentity = hasStrongPostIdentity(root);
  if (hasStrongIdentity) {
    return true;
  }

  const hasFeedTracking = hasFeedTrackingSignal(root);
  const isArticleLike = root.matches('article, [role="article"]');
  const textLength = (root.textContent ?? '').trim().length;
  if (textLength < 40) {
    return false;
  }

  // Expanded comment threads can produce very long tracked post containers.
  // Keep rejecting oversized generic wrappers, but allow tracked/article roots.
  if (textLength > 12_000 && !hasFeedTracking && !isArticleLike) {
    return false;
  }

  const hasTime = Boolean(root.querySelector('time'));
  const hasActor =
    Boolean(root.querySelector('a[href*="/in/"]')) ||
    Boolean(root.querySelector('a[href*="/company/"]')) ||
    Boolean(root.querySelector('a[href*="/school/"]'));
  const hasActions =
    Boolean(root.querySelector('button[aria-label*="Like"]')) ||
    Boolean(root.querySelector('button[aria-label*="Comment"]')) ||
    Boolean(root.querySelector('button[aria-label*="Repost"]')) ||
    Boolean(root.querySelector('button[aria-label*="Send"]')) ||
    root.querySelectorAll('button').length >= 2;
  const hasUpdateLink = Boolean(root.querySelector(POST_LINK_SELECTOR));
  const hasRichContent =
    Boolean(root.querySelector('img')) ||
    Boolean(root.querySelector('video')) ||
    Boolean(root.querySelector('iframe')) ||
    Boolean(root.querySelector('[aria-roledescription="carousel"]'));

  if (isArticleLike && textLength >= 80 && (hasActor || hasTime || hasUpdateLink)) {
    return true;
  }

  if (hasFeedTracking && (textLength >= 120 || hasActor || hasTime || isArticleLike)) {
    return true;
  }

  if (hasUpdateLink && textLength >= 120 && (hasActor || hasTime || hasRichContent)) {
    return true;
  }

  return hasActor && (hasTime || hasActions);
}

function closestLikelyPostContainer(node: Element): HTMLElement | null {
  if (!(node instanceof HTMLElement)) {
    return null;
  }

  if (node.closest('.cleanedin-badge, [data-cleanedin-ui="1"]')) {
    return null;
  }

  const direct = node.closest<HTMLElement>(POST_ROOT_SELECTOR);
  if (direct && isLikelyPostContainer(direct)) {
    return direct;
  }

  const hinted = node.closest<HTMLElement>(POST_CONTAINER_HINT_SELECTOR);
  if (hinted && isLikelyPostContainer(hinted)) {
    return hinted;
  }

  return null;
}

export function isSupportedFeedPath(pathname = normalizeUrlPath(window.location.href)): boolean {
  return pathname === '/' || pathname.startsWith('/feed');
}

export function resolveFeedRoot(doc: Document = document): HTMLElement | null {
  for (const selector of FEED_ROOT_SELECTORS) {
    const found = doc.querySelector<HTMLElement>(selector);
    if (found) {
      return found;
    }
  }

  return null;
}

export function findPostRoots(container: ParentNode): HTMLElement[] {
  const roots = new Set<HTMLElement>();

  for (const root of maybeQueryAll<HTMLElement>(container, POST_ROOT_SELECTOR)) {
    if (isExtensionUiNode(root)) {
      continue;
    }

    if (isLikelyPostContainer(root)) {
      roots.add(root);
    }
  }

  for (const tracked of maybeQueryAll<HTMLElement>(container, FEED_TRACKING_SELECTOR)) {
    const candidate = closestLikelyPostContainer(tracked) ?? (isLikelyPostContainer(tracked) ? tracked : null);
    if (candidate) {
      roots.add(candidate);
    }
  }

  for (const anchor of maybeQueryAll<HTMLAnchorElement>(container, POST_LINK_SELECTOR)) {
    const candidate = closestLikelyPostContainer(anchor);
    if (candidate) {
      roots.add(candidate);
    }
  }

  if (roots.size === 0) {
    for (const fallback of maybeQueryAll<HTMLElement>(container, 'article, [role="article"]')) {
      if (isLikelyPostContainer(fallback)) {
        roots.add(fallback);
      }
    }
  }

  return [...roots];
}

export function isPostRootNode(node: Element): node is HTMLElement {
  return Boolean(closestLikelyPostContainer(node));
}

export function findNearestPostRoot(node: Element): HTMLElement | null {
  return closestLikelyPostContainer(node);
}

export function getPostRootSelectorCounts(doc: ParentNode = document): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const selector of [...POST_ROOT_SELECTORS, POST_LINK_SELECTOR, FEED_TRACKING_SELECTOR]) {
    counts[selector] = maybeQueryAll(doc, selector).length;
  }
  return counts;
}

export function watchFeedRootAvailability(listener: (root: HTMLElement) => void): () => void {
  let previousRoot: HTMLElement | null = null;

  const emitIfChanged = () => {
    const nextRoot = resolveFeedRoot(document);

    if (nextRoot && nextRoot !== previousRoot) {
      previousRoot = nextRoot;
      listener(nextRoot);
      return;
    }

    if (!nextRoot) {
      previousRoot = null;
    }
  };

  emitIfChanged();

  const target = document.documentElement ?? document.body;
  if (!target) {
    return () => undefined;
  }

  const observer = new MutationObserver(() => emitIfChanged());
  observer.observe(target, { childList: true, subtree: true });

  return () => observer.disconnect();
}

type RouteChangeListener = (url: string) => void;

let historyPatched = false;

function emitRouteChange(): void {
  window.dispatchEvent(new Event('cleanedin:routechange'));
}

/**
 * Monitors route changes by patching history.pushState and history.replaceState.
 *
 * LinkedIn's feed uses client-side routing without full page reloads.
 * This monitors navigation state changes to reset the feed observer when the user
 * navigates to a different page/view.
 *
 * Emits custom 'cleanedin:routechange' event on path changes.
 * Does not expose any sensitive data or interfere with other extensions.
 */
function patchHistoryOnce(): void {
  if (historyPatched) {
    return;
  }

  historyPatched = true;

  const originalPushState = history.pushState.bind(history);
  const originalReplaceState = history.replaceState.bind(history);

  history.pushState = ((...args: Parameters<History['pushState']>) => {
    const result = originalPushState(...args);
    emitRouteChange();
    return result;
  }) as History['pushState'];

  history.replaceState = ((...args: Parameters<History['replaceState']>) => {
    const result = originalReplaceState(...args);
    emitRouteChange();
    return result;
  }) as History['replaceState'];
}

export function watchRouteChanges(listener: RouteChangeListener): () => void {
  patchHistoryOnce();

  const handler = () => listener(window.location.href);

  window.addEventListener('popstate', handler);
  window.addEventListener('cleanedin:routechange', handler as EventListener);

  return () => {
    window.removeEventListener('popstate', handler);
    window.removeEventListener('cleanedin:routechange', handler as EventListener);
  };
}
