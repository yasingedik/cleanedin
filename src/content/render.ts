import contentStyles from './styles.css?inline';
import type { FilterSettings, PostDecision, PostFeatures } from '../shared/types';

const STYLE_ID = 'cleanedin-content-styles';
const HIDDEN_CLASS = 'cleanedin-hidden';
const BADGE_CLASS = 'cleanedin-badge';
const BADGE_FOR_ATTR = 'data-cleanedin-badge-for';
const POST_ID_ATTR = 'data-cleanedin-post-id';
const FLOATING_PANEL_ID = 'cleanedin-floating-options';
const FLOATING_PANEL_LAYOUT_STORAGE_KEY = 'cleanedin:floating-panel-layout:v1';
const FLOATING_PANEL_POPUP_HEIGHT_ATTR = 'data-cleanedin-popup-height';
const FLOATING_PANEL_MARGIN = 12;
const FLOATING_PANEL_DEFAULT_TOP = 84;
const FLOATING_PANEL_DEFAULT_WIDTH = 330;
const FLOATING_PANEL_DEFAULT_HEIGHT = 620;
const FLOATING_PANEL_MIN_WIDTH = 260;
const FLOATING_PANEL_MIN_HEIGHT = 320;
const RAIL_INSERTION_CARD_INDEX = 2;
const LEFT_RAIL_CANDIDATE_SELECTORS = ['.scaffold-layout__sidebar', '.scaffold-layout__aside', 'aside'] as const;
const IDENTITY_MODULE_ROOT_SELECTORS = ['[data-view-name="identity-module"]', '.feed-identity-module'] as const;
const POPUP_MESSAGE_SOURCE = 'cleanedin-popup';
const POPUP_HEIGHT_MESSAGE_TYPE = 'popup-height';

const temporaryRevealPostIds = new Set<string>();
let lastKnownRailMountTarget: HTMLElement | null = null;

type FloatingPanelLayout = {
  undocked: boolean;
  left: number;
  top: number;
  width: number;
  height: number;
};

type PopupHeightMessage = {
  source: typeof POPUP_MESSAGE_SOURCE;
  type: typeof POPUP_HEIGHT_MESSAGE_TYPE;
  height: number;
};

const PROFILE_SIGNAL_SELECTORS = [
  '.feed-identity-module',
  '[data-view-name="identity-module"]',
  '[data-view-name*="identity-self-profile"]',
  '[data-test-id*="identity"]',
  '[data-view-name*="feed_identity"]',
  'a[href*="/in/"]',
  'a[href*="/mynetwork"]'
] as const;

const SHORTCUT_SIGNAL_SELECTORS = ['a[href*="/groups"]', 'a[href*="/events"]', 'a[href*="/newsletters"]', 'a[href*="/mynetwork"]'] as const;
const RAIL_MODULE_SIGNAL_SELECTORS = ['[data-view-name^="home-nav-left-rail-"]', ...SHORTCUT_SIGNAL_SELECTORS] as const;
const RAIL_STACK_SIGNAL_SELECTORS = [...PROFILE_SIGNAL_SELECTORS, ...RAIL_MODULE_SIGNAL_SELECTORS] as const;
const RAIL_VIEWNAME_MODULE_SELECTOR = '[data-view-name^="home-nav-left-rail-"]';

function directElementChildren(container: ParentNode): HTMLElement[] {
  return [...container.children].filter((child): child is HTMLElement => child instanceof HTMLElement);
}

function profileSignalCount(candidate: ParentNode): number {
  return candidate.querySelectorAll(PROFILE_SIGNAL_SELECTORS.join(', ')).length;
}

function hasSignal(candidate: ParentNode, selector: string): boolean {
  if (candidate instanceof HTMLElement && candidate.matches(selector)) {
    return true;
  }

  return candidate.querySelector(selector) !== null;
}

function hasIdentitySignal(candidate: ParentNode): boolean {
  return hasSignal(candidate, PROFILE_SIGNAL_SELECTORS.join(', '));
}

function hasRailModuleSignal(candidate: ParentNode): boolean {
  return hasSignal(candidate, RAIL_MODULE_SIGNAL_SELECTORS.join(', '));
}

function signalCardChildCount(candidate: HTMLElement): number {
  return directElementChildren(candidate).filter((child) => hasIdentitySignal(child) || hasRailModuleSignal(child)).length;
}

function isLikelyMainFeedContainer(candidate: HTMLElement): boolean {
  return (
    candidate.matches('[data-testid="mainFeed"], [data-finite-scroll-hotkey-context], [data-view-name="feed"]') ||
    candidate.querySelector('[data-testid="mainFeed"], [data-finite-scroll-hotkey-context], [data-view-name="feed"]') !== null
  );
}

function isLikelyLeftRailColumn(candidate: HTMLElement): boolean {
  const rect = candidate.getBoundingClientRect();
  if (rect.width !== 0 && (rect.width < 200 || rect.width > 460)) {
    return false;
  }

  if (rect.left !== 0 && rect.left > window.innerWidth * 0.48) {
    return false;
  }

  if (isLikelyMainFeedContainer(candidate)) {
    return false;
  }

  return true;
}

