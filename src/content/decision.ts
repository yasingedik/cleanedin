import type {
  DecisionReason,
  DecisionReasonContext,
  FilterSettings,
  PostCategory,
  PostDecision,
  PostFeatures
} from '../shared/types';

function findKeywordHit(text: string, keywords: string[]): string | null {
  const lower = text.toLowerCase();
  for (const keyword of keywords) {
    if (lower.includes(keyword)) {
      return keyword;
    }
  }
  return null;
}

function normalizeComparableText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findHiddenNameMatch(post: PostFeatures, hiddenNames: string[]): string | null {
  if (hiddenNames.length === 0) {
    return null;
  }

  const lead = normalizeComparableText(post.leadText);
  const bodyLead = normalizeComparableText(post.textContent.slice(0, 520));
  const actorNames = post.actorNames.map((name) => normalizeComparableText(name)).filter(Boolean);
  const actorSet = new Set(actorNames);

  for (const rawName of hiddenNames) {
    const normalizedName = normalizeComparableText(rawName);
    if (!normalizedName) {
      continue;
    }

    if (actorSet.has(normalizedName)) {
      return rawName.trim();
    }

    const probe = ` ${normalizedName} `;
    if (` ${lead} `.includes(probe) || ` ${bodyLead} `.includes(probe)) {
      return rawName.trim();
    }
  }

  return null;
}

type HideMatch = {
  reason: DecisionReason;
  hiddenCategory: PostCategory | null;
  reasonContext?: Partial<DecisionReasonContext>;
};

function emptyReasonContext(): DecisionReasonContext {
  return {
    matchedKeyword: null,
    missingKeywords: [],
    matchedName: null,
    matchedConnectionLevel: null,
    matchedProfileType: null,
    ageLimitDays: null
  };
}

function registerHideMatch(
  shouldHide: boolean,
  reason: DecisionReason,
  hideMatches: HideMatch[],
  hiddenCategory: PostCategory | null = null,
  reasonContext: Partial<DecisionReasonContext> = {}
): void {
  if (!shouldHide) {
    return;
  }

  hideMatches.push({ reason, hiddenCategory, reasonContext });
}

export function decidePostVisibility(post: PostFeatures, settings: FilterSettings): PostDecision {
  const reasons: DecisionReason[] = [];
  const isUnknown = post.labels.size === 0;
  const defaultContext = emptyReasonContext();

  if (!settings.enabled) {
    return { hide: false, reasons, isUnknown, hiddenCategory: null, reasonContext: defaultContext };
  }

  const hideMatches: HideMatch[] = [];

  for (const label of post.labels) {
    registerHideMatch(settings.categoryActions[label] === 'hide', 'category_match', hideMatches, label);
  }

  const includeKeywordHit = findKeywordHit(post.textContent, settings.includeKeywords);
  registerHideMatch(
    settings.includeKeywordsAction === 'hide' &&
      settings.includeKeywords.length > 0 &&
      !includeKeywordHit,
    'include_keyword_miss',
    hideMatches,
    null,
    { missingKeywords: settings.includeKeywords.slice(0, 3) }
  );

  const excludeKeywordHit = findKeywordHit(post.textContent, settings.excludeKeywords);
  registerHideMatch(
    settings.excludeKeywordsAction === 'hide' &&
      settings.excludeKeywords.length > 0 &&
      Boolean(excludeKeywordHit),
    'exclude_keyword_match',
    hideMatches,
    null,
    { matchedKeyword: excludeKeywordHit }
  );

  const matchedHiddenName = findHiddenNameMatch(post, settings.hiddenNames);
  registerHideMatch(
    settings.hiddenNamesAction === 'hide' && Boolean(matchedHiddenName),
    'hidden_name_match',
    hideMatches,
    null,
    { matchedName: matchedHiddenName }
  );

  registerHideMatch(
    Boolean(post.connectionLevel && settings.connectionLevelActions[post.connectionLevel] === 'hide'),
    'connection_level_match',
    hideMatches,
    null,
    { matchedConnectionLevel: post.connectionLevel }
  );

  registerHideMatch(
    Boolean(post.profileType && settings.profileTypeActions[post.profileType] === 'hide'),
    'profile_type_match',
    hideMatches,
    null,
    { matchedProfileType: post.profileType }
  );

  const ageLimitDays = settings.ageFilter.maxAgeDays;
  registerHideMatch(
    settings.ageFilter.action === 'hide' &&
      typeof ageLimitDays === 'number' &&
      typeof post.ageHours === 'number' &&
      post.ageHours / 24 > ageLimitDays,
    'age_exceeded',
    hideMatches,
    null,
    { ageLimitDays }
  );

  if (hideMatches.length > 0) {
    const selected = hideMatches[0];
    reasons.push(selected.reason);
    return {
      hide: true,
      reasons,
      isUnknown,
      hiddenCategory: selected.hiddenCategory,
      reasonContext: { ...defaultContext, ...selected.reasonContext }
    };
  }

  return { hide: false, reasons, isUnknown, hiddenCategory: null, reasonContext: defaultContext };
}
