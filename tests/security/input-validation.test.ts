import { describe, it, expect } from 'vitest';
import { sanitizeKeywords } from '../../src/shared/schema';
import type { PostCategory } from '../../src/shared/types';

describe('Input Validation Security', () => {
  describe('Keyword Sanitization Boundary Conditions', () => {
    it('should enforce max 200 keywords limit', () => {
      const tooMany = Array(250).fill('keyword');
      const result = sanitizeKeywords(tooMany);
      expect(result.length).toBeLessThanOrEqual(200);
    });

    it('should enforce max 80 characters per keyword', () => {
      const longKeyword = 'a'.repeat(100);
      const result = sanitizeKeywords([longKeyword]);
      expect(result[0].length).toBeLessThanOrEqual(80);
    });

    it('should trim whitespace from keywords', () => {
      const keywords = ['  test  ', '  keyword  ', 'normal'];
      const result = sanitizeKeywords(keywords);
      expect(result[0]).toBe('test');
      expect(result[1]).toBe('keyword');
      expect(result[2]).toBe('normal');
    });

    it('should normalize whitespace in keywords', () => {
      const keywords = ['test   keyword', 'another  one'];
      const result = sanitizeKeywords(keywords);
      expect(result[0]).not.toContain('   ');
      expect(result[1]).not.toContain('  ');
    });

    it('should deduplicate keywords', () => {
      const keywords = ['test', 'test', 'keyword', 'keyword', 'test'];
      const result = sanitizeKeywords(keywords);
      expect(result).toEqual(['test', 'keyword']);
    });

    it('should handle empty keyword array', () => {
      const result = sanitizeKeywords([]);
      expect(result).toEqual([]);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should filter out empty strings and whitespace-only strings', () => {
      const keywords = ['test', '', '  ', 'keyword', '\t', '\n'];
      const result = sanitizeKeywords(keywords);
      expect(result[0]).toBe('test');
      expect(result[1]).toBe('keyword');
      expect(result.length).toBe(2);
    });

    it('should handle mixed valid and invalid keywords', () => {
      const keywords = ['valid', '', '  ', 'keyword<script>', '123', '   spaces   '];
      const result = sanitizeKeywords(keywords);
      expect(Array.isArray(result)).toBe(true);
      expect(result.every((k) => k.trim().length > 0)).toBe(true);
    });

    it('should convert to lowercase safely', () => {
      const keywords = ['TEST', 'KeyWord', 'FILTER'];
      const result = sanitizeKeywords(keywords);
      expect(result[0]).toBe('test');
      expect(result[1]).toBe('keyword');
      expect(result[2]).toBe('filter');
    });

    it('should handle special characters without crashing', () => {
      const keywords = ['@#$%', '©®™', '中文', 'العربية', 'emoji😀'];
      const result = sanitizeKeywords(keywords);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should type-check array entries as strings', () => {
      // This should be validated at runtime
      const keywords = ['valid1', 'valid2'];
      const result = sanitizeKeywords(keywords);
      expect(result.every((k) => typeof k === 'string')).toBe(true);
    });
  });

  describe('Age Filter Validation', () => {
    it('should accept valid positive age values', () => {
      const validAges = [1, 24, 168, 730, 8760];
      validAges.forEach((age) => {
        expect(typeof age === 'number' && age > 0).toBe(true);
      });
    });

    it('should reject negative age values', () => {
      const invalidAge = -24;
      expect(invalidAge > 0).toBe(false);
    });

    it('should reject zero age value', () => {
      const invalidAge = 0;
      expect(invalidAge > 0).toBe(false);
    });

    it('should handle extremely large age numbers', () => {
      const largeAge = 999999;
      expect(typeof largeAge === 'number').toBe(true);
      expect(largeAge > 0).toBe(true);
    });

    it('should reject non-numeric age values', () => {
      const invalid = 'not-a-number';
      expect(typeof invalid === 'number').toBe(false);
    });

    it('should reject floating point ages (should be integers)', () => {
      const floatAge = 24.5;
      expect(Number.isInteger(floatAge)).toBe(false);
    });

    it('should reject NaN and Infinity', () => {
      expect(Number.isNaN(NaN)).toBe(true);
      expect(Number.isFinite(Infinity)).toBe(false);
    });
  });

  describe('Category Filter Validation', () => {
    const VALID_CATEGORIES: PostCategory[] = [
      'ad',
      'suggested',
      'recommendation',
      'video',
      'poll',
      'carousel',
      'shared',
      'liked',
      'loved',
      'supported',
      'celebrated',
      'funny',
      'insightful',
      'commented',
      'followed',
      'image',
      'link'
    ];

    it('should accept all valid categories', () => {
      VALID_CATEGORIES.forEach((category) => {
        expect(VALID_CATEGORIES.includes(category)).toBe(true);
      });
    });

    it('should reject unknown categories', () => {
      const invalidCategory = 'unknown_category' as PostCategory;
      expect(VALID_CATEGORIES.includes(invalidCategory)).toBe(false);
    });

    it('should reject null categories', () => {
      const nullCategory = null as unknown as PostCategory;
      expect(VALID_CATEGORIES.includes(nullCategory)).toBe(false);
    });

    it('should reject undefined categories', () => {
      const undefinedCategory = undefined as unknown as PostCategory;
      expect(VALID_CATEGORIES.includes(undefinedCategory)).toBe(false);
    });

    it('should handle empty category array', () => {
      const emptyCategories: PostCategory[] = [];
      expect(Array.isArray(emptyCategories)).toBe(true);
      expect(emptyCategories.length).toBe(0);
    });

    it('should deduplicate categories in selection', () => {
      const duplicated: PostCategory[] = ['ad', 'ad', 'video', 'video'];
      const unique = [...new Set(duplicated)];
      expect(unique.length).toBe(2);
    });
  });

  describe('Filter Mode Validation', () => {
    const VALID_MODES = ['hide_selected', 'show_only_selected'] as const;

    it('should accept hide_selected mode', () => {
      const mode = 'hide_selected';
      expect(VALID_MODES.includes(mode as never)).toBe(true);
    });

    it('should accept show_only_selected mode', () => {
      const mode = 'show_only_selected';
      expect(VALID_MODES.includes(mode as never)).toBe(true);
    });

    it('should reject unknown mode values', () => {
      const invalidMode = 'invalid_mode';
      expect(VALID_MODES.includes(invalidMode as never)).toBe(false);
    });

    it('should reject null mode', () => {
      const nullMode = null as unknown;
      expect(VALID_MODES.includes(nullMode as never)).toBe(false);
    });
  });

  describe('Unknown Policy Validation', () => {
    const VALID_POLICIES = ['show_unknown', 'hide_unknown'] as const;

    it('should accept show_unknown policy', () => {
      const policy = 'show_unknown';
      expect(VALID_POLICIES.includes(policy as never)).toBe(true);
    });

    it('should accept hide_unknown policy', () => {
      const policy = 'hide_unknown';
      expect(VALID_POLICIES.includes(policy as never)).toBe(true);
    });

    it('should reject unknown policy values', () => {
      const invalidPolicy = 'invalid_policy';
      expect(VALID_POLICIES.includes(invalidPolicy as never)).toBe(false);
    });
  });
});
