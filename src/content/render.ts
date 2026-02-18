import contentStyles from './styles.css?inline';
import type { FilterSettings, PostDecision, PostFeatures } from '../shared/types';

const STYLE_ID = 'cleanedin-content-styles';
const HIDDEN_CLASS = 'cleanedin-hidden';
const BADGE_CLASS = 'cleanedin-badge';
const BADGE_FOR_ATTR = 'data-cleanedin-badge-for';
const FLOATING_PANEL_ID = 'cleanedin-floating-options';
const LEFT_RAIL_CANDIDATE_SELECTORS = ['main .scaffold-layout__sidebar', 'main .scaffold-layout__aside', 'main aside'] as const;
const IDENTITY_MODULE_ROOT_SELECTORS = ['[data-view-name="identity-module"]', '.feed-identity-module'] as const;

const temporaryRevealRoots = new Set<HTMLElement>();
const badgeByRoot = new WeakMap<HTMLElement, HTMLElement>();

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
  const sidebarCandidates = [...document.querySelectorAll<HTMLElement>('main .scaffold-layout__sidebar')].filter(
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

function resolveRailInsertionAnchor(container: HTMLElement): HTMLElement | null {
  const railCards = directElementChildren(container).filter((child) => hasIdentitySignal(child) || hasRailModuleSignal(child));
  if (railCards.length > 0) {
    return railCards[railCards.length - 1] ?? null;
  }

  for (const child of directElementChildren(container)) {
    const nestedRailCards = directElementChildren(child).filter((nestedChild) => hasIdentitySignal(nestedChild) || hasRailModuleSignal(nestedChild));
    if (nestedRailCards.length > 0) {
      return nestedRailCards[nestedRailCards.length - 1] ?? null;
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

  if (!stickyHost) {
    return normalizeRailMountTarget(resolveMountStackTarget(railHost));
  }

  const stackTarget = resolveMountStackTarget(stickyHost);
  return normalizeRailMountTarget(stackTarget);
}

function getFloatingPanelRoot(): HTMLElement {
  const panel = document.createElement('section');
  panel.id = FLOATING_PANEL_ID;
  panel.setAttribute('data-cleanedin-ui', '1');

  const header = document.createElement('header');
  header.className = 'cleanedin-floating-options__header';

  const title = document.createElement('strong');
  title.textContent = 'CleanedIn Options';

  const frameWrap = document.createElement('div');
  frameWrap.className = 'cleanedin-floating-options__frame-wrap';

  const iframe = document.createElement('iframe');
  iframe.className = 'cleanedin-floating-options__frame';
  iframe.src = chrome.runtime.getURL('src/popup/index.html');
  iframe.title = 'CleanedIn options';

  header.append(title);
  frameWrap.appendChild(iframe);
  panel.append(header, frameWrap);

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

function removeBadge(root: HTMLElement): void {
  const existing = badgeByRoot.get(root);
  if (existing) {
    existing.remove();
    badgeByRoot.delete(root);
  }
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

function showPost(root: HTMLElement, postId: string): void {
  root.classList.remove(HIDDEN_CLASS);
  root.removeAttribute('data-cleanedin-hidden');
  removeBadgesByPostId(postId);
  removeBadge(root);
}

function hidePost(root: HTMLElement): void {
  root.classList.add(HIDDEN_CLASS);
  root.setAttribute('data-cleanedin-hidden', 'true');
}

function mountBadge(post: PostFeatures, decision: PostDecision, settings: FilterSettings): void {
  if (!post.root.parentElement) {
    return;
  }

  const existing = badgeByRoot.get(post.root);
  if (existing?.isConnected) {
    const textEl = existing.querySelector('span');
    if (textEl) {
      textEl.textContent = badgeText(post, decision, settings);
    }

    existing.dataset.cleanedinTone = getBadgeTone(post, decision);
    return;
  }

  removeBadgesByPostId(post.postId);

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
    temporaryRevealRoots.add(post.root);
    showPost(post.root, post.postId);
  });

  badge.append(text, button);
  post.root.parentElement.insertBefore(badge, post.root);
  badgeByRoot.set(post.root, badge);
}

export function clearTemporaryReveals(): void {
  temporaryRevealRoots.clear();
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
  const railMountTarget = resolveLinkedInLeftRailMountTarget();

  if (railMountTarget) {
    const anchor = resolveRailInsertionAnchor(railMountTarget);
    if (anchor?.parentElement) {
      anchor.parentElement.insertBefore(panel, anchor.nextSibling);
    } else {
      railMountTarget.append(panel);
    }
    panel.dataset.mount = 'rail';
    return;
  }

  panel.dataset.mount = 'fixed';
  if (panel.parentElement !== document.body) {
    document.body.appendChild(panel);
  }
}

export function removeFloatingOptionsPanel(): void {
  document.getElementById(FLOATING_PANEL_ID)?.remove();
}

export function applyPostRendering(post: PostFeatures, decision: PostDecision, settings: FilterSettings): void {
  ensureStyleInjection();

  if (!post.root.isConnected) {
    temporaryRevealRoots.delete(post.root);
    removeBadgesByPostId(post.postId);
    removeBadge(post.root);
    return;
  }

  if (temporaryRevealRoots.has(post.root)) {
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
      removeBadge(post.root);
    }
    return;
  }

  showPost(post.root, post.postId);
}
