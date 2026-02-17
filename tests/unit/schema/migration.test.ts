import { describe, expect, it } from 'vitest';
import { ALL_CATEGORIES, migrateSyncSettings } from '../../../src/shared/schema';
import type { CategoryActions } from '../../../src/shared/types';

function createCategoryActions(defaultAction: 'show' | 'hide' = 'show'): CategoryActions {
  return ALL_CATEGORIES.reduce(
    (acc, category) => {
      acc[category] = defaultAction;
      return acc;
    },
    {} as CategoryActions
  );
}

describe('sync settings migration', () => {
  it('prefers modern categoryActions over legacy selectedCategories when both are present', () => {
    const categoryActions = createCategoryActions('show');
    categoryActions.liked = 'show';

    const migrated = migrateSyncSettings({
      categoryActions,
      // Legacy payload still present from older extension versions.
      mode: 'hide_selected',
      selectedCategories: ['liked']
    } as unknown as Parameters<typeof migrateSyncSettings>[0]);

    expect(migrated.categoryActions.liked).toBe('show');
  });

  it('still migrates legacy selectedCategories when modern categoryActions are missing', () => {
    const migrated = migrateSyncSettings({
      mode: 'hide_selected',
      selectedCategories: ['liked']
    } as unknown as Parameters<typeof migrateSyncSettings>[0]);

    expect(migrated.categoryActions.liked).toBe('hide');
  });
});
