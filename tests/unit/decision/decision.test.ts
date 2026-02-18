import { describe, expect, it } from 'vitest';
import { decidePostVisibility } from '../../../src/content/decision';
import { ALL_CATEGORIES } from '../../../src/shared/schema';
import type { CategoryActions, FilterSettings, PostFeatures } from '../../../src/shared/types';

function createCategoryActions(action: 'show' | 'hide' = 'show'): CategoryActions {
  return ALL_CATEGORIES.reduce(
    (acc, category) => {
      acc[category] = action;
      return acc;
    },
    {} as CategoryActions
  );
}

function makeSettings(overrides: Partial<FilterSettings> = {}): FilterSettings {
  return {
    enabled: true,
    categoryActions: {
      ...createCategoryActions('show'),
      ad: 'hide'
    },
    showBadgeOnHidden: true,
    showInFeedOptionsPanel: true,
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
    schemaVersion: 6,
    ...overrides
  };
}

function makePost(overrides: Partial<PostFeatures> = {}): PostFeatures {
  return {
    postId: 'p1',
    root: document.createElement('article'),
    hasTimestamp: false,
    ageHours: null,
    leadText: 'default content',
    actorNames: [],
    connectionLevel: null,
    profileType: null,
    labels: new Set(),
    textContent: 'default content',
    links: [],
    ...overrides
  };
}

describe('decidePostVisibility', () => {
  it('hides category when its action is hide', () => {
    const settings = makeSettings();
    const post = makePost({ labels: new Set(['ad']) });

    const decision = decidePostVisibility(post, settings);
    expect(decision.hide).toBe(true);
    expect(decision.hiddenCategory).toBe('ad');
  });

  it('does not hide include keywords when action is off', () => {
    const settings = makeSettings({
      includeKeywords: ['cloud'],
      includeKeywordsAction: 'off'
    });
    const post = makePost({ textContent: 'No cloud keyword here' });

    const decision = decidePostVisibility(post, settings);
    expect(decision.hide).toBe(false);
  });

  it('hides include keyword misses when action is hide', () => {
    const settings = makeSettings({
      includeKeywords: ['cloud'],
      includeKeywordsAction: 'hide'
    });
    const post = makePost({ textContent: 'No keyword here' });

    const decision = decidePostVisibility(post, settings);
    expect(decision.hide).toBe(true);
    expect(decision.reasons).toContain('include_keyword_miss');
    expect(decision.reasonContext.missingKeywords).toEqual(['cloud']);
  });

  it('tracks matched exclude keyword for badge context', () => {
    const settings = makeSettings({
      excludeKeywords: ['crypto'],
      excludeKeywordsAction: 'hide'
    });
    const post = makePost({ textContent: 'This mentions crypto markets.' });

    const decision = decidePostVisibility(post, settings);
    expect(decision.hide).toBe(true);
    expect(decision.reasons).toContain('exclude_keyword_match');
    expect(decision.reasonContext.matchedKeyword).toBe('crypto');
  });

  it('hides old posts when age filter action is hide', () => {
    const settings = makeSettings({ ageFilter: { maxAgeDays: 2, action: 'hide' } });
    const post = makePost({ ageHours: 24 * 4, hasTimestamp: true });

    const decision = decidePostVisibility(post, settings);
    expect(decision.hide).toBe(true);
    expect(decision.reasons).toContain('age_exceeded');
  });

  it('hides when hidden name list matches actor names', () => {
    const settings = makeSettings({ hiddenNames: ['acme inc'], hiddenNamesAction: 'hide' });
    const post = makePost({ actorNames: ['acme inc'], leadText: 'Acme Inc reposted this • 2d' });

    const decision = decidePostVisibility(post, settings);
    expect(decision.hide).toBe(true);
    expect(decision.reasons).toContain('hidden_name_match');
    expect(decision.reasonContext.matchedName).toBe('acme inc');
  });

  it('hides when selected connection level matches', () => {
    const settings = makeSettings({
      connectionLevelActions: {
        following: 'show',
        first: 'show',
        second: 'hide',
        third_plus: 'show'
      }
    });
    const post = makePost({ connectionLevel: 'second' });

    const decision = decidePostVisibility(post, settings);
    expect(decision.hide).toBe(true);
    expect(decision.reasons).toContain('connection_level_match');
    expect(decision.reasonContext.matchedConnectionLevel).toBe('second');
  });

  it('hides when selected profile type matches', () => {
    const settings = makeSettings({
      profileTypeActions: {
        individual: 'show',
        group: 'show',
        company: 'hide',
        other: 'show'
      }
    });
    const post = makePost({ profileType: 'company' });

    const decision = decidePostVisibility(post, settings);
    expect(decision.hide).toBe(true);
    expect(decision.reasons).toContain('profile_type_match');
  });
});