function getRailScore(candidate: HTMLElement): number {
  const rect = candidate.getBoundingClientRect();
  const cardCount = candidate.querySelectorAll('.artdeco-card, .feed-identity-module, .premium-upsell-link').length;
  const shortcutCount = candidate.querySelectorAll(SHORTCUT_SIGNAL_SELECTORS.join(', ')).length;
  const profileSignals = profileSignalCount(candidate);

  let score = 0;
  if (candidate.classList.contains('scaffold-layout__sidebar')) {
    score += 40;
  }
  if (candidate.querySelector('.scaffold-layout__sticky')) {
    score += 15;
  }
  score += profileSignals * 12;
  score += shortcutCount * 25;
  score += Math.min(cardCount, 10) * 4;
  if (rect.left <= window.innerWidth * 0.35 || rect.left === 0) {
    score += 12;
  }
  if (rect.left >= window.innerWidth * 0.5) {
    score -= 12;
  }
  if (rect.width >= 200 && rect.width <= 420) {
    score += 8;
  }

  return score;
}

function resolveLinkedInLeftRailHost(): HTMLElement | null {
  const sidebarCandidates = [...document.querySelectorAll<HTMLElement>('.scaffold-layout__sidebar')].filter(
    (candidate) => candidate.isConnected && isLikelyLeftRailColumn(candidate)
  );
  const profileSidebars = sidebarCandidates.filter((candidate) => profileSignalCount(candidate) > 0);
  if (profileSidebars.length > 0) {
    return [...profileSidebars].sort((a, b) => getRailScore(b) - getRailScore(a))[0] ?? null;
  }

  if (sidebarCandidates.length > 0) {
    return [...sidebarCandidates].sort((a, b) => getRailScore(b) - getRailScore(a))[0] ?? null;
  }

  const candidates = [...new Set(LEFT_RAIL_CANDIDATE_SELECTORS.flatMap((selector) => [...document.querySelectorAll<HTMLElement>(selector)]))].filter((candidate) => {
    return candidate.isConnected && isLikelyLeftRailColumn(candidate);
  });

  if (candidates.length === 0) {
    return null;
  }

  const profileCandidates = candidates.filter((candidate) => profileSignalCount(candidate) > 0);
  const rankedPool = profileCandidates.length > 0 ? profileCandidates : candidates;
  return [...rankedPool].sort((a, b) => getRailScore(b) - getRailScore(a))[0] ?? null;
}

function resolveSignalBasedRailHost(): HTMLElement | null {
  const main = document.querySelector('main');
  const identityRoots = [...document.querySelectorAll<HTMLElement>(IDENTITY_MODULE_ROOT_SELECTORS.join(', '))].filter(
    (root) => root.isConnected && (!main || main.contains(root))
  );

  if (identityRoots.length === 0) {
    return null;
  }

  const candidates = new Set<HTMLElement>();
  for (const identityRoot of identityRoots) {
    let node = identityRoot.parentElement;
    while (node && node !== document.body && node !== document.documentElement) {
      if (main && !main.contains(node)) {
        break;
      }

      if (hasRailModuleSignal(node)) {
        candidates.add(node);
      }
      node = node.parentElement;
    }
  }

  const ranked = [...candidates]
    .filter((candidate) => isLikelyLeftRailColumn(candidate))
    .map((candidate) => {
      const rect = candidate.getBoundingClientRect();
      const directSignalChildren = signalCardChildCount(candidate);
      const boundedWidth = rect.width >= 200 && rect.width <= 520;
      const boundedHeight = rect.height >= 280;

      let depth = 0;
      let node: HTMLElement | null = candidate;
      while (node && node !== main && node !== document.body) {
        depth += 1;
        node = node.parentElement;
      }

      const score =
        directSignalChildren * 90 +
        (hasIdentitySignal(candidate) ? 30 : 0) +
        (hasRailModuleSignal(candidate) ? 30 : 0) +
        (boundedWidth ? 10 : 0) +
        (boundedHeight ? 8 : 0);

      return { candidate, score, depth };
    })
    .sort((a, b) => b.score - a.score || b.depth - a.depth);

  return ranked[0]?.candidate ?? null;
}

function collectAncestorChain(node: HTMLElement, boundary: HTMLElement): HTMLElement[] {
  const ancestors: HTMLElement[] = [];
  let current: HTMLElement | null = node;

  while (current) {
    ancestors.push(current);
    if (current === boundary) {
      break;
    }
    current = current.parentElement;
  }

  return ancestors;
}

function findLowestCommonAncestorWithin(first: HTMLElement, second: HTMLElement, boundary: HTMLElement): HTMLElement | null {
  const firstAncestors = new Set(collectAncestorChain(first, boundary));
  for (const ancestor of collectAncestorChain(second, boundary)) {
    if (firstAncestors.has(ancestor)) {
      return ancestor;
    }
  }

  return null;
}

function resolveSignalStackContainer(container: HTMLElement): HTMLElement | null {
  const identityRoot = container.querySelector<HTMLElement>(IDENTITY_MODULE_ROOT_SELECTORS.join(', '));
  if (!identityRoot) {
    return null;
  }

  const viewNameModule = [...container.querySelectorAll<HTMLElement>(RAIL_VIEWNAME_MODULE_SELECTOR)].find(
    (node) => !identityRoot.contains(node)
  );
  const shortcutModule =
    viewNameModule ??
    [...container.querySelectorAll<HTMLElement>(SHORTCUT_SIGNAL_SELECTORS.join(', '))].find((node) => !identityRoot.contains(node));

  if (!shortcutModule) {
    return null;
  }

  const stackRoot = findLowestCommonAncestorWithin(identityRoot, shortcutModule, container);
  return stackRoot ?? null;
}

