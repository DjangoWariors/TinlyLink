import { describe, it, expect } from 'vitest';
import {
  cn,
  formatNumber,
  formatCompactNumber,
  formatPercent,
  formatBytes,
  truncate,
  truncateUrl,
  isValidUrl,
  extractDomain,
  generateRandomString,
  capitalize,
  slugify,
  getInitials,
  isEmpty,
  parseQueryString,
  buildQueryString,
  getPercentageColor,
} from '@/utils';

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles conditional classes', () => {
    expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz');
  });

  it('handles arrays', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar');
  });
});

describe('formatNumber', () => {
  it('formats numbers with commas', () => {
    expect(formatNumber(1000)).toBe('1,000');
    expect(formatNumber(1000000)).toBe('1,000,000');
  });
});

describe('formatCompactNumber', () => {
  it('formats thousands', () => {
    expect(formatCompactNumber(1500)).toBe('1.5K');
    expect(formatCompactNumber(10000)).toBe('10K');
  });

  it('formats millions', () => {
    expect(formatCompactNumber(1500000)).toBe('1.5M');
    expect(formatCompactNumber(10000000)).toBe('10M');
  });

  it('returns small numbers as-is', () => {
    expect(formatCompactNumber(500)).toBe('500');
  });
});

describe('formatPercent', () => {
  it('formats percentage', () => {
    expect(formatPercent(50.5)).toBe('50.5%');
    expect(formatPercent(100, 0)).toBe('100%');
  });
});

describe('formatBytes', () => {
  it('formats bytes', () => {
    expect(formatBytes(0)).toBe('0 Bytes');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1048576)).toBe('1 MB');
    expect(formatBytes(1073741824)).toBe('1 GB');
  });
});

describe('truncate', () => {
  it('truncates long strings', () => {
    expect(truncate('Hello World', 5)).toBe('Hello...');
  });

  it('returns short strings unchanged', () => {
    expect(truncate('Hello', 10)).toBe('Hello');
  });
});

describe('truncateUrl', () => {
  it('truncates long URLs', () => {
    const longUrl = 'https://example.com/very/long/path/that/needs/truncating';
    const result = truncateUrl(longUrl, 30);
    expect(result.length).toBeLessThanOrEqual(33); // 30 + '...'
  });

  it('removes protocol', () => {
    const result = truncateUrl('https://example.com', 50);
    expect(result).toBe('example.com');
  });
});

describe('isValidUrl', () => {
  it('validates correct URLs', () => {
    expect(isValidUrl('https://example.com')).toBe(true);
    expect(isValidUrl('http://localhost:3000')).toBe(true);
  });

  it('rejects invalid URLs', () => {
    expect(isValidUrl('not a url')).toBe(false);
    expect(isValidUrl('')).toBe(false);
  });
});

describe('extractDomain', () => {
  it('extracts domain from URL', () => {
    expect(extractDomain('https://example.com/path')).toBe('example.com');
    expect(extractDomain('http://sub.example.com')).toBe('sub.example.com');
  });

  it('returns input on invalid URL', () => {
    expect(extractDomain('not a url')).toBe('not a url');
  });
});

describe('generateRandomString', () => {
  it('generates string of correct length', () => {
    expect(generateRandomString(10).length).toBe(10);
    expect(generateRandomString(20).length).toBe(20);
  });

  it('generates different strings', () => {
    const a = generateRandomString(10);
    const b = generateRandomString(10);
    expect(a).not.toBe(b);
  });
});

describe('capitalize', () => {
  it('capitalizes first letter', () => {
    expect(capitalize('hello')).toBe('Hello');
    expect(capitalize('HELLO')).toBe('HELLO');
  });
});

describe('slugify', () => {
  it('creates slug from string', () => {
    expect(slugify('Hello World')).toBe('hello-world');
    expect(slugify('Test  String!')).toBe('test-string');
  });
});

describe('getInitials', () => {
  it('gets initials from name', () => {
    expect(getInitials('John Doe')).toBe('JD');
    expect(getInitials('Alice')).toBe('A');
    expect(getInitials('John Middle Doe')).toBe('JM');
  });
});

describe('isEmpty', () => {
  it('checks if object is empty', () => {
    expect(isEmpty({})).toBe(true);
    expect(isEmpty({ key: 'value' })).toBe(false);
  });
});

describe('parseQueryString', () => {
  it('parses query string', () => {
    expect(parseQueryString('?foo=bar&baz=qux')).toEqual({
      foo: 'bar',
      baz: 'qux',
    });
  });
});

describe('buildQueryString', () => {
  it('builds query string from object', () => {
    expect(buildQueryString({ foo: 'bar', baz: 'qux' })).toBe('foo=bar&baz=qux');
  });

  it('ignores null and undefined values', () => {
    expect(buildQueryString({ foo: 'bar', baz: null, qux: undefined })).toBe('foo=bar');
  });
});

describe('getPercentageColor', () => {
  it('returns correct colors for percentages', () => {
    expect(getPercentageColor(90)).toBe('#dc2626'); // red
    expect(getPercentageColor(70)).toBe('#d97706'); // yellow
    expect(getPercentageColor(50)).toBe('#059669'); // green
  });
});
