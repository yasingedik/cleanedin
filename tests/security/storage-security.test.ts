import { describe, it, expect } from 'vitest';
import {
  migrateLocalSettings,
  migrateSyncSettings,
  DEFAULT_SYNC_SETTINGS,
  DEFAULT_LOCAL_SETTINGS
} from '../../src/shared/schema';
import type { FilterSettings } from '../../src/shared/types';

describe('Storage Integrity Security', () => {
  describe('Malformed Settings Handling', () => {
    it('should handle null sync settings gracefully', () => {
      const malformed = null as unknown as Partial<FilterSettings>;
      expect(() => migrateSyncSettings(malformed)).not.toThrow();
    });

    it('should handle undefined sync settings gracefully', () => {
      const malformed = undefined as unknown as Partial<FilterSettings>;
      expect(() => migrateSyncSettings(malformed)).not.toThrow();
    });

    it('should use defaults for incomplete sync settings', () => {
      const incomplete = { enabled: true } as Partial<FilterSettings>;
      const result = migrateSyncSettings(incomplete);
      expect(result).toHaveProperty('enabled');
      expect(result).toHaveProperty('categoryActions');
      expect(result).toHaveProperty('showBadgeOnHidden');
      expect(result).toHaveProperty('showInFeedOptionsPanel');
    });

    it('should handle null local settings gracefully', () => {
      const malformed = null as unknown as Partial<FilterSettings>;
      expect(() => migrateLocalSettings(malformed)).not.toThrow();
    });

    it('should handle undefined local settings gracefully', () => {
      const malformed = undefined as unknown as Partial<FilterSettings>;
      expect(() => migrateLocalSettings(malformed)).not.toThrow();
    });

    it('should use defaults for incomplete local settings', () => {
      const incomplete = { debug: true } as Partial<FilterSettings>;
      const result = migrateLocalSettings(incomplete);
      expect(result).toHaveProperty('debug');
      expect(result).toHaveProperty('includeKeywords');
      expect(result).toHaveProperty('excludeKeywords');
    });
  });

  describe('Invalid Type Handling', () => {
    it('should handle string instead of object in sync settings', () => {
      const invalid = 'not an object' as unknown as Partial<FilterSettings>;
      expect(() => migrateSyncSettings(invalid)).not.toThrow();
    });

    it('should handle number instead of object in sync settings', () => {
      const invalid = 123 as unknown as Partial<FilterSettings>;
      expect(() => migrateSyncSettings(invalid)).not.toThrow();
    });

    it('should handle array instead of object in sync settings', () => {
      const invalid = [] as unknown as Partial<FilterSettings>;
      expect(() => migrateSyncSettings(invalid)).not.toThrow();
    });

    it('should handle boolean instead of object in local settings', () => {
      const invalid = true as unknown as Partial<FilterSettings>;
      expect(() => migrateLocalSettings(invalid)).not.toThrow();
    });

    it('should validate categoryActions object', () => {
      const malformed = {
        categoryActions: 'not-an-object'
      } as unknown as Partial<FilterSettings>;
      const result = migrateSyncSettings(malformed);
      expect(typeof result.categoryActions).toBe('object');
      expect(result.categoryActions.ad).toBeDefined();
    });

    it('should ignore unknownAction input from legacy settings', () => {
      const malformed = {
        unknownAction: 'hide'
      } as unknown as Partial<FilterSettings>;
      const result = migrateSyncSettings(malformed);
      expect(result).toHaveProperty('showBadgeOnHidden');
      expect(result).toHaveProperty('showInFeedOptionsPanel');
      expect(result).not.toHaveProperty('unknownAction');
    });
  });

  describe('Corrupted Data Handling', () => {
    it('should handle negative numbers in numeric fields', () => {
      const corrupted = {
        ageFilter: { enabled: true, maxAgeHours: -24 }
      } as unknown as Partial<FilterSettings>;
      const result = migrateLocalSettings(corrupted);
      expect(result.ageFilter).toBeDefined();
    });

    it('should handle extremely large numbers', () => {
      const corrupted = {
        ageFilter: { enabled: true, maxAgeHours: 999999999999 }
      } as unknown as Partial<FilterSettings>;
      const result = migrateLocalSettings(corrupted);
      expect(result.ageFilter).toBeDefined();
    });

    it('should handle null in keyword arrays', () => {
      const corrupted = {
        includeKeywords: ['valid', null, 'keyword']
      } as unknown as Partial<FilterSettings>;
      const result = migrateLocalSettings(corrupted);
      expect(Array.isArray(result.includeKeywords)).toBe(true);
    });

    it('should handle mixed types in keyword arrays', () => {
      const corrupted = {
        includeKeywords: ['valid', 123, true, { key: 'value' }]
      } as unknown as Partial<FilterSettings>;
      const result = migrateLocalSettings(corrupted);
      expect(Array.isArray(result.includeKeywords)).toBe(true);
    });

    it('should handle duplicate categories gracefully via legacy input', () => {
      const corrupted = {
        selectedCategories: ['ad', 'ad', 'video', 'video', 'ad']
      } as unknown as Partial<FilterSettings>;
      const result = migrateSyncSettings(corrupted);
      expect(result.categoryActions.ad).toBeDefined();
      expect(result.categoryActions.video).toBeDefined();
    });

    it('should filter unknown categories from legacy selection', () => {
      const corrupted = {
        selectedCategories: ['ad', 'unknown_category', 'video']
      } as unknown as Partial<FilterSettings>;
      const result = migrateSyncSettings(corrupted);
      expect(result.categoryActions.ad).toBeDefined();
      expect(result.categoryActions.video).toBeDefined();
    });
  });

  describe('Schema Version Handling', () => {
    it('should handle missing schema version', () => {
      const noVersion = {} as unknown as Partial<FilterSettings>;
      const result = migrateLocalSettings(noVersion);
      expect(result.schemaVersion).toBeDefined();
      expect(typeof result.schemaVersion).toBe('number');
    });

    it('should handle invalid schema version type', () => {
      const invalidVersion = {
        schemaVersion: 'not-a-number'
      } as unknown as Partial<FilterSettings>;
      const result = migrateLocalSettings(invalidVersion);
      expect(typeof result.schemaVersion).toBe('number');
    });

    it('should handle future schema versions gracefully', () => {
      const futureVersion = {
        schemaVersion: 999
      } as unknown as Partial<FilterSettings>;
      const result = migrateLocalSettings(futureVersion);
      expect(result.schemaVersion).toBeDefined();
    });
  });

  describe('Large Data Handling', () => {
    it('should handle settings with many keywords without crashing', () => {
      const manyKeywords = Array(500).fill('keyword');
      const massive = {
        includeKeywords: manyKeywords,
        excludeKeywords: manyKeywords
      } as unknown as Partial<FilterSettings>;
      expect(() => migrateLocalSettings(massive)).not.toThrow();
    });

    it('should handle keywords with extremely long strings', () => {
      const longKeyword = 'a'.repeat(10000);
      const massive = {
        includeKeywords: [longKeyword]
      } as unknown as Partial<FilterSettings>;
      const result = migrateLocalSettings(massive);
      expect(Array.isArray(result.includeKeywords)).toBe(true);
    });

    it('should handle deeply nested malformed objects', () => {
      const deepNested = {
        ageFilter: {
          enabled: true,
          maxAgeHours: {
            nested: {
              deeply: {
                value: 24
              }
            }
          }
        }
      } as unknown as Partial<FilterSettings>;
      expect(() => migrateLocalSettings(deepNested)).not.toThrow();
    });
  });

  describe('Storage Defaults', () => {
    it('should have valid default sync settings', () => {
      expect(DEFAULT_SYNC_SETTINGS).toHaveProperty('enabled');
      expect(typeof DEFAULT_SYNC_SETTINGS.enabled).toBe('boolean');
      expect(DEFAULT_SYNC_SETTINGS).toHaveProperty('categoryActions');
      expect(DEFAULT_SYNC_SETTINGS).toHaveProperty('showBadgeOnHidden');
      expect(DEFAULT_SYNC_SETTINGS).toHaveProperty('showInFeedOptionsPanel');
      expect(typeof DEFAULT_SYNC_SETTINGS.categoryActions).toBe('object');
    });

    it('should have valid default local settings', () => {
      expect(DEFAULT_LOCAL_SETTINGS).toHaveProperty('includeKeywords');
      expect(Array.isArray(DEFAULT_LOCAL_SETTINGS.includeKeywords)).toBe(true);
      expect(DEFAULT_LOCAL_SETTINGS).toHaveProperty('excludeKeywords');
      expect(Array.isArray(DEFAULT_LOCAL_SETTINGS.excludeKeywords)).toBe(true);
      expect(DEFAULT_LOCAL_SETTINGS).toHaveProperty('ageFilter');
      expect(DEFAULT_LOCAL_SETTINGS).toHaveProperty('includeKeywordsAction');
    });

    it('should use defaults when migration receives empty object', () => {
      const result = migrateSyncSettings({});
      expect(result).toEqual(DEFAULT_SYNC_SETTINGS);
    });

    it('should use defaults when migration receives empty local object', () => {
      const result = migrateLocalSettings({});
      expect(result).toEqual(DEFAULT_LOCAL_SETTINGS);
    });
  });
});
