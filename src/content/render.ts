import contentStyles from './styles.css?inline';
import type { FilterSettings, PostDecision, PostFeatures } from '../shared/types';

const STYLE_ID = 'cleanedin-content-styles';
const HIDDEN_CLASS = 'cleanedin-hidden';
const BADGE_CLASS = 'cleanedin-badge';
const BADGE_FOR_ATTR = 'data-cleanedin-badge-for';

const temporaryRevealRoots = new Set<HTMLElement>();
const badgeByRoot = new WeakMap<HTMLElement, HTMLElement>();

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
