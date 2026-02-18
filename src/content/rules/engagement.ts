import type { CategoryRule } from './types';
import { rootHasAnySelector } from './helpers';

const LEAD_TEXT_LENGTH = 360;
const LEAD_POST_PREFIX = 'feedpost';
const LEAD_ACTIVITY_MAX_OFFSET = 120;
const LEAD_CONTEXT_MAX_LENGTH = 220;

const SUGGESTED_LEAD_TOKENS = ['feedpostsuggested'];
const RECOMMENDATION_LEAD_TOKENS = ['feedpostrecommendedforyou', 'feedpostjobsrecommendedforyou'];

const LIKED_LEAD_TOKENS = ['likesthis', 'likedthis'];
const LOVED_LEAD_TOKENS = ['lovesthis', 'lovedthis'];
const SUPPORTED_LEAD_TOKENS = ['supportsthis', 'supportedthis'];
const CELEBRATED_LEAD_TOKENS = ['celebratesthis', 'celebratedthis'];
const FUNNY_LEAD_TOKENS = ['findsthisfunny'];
const INSIGHTFUL_LEAD_TOKENS = ['findsthisinsightful'];

const COMMENTED_LEAD_TOKENS = ['commentedonthis'];
const FOLLOWED_LEAD_TOKENS = ['followedthis'];
const FOLLOWS_LEAD_TOKENS = ['follows'];
const SHARED_LEAD_TOKENS = ['repostedthis', 'resharedthis'];
const FOLLOW_ACTIVITY_HEADER_SELECTOR = [
  '[data-view-name="feed-header-text"]',
  '[data-view-name*="feed-header"]',
  '[data-view-name*="feed-actor"]'
].join(', ');
const HEADER_ACTIVITY_EXCLUDE_SELECTOR = [
  '[data-view-name="feed-commentary"]',
  '[data-view-name^="comment-"]',
  '[data-view-name*="comment-"]',
  '[data-testid*="comment"]'
].join(', ');

function compactText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function getLeadActivityText(post: Parameters<CategoryRule['match']>[0]): string {
  return post.textContent.slice(0, LEAD_TEXT_LENGTH).toLowerCase().replace(/\s+/g, '');
}

function getLeadContextText(post: Parameters<CategoryRule['match']>[0]): string {
  return post.textContent.slice(0, LEAD_CONTEXT_MAX_LENGTH).toLowerCase().replace(/\s+/g, ' ');
}

function hasLeadActivityContext(post: Parameters<CategoryRule['match']>[0]): boolean {
  const lead = getLeadContextText(post);
  if (lead.replace(/\s+/g, '').startsWith(LEAD_POST_PREFIX)) {
    return true;
  }

  if (post.hasTimestamp || post.connectionLevel !== null) {
    return true;
  }

  if (/[•·|]/.test(lead)) {
    return true;
  }

  if (/\b(?:1st|2nd|3rd\+?|following)\b/.test(lead)) {
    return true;
  }

  return /\b\d+\s*(?:h|hr|hrs|hour|hours|d|day|days|w|wk|wks|week|weeks|mo|month|months|y|yr|yrs|year|years)\b/.test(
    lead
  );
}

function hasLeadActivityToken(
  post: Parameters<CategoryRule['match']>[0],
  tokens: string[],
  maxOffset = LEAD_ACTIVITY_MAX_OFFSET,
  requireContext = true
): boolean {
  if (requireContext && !hasLeadActivityContext(post)) {
    return false;
  }

  const lead = getLeadActivityText(post);

  return tokens.some((token) => {
    const index = lead.indexOf(token);
    return index >= 0 && index <= maxOffset;
  });
}

function textIncludesAny(post: Parameters<CategoryRule['match']>[0], phrases: string[]): boolean {
  const text = post.textContent.toLowerCase();
  return phrases.some((phrase) => text.includes(phrase));
}

function leadContextIncludesAny(post: Parameters<CategoryRule['match']>[0], phrases: string[]): boolean {
  const lead = getLeadContextText(post);
  return phrases.some((phrase) => lead.includes(phrase));
}

function collectHeaderActivityTexts(post: Parameters<CategoryRule['match']>[0]): string[] {
  const scope = post.contentRoot ?? post.root;
  const headerTexts: string[] = [];
  const seen = new Set<string>();
  const headerNodes = [...scope.querySelectorAll<HTMLElement>(FOLLOW_ACTIVITY_HEADER_SELECTOR)].slice(0, 10);

  const register = (raw: string | null, maxLength = 260): void => {
    if (!raw) {
      return;
    }

    const normalized = raw.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, maxLength);
    if (!normalized || seen.has(normalized)) {
      return;
    }

    seen.add(normalized);
    headerTexts.push(normalized);
  };

  for (const node of headerNodes) {
    if (node.closest(HEADER_ACTIVITY_EXCLUDE_SELECTOR)) {
      continue;
    }

    register(node.textContent, 180);
    register(node.parentElement?.textContent ?? null);
    register(node.closest<HTMLElement>('[data-view-name*="feed-header"], [data-view-name*="feed-actor"]')?.textContent ?? null);
  }

  return headerTexts;
}

function hasLikedHeaderActivity(post: Parameters<CategoryRule['match']>[0]): boolean {
  const joinedHeaderText = collectHeaderActivityTexts(post).join(' ');
  if (!joinedHeaderText) {
    return false;
  }

  if (
    /\b(?:likes?|liked)\s+this\b/.test(joinedHeaderText) ||
    /\band\s+\d+\s+other\s+connections?\s+(?:like|likes|liked)\s+this\b/.test(joinedHeaderText)
  ) {
    return true;
  }

  const compactHeaderText = compactText(joinedHeaderText);
  return (
    compactHeaderText.includes('likedthis') ||
    compactHeaderText.includes('likesthis') ||
    /and\d+otherconnections?(?:like|likes|liked)this/.test(compactHeaderText)
  );
}

