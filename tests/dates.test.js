// Тесты: к какому дню относится запись (граница суток) и арифметика дней.
import { describe, it, expect } from 'vitest';
import { dayKeyFor, addDays, daysBetween } from '../src/logic/dates.js';

describe('dayKeyFor — граница суток', () => {
  it('запись в 01:30 ночи относится к предыдущему дню (граница 4:00)', () => {
    expect(dayKeyFor(new Date(2026, 2, 15, 1, 30), 4)).toBe('2026-03-14');
  });
  it('запись ровно в 04:00 относится к текущему дню', () => {
    expect(dayKeyFor(new Date(2026, 2, 15, 4, 0), 4)).toBe('2026-03-15');
  });
  it('запись днём относится к текущему дню', () => {
    expect(dayKeyFor(new Date(2026, 2, 15, 14, 0), 4)).toBe('2026-03-15');
  });
  it('ночь на 1-е число уходит в последний день прошлого месяца', () => {
    expect(dayKeyFor(new Date(2026, 2, 1, 3, 59), 4)).toBe('2026-02-28');
  });
  it('граница 0 — обычные календарные сутки', () => {
    expect(dayKeyFor(new Date(2026, 2, 15, 0, 10), 0)).toBe('2026-03-15');
  });
});

describe('addDays и daysBetween', () => {
  it('переход через конец месяца и года', () => {
    expect(addDays('2026-03-31', 1)).toBe('2026-04-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('разница в днях, включая переход на летнее время', () => {
    expect(daysBetween('2026-03-01', '2026-03-08')).toBe(7);
    expect(daysBetween('2026-03-25', '2026-04-01')).toBe(7);
    expect(daysBetween('2026-03-08', '2026-03-01')).toBe(-7);
  });
});
