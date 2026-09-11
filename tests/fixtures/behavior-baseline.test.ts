import { afterEach, describe, expect, it, vi } from 'vitest';
import { decidePostVisibility } from '../../src/content/decision';
import { findPostTargets } from '../../src/content/feed-root';
import {
  applyPostRendering,
  clearTemporaryReveals
} from '../../src/content/render';
import { ALL_CATEGORIES } from '../../src/shared/schema';
import type {
  ConnectionLevel,
  FilterSettings,
  PostCategory,
  ProfileType
} from '../../src/shared/types';
import { element, features, loadBaseline, settings } from './baseline/helpers';

afterEach(() => {
  clearTemporaryReveals();
  document.body.innerHTML = '';
  vi.useRealTimers();
});

const categoryCases: Array<[string, PostCategory[]]> = [
  ['ad', ['ad']],
  ['promoted', ['ad']],
  ['suggested', ['suggested']],
  ['recommendation', ['recommendation']],
  ['liked', ['liked']],
  ['loved', ['loved']],
  ['supported', ['supported']],
  ['celebrated', ['celebrated']],
  ['funny', ['funny']],
  ['insightful', ['insightful']],
  ['commented', ['commented']],
  ['followed', ['followed']],
  ['shared', ['shared']],
  ['video', ['video']],
  ['poll', ['poll']],
  ['image', ['image']],
  ['link', ['link']],
  ['carousel', ['carousel']],
  ['multiple', ['ad', 'video', 'liked', 'loved', 'link']],
  ['unknown', []],
  ['promotion-story', []],
  ['avatar-only', []],
  ['internal-link', []],
  ['following-up', []]
];

describe('frozen category and rendering baseline', () => {
  it('freezes user-facing defaults before migration work', () => {
    const config = settings();
    expect(config).toMatchObject({
      enabled: true,
      showBadgeOnHidden: true,
      showInFeedOptionsPanel: true,
      includeKeywords: [],
      includeKeywordsAction: 'off',
      excludeKeywords: [],
      excludeKeywordsAction: 'off',
      hiddenNames: [],
      hiddenNamesAction: 'off',
      ageFilter: { action: 'off', maxAgeDays: null },
      debug: false,
      schemaVersion: 6
    });
    expect(
      Object.entries(config.categoryActions).filter(
        ([, action]) => action === 'hide'
      )
    ).toEqual([['ad', 'hide']]);
    expect(
      Object.values(config.connectionLevelActions).every(
        (action) => action === 'show'
      )
    ).toBe(true);
    expect(
      Object.values(config.profileTypeActions).every(
        (action) => action === 'show'
      )
    ).toBe(true);
  });

  it('covers every existing category with an explicit fixture expectation', () => {
    expect(
      [...new Set(categoryCases.flatMap(([, labels]) => labels))].sort()
    ).toEqual([...ALL_CATEGORIES].sort());
  });

  it.each(categoryCases)(
    '%s extracts exact ordered labels and obeys hide/show/disable',
    (name, expected) => {
      loadBaseline('categories.html');
      const root = element(`[data-case="${name}"]`);
      const post = features(root);
      expect([...post.labels]).toEqual(expected);
      const config = settings();
      // Every category is enabled for this check; negative fixtures must stay visible.
      for (const category of ALL_CATEGORIES)
        config.categoryActions[category] = 'hide';
      const decision = decidePostVisibility(post, config);
      expect(decision.hide).toBe(expected.length > 0);
      expect(decision.hiddenCategory).toBe(expected[0] ?? null);
      applyPostRendering(post, decision, config);
      expect(root.classList.contains('cleanedin-hidden')).toBe(decision.hide);
      expect(document.querySelectorAll('.cleanedin-badge')).toHaveLength(
        decision.hide ? 1 : 0
      );
      if (decision.hide)
        expect(root.previousElementSibling?.textContent).toContain(
          'Post hidden'
        );

      config.enabled = false;
      applyPostRendering(post, decidePostVisibility(post, config), config);
      expect(root.classList.contains('cleanedin-hidden')).toBe(false);
      expect(root.hasAttribute('data-cleanedin-hidden')).toBe(false);
      expect(document.querySelectorAll('.cleanedin-badge')).toHaveLength(0);
      expect(root.isConnected).toBe(true);
    }
  );

  it('Show on a high-priority category does not override another hide', () => {
    loadBaseline('categories.html');
    const post = features(element('[data-case="multiple"]'));
    const config = settings();
    config.categoryActions.ad = 'show';
    config.categoryActions.video = 'hide';
    config.categoryActions.liked = 'hide';
    expect(decidePostVisibility(post, config).hiddenCategory).toBe('video');
    config.categoryActions.video = 'show';
    config.categoryActions.loved = 'hide';
    expect(decidePostVisibility(post, config).hiddenCategory).toBe('liked');
  });

  it('preserves reveal across reevaluation and replacement, and resets it explicitly', () => {
    loadBaseline('categories.html');
    let root = element('[data-case="ad"]');
    const config = settings();
    const render = () => {
      const post = features(root);
      applyPostRendering(post, decidePostVisibility(post, config), config);
    };
    render();
    root.previousElementSibling
      ?.querySelector<HTMLButtonElement>('button')
      ?.click();
    render();
    expect(root.classList.contains('cleanedin-hidden')).toBe(false);
    const replacement = root.cloneNode(true) as HTMLElement;
    root.replaceWith(replacement);
    root = replacement;
    render();
    expect(root.classList.contains('cleanedin-hidden')).toBe(false);
    clearTemporaryReveals();
    render();
    expect(root.classList.contains('cleanedin-hidden')).toBe(true);
    expect(document.querySelectorAll('.cleanedin-badge')).toHaveLength(1);
  });
});

