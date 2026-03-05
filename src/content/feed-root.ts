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
  '[data-view-name="feed-full-update"]',
  '[role="listitem"]',
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

const FEATURE_ROOT_SELECTOR = '[data-view-name="feed-full-update"]';
const POST_LINK_SELECTOR = ['a[href*="/feed/update/"]', 'a[href*="/posts/"]', 'a[href*="urn:li:activity:"]'].join(', ');
const FEED_TRACKING_SELECTOR = [
  '[data-view-tracking-scope*="FEED_UPDATE_SERVED"]',
  '[data-view-tracking-scope*="SPONSORED_UPDATE_SERVED"]',
  '[data-view-tracking-scope*="UPDATE_SERVED"]'
].join(', ');
const POST_CONTAINER_HINT_SELECTOR = [
  FEATURE_ROOT_SELECTOR,
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
const NON_FEED_RAIL_SELECTOR = [
  '.scaffold-layout__sidebar',
  '.scaffold-layout__aside',
  '.feed-identity-module',
  '[data-view-name="identity-module"]',
  '[data-view-name^="home-nav-left-rail-"]'
].join(', ');

const ROOT_IDENTITY_SELECTOR = '[data-urn], [data-id], [data-activity-urn], [data-update-id], [data-occludable-job-id]';
const ACTOR_PROFILE_LINK_SELECTOR = ['a[href*="/in/"]', 'a[href*="/company/"]', 'a[href*="/school/"]', 'a[href*="/groups/"]'].join(
  ', '
);
const LISTITEM_CONTROL_SELECTOR = 'button, [role="button"], a[role="button"]';
const FEED_CONTENT_MARKER_SELECTOR = [
  '[data-testid="expandable-text-box"]',
  '[data-view-name="feed-commentary"]',
  '[data-view-name*="feed-commentary"]',
  '[data-testid*="carousel"]',
  'img',
  'video',
  'iframe'
].join(', ');
const POST_ACTION_TOKEN_PATTERN = /\b(?:like|comment|repost|send|share)\b/;
const FOLLOW_ACTION_TOKEN_PATTERN = /\bfollow\b/;
const FEED_POST_LEAD_PREFIX = 'feed post';
const FEED_POST_LEAD_COMPACT_PREFIX = 'feedpost';
const FEED_POST_LEAD_LENGTH = 240;

type PostTargetSource = 'feature-root' | 'selector' | 'tracking' | 'post-link' | 'fallback';

export type PostTarget = {
  renderRoot: HTMLElement;
  featureRoot: HTMLElement;
  source: PostTargetSource;
};

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
  if (root.matches(FEATURE_ROOT_SELECTOR)) {
    return true;
  }

  if (root.matches('[role="listitem"]') && root.querySelector(FEATURE_ROOT_SELECTOR)) {
    return true;
  }

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
  return (
    trackingScope.includes('FEED_UPDATE_SERVED') ||
    trackingScope.includes('SPONSORED_UPDATE_SERVED') ||
    trackingScope.includes('UPDATE_SERVED')
  );
}

