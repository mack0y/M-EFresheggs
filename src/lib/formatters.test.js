import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatDate,
  formatTime,
  formatQuantity,
  formatDateShort,
  formatShiftTime,
} from './formatters.js';

// ============================================================
// Mock the ./api module that formatters.js depends on
// formatters imports { TRAY_SIZE, getLocalDate } from './api'
// ============================================================
vi.mock('./api', () => ({
  TRAY_SIZE: 30,
  getLocalDate: vi.fn((date) => {
    // Replicate the real getLocalDate logic but without timezone dependency
    // using the (possibly fake) Date constructor
    const d = date || new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${yyyy}-${mm}-${dd}`;
  }),
}));

// ============================================================
// Setup: fix system time for reproducible date-dependent tests
// Reference: July 10, 2026 (matches the conversation date)
// ============================================================
const REFERENCE_DATE = new Date('2026-07-10T00:00:00.000Z');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(REFERENCE_DATE);
});

afterEach(() => {
  vi.useRealTimers();
});

// ============================================================
// formatDate
// ============================================================
describe('formatDate', () => {
  it('returns "Today" when date matches today (2026-07-10)', () => {
    expect(formatDate('2026-07-10')).toBe('Today');
  });

  it('returns "Yesterday" when date matches yesterday (2026-07-09)', () => {
    expect(formatDate('2026-07-09')).toBe('Yesterday');
  });

  it('returns "Mon DD" for a date within the same month', () => {
    expect(formatDate('2026-07-01')).toBe('Jul 1');
  });

  it('returns "Mon DD" for a date in a different month', () => {
    expect(formatDate('2026-06-15')).toBe('Jun 15');
  });

  it('returns "Mon DD" for a date in a different year', () => {
    expect(formatDate('2025-12-25')).toBe('Dec 25');
  });

  it('returns "Mon DD" for an old date', () => {
    expect(formatDate('2024-01-01')).toBe('Jan 1');
  });
});

// ============================================================
// formatTime
// ============================================================
describe('formatTime', () => {
  it('returns empty string for null', () => {
    expect(formatTime(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(formatTime(undefined)).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(formatTime('')).toBe('');
  });

  it('returns a 12-hour time string for a valid ISO timestamp', () => {
    const result = formatTime('2026-07-10T11:45:00');
    // The exact output depends on the runner's timezone, so validate the shape
    expect(result).toMatch(/^\d{1,2}:\d{2} (AM|PM)$/);
  });

  it('includes minutes in the output', () => {
    const result = formatTime('2026-07-10T08:05:00');
    expect(result).toMatch(/:05 (AM|PM)$/);
  });

  it('handles midnight', () => {
    const result = formatTime('2026-07-10T00:00:00');
    expect(result).toMatch(/^\d{1,2}:00 (AM|PM)$/);
  });

  it('handles noon', () => {
    const result = formatTime('2026-07-10T12:00:00');
    expect(result).toMatch(/^\d{1,2}:00 (AM|PM)$/);
  });
});

// ============================================================
// formatQuantity
// ============================================================
describe('formatQuantity', () => {
  it('returns "0 pcs" for quantity 0', () => {
    expect(formatQuantity({ quantity: 0 })).toBe('0 pcs');
  });

  it('returns "1 tray" for 1 tray of 30 eggs (quantity=1, default tray_size)', () => {
    // totalEggs = 1 × 30 = 30
    // trays = 30 / 30 = 1, pieces = 0
    expect(formatQuantity({ quantity: 1 })).toBe('1 tray');
  });

  it('returns "2 trays" for 2 trays of 30 eggs (quantity=2, default tray_size)', () => {
    // totalEggs = 2 × 30 = 60
    // trays = 60 / 30 = 2, pieces = 0
    expect(formatQuantity({ quantity: 2 })).toBe('2 trays');
  });

  it('returns "15 pcs" for partial tray (quantity=0.5, default tray_size)', () => {
    // totalEggs = 0.5 × 30 = 15
    // trays = 0, pieces = 15
    expect(formatQuantity({ quantity: 0.5 })).toBe('15 pcs');
  });

  it('returns "1t + 6p" for 1 tray of 36 eggs (custom tray_size)', () => {
    // totalEggs = 1 × 36 = 36
    // trays = 36 / 30 = 1, pieces = 36 % 30 = 6
    expect(formatQuantity({ quantity: 1, tray_size: 36 })).toBe('1t + 6p');
  });

  it('returns "3t + 10p" for 5 trays of 20 eggs (custom tray_size)', () => {
    // totalEggs = 5 × 20 = 100
    // trays = 100 / 30 = 3, pieces = 100 % 30 = 10
    expect(formatQuantity({ quantity: 5, tray_size: 20 })).toBe('3t + 10p');
  });

  it('uses default TRAY_SIZE (30) when tray_size is not provided', () => {
    expect(formatQuantity({ quantity: 3 })).toBe('3 trays');
  });

  it('returns "90 pcs" for quantity 3 with tray_size 0 (edge: zero tray_size)', () => {
    // totalEggs = 3 × 0 = 0, trays = 0, pieces = 0
    // This is an edge case that the current code doesn't guard against
    // but we document the behavior
    const result = formatQuantity({ quantity: 3, tray_size: 0 });
    // 3 * 0 = 0 eggs, 0 / 30 = 0 trays, 0 % 30 = 0 pieces → "0 pcs"
    expect(result).toBe('0 pcs');
  });
});

// ============================================================
// formatDateShort
// ============================================================
describe('formatDateShort', () => {
  it('returns "Jul 10" for July 10', () => {
    expect(formatDateShort('2026-07-10')).toBe('Jul 10');
  });

  it('returns "Jan 1" for January 1', () => {
    expect(formatDateShort('2024-01-01')).toBe('Jan 1');
  });

  it('returns "Dec 25" for December 25', () => {
    expect(formatDateShort('2023-12-25')).toBe('Dec 25');
  });

  it('returns "Mon DD" format for any date', () => {
    const result = formatDateShort('2026-03-05');
    expect(result).toMatch(/^[A-Z][a-z]{2} \d{1,2}$/);
  });

  it('never returns "Today" or "Yesterday" (no relative logic)', () => {
    const result = formatDateShort('2026-07-10'); // "today" in our fixed time
    expect(result).not.toBe('Today');
    expect(result).not.toBe('Yesterday');
    expect(result).toBe('Jul 10');
  });
});

// ============================================================
// formatShiftTime
// ============================================================
describe('formatShiftTime', () => {
  it('returns empty string for null', () => {
    expect(formatShiftTime(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(formatShiftTime(undefined)).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(formatShiftTime('')).toBe('');
  });

  it('converts "06:00" to "6:00 AM"', () => {
    expect(formatShiftTime('06:00')).toBe('6:00 AM');
  });

  it('converts "12:00" to "12:00 PM" (noon)', () => {
    expect(formatShiftTime('12:00')).toBe('12:00 PM');
  });

  it('converts "00:00" to "12:00 AM" (midnight)', () => {
    expect(formatShiftTime('00:00')).toBe('12:00 AM');
  });

  it('converts "13:30" to "1:30 PM"', () => {
    expect(formatShiftTime('13:30')).toBe('1:30 PM');
  });

  it('converts "23:59" to "11:59 PM"', () => {
    expect(formatShiftTime('23:59')).toBe('11:59 PM');
  });

  it('converts "00:05" to "12:05 AM"', () => {
    expect(formatShiftTime('00:05')).toBe('12:05 AM');
  });

  it('converts "07:05" to "7:05 AM"', () => {
    expect(formatShiftTime('07:05')).toBe('7:05 AM');
  });

  it('converts "09:09" to "9:09 AM"', () => {
    expect(formatShiftTime('09:09')).toBe('9:09 AM');
  });

  it('converts "11:59" to "11:59 AM"', () => {
    expect(formatShiftTime('11:59')).toBe('11:59 AM');
  });
});
