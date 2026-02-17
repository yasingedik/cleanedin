import { classifyPost } from './classifier';
import { decidePostVisibility } from './decision';
import { extractPostFeatures } from './extractor';
import {
  findPostRoots,
  findNearestPostRoot,
  getPostRootSelectorCounts,
  isSupportedFeedPath,
  resolveFeedRoot,
  watchFeedRootAvailability,
  watchRouteChanges
} from './feed-root';
import { FeedObserver } from './observer';
import {
  applyPostRendering,
  clearAllHiddenBadges,
  clearTemporaryReveals,
  ensureFloatingOptionsPanel,
  removeFloatingOptionsPanel
} from './render';
import { DEFAULT_LOCAL_SETTINGS, DEFAULT_SYNC_SETTINGS } from '../shared/schema';
import { getSettings, subscribeToStorageChanges } from '../shared/storage';
import type { FilterSettings } from '../shared/types';

try {
  document.documentElement?.setAttribute('data-cleanedin-content-boot', '1');
  window.__cleanedin_content_boot = true;
} catch {
  // Ignore marker failures and continue.
}

console.log('[cleanedin] content boot', window.location.pathname);

const trackedRoots = new Set<HTMLElement>();
let observedPostsCount = 0;
let useBodyRootFallback = false;

let observer: FeedObserver | null = null;
let stopRouteWatcher: (() => void) | null = null;
let stopStorageWatcher: (() => void) | null = null;
let stopRootAvailabilityWatcher: (() => void) | null = null;
let noPostsFallbackTimer: number | null = null;
let bodyFallbackSeedTimer: number | null = null;
let startupSettingsSyncTimer: number | null = null;

let activeSettings: FilterSettings = {
  ...DEFAULT_SYNC_SETTINGS,
  ...DEFAULT_LOCAL_SETTINGS
};

function debugLog(...args: unknown[]): void {
  if (activeSettings.debug) {
    console.debug('[cleanedin]', ...args);
  }
}

function evaluatePost(root: HTMLElement): void {
  if (!root.isConnected) {
    trackedRoots.delete(root);
    return;
  }

  const features = extractPostFeatures(root);
  const result = classifyPost(features);
  features.labels = result.labels;

  const decision = decidePostVisibility(features, activeSettings);
  applyPostRendering(features, decision, activeSettings);

  if (activeSettings.debug) {
    root.setAttribute('data-cleanedin-labels', [...result.labels].join(','));
    root.setAttribute('data-cleanedin-confidence', result.confidence);
    root.setAttribute('data-cleanedin-decision', decision.hide ? 'hide' : 'show');
    root.setAttribute('data-cleanedin-reasons', decision.reasons.join(','));
    root.setAttribute('data-cleanedin-connection-level', features.connectionLevel ?? '');
    root.setAttribute('data-cleanedin-profile-type', features.profileType ?? '');
    root.setAttribute('data-cleanedin-actor-names', features.actorNames.join('|'));
    if (typeof features.ageHours === 'number') {
      root.setAttribute('data-cleanedin-age-days', (features.ageHours / 24).toFixed(2));
    } else {
      root.removeAttribute('data-cleanedin-age-days');
    }
  }
}

function updateObservedPostsDiagnostics(newRootsCount: number): void {
  observedPostsCount += newRootsCount;
  window.__cleanedin_observed_posts = observedPostsCount;
  document.documentElement?.setAttribute('data-cleanedin-observed-posts', String(observedPostsCount));
}

function selectTopRoots(roots: HTMLElement[]): HTMLElement[] {
  const uniqueRoots = [...new Set(roots)].filter((root) => root.isConnected);
  return uniqueRoots.filter((root) => !uniqueRoots.some((candidate) => candidate !== root && candidate.contains(root)));
}

function processObservedRoots(roots: HTMLElement[]): void {
  const topRoots = selectTopRoots(roots);
  updateObservedPostsDiagnostics(topRoots.length);
  for (const root of topRoots) {
    trackedRoots.add(root);
    evaluatePost(root);
  }
}

function reevaluateAllTrackedPosts(): void {
  for (const root of [...trackedRoots]) {
    if (!root.isConnected) {
      trackedRoots.delete(root);
      continue;
    }

    evaluatePost(root);
  }
}

