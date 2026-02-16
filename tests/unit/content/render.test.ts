import { afterEach, describe, expect, it } from 'vitest';
import { applyPostRendering, clearAllHiddenBadges, clearTemporaryReveals } from '../../../src/content/render';
import { ALL_CATEGORIES } from '../../../src/shared/schema';
import type { CategoryActions, FilterSettings, PostDecision, PostFeatures } from '../../../src/shared/types';

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

function buildPost(): PostFeatures {
  const root = document.createElement('article');
  root.setAttribute('data-urn', 'urn:li:activity:test');
  document.body.appendChild(root);

  return {
    postId: 'urn:li:activity:test',
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

afterEach(() => {
  clearTemporaryReveals();
  clearAllHiddenBadges();
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
    post.actorNames = ['Jane Doe'];

    const decision: PostDecision = {
      hide: true,
      reasons: ['category_match'],
      isUnknown: false,
      hiddenCategory: 'liked',
      reasonContext: emptyReasonContext()
    };

    applyPostRendering(post, decision, settings);
    expect(document.querySelector('.cleanedin-badge span')?.textContent).toBe('Post hidden: liked by Jane Doe');

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
});