function resolveMountStackTarget(container: HTMLElement): HTMLElement {
  const signalStack = resolveSignalStackContainer(container);
  if (signalStack) {
    return signalStack;
  }

  const candidates: HTMLElement[] = [container, ...container.querySelectorAll<HTMLElement>('div, section, aside')];
  const rankedCandidates = candidates
    .map((candidate) => {
      if (candidate.matches(RAIL_STACK_SIGNAL_SELECTORS.join(', '))) {
        return null;
      }

      if (candidate.classList.contains('artdeco-card')) {
        return null;
      }

      const children = directElementChildren(candidate);
      const directSignalChildren = children.filter((child) =>
        child.matches(RAIL_STACK_SIGNAL_SELECTORS.join(', ')) || Boolean(child.querySelector(RAIL_STACK_SIGNAL_SELECTORS.join(', ')))
      ).length;
      const directIdentityChildren = children.filter((child) => hasIdentitySignal(child)).length;
      const directModuleChildren = children.filter((child) => hasRailModuleSignal(child)).length;

      if (
        !hasIdentitySignal(candidate) ||
        !hasRailModuleSignal(candidate) ||
        directSignalChildren < 2 ||
        directIdentityChildren < 1 ||
        directModuleChildren < 1
      ) {
        return null;
      }

      let depth = 0;
      let node: HTMLElement | null = candidate;
      while (node && node !== container) {
        depth += 1;
        node = node.parentElement;
      }

      return {
        candidate,
        directSignalChildren,
        directIdentityChildren,
        directModuleChildren,
        depth
      };
    })
    .filter(
      (entry): entry is {
        candidate: HTMLElement;
        directSignalChildren: number;
        directIdentityChildren: number;
        directModuleChildren: number;
        depth: number;
      } => entry !== null
    )
    .sort(
      (a, b) =>
        b.directSignalChildren - a.directSignalChildren ||
        b.directModuleChildren - a.directModuleChildren ||
        b.directIdentityChildren - a.directIdentityChildren ||
        b.depth - a.depth
    );

  if (rankedCandidates.length > 0) {
    return rankedCandidates[0].candidate;
  }

  return container;
}

