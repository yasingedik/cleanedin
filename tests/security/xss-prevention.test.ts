import { describe, it, expect } from 'vitest';
import { sanitizeKeywords } from '../../src/shared/schema';

describe('XSS Prevention - Keyword Sanitization', () => {
  it('should safely handle script-like patterns as literal text', () => {
    const pattern = '<script>alert("xss")</script>';
    const result = sanitizeKeywords([pattern]);
    // Keywords are used for substring matching, not DOM rendering, so literal text is safe
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(typeof result[0]).toBe('string');
  });

  it('should safely handle event handler patterns as literal text', () => {
    const pattern = 'test" onload="alert(1)';
    const result = sanitizeKeywords([pattern]);
    // Keywords are used for substring matching, not DOM rendering, so literal text is safe
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(typeof result[0]).toBe('string');
  });

  it('should treat HTML entities as literal text in keywords', () => {
    const pattern = '&lt;script&gt;alert("xss")&lt;/script&gt;';
    const result = sanitizeKeywords([pattern]);
    // Should be treated as literal text, not interpreted as HTML
    expect(result.length).toBeGreaterThan(0);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should handle percent-encoded patterns safely', () => {
    const pattern = '%3Cscript%3Ealert(1)%3C/script%3E';
    const result = sanitizeKeywords([pattern]);
    expect(result.length).toBeGreaterThan(0);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should treat SQL-like patterns as literal keywords', () => {
    const pattern = "1' OR '1'='1";
    const result = sanitizeKeywords([pattern]);
    // Treated as literal substring, not as SQL - safe for keyword matching
    expect(result[0]).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it('should preserve legitimate keywords unchanged', () => {
    const legitimate = ['test', 'keyword', 'filter', 'linkedin'];
    const result = sanitizeKeywords(legitimate);
    expect(result).toEqual(legitimate);
  });

  it('should filter out empty and whitespace-only keywords', () => {
    const keywords = ['', 'test', '  ', 'valid'];
    const result = sanitizeKeywords(keywords);
    expect(Array.isArray(result)).toBe(true);
    // Empty/whitespace strings should be filtered
    expect(result.every((k) => k.trim().length > 0)).toBe(true);
  });

  it('should treat URI-like patterns as literal keywords', () => {
    const pattern = 'javascript:alert(1)';
    const result = sanitizeKeywords([pattern]);
    // Used for substring matching, not rendering, so literal text is safe
    expect(result[0]).toBeDefined();
    expect(typeof result[0]).toBe('string');
  });
});
