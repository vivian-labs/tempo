import { describe, it, expect } from 'vitest';
import {
  parseDuration,
  durationParts,
  formatDuration,
  sectorPath,
  durationFromPointer,
} from './time';
describe('time input and presentation', () => {
  it('accepts minutes and explicit sexagesimal notation', () => {
    expect(parseDuration('25')).toBe(1500000);
    expect(parseDuration('1:30')).toBe(90000);
    expect(parseDuration('1:02:03')).toBe(3723000);
  });
  it('rejects zero, overflow and ambiguous numeric input', () => {
    for (const s of ['', '0', '-1', '1e3', '2:80', '25:00:00', 'NaN'])
      expect(parseDuration(s)).toBeNull();
  });
  it('rounds up remaining seconds without showing negative time', () => {
    expect(formatDuration(59999)).toBe('01:00');
    expect(durationParts(-100)).toEqual(['00', '00', '00']);
  });
  it('depletes the sector to an empty path', () => {
    expect(sectorPath(0)).toBe('');
    expect(sectorPath(0.25)).toContain('A244 244 0 0 1 544');
    expect(sectorPath(1)).not.toContain('NaN');
  });
  it('maps clock cardinal positions to physical timer values', () => {
    expect(durationFromPointer(100, 0, 60)).toBe(900000);
    expect(durationFromPointer(0, 100, 60)).toBe(1800000);
    expect(durationFromPointer(-100, 0, 60)).toBe(2700000);
  });
});