function normalizeRailMountTarget(target: HTMLElement): HTMLElement {
  let node: HTMLElement = target;

  while (node.parentElement) {
    const styles = window.getComputedStyle(node);
    if (styles.display === 'contents' || styles.position === 'absolute') {
      node = node.parentElement;
      continue;
    }

    break;
  }

  return node;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getViewportWidth(): number {
  return Math.max(window.innerWidth, document.documentElement?.clientWidth ?? 0, 0);
}

function getViewportHeight(): number {
  return Math.max(window.innerHeight, document.documentElement?.clientHeight ?? 0, 0);
}

function getDefaultFloatingPanelLayout(): FloatingPanelLayout {
  const viewportWidth = getViewportWidth();
  const viewportHeight = getViewportHeight();
  const maxWidth = Math.max(FLOATING_PANEL_MIN_WIDTH, viewportWidth - FLOATING_PANEL_MARGIN * 2);
  const maxHeight = Math.max(FLOATING_PANEL_MIN_HEIGHT, viewportHeight - FLOATING_PANEL_MARGIN * 2);
  const width = clamp(FLOATING_PANEL_DEFAULT_WIDTH, FLOATING_PANEL_MIN_WIDTH, maxWidth);
  const height = clamp(FLOATING_PANEL_DEFAULT_HEIGHT, FLOATING_PANEL_MIN_HEIGHT, maxHeight);
  const top = clamp(
    FLOATING_PANEL_DEFAULT_TOP,
    FLOATING_PANEL_MARGIN,
    Math.max(FLOATING_PANEL_MARGIN, viewportHeight - FLOATING_PANEL_MARGIN - height)
  );
  const left = clamp(
    FLOATING_PANEL_MARGIN,
    FLOATING_PANEL_MARGIN,
    Math.max(FLOATING_PANEL_MARGIN, viewportWidth - FLOATING_PANEL_MARGIN - width)
  );

  return {
    undocked: false,
    left,
    top,
    width,
    height
  };
}

function normalizeFloatingPanelLayout(input: Partial<FloatingPanelLayout>): FloatingPanelLayout {
  const defaults = getDefaultFloatingPanelLayout();
  const viewportWidth = getViewportWidth();
  const viewportHeight = getViewportHeight();

  const maxWidth = Math.max(FLOATING_PANEL_MIN_WIDTH, viewportWidth - FLOATING_PANEL_MARGIN * 2);
  const maxHeight = Math.max(FLOATING_PANEL_MIN_HEIGHT, viewportHeight - FLOATING_PANEL_MARGIN * 2);
  const width = clamp(typeof input.width === 'number' ? input.width : defaults.width, FLOATING_PANEL_MIN_WIDTH, maxWidth);
  const height = clamp(typeof input.height === 'number' ? input.height : defaults.height, FLOATING_PANEL_MIN_HEIGHT, maxHeight);

  const leftMin = FLOATING_PANEL_MARGIN;
  const leftMax = Math.max(leftMin, viewportWidth - FLOATING_PANEL_MARGIN - width);
  const topMin = FLOATING_PANEL_MARGIN;
  const topMax = Math.max(topMin, viewportHeight - FLOATING_PANEL_MARGIN - height);

  return {
    undocked: Boolean(input.undocked),
    left: clamp(typeof input.left === 'number' ? input.left : defaults.left, leftMin, leftMax),
    top: clamp(typeof input.top === 'number' ? input.top : defaults.top, topMin, topMax),
    width,
    height
  };
}

function readFloatingPanelLayout(): FloatingPanelLayout | null {
  try {
    const raw = window.localStorage.getItem(FLOATING_PANEL_LAYOUT_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<FloatingPanelLayout> | null;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    return normalizeFloatingPanelLayout(parsed);
  } catch {
    return null;
  }
}

function writeFloatingPanelLayout(layout: FloatingPanelLayout): void {
  try {
    window.localStorage.setItem(FLOATING_PANEL_LAYOUT_STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // Ignore storage failures in constrained browser contexts.
  }
}

function readPanelRectLayout(panel: HTMLElement): FloatingPanelLayout {
  const rect = panel.getBoundingClientRect();
  return normalizeFloatingPanelLayout({
    undocked: panel.dataset.mount === 'fixed',
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height
  });
}

function clearPanelInlineLayoutStyles(panel: HTMLElement): void {
  panel.style.removeProperty('left');
  panel.style.removeProperty('top');
  panel.style.removeProperty('width');
  panel.style.removeProperty('height');
  panel.style.removeProperty('min-width');
  panel.style.removeProperty('max-width');
}

function applyFixedPanelLayout(panel: HTMLElement, layout: FloatingPanelLayout): void {
  panel.style.left = `${layout.left}px`;
  panel.style.top = `${layout.top}px`;
  panel.style.width = `${layout.width}px`;
  panel.style.height = `${layout.height}px`;
}

function isPopupHeightMessage(value: unknown): value is PopupHeightMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    'source' in value &&
    'type' in value &&
    'height' in value &&
    (value as { source?: unknown }).source === POPUP_MESSAGE_SOURCE &&
    (value as { type?: unknown }).type === POPUP_HEIGHT_MESSAGE_TYPE &&
    typeof (value as { height?: unknown }).height === 'number'
  );
}

function getFloatingPanelFrameWrap(panel: HTMLElement): HTMLElement | null {
  return panel.querySelector<HTMLElement>('.cleanedin-floating-options__frame-wrap');
}

function getFloatingPanelFrame(panel: HTMLElement): HTMLIFrameElement | null {
  return panel.querySelector<HTMLIFrameElement>('.cleanedin-floating-options__frame');
}

function readReportedPopupHeight(panel: HTMLElement): number | null {
  const raw = panel.getAttribute(FLOATING_PANEL_POPUP_HEIGHT_ATTR);
  if (!raw) {
    return null;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.round(parsed);
}

function syncEmbeddedPopupHeight(panel: HTMLElement): void {
  const frameWrap = getFloatingPanelFrameWrap(panel);
  const iframe = getFloatingPanelFrame(panel);
  if (!frameWrap || !iframe) {
    return;
  }

  if (panel.dataset.mount !== 'rail') {
    frameWrap.style.removeProperty('height');
    iframe.style.removeProperty('height');
    return;
  }

  const reportedHeight = readReportedPopupHeight(panel);
  if (!reportedHeight) {
    frameWrap.style.removeProperty('height');
    iframe.style.removeProperty('height');
    return;
  }

  frameWrap.style.height = `${reportedHeight}px`;
  iframe.style.height = `${reportedHeight}px`;
}

function getMeasuredWidth(element: HTMLElement | null | undefined): number | null {
  if (!element) {
    return null;
  }

  const width = element.getBoundingClientRect().width;
  if (!Number.isFinite(width) || width <= 0) {
    return null;
  }

  return width;
}

function resolveDockedPanelWidth(panel: HTMLElement, railMountTarget: HTMLElement): number | null {
  const widthCandidates = new Set<number>();

  const registerWidth = (width: number | null): void => {
    if (typeof width !== 'number') {
      return;
    }

    widthCandidates.add(Math.max(0, Math.floor(width)));
  };

  registerWidth(getMeasuredWidth(railMountTarget));
  registerWidth(getMeasuredWidth(railMountTarget.closest<HTMLElement>('.scaffold-layout__sidebar')));

  const structuralSiblings = directElementChildren(railMountTarget).filter(
    (child) => child !== panel && child.matches('div, section, aside, article')
  );
  registerWidth(getMeasuredWidth(structuralSiblings[structuralSiblings.length - 1] ?? null));

  if (widthCandidates.size === 0) {
    return null;
  }

  return Math.max(0, Math.min(...widthCandidates));
}

function applyRailPanelLayout(panel: HTMLElement, railMountTarget: HTMLElement): void {
  clearPanelInlineLayoutStyles(panel);
  panel.style.width = '100%';
  panel.style.minWidth = '0px';

  const dockedWidth = resolveDockedPanelWidth(panel, railMountTarget);
  if (typeof dockedWidth === 'number' && dockedWidth > 0) {
    panel.style.maxWidth = `${dockedWidth}px`;
  } else {
    panel.style.maxWidth = '100%';
  }

  syncEmbeddedPopupHeight(panel);
}

function syncDockButtonVisibility(panel: HTMLElement): void {
  const dockButton = panel.querySelector<HTMLButtonElement>('.cleanedin-floating-options__dock-btn');
  if (!dockButton) {
    return;
  }

  dockButton.hidden = panel.dataset.mount !== 'fixed';
}

function mountPanelAsFixed(panel: HTMLElement, rawLayout: Partial<FloatingPanelLayout>): FloatingPanelLayout {
  const nextLayout = normalizeFloatingPanelLayout({ ...rawLayout, undocked: true });
  panel.dataset.mount = 'fixed';
  if (panel.parentElement !== document.body) {
    document.body.appendChild(panel);
  }

  clearPanelInlineLayoutStyles(panel);
  applyFixedPanelLayout(panel, nextLayout);
  syncEmbeddedPopupHeight(panel);
  syncDockButtonVisibility(panel);
  return nextLayout;
}

function mountPanelAsRail(panel: HTMLElement, railMountTarget: HTMLElement): void {
  lastKnownRailMountTarget = railMountTarget;
  const anchor = resolveRailInsertionAnchor(railMountTarget);
  if (anchor?.parentElement) {
    anchor.parentElement.insertBefore(panel, anchor.nextSibling);
  } else {
    railMountTarget.append(panel);
  }

  panel.dataset.mount = 'rail';
  applyRailPanelLayout(panel, railMountTarget);
  syncDockButtonVisibility(panel);
}

function undockPanel(panel: HTMLElement): FloatingPanelLayout {
  const currentLayout = readPanelRectLayout(panel);
  const undockedLayout = mountPanelAsFixed(panel, { ...currentLayout, undocked: true });
  writeFloatingPanelLayout(undockedLayout);
  return undockedLayout;
}

function dockPanel(panel: HTMLElement): boolean {
  const railMountTarget =
    (lastKnownRailMountTarget && lastKnownRailMountTarget.isConnected ? lastKnownRailMountTarget : null) ??
    resolveLinkedInLeftRailMountTarget();
  if (!railMountTarget) {
    return false;
  }

  const currentLayout = readPanelRectLayout(panel);
  writeFloatingPanelLayout({ ...currentLayout, undocked: false });
  mountPanelAsRail(panel, railMountTarget);
  return true;
}

function setupFloatingPanelInteractions(panel: HTMLElement): void {
  if (panel.getAttribute('data-cleanedin-panel-ready') === '1') {
    syncEmbeddedPopupHeight(panel);
    syncDockButtonVisibility(panel);
    return;
  }

  const header = panel.querySelector<HTMLElement>('.cleanedin-floating-options__header');
  const resizeHandle = panel.querySelector<HTMLElement>('.cleanedin-floating-options__resize-handle');
  const dockButton = panel.querySelector<HTMLButtonElement>('.cleanedin-floating-options__dock-btn');
  const iframe = getFloatingPanelFrame(panel);

  if (!header || !resizeHandle || !dockButton || !iframe) {
    return;
  }

  panel.setAttribute('data-cleanedin-panel-ready', '1');

  const syncFrameHeightFromMessage = (event: MessageEvent): void => {
    if (!panel.isConnected) {
      window.removeEventListener('message', syncFrameHeightFromMessage);
      return;
    }

    if (event.source !== iframe.contentWindow) {
      return;
    }

    if (!isPopupHeightMessage(event.data)) {
      return;
    }

    panel.setAttribute(FLOATING_PANEL_POPUP_HEIGHT_ATTR, String(Math.max(1, Math.round(event.data.height))));
    syncEmbeddedPopupHeight(panel);
  };

  window.addEventListener('message', syncFrameHeightFromMessage);

  const setPointerCaptureIfSupported = (target: HTMLElement, pointerId: number): void => {
    if (typeof target.setPointerCapture === 'function') {
      target.setPointerCapture(pointerId);
    }
  };

  const releasePointerCaptureIfSupported = (target: HTMLElement, pointerId: number): void => {
    if (typeof target.hasPointerCapture === 'function' && target.hasPointerCapture(pointerId)) {
      target.releasePointerCapture(pointerId);
    }
  };

  const stopGesture = (
    pointerId: number,
    move: (event: PointerEvent) => void,
    finish: (event: PointerEvent) => void
  ): void => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', finish);
    window.removeEventListener('pointercancel', finish);
    releasePointerCaptureIfSupported(header, pointerId);
    releasePointerCaptureIfSupported(resizeHandle, pointerId);
  };

  const startDrag = (event: PointerEvent): void => {
    if (event.button !== 0) {
      return;
    }

    if (event.target instanceof Element && event.target.closest('button')) {
      return;
    }

    event.preventDefault();
    let currentLayout = undockPanel(panel);
    const pointerId = event.pointerId;
    const startLeft = currentLayout.left;
    const startTop = currentLayout.top;
    const startX = event.clientX;
    const startY = event.clientY;

    panel.dataset.dragging = 'true';
    setPointerCaptureIfSupported(header, pointerId);

    const move = (moveEvent: PointerEvent): void => {
      if (moveEvent.pointerId !== pointerId) {
        return;
      }

      currentLayout = normalizeFloatingPanelLayout({
        undocked: true,
        left: startLeft + (moveEvent.clientX - startX),
        top: startTop + (moveEvent.clientY - startY),
        width: currentLayout.width,
        height: currentLayout.height
      });
      applyFixedPanelLayout(panel, currentLayout);
    };

    const finish = (finishEvent: PointerEvent): void => {
      if (finishEvent.pointerId !== pointerId) {
        return;
      }

      panel.removeAttribute('data-dragging');
      stopGesture(pointerId, move, finish);
      currentLayout = normalizeFloatingPanelLayout({ ...readPanelRectLayout(panel), undocked: true });
      applyFixedPanelLayout(panel, currentLayout);
      writeFloatingPanelLayout(currentLayout);
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
  };

  const startResize = (event: PointerEvent): void => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    let currentLayout = undockPanel(panel);
    const pointerId = event.pointerId;
    const startWidth = currentLayout.width;
    const startHeight = currentLayout.height;
    const startLeft = currentLayout.left;
    const startTop = currentLayout.top;
    const startX = event.clientX;
    const startY = event.clientY;

    panel.dataset.resizing = 'true';
    setPointerCaptureIfSupported(resizeHandle, pointerId);

    const move = (moveEvent: PointerEvent): void => {
      if (moveEvent.pointerId !== pointerId) {
        return;
      }

      currentLayout = normalizeFloatingPanelLayout({
        undocked: true,
        left: startLeft,
        top: startTop,
        width: startWidth + (moveEvent.clientX - startX),
        height: startHeight + (moveEvent.clientY - startY)
      });
      applyFixedPanelLayout(panel, currentLayout);
    };

    const finish = (finishEvent: PointerEvent): void => {
      if (finishEvent.pointerId !== pointerId) {
        return;
      }

      panel.removeAttribute('data-resizing');
      stopGesture(pointerId, move, finish);
      currentLayout = normalizeFloatingPanelLayout({ ...readPanelRectLayout(panel), undocked: true });
      applyFixedPanelLayout(panel, currentLayout);
      writeFloatingPanelLayout(currentLayout);
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
  };

  header.addEventListener('pointerdown', startDrag);
  resizeHandle.addEventListener('pointerdown', startResize);
  dockButton.addEventListener('pointerdown', (event) => {
    event.stopPropagation();
  });
  dockButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    dockPanel(panel);
  });

  syncDockButtonVisibility(panel);
}