function normalizeInlineText(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function controlSignalText(node: Element): string {
  return normalizeInlineText(
    `${node.getAttribute('aria-label') ?? ''} ${node.getAttribute('title') ?? ''} ${(node as HTMLElement).textContent ?? ''}`
  );
}

function hasFeedPostLeadSignature(root: HTMLElement): boolean {
  const lead = normalizeInlineText((root.textContent ?? '').slice(0, FEED_POST_LEAD_LENGTH));
  if (!lead) {
    return false;
  }

  const compactLead = lead.replace(/\s+/g, '');
  return lead.startsWith(FEED_POST_LEAD_PREFIX) || compactLead.startsWith(FEED_POST_LEAD_COMPACT_PREFIX);
}

function hasModernListitemFallbackSignal(root: HTMLElement): boolean {
  if (!root.matches('li, [role="listitem"]')) {
    return false;
  }

  if (!hasFeedPostLeadSignature(root)) {
    return false;
  }

  const hasActorProfile = Boolean(root.querySelector(ACTOR_PROFILE_LINK_SELECTOR));
  if (!hasActorProfile) {
    return false;
  }

  const controls = [...root.querySelectorAll<HTMLElement>(LISTITEM_CONTROL_SELECTOR)].slice(0, 48);
  let actionKeywordHits = 0;
  let hasFollowAction = false;
  let hasPostMenuHint = false;

  for (const control of controls) {
    const signal = controlSignalText(control);
    if (!signal) {
      continue;
    }

    if (
      signal.includes('control menu for post') ||
      signal.includes('hide post') ||
      signal.includes('more options for post')
    ) {
      hasPostMenuHint = true;
    }

    if (POST_ACTION_TOKEN_PATTERN.test(signal)) {
      actionKeywordHits += 1;
    }

    if (FOLLOW_ACTION_TOKEN_PATTERN.test(signal)) {
      hasFollowAction = true;
    }
  }

  const buttonCount = root.querySelectorAll('button').length;
  const hasFeedActionCluster = actionKeywordHits >= 2 || buttonCount >= 4;
  const hasContentMarker =
    Boolean(root.querySelector(FEED_CONTENT_MARKER_SELECTOR)) || normalizeInlineText(root.textContent ?? '').length >= 180;

  return hasContentMarker && (hasFeedActionCluster || hasFollowAction || hasPostMenuHint);
}

function isGlobalContainer(root: HTMLElement): boolean {
  if (root.matches('html, body, main, [role="main"], #root, [data-testid="mainFeed"]')) {
    return true;
  }

  const feedUpdateCount = root.querySelectorAll(FEATURE_ROOT_SELECTOR).length;
  return feedUpdateCount > 1 && root.getAttribute('data-view-name') !== 'feed-full-update';
}

function isLikelyPostContainer(root: HTMLElement): boolean {
  if (isExtensionUiNode(root)) {
    return false;
  }

  if (root.closest(NON_FEED_RAIL_SELECTOR)) {
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
  const isArticleLike = root.matches('article, [role="article"], [role="listitem"]');
  const hasUpdateLink = Boolean(root.querySelector(POST_LINK_SELECTOR));
  const textLength = (root.textContent ?? '').trim().length;
  if (textLength < 40 && !hasUpdateLink && !hasFeedTracking && !isArticleLike) {
    return false;
  }

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
  const buttonCount = root.querySelectorAll('button').length;
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

  if (root.matches('li, [role="listitem"]') && hasUpdateLink && (hasActor || hasTime || hasRichContent || buttonCount >= 1 || textLength >= 140)) {
    return true;
  }

  if (hasUpdateLink && textLength >= 120 && (hasActor || hasTime || hasRichContent)) {
    return true;
  }

  return hasActor && (hasTime || hasActions);
}

function isLikelyFeatureRoot(root: HTMLElement): boolean {
  if (isExtensionUiNode(root)) {
    return false;
  }

  if (root.closest(NON_FEED_RAIL_SELECTOR)) {
    return false;
  }

  if (root.matches(FEATURE_ROOT_SELECTOR)) {
    return true;
  }

  return isLikelyPostContainer(root);
}

function resolveFeatureRoot(root: HTMLElement): HTMLElement {
  if (root.matches(FEATURE_ROOT_SELECTOR)) {
    return root;
  }

  const nestedFeature = root.querySelector<HTMLElement>(FEATURE_ROOT_SELECTOR);
  if (nestedFeature && isLikelyFeatureRoot(nestedFeature)) {
    return nestedFeature;
  }

  return root;
}

function resolveRenderRoot(featureRoot: HTMLElement): HTMLElement {
  const listitem = featureRoot.closest<HTMLElement>('[role="listitem"], li');
  if (listitem && isLikelyPostContainer(listitem)) {
    return listitem;
  }

  const articleLike = featureRoot.closest<HTMLElement>('article, [role="article"]');
  if (articleLike && isLikelyPostContainer(articleLike)) {
    return articleLike;
  }

  let ancestor: HTMLElement | null = featureRoot.parentElement;
  while (ancestor && ancestor !== document.body && ancestor !== document.documentElement) {
    const hasAnchoringSignal =
      hasFeedTrackingSignal(ancestor) ||
      ancestor.matches(ROOT_IDENTITY_SELECTOR) ||
      ancestor.getAttribute('data-view-name') === 'feed-full-update';

    if (hasAnchoringSignal && isLikelyPostContainer(ancestor)) {
      return ancestor;
    }

    ancestor = ancestor.parentElement;
  }

  return featureRoot;
}

function createPostTargetFromRoot(root: HTMLElement, source: PostTargetSource): PostTarget | null {
  if (!isLikelyPostContainer(root)) {
    return null;
  }

  const featureRoot = resolveFeatureRoot(root);
  if (!isLikelyFeatureRoot(featureRoot)) {
    return null;
  }

  if (featureRoot === root && root.matches('li, [role="listitem"]')) {
    const hasListItemSignal =
      hasFeedTrackingSignal(root) ||
      Boolean(root.querySelector(POST_LINK_SELECTOR)) ||
      Boolean(root.querySelector(ROOT_IDENTITY_SELECTOR)) ||
      hasModernListitemFallbackSignal(root);
    if (!hasListItemSignal) {
      return null;
    }
  }

  const renderRoot = resolveRenderRoot(featureRoot);
  if (!isLikelyPostContainer(renderRoot)) {
    return null;
  }

  const resolvedFeatureRoot = resolveFeatureRoot(renderRoot);
  return {
    renderRoot,
    featureRoot: resolvedFeatureRoot,
    source
  };
}

function createPostTargetFromFeatureRoot(featureRoot: HTMLElement, source: PostTargetSource): PostTarget | null {
  if (!isLikelyFeatureRoot(featureRoot)) {
    return null;
  }

  const renderRoot = resolveRenderRoot(featureRoot);
  if (!isLikelyPostContainer(renderRoot)) {
    return null;
  }

  return {
    renderRoot,
    featureRoot,
    source
  };
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

function registerTarget(targets: Map<HTMLElement, PostTarget>, target: PostTarget): void {
  const existing = targets.get(target.renderRoot);
  if (!existing) {
    targets.set(target.renderRoot, target);
    return;
  }

  const existingHasDedicatedFeature = existing.featureRoot !== existing.renderRoot;
  const incomingHasDedicatedFeature = target.featureRoot !== target.renderRoot;
  if (!existingHasDedicatedFeature && incomingHasDedicatedFeature) {
    targets.set(target.renderRoot, target);
  }
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

export function findPostTargets(container: ParentNode): PostTarget[] {
  const targets = new Map<HTMLElement, PostTarget>();

  for (const featureRoot of maybeQueryAll<HTMLElement>(container, FEATURE_ROOT_SELECTOR)) {
    const target = createPostTargetFromFeatureRoot(featureRoot, 'feature-root');
    if (target) {
      registerTarget(targets, target);
    }
  }

  for (const root of maybeQueryAll<HTMLElement>(container, POST_ROOT_SELECTOR)) {
    if (isExtensionUiNode(root)) {
      continue;
    }

    const target = createPostTargetFromRoot(root, 'selector');
    if (target) {
      registerTarget(targets, target);
    }
  }

  for (const tracked of maybeQueryAll<HTMLElement>(container, FEED_TRACKING_SELECTOR)) {
    const candidate = closestLikelyPostContainer(tracked) ?? (isLikelyPostContainer(tracked) ? tracked : null);
    if (!candidate) {
      continue;
    }

    const target = createPostTargetFromRoot(candidate, 'tracking');
    if (target) {
      registerTarget(targets, target);
    }
  }

  for (const anchor of maybeQueryAll<HTMLAnchorElement>(container, POST_LINK_SELECTOR)) {
    const candidate = closestLikelyPostContainer(anchor);
    if (!candidate) {
      continue;
    }

    const target = createPostTargetFromRoot(candidate, 'post-link');
    if (target) {
      registerTarget(targets, target);
    }
  }

  if (targets.size === 0) {
    for (const fallback of maybeQueryAll<HTMLElement>(container, 'article, [role="article"], [role="listitem"]')) {
      const target = createPostTargetFromRoot(fallback, 'fallback');
      if (target) {
        registerTarget(targets, target);
      }
    }
  }

  return [...targets.values()];
}

export function findPostRoots(container: ParentNode): HTMLElement[] {
  return findPostTargets(container).map((target) => target.renderRoot);
}

export function findNearestPostTarget(node: Element): PostTarget | null {
  if (!(node instanceof HTMLElement)) {
    return null;
  }

  if (node.closest('.cleanedin-badge, [data-cleanedin-ui="1"]')) {
    return null;
  }

  const nearestFeature = node.closest<HTMLElement>(FEATURE_ROOT_SELECTOR);
  if (nearestFeature) {
    const target = createPostTargetFromFeatureRoot(nearestFeature, 'feature-root');
    if (target) {
      return target;
    }
  }

  const nearestRoot = closestLikelyPostContainer(node);
  if (!nearestRoot) {
    return null;
  }

  return createPostTargetFromRoot(nearestRoot, 'selector');
}

export function isPostRootNode(node: Element): node is HTMLElement {
  if (!(node instanceof HTMLElement)) {
    return false;
  }

  return findNearestPostTarget(node)?.renderRoot === node;
}

export function findNearestPostRoot(node: Element): HTMLElement | null {
  return findNearestPostTarget(node)?.renderRoot ?? null;
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