function wrappedPost() {
  loadBaseline('structures.html');
  return features(
    element('#wrapped'),
    element('#wrapped [data-view-name="feed-full-update"]')
  );
}

describe('frozen filter semantics', () => {
  it.each<[string, Partial<FilterSettings>, boolean]>([
    [
      'include any match, normalized',
      {
        includeKeywordsAction: 'hide',
        includeKeywords: [' CLOUD ', 'unmatched']
      },
      false
    ],
    [
      'include none matches',
      {
        includeKeywordsAction: 'hide',
        includeKeywords: ['unmatched', 'absent']
      },
      true
    ],
    [
      'empty include list',
      { includeKeywordsAction: 'hide', includeKeywords: [] },
      false
    ],
    [
      'include off',
      { includeKeywordsAction: 'off', includeKeywords: ['absent'] },
      false
    ],
    [
      'exclude substring',
      { excludeKeywordsAction: 'hide', excludeKeywords: ['INFRA'] },
      true
    ],
    [
      'exclude no match',
      { excludeKeywordsAction: 'hide', excludeKeywords: ['absent'] },
      false
    ],
    [
      'regex is literal',
      { excludeKeywordsAction: 'hide', excludeKeywords: ['cloud.*'] },
      false
    ],
    [
      'exclude off',
      { excludeKeywordsAction: 'off', excludeKeywords: ['cloud'] },
      false
    ],
    [
      'actor name',
      { hiddenNamesAction: 'hide', hiddenNames: ['fixture author'] },
      true
    ],
    [
      'mentioned name, not author-only',
      { hiddenNamesAction: 'hide', hiddenNames: ['Fixture Mention'] },
      true
    ],
    [
      'name boundary',
      { hiddenNamesAction: 'hide', hiddenNames: ['Fixture Auth'] },
      false
    ],
    [
      'names off',
      { hiddenNamesAction: 'off', hiddenNames: ['Fixture Author'] },
      false
    ],
    ['age equality', { ageFilter: { action: 'hide', maxAgeDays: 2 } }, false],
    ['age exceeds', { ageFilter: { action: 'hide', maxAgeDays: 1 } }, true],
    ['age off', { ageFilter: { action: 'off', maxAgeDays: 1 } }, false]
  ])('%s', (_, patch, hide) => {
    const post = wrappedPost();
    const config = settings(patch);
    const decision = decidePostVisibility(post, config);
    expect(decision.hide).toBe(hide);
    applyPostRendering(post, decision, config);
    expect(post.root.classList.contains('cleanedin-hidden')).toBe(hide);
  });

  it('preserves explanation precedence when every filter matches', () => {
    const post = wrappedPost();
    const config = settings({
      includeKeywordsAction: 'hide',
      includeKeywords: ['absent'],
      excludeKeywordsAction: 'hide',
      excludeKeywords: ['cloud'],
      hiddenNamesAction: 'hide',
      hiddenNames: ['Fixture Author'],
      ageFilter: { action: 'hide', maxAgeDays: 1 }
    });
    config.categoryActions.video = 'hide';
    config.connectionLevelActions.first = 'hide';
    config.profileTypeActions.individual = 'hide';
    const expectations = [
      [
        'category_match',
        () => {
          config.categoryActions.video = 'show';
        }
      ],
      [
        'include_keyword_miss',
        () => {
          config.includeKeywordsAction = 'off';
        }
      ],
      [
        'exclude_keyword_match',
        () => {
          config.excludeKeywordsAction = 'off';
        }
      ],
      [
        'hidden_name_match',
        () => {
          config.hiddenNamesAction = 'off';
        }
      ],
      [
        'connection_level_match',
        () => {
          config.connectionLevelActions.first = 'show';
        }
      ],
      [
        'profile_type_match',
        () => {
          config.profileTypeActions.individual = 'show';
        }
      ],
      [
        'age_exceeded',
        () => {
          config.ageFilter.action = 'off';
        }
      ]
    ] as const;
    for (const [reason, turnOff] of expectations) {
      expect(decidePostVisibility(post, config).reasons).toEqual([reason]);
      turnOff();
    }
    expect(decidePostVisibility(post, config).hide).toBe(false);
  });

  it.each<[string, ConnectionLevel]>([
    ['Following', 'following'],
    ['1st', 'first'],
    ['2nd', 'second'],
    ['3rd+', 'third_plus']
  ])('extracts and filters %s connections', (token, expected) => {
    document.body.innerHTML = `<article><header data-view-name="feed-actor"><a href="https://www.linkedin.com/in/fixture-person">Fixture Person</a> • ${token} <time>2h</time></header><p>Fixture update</p></article>`;
    const post = features(element('article'));
    expect(post.connectionLevel).toBe(expected);
    const config = settings();
    config.connectionLevelActions[expected] = 'hide';
    expect(decidePostVisibility(post, config).reasons).toEqual([
      'connection_level_match'
    ]);
    config.connectionLevelActions[expected] = 'show';
    expect(decidePostVisibility(post, config).hide).toBe(false);
  });

  it.each<[string, ProfileType]>([
    ['in', 'individual'],
    ['company', 'company'],
    ['groups', 'group'],
    ['', 'other']
  ])('extracts and filters %s profile type', (path, expected) => {
    document.body.innerHTML = `<article>${path ? `<a data-view-name="feed-actor" href="https://www.linkedin.com/${path}/fixture">Fixture Publisher</a>` : ''}<p>Plain update</p></article>`;
    const post = features(element('article'));
    expect(post.profileType).toBe(expected);
    const config = settings();
    config.profileTypeActions[expected] = 'hide';
    expect(decidePostVisibility(post, config).reasons).toEqual([
      'profile_type_match'
    ]);
    config.profileTypeActions[expected] = 'show';
    expect(decidePostVisibility(post, config).hide).toBe(false);
  });

  it('limits body name matching to the first 520 characters', () => {
    document.body.innerHTML = '<article><p></p></article>';
    const root = element('article');
    element('p').textContent = `${'x'.repeat(530)} Fixture Mention`;
    expect(
      decidePostVisibility(
        features(root),
        settings({
          hiddenNamesAction: 'hide',
          hiddenNames: ['Fixture Mention']
        })
      ).hide
    ).toBe(false);
    element('p').textContent = `${'x'.repeat(400)} Fixture Mention`;
    expect(
      decidePostVisibility(
        features(root),
        settings({
          hiddenNamesAction: 'hide',
          hiddenNames: ['Fixture Mention']
        })
      ).hide
    ).toBe(true);
  });

  it('uses a fixed clock for absolute timestamps', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-01T12:00:00Z'));
    document.body.innerHTML =
      '<article><time datetime="2026-08-30T12:00:00Z">Fixture timestamp</time></article>';
    expect(features(element('article')).ageHours).toBe(48);
  });
});