function resolveRailInsertionAnchor(container: HTMLElement): HTMLElement | null {
  const directChildren = directElementChildren(container);
  const isArtdecoCardLike = (node: HTMLElement): boolean =>
    node.classList.contains('artdeco-card') || Boolean(node.querySelector(':scope > .artdeco-card'));
  const nonInteractiveCards = directChildren.filter(
    (child) =>
      !child.matches('a, button, [role="button"]') &&
      (isArtdecoCardLike(child) || hasIdentitySignal(child) || hasRailModuleSignal(child))
  );
  const railCards =
    nonInteractiveCards.length > 0
      ? nonInteractiveCards
      : directChildren.filter((child) => hasIdentitySignal(child) || hasRailModuleSignal(child));

  if (railCards.length > 0) {
    return railCards[Math.min(RAIL_INSERTION_CARD_INDEX, railCards.length - 1)] ?? null;
  }

  for (const child of directChildren) {
    const nestedChildren = directElementChildren(child);
    const nestedNonInteractiveCards = nestedChildren.filter(
      (nestedChild) =>
        !nestedChild.matches('a, button, [role="button"]') &&
        (isArtdecoCardLike(nestedChild) || hasIdentitySignal(nestedChild) || hasRailModuleSignal(nestedChild))
    );
    const nestedRailCards =
      nestedNonInteractiveCards.length > 0
        ? nestedNonInteractiveCards
        : nestedChildren.filter((nestedChild) => hasIdentitySignal(nestedChild) || hasRailModuleSignal(nestedChild));

    if (nestedRailCards.length > 0) {
      return nestedRailCards[Math.min(RAIL_INSERTION_CARD_INDEX, nestedRailCards.length - 1)] ?? null;
    }
  }

  return null;
}