function collectVisiblePostRoots(): HTMLElement[] {
  const scopes = new Set<ParentNode>();
  const observerRoot = resolveObserverRoot();
  if (observerRoot) {
    scopes.add(observerRoot);
  }

  const feedRoot = resolveFeedRoot(document);
  if (feedRoot) {
    scopes.add(feedRoot);
  }

  const main = document.querySelector('main');
  if (main) {
    scopes.add(main);
  }

  scopes.add(document);

  const roots = new Set<HTMLElement>();
  for (const scope of scopes) {
    for (const root of findPostRoots(scope)) {
      if (root.isConnected) {
        roots.add(root);
      }
    }
  }

  return [...roots];
}

function resolveObserverRoot(): HTMLElement | null {
  if (useBodyRootFallback) {
    return document.body;
  }

  return resolveFeedRoot(document);
}

function setRootModeDiagnostics(): void {
  const mode = useBodyRootFallback ? 'body-fallback' : 'feed-root';
  window.__cleanedin_root_mode = mode;
  document.documentElement?.setAttribute('data-cleanedin-root-mode', mode);
}

function ensureObserver(): FeedObserver {
  if (observer) {
    return observer;
  }

  observer = new FeedObserver({
    getRoot: () => resolveObserverRoot(),
    onPosts: (roots) => {
      processObservedRoots(roots);
    }
  });

  return observer;
}

function stopWaitingForFeedRoot(): void {
  stopRootAvailabilityWatcher?.();
  stopRootAvailabilityWatcher = null;
}

function clearNoPostsFallbackTimer(): void {
  if (noPostsFallbackTimer !== null) {
    window.clearTimeout(noPostsFallbackTimer);
    noPostsFallbackTimer = null;
  }
}

function clearBodyFallbackSeedTimer(): void {
  if (bodyFallbackSeedTimer !== null) {
    window.clearTimeout(bodyFallbackSeedTimer);
    bodyFallbackSeedTimer = null;
  }
}

function clearStartupSettingsSyncTimer(): void {
  if (startupSettingsSyncTimer !== null) {
    window.clearTimeout(startupSettingsSyncTimer);
    startupSettingsSyncTimer = null;
  }
}

function findActionClusterSeedRoots(): HTMLElement[] {
  const scope = document.querySelector('main') ?? document.body ?? document.documentElement;
  if (!scope) {
    return [];
  }

  const roots = new Set<HTMLElement>();
  const buttons = scope.querySelectorAll<HTMLButtonElement>('button');

  for (const button of buttons) {
    if (button.closest('.cleanedin-badge, [data-cleanedin-ui="1"]')) {
      continue;
    }

    const nearestRoot = findNearestPostRoot(button);
    const fallbackRoot = button.closest<HTMLElement>('article, [role="article"], li');
    const candidate = nearestRoot ?? fallbackRoot;
    if (!candidate || !candidate.isConnected) {
      continue;
    }

    if (candidate.classList.contains('cleanedin-badge') || candidate.closest('.cleanedin-badge')) {
      continue;
    }

    if (!nearestRoot) {
      const hasStructuralIdentity =
        candidate.hasAttribute('data-urn') ||
        candidate.hasAttribute('data-id') ||
        candidate.hasAttribute('data-activity-urn') ||
        candidate.hasAttribute('data-update-id') ||
        candidate.hasAttribute('data-occludable-job-id') ||
        candidate.matches('article, [role="article"]');
      if (!hasStructuralIdentity) {
        continue;
      }
    }

    const textLength = (candidate.textContent ?? '').trim().length;
    const buttonCount = candidate.querySelectorAll('button').length;
    if (textLength < 120 || buttonCount < 3) {
      continue;
    }

    roots.add(candidate);
    if (roots.size >= 300) {
      break;
    }
  }

  return [...roots];
}

function scheduleBodyFallbackSeeding(): void {
  clearBodyFallbackSeedTimer();

  bodyFallbackSeedTimer = window.setTimeout(() => {
    if (observedPostsCount > 0 || !isSupportedFeedPath()) {
      return;
    }

    const seededRoots = findActionClusterSeedRoots();
    if (seededRoots.length === 0) {
      console.warn('[cleanedin] body-fallback seeding found no candidate roots');
      return;
    }

    console.warn(`[cleanedin] body-fallback seeded ${seededRoots.length} candidate roots`);
    processObservedRoots(seededRoots);
  }, 1500);
}

