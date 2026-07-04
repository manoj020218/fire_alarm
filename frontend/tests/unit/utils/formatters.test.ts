import { describe, it, expect } from 'vitest';
import { formatUptime, formatRSSI, formatValue, relativeTime } from '@/utils/formatters';

describe('formatUptime', () => {
  it('shows days hours minutes when >= 1 day', () => {
    expect(formatUptime(86400 + 3600 + 60)).toBe('1d 1h 1m');
  });
  it('shows hours minutes when < 1 day', () => {
    expect(formatUptime(3600 + 120)).toBe('1h 2m');
  });
  it('shows only minutes when < 1 hour', () => {
    expect(formatUptime(300)).toBe('5m');
  });
  it('returns 0m for 0 seconds', () => {
    expect(formatUptime(0)).toBe('0m');
  });
});

describe('formatRSSI', () => {
  it('returns Excellent for strong signal', () => expect(formatRSSI(-45)).toBe('Excellent'));
  it('returns Good for -60', () => expect(formatRSSI(-60)).toBe('Good'));
  it('returns Fair for -65', () => expect(formatRSSI(-65)).toBe('Fair'));
  it('returns Weak for -75', () => expect(formatRSSI(-75)).toBe('Weak'));
});

describe('formatValue', () => {
  it('formats with 1 decimal and unit', () => {
    expect(formatValue(6.532, 'bar')).toBe('6.5 bar');
  });
  it('formats integer as decimal', () => {
    expect(formatValue(65, '%')).toBe('65.0 %');
  });
});

describe('relativeTime', () => {
  it('shows seconds ago for very recent', () => {
    const iso = new Date(Date.now() - 30_000).toISOString();
    expect(relativeTime(iso)).toBe('30s ago');
  });
  it('shows minutes ago', () => {
    const iso = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(relativeTime(iso)).toBe('5m ago');
  });
  it('shows hours ago', () => {
    const iso = new Date(Date.now() - 3 * 3600_000).toISOString();
    expect(relativeTime(iso)).toBe('3h ago');
  });
  it('shows days ago', () => {
    const iso = new Date(Date.now() - 2 * 86400_000).toISOString();
    expect(relativeTime(iso)).toBe('2d ago');
  });
});