function resolveLinkedInLeftRailMountTarget(): HTMLElement | null {
  const railHost = resolveLinkedInLeftRailHost() ?? resolveSignalBasedRailHost();
  if (!railHost) {
    return null;
  }

  const stickyHost =
    railHost.querySelector<HTMLElement>(':scope > .scaffold-layout__sticky') ?? railHost.querySelector<HTMLElement>('.scaffold-layout__sticky');
  const stickyContent =
    stickyHost?.querySelector<HTMLElement>(':scope > .scaffold-layout__sticky-content') ??
    stickyHost?.querySelector<HTMLElement>('.scaffold-layout__sticky-content') ??
    null;

  if (!stickyHost && !stickyContent) {
    return normalizeRailMountTarget(resolveMountStackTarget(railHost));
  }

  const stackTarget = resolveMountStackTarget(stickyContent ?? stickyHost ?? railHost);
  return normalizeRailMountTarget(stackTarget);
}

function getFloatingPanelRoot(): HTMLElement {
  const panel = document.createElement('section');
  panel.id = FLOATING_PANEL_ID;
  panel.setAttribute('data-cleanedin-ui', '1');
  panel.setAttribute('data-mount', 'rail');

  const header = document.createElement('header');
  header.className = 'cleanedin-floating-options__header';

  const title = document.createElement('strong');
  title.textContent = 'CleanedIn Options';

  const headerActions = document.createElement('div');
  headerActions.className = 'cleanedin-floating-options__actions';

  const dockButton = document.createElement('button');
  dockButton.type = 'button';
  dockButton.className = 'cleanedin-floating-options__dock-btn';
  dockButton.textContent = 'Dock';
  dockButton.hidden = true;

  const frameWrap = document.createElement('div');
  frameWrap.className = 'cleanedin-floating-options__frame-wrap';

  const iframe = document.createElement('iframe');
  iframe.className = 'cleanedin-floating-options__frame';
  iframe.src = chrome.runtime.getURL('src/popup/index.html');
  iframe.title = 'CleanedIn options';
  iframe.scrolling = 'no';

  const resizeHandle = document.createElement('button');
  resizeHandle.type = 'button';
  resizeHandle.className = 'cleanedin-floating-options__resize-handle';
  resizeHandle.setAttribute('aria-label', 'Resize options panel');

  headerActions.appendChild(dockButton);
  header.append(title, headerActions);
  frameWrap.appendChild(iframe);
  panel.append(header, frameWrap, resizeHandle);

  return panel;
}

const CATEGORY_BADGE_LABELS = {
  ad: 'ads/promoted',
  suggested: 'suggested',
  recommendation: 'recommendation',
  liked: 'liked',
  loved: 'loved',
  supported: 'supported',
  celebrated: 'celebrated',
  funny: 'funny',
  insightful: 'insightful',
  commented: 'commented',
  followed: 'followed/following',
  shared: 'shared/reposted',
  video: 'video',
  poll: 'poll',
  image: 'image',
  link: 'link',
  carousel: 'carousel/document'
} as const;

const CONNECTION_LEVEL_LABELS = {
  following: 'following',
  first: '1st',
  second: '2nd',
  third_plus: '3rd+'
} as const;