describe('DOM shapes and identity', () => {
  it('records comment facts that still leak when comments are inside the feature root (#26)', () => {
    loadBaseline('structures.html');
    const post = features(element('#comment-leak'));
    expect(post.actorNames).toEqual([]);
    expect(post.profileType).toBe('individual');
    expect(post.ageHours).toBe(24);
    expect([...post.labels]).toEqual(['video']);
    expect(
      decidePostVisibility(
        post,
        settings({
          excludeKeywordsAction: 'hide',
          excludeKeywords: ['comment-only keyword']
        })
      ).hide
    ).toBe(true);
  });

  it('discovers one outer wrapper, extracts inner facts and hides the whole card', () => {
    loadBaseline('structures.html');
    const targets = findPostTargets(element('[data-testid="mainFeed"]'));
    const target = targets.find(
      (candidate) => candidate.renderRoot.id === 'wrapped'
    );
    expect(target).toBeDefined();
    expect(
      targets.some((candidate) => candidate.renderRoot.id === 'inner-article')
    ).toBe(false);
    const post = features(target!.renderRoot, target!.featureRoot);
    expect(post.postId).toBe('urn:li:activity:2001');
    expect(post.connectionLevel).toBe('first');
    expect(post.actorNames).not.toContain('Fixture Commenter');
    expect(post.textContent).not.toContain('Comment-only keyword');
    const config = settings({
      excludeKeywordsAction: 'hide',
      excludeKeywords: ['cloud']
    });
    applyPostRendering(post, decidePostVisibility(post, config), config);
    expect(element('#wrapped').classList.contains('cleanedin-hidden')).toBe(
      true
    );
    expect(element('#comments').closest('.cleanedin-hidden')).toBe(
      element('#wrapped')
    );
    expect(
      element('#inner-article').classList.contains('cleanedin-hidden')
    ).toBe(false);
  });

  it('keeps missing fields explicit and fallback identity deterministic', () => {
    loadBaseline('structures.html');
    const post = features(element('#missing'));
    expect(post).toMatchObject({
      ageHours: null,
      hasTimestamp: false,
      connectionLevel: null,
      profileType: 'other',
      actorNames: [],
      postIdSource: 'fallback_hash'
    });
    expect(
      decidePostVisibility(
        post,
        settings({ ageFilter: { action: 'hide', maxAgeDays: 1 } })
      ).hide
    ).toBe(false);
    const first = features(element('#fallback-a'));
    expect(
      features(element('#fallback-a').cloneNode(true) as HTMLElement).postId
    ).toBe(first.postId);
    expect(features(element('#fallback-b')).postId).not.toBe(first.postId);
  });

  it('records current nested-post media inheritance for review in #26', () => {
    loadBaseline('structures.html');
    const post = features(element('#nested-parent'));
    expect(post.postId).toBe('urn:li:activity:2002');
    expect([...post.labels]).toContain('video');
    expect(post.textContent).toContain('A quoted fixture post.');
  });
});
