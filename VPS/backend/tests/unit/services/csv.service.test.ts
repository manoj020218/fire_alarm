/**
 * Unit tests — csv.service
 */
import { buildCsv } from '../../../src/services/csv.service';

describe('buildCsv', () => {
  it('returns empty string for empty input', () => {
    expect(buildCsv([])).toBe('');
  });

  it('generates header + one data row', () => {
    const rows = [{ id: '1', name: 'Alice', value: 42 }];
    const csv = buildCsv(rows as unknown as Record<string, unknown>[]);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('id,name,value');
    expect(lines[1]).toBe('1,Alice,42');
  });

  it('escapes commas in cell values', () => {
    const rows = [{ name: 'Hello, World' }];
    const csv = buildCsv(rows as unknown as Record<string, unknown>[]);
    expect(csv).toContain('"Hello, World"');
  });

  it('escapes double-quotes in cell values', () => {
    const rows = [{ name: 'Say "Hi"' }];
    const csv = buildCsv(rows as unknown as Record<string, unknown>[]);
    expect(csv).toContain('"Say ""Hi"""');
  });

  it('handles null/undefined values as empty string', () => {
    const rows = [{ a: null, b: undefined, c: 'ok' }];
    const csv = buildCsv(rows as unknown as Record<string, unknown>[]);
    const dataLine = csv.split('\n')[1];
    expect(dataLine).toBe(',,ok');
  });

  it('generates multiple rows correctly', () => {
    const rows = [
      { x: 1, y: 2 },
      { x: 3, y: 4 },
    ];
    const csv = buildCsv(rows as unknown as Record<string, unknown>[]);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe('1,2');
    expect(lines[2]).toBe('3,4');
  });
});