const PROFILE_TYPE_LABELS = {
  individual: 'individual',
  company: 'company',
  group: 'group',
  other: 'other'
} as const;

const REACTION_CATEGORIES = new Set(['liked', 'loved', 'supported', 'celebrated', 'funny', 'insightful', 'commented']);

const DECISION_REASON_LABELS = {
  category_match: 'category rule',
  include_keyword_miss: 'missing include keyword',
  exclude_keyword_match: 'exclude keyword',
  hidden_name_match: 'hidden name',
  connection_level_match: 'connection level',
  profile_type_match: 'profile type',
  age_exceeded: 'age limit'
} as const;

function ensureStyleInjection(): void {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const styleEl = document.createElement('style');
  styleEl.id = STYLE_ID;
  styleEl.textContent = contentStyles;
  document.head.appendChild(styleEl);
}

function formatActorName(raw: string | null): string | null {
  if (!raw) {
    return null;
  }

  const value = raw.trim();
  if (!value) {
    return null;
  }

  if (/[A-Z]/.test(value)) {
    return value;
  }

  return value
    .split(/\s+/)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ');
}

function getPrimaryActorName(post: PostFeatures): string | null {
  return formatActorName(post.actorNames[0] ?? null);
}

function formatKeywordList(keywords: string[]): string {
  return keywords
    .map((keyword) => keyword.trim())
    .filter(Boolean)
    .slice(0, 3)
    .map((keyword) => `"${keyword}"`)
    .join(', ');
}

function getBadgeTone(post: PostFeatures, decision: PostDecision): string {
  if (decision.hiddenCategory) {
    if (decision.hiddenCategory === 'ad') {
      return 'ad';
    }

    if (decision.hiddenCategory === 'suggested' || decision.hiddenCategory === 'recommendation') {
      return 'suggested';
    }

    if (REACTION_CATEGORIES.has(decision.hiddenCategory)) {
      return 'reaction';
    }

    if (decision.hiddenCategory === 'followed') {
      return 'connection';
    }

    return 'media';
  }

  if (decision.reasons.includes('connection_level_match')) {
    return 'connection';
  }

  if (decision.reasons.includes('profile_type_match')) {
    return 'profile';
  }

  if (decision.reasons.includes('hidden_name_match')) {
    return 'name';
  }

  if (decision.reasons.includes('age_exceeded')) {
    return 'age';
  }

  if (decision.reasons.includes('include_keyword_miss') || decision.reasons.includes('exclude_keyword_match')) {
    return 'keyword';
  }

  return 'generic';
}

function badgeText(post: PostFeatures, decision: PostDecision, settings: FilterSettings): string {
  const context = decision.reasonContext;

  if (decision.hiddenCategory) {
    const category = decision.hiddenCategory;
    const actorName = getPrimaryActorName(post);
    const matchedConnectionLevel = context.matchedConnectionLevel ?? post.connectionLevel;

    if (category === 'followed' && matchedConnectionLevel) {
      return `Post hidden (${CONNECTION_LEVEL_LABELS[matchedConnectionLevel]})`;
    }

    if (category === 'followed' && actorName) {
      return `Post hidden: followed by ${actorName}`;
    }

    if (REACTION_CATEGORIES.has(category) && actorName) {
      return `Post hidden: ${CATEGORY_BADGE_LABELS[category]} by ${actorName}`;
    }

    return `Post hidden: ${CATEGORY_BADGE_LABELS[category]}`;
  }

  if (decision.reasons.includes('connection_level_match')) {
    const matchedConnectionLevel = context.matchedConnectionLevel ?? post.connectionLevel;
    if (matchedConnectionLevel) {
      return `Post hidden (${CONNECTION_LEVEL_LABELS[matchedConnectionLevel]})`;
    }

    return 'Post hidden (connection level)';
  }

  if (decision.reasons.includes('profile_type_match')) {
    const matchedProfileType = context.matchedProfileType ?? post.profileType;
    if (matchedProfileType) {
      return `Post hidden (${PROFILE_TYPE_LABELS[matchedProfileType]})`;
    }

    return 'Post hidden (profile type)';
  }

  if (decision.reasons.includes('age_exceeded')) {
    const days = context.ageLimitDays ?? settings.ageFilter.maxAgeDays;
    if (typeof days === 'number') {
      const suffix = days === 1 ? '' : 's';
      return `Post hidden (older than ${days} day${suffix})`;
    }

    return 'Post hidden (age limit)';
  }

  if (decision.reasons.includes('hidden_name_match')) {
    const matchedName = formatActorName(context.matchedName) ?? getPrimaryActorName(post);
    return matchedName ? `Post hidden (name: ${matchedName})` : 'Post hidden (name filter)';
  }

  if (decision.reasons.includes('exclude_keyword_match')) {
    if (context.matchedKeyword) {
      return `Post hidden (keyword: "${context.matchedKeyword}")`;
    }

    return 'Post hidden (exclude keyword)';
  }

  if (decision.reasons.includes('include_keyword_miss')) {
    const missingKeywords =
      context.missingKeywords.length > 0 ? context.missingKeywords : settings.includeKeywords.slice(0, 3);
    const keywordContext = formatKeywordList(missingKeywords);
    return keywordContext ? `Post hidden (missing include: ${keywordContext})` : 'Post hidden (missing include keyword)';
  }

  const reasonText = decision.reasons.map((reason) => DECISION_REASON_LABELS[reason]).join(', ');
  return `Post hidden (${reasonText || 'rule match'})`;
}

function isBadgeElement(node: Element | null): node is HTMLElement {
  return node instanceof HTMLElement && node.classList.contains(BADGE_CLASS);
}