function enableBodyRootFallback(): void {
  if (useBodyRootFallback) {
    return;
  }

  useBodyRootFallback = true;
  setRootModeDiagnostics();
  stopWaitingForFeedRoot();
  console.warn('[cleanedin] switching observer root to document.body fallback');

  if (observer) {
    observer.restart();
  } else {
    ensureObserver().start();
  }

  scheduleBodyFallbackSeeding();
}

function scheduleNoPostsFallbackCheck(): void {
  clearNoPostsFallbackTimer();

  noPostsFallbackTimer = window.setTimeout(() => {
    if (observedPostsCount > 0 || !isSupportedFeedPath()) {
      return;
    }

    const feedRootFound = Boolean(resolveFeedRoot(document));
    const selectorCounts = getPostRootSelectorCounts(resolveFeedRoot(document) ?? document);
    console.warn(
      `[cleanedin] no post roots observed after startup ${JSON.stringify({
        feedRootFound,
        selectorCounts
      })}`
    );

    enableBodyRootFallback();
  }, 5000);
}

function scheduleStartupSettingsSync(): void {
  clearStartupSettingsSyncTimer();

  startupSettingsSyncTimer = window.setTimeout(() => {
    if (!isSupportedFeedPath()) {
      return;
    }

    void refreshSettingsAndReevaluate();
  }, 1200);
}

function bindObserverWhenFeedRootReady(): void {
  stopWaitingForFeedRoot();

  if (!isSupportedFeedPath()) {
    removeFloatingOptionsPanel();
    return;
  }

  ensureFloatingOptionsPanel();

  if (useBodyRootFallback) {
    ensureObserver().start();
    return;
  }

  if (resolveObserverRoot()) {
    ensureObserver().start();
    return;
  }

  stopRootAvailabilityWatcher = watchFeedRootAvailability(() => {
    if (!isSupportedFeedPath()) {
      return;
    }

    ensureObserver().start();
    stopWaitingForFeedRoot();
  });
}

async function refreshSettingsAndReevaluate(): Promise<void> {
  try {
    activeSettings = await getSettings();
    debugLog('settings-updated', activeSettings);
    for (const hiddenRoot of document.querySelectorAll<HTMLElement>('.cleanedin-hidden[data-cleanedin-hidden="true"]')) {
      hiddenRoot.classList.remove('cleanedin-hidden');
      hiddenRoot.removeAttribute('data-cleanedin-hidden');
    }
    clearAllHiddenBadges();
    for (const root of collectVisiblePostRoots()) {
      trackedRoots.add(root);
    }
    reevaluateAllTrackedPosts();
  } catch (error) {
    console.error('[cleanedin] failed to refresh settings', error);
  }
}

function resetRouteState(): void {
  observer?.stop();
  trackedRoots.clear();
  observedPostsCount = 0;
  updateObservedPostsDiagnostics(0);
  clearNoPostsFallbackTimer();
  clearBodyFallbackSeedTimer();
  clearStartupSettingsSyncTimer();
  clearAllHiddenBadges();
  clearTemporaryReveals();
  removeFloatingOptionsPanel();
  stopWaitingForFeedRoot();
}

async function activateForCurrentRoute(refreshSettings = false): Promise<void> {
  resetRouteState();
  useBodyRootFallback = false;
  setRootModeDiagnostics();

  if (!isSupportedFeedPath()) {
    return;
  }

  if (refreshSettings) {
    await refreshSettingsAndReevaluate();
  }

  bindObserverWhenFeedRootReady();
  scheduleNoPostsFallbackCheck();
  scheduleStartupSettingsSync();
}

async function boot(): Promise<void> {
  setRootModeDiagnostics();
  try {
    activeSettings = await getSettings();
  } catch (error) {
    console.error('[cleanedin] failed to load settings at boot, using defaults', error);
  }

  await activateForCurrentRoute(false);

  stopStorageWatcher = subscribeToStorageChanges(async (changes, area) => {
    if (area !== 'sync' && area !== 'local') {
      return;
    }

    if (Object.keys(changes).length === 0) {
      return;
    }

    await refreshSettingsAndReevaluate();
  });

  stopRouteWatcher = watchRouteChanges(async () => {
    await activateForCurrentRoute(true);
  });
}

void boot();

window.addEventListener('beforeunload', () => {
  observer?.stop();
  stopRouteWatcher?.();
  stopStorageWatcher?.();
  stopWaitingForFeedRoot();
  clearNoPostsFallbackTimer();
  clearBodyFallbackSeedTimer();
  clearStartupSettingsSyncTimer();
});