function hasFollowsHeaderActivity(post: Parameters<CategoryRule['match']>[0]): boolean {
  const joinedHeaderText = collectHeaderActivityTexts(post).join(' ');

  if (!joinedHeaderText) {
    return false;
  }

  if (/\bfollows\b(?!\s+up\b)/.test(joinedHeaderText) || /\bfollowed\s+this\b/.test(joinedHeaderText)) {
    return true;
  }

  const compactHeaderText = compactText(joinedHeaderText);
  return (
    (compactHeaderText.includes('follows') && !compactHeaderText.includes('followsup')) ||
    compactHeaderText.includes('followedthis')
  );
}

export const suggestionRule: CategoryRule = {
  id: 'suggested.structural',
  category: 'suggested',
  priority: 70,
  match: (post) => {
    return (
      hasLeadActivityToken(post, SUGGESTED_LEAD_TOKENS, 40, false) ||
      leadContextIncludesAny(post, ['suggested', 'suggested for you']) ||
      rootHasAnySelector(post, ['[data-test-id*="suggested"]', '[data-view-name*="suggest"]'])
    );
  }
};

export const recommendationRule: CategoryRule = {
  id: 'recommendation.structural',
  category: 'recommendation',
  priority: 68,
  match: (post) => {
    if (hasLeadActivityToken(post, RECOMMENDATION_LEAD_TOKENS, 40, false)) {
      return true;
    }

    if (!textIncludesAny(post, ['recommended for you', 'jobs recommended for you'])) {
      return false;
    }

    return rootHasAnySelector(post, [
      '[data-view-name="feed-call-to-action"]',
      '[data-view-name="feed-update-carousel"]',
      '[data-view-name="edge-creation-follow-action"]',
      '[data-testid="carousel"]'
    ]);
  }
};

export const likedRule: CategoryRule = {
  id: 'liked.activity',
  category: 'liked',
  priority: 60,
  match: (post) => {
    return (
      hasLeadActivityToken(post, LIKED_LEAD_TOKENS) ||
      hasLikedHeaderActivity(post) ||
      leadContextIncludesAny(post, [' liked this ', ' likes this ']) ||
      rootHasAnySelector(post, ['[data-activity-type="LIKE"]'])
    );
  }
};

export const lovedRule: CategoryRule = {
  id: 'loved.activity',
  category: 'loved',
  priority: 60,
  match: (post) => {
    return hasLeadActivityToken(post, LOVED_LEAD_TOKENS) || rootHasAnySelector(post, ['[data-activity-type="LOVE"]']);
  }
};

export const supportedRule: CategoryRule = {
  id: 'supported.activity',
  category: 'supported',
  priority: 60,
  match: (post) => {
    return (
      hasLeadActivityToken(post, SUPPORTED_LEAD_TOKENS) || rootHasAnySelector(post, ['[data-activity-type="SUPPORT"]'])
    );
  }
};

export const celebratedRule: CategoryRule = {
  id: 'celebrated.activity',
  category: 'celebrated',
  priority: 60,
  match: (post) => {
    return (
      hasLeadActivityToken(post, CELEBRATED_LEAD_TOKENS) || rootHasAnySelector(post, ['[data-activity-type="CELEBRATE"]'])
    );
  }
};

export const funnyRule: CategoryRule = {
  id: 'funny.activity',
  category: 'funny',
  priority: 60,
  match: (post) => {
    return hasLeadActivityToken(post, FUNNY_LEAD_TOKENS) || rootHasAnySelector(post, ['[data-activity-type="FUNNY"]']);
  }
};

export const insightfulRule: CategoryRule = {
  id: 'insightful.activity',
  category: 'insightful',
  priority: 60,
  match: (post) => {
    return (
      hasLeadActivityToken(post, INSIGHTFUL_LEAD_TOKENS) ||
      rootHasAnySelector(post, ['[data-activity-type="INSIGHTFUL"]'])
    );
  }
};

export const commentedRule: CategoryRule = {
  id: 'commented.activity',
  category: 'commented',
  priority: 60,
  match: (post) => {
    return (
      rootHasAnySelector(post, ['[data-activity-type="COMMENT"]']) ||
      hasLeadActivityToken(post, COMMENTED_LEAD_TOKENS) ||
      leadContextIncludesAny(post, [' commented on this ', ' commented this '])
    );
  }
};

export const followedRule: CategoryRule = {
  id: 'followed.activity',
  category: 'followed',
  priority: 55,
  match: (post) => {
    const followsHeaderActivity = hasFollowsHeaderActivity(post);

    return (
      post.connectionLevel === 'following' ||
      rootHasAnySelector(post, ['[data-activity-type="FOLLOW"]']) ||
      hasLeadActivityToken(post, FOLLOWED_LEAD_TOKENS) ||
      (hasLeadActivityToken(post, FOLLOWS_LEAD_TOKENS) && followsHeaderActivity) ||
      followsHeaderActivity ||
      leadContextIncludesAny(post, [' followed this '])
    );
  }
};

export const sharedRule: CategoryRule = {
  id: 'shared.activity',
  category: 'shared',
  priority: 65,
  match: (post) => {
    return (
      rootHasAnySelector(post, ['[data-urn*="reshare"]', '[data-test-id*="reshare"]', 'a[href*="reshare"]']) ||
      hasLeadActivityToken(post, SHARED_LEAD_TOKENS)
    );
  }
};