function findAdjacentBadge(root: HTMLElement): HTMLElement | null {
  const previous = root.previousElementSibling;
  return isBadgeElement(previous) ? previous : null;
}

function removeAdjacentBadge(root: HTMLElement): void {
  findAdjacentBadge(root)?.remove();
}

function findBadgesByPostId(postId: string): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(`.${BADGE_CLASS}[${BADGE_FOR_ATTR}]`)].filter(
    (badge) => badge.getAttribute(BADGE_FOR_ATTR) === postId
  );
}

function removeBadgesByPostId(postId: string): void {
  for (const badge of findBadgesByPostId(postId)) {
    badge.remove();
  }
}

function pruneStaleBadges(): void {
  for (const badge of document.querySelectorAll<HTMLElement>(`.${BADGE_CLASS}[${BADGE_FOR_ATTR}]`)) {
    const postId = badge.getAttribute(BADGE_FOR_ATTR);
    const root = badge.nextElementSibling;
    const isValidAdjacentRoot =
      postId &&
      root instanceof HTMLElement &&
      root.isConnected &&
      root.getAttribute(POST_ID_ATTR) === postId &&
      root.classList.contains(HIDDEN_CLASS);

    if (!isValidAdjacentRoot) {
      badge.remove();
    }
  }
}

function showPost(root: HTMLElement, postId: string): void {
  root.classList.remove(HIDDEN_CLASS);
  root.removeAttribute('data-cleanedin-hidden');
  root.setAttribute(POST_ID_ATTR, postId);
  removeBadgesByPostId(postId);
  removeAdjacentBadge(root);
}

function hidePost(root: HTMLElement): void {
  root.classList.add(HIDDEN_CLASS);
  root.setAttribute('data-cleanedin-hidden', 'true');
}

function mountBadge(post: PostFeatures, decision: PostDecision, settings: FilterSettings): void {
  if (!post.root.parentElement) {
    return;
  }

  const adjacentBadge = findAdjacentBadge(post.root);
  if (adjacentBadge && adjacentBadge.getAttribute(BADGE_FOR_ATTR) === post.postId) {
    const textEl = adjacentBadge.querySelector('span');
    if (textEl) {
      textEl.textContent = badgeText(post, decision, settings);
    }

    adjacentBadge.dataset.cleanedinTone = getBadgeTone(post, decision);
    return;
  }

  if (adjacentBadge) {
    adjacentBadge.remove();
  }

  removeBadgesByPostId(post.postId);

  const existing = findAdjacentBadge(post.root);
  if (existing) {
    const textEl = existing.querySelector('span');
    if (textEl) {
      textEl.textContent = badgeText(post, decision, settings);
    }

    existing.dataset.cleanedinTone = getBadgeTone(post, decision);
    return;
  }

  const badge = document.createElement('div');
  badge.className = BADGE_CLASS;
  badge.setAttribute(BADGE_FOR_ATTR, post.postId);
  badge.setAttribute('data-cleanedin-ui', '1');
  badge.dataset.cleanedinTone = getBadgeTone(post, decision);

  const text = document.createElement('span');
  text.textContent = badgeText(post, decision, settings);

  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Show once';
  button.addEventListener('click', () => {
    temporaryRevealPostIds.add(post.postId);
    showPost(post.root, post.postId);
  });

  badge.append(text, button);
  post.root.parentElement.insertBefore(badge, post.root);
}

export function clearTemporaryReveals(): void {
  temporaryRevealPostIds.clear();
}

export function clearAllHiddenBadges(): void {
  for (const badge of document.querySelectorAll<HTMLElement>(`.${BADGE_CLASS}`)) {
    badge.remove();
  }
}

export function ensureFloatingOptionsPanel(): void {
  ensureStyleInjection();
  const existing = document.getElementById(FLOATING_PANEL_ID);
  const panel = existing instanceof HTMLElement ? existing : getFloatingPanelRoot();
  setupFloatingPanelInteractions(panel);
  const railMountTarget = resolveLinkedInLeftRailMountTarget();
  if (railMountTarget) {
    lastKnownRailMountTarget = railMountTarget;
  }

  const storedLayout = readFloatingPanelLayout();
  if (storedLayout?.undocked) {
    mountPanelAsFixed(panel, storedLayout);
    return;
  }

  if (railMountTarget) {
    mountPanelAsRail(panel, railMountTarget);
    return;
  }

  mountPanelAsFixed(panel, storedLayout ?? getDefaultFloatingPanelLayout());
}

export function removeFloatingOptionsPanel(): void {
  document.getElementById(FLOATING_PANEL_ID)?.remove();
}

export function applyPostRendering(post: PostFeatures, decision: PostDecision, settings: FilterSettings): void {
  ensureStyleInjection();

  if (!post.root.isConnected) {
    temporaryRevealPostIds.delete(post.postId);
    removeBadgesByPostId(post.postId);
    return;
  }

  post.root.setAttribute(POST_ID_ATTR, post.postId);
  pruneStaleBadges();

  if (temporaryRevealPostIds.has(post.postId)) {
    showPost(post.root, post.postId);
    return;
  }

  if (decision.hide) {
    if (settings.showBadgeOnHidden && !post.root.parentElement) {
      // Keep post visible when a contextual badge cannot be mounted.
      showPost(post.root, post.postId);
      return;
    }

    hidePost(post.root);
    if (settings.showBadgeOnHidden) {
      mountBadge(post, decision, settings);
    } else {
      removeBadgesByPostId(post.postId);
      removeAdjacentBadge(post.root);
    }
    return;
  }

  showPost(post.root, post.postId);
}
