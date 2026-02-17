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
const SHARED_LEAD_TOKENS = ['repostedthis', 'resharedthis'];

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

export const suggestionRule: CategoryRule = {
  id: 'suggested.structural',
  category: 'suggested',
  priority: 70,
  match: (post) => {
    return (
      hasLeadActivityToken(post, SUGGESTED_LEAD_TOKENS, 40, false) ||
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
    return hasLeadActivityToken(post, LIKED_LEAD_TOKENS) || rootHasAnySelector(post, ['[data-activity-type="LIKE"]']);
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
      hasLeadActivityToken(post, COMMENTED_LEAD_TOKENS)
    );
  }
};

export const followedRule: CategoryRule = {
  id: 'followed.activity',
  category: 'followed',
  priority: 55,
  match: (post) => {
    return (
      post.connectionLevel === 'following' ||
      rootHasAnySelector(post, ['[data-activity-type="FOLLOW"]']) ||
      hasLeadActivityToken(post, FOLLOWED_LEAD_TOKENS)
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
