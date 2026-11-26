// Тесты: мягкая забота при очень высоком стрессе несколько дней подряд.
import { describe, it, expect } from 'vitest';
import { currentHighStressStreak, shouldShowCare } from '../src/logic/care.js';

const e = (day, stress) => ({ day, stress });

describe('серия дней с высоким стрессом', () => {
  it('три дня подряд по 9–10', () => {
    const entries = [e('2026-03-01', 3), e('2026-03-02', 9), e('2026-03-03', 10), e('2026-03-04', 9)];
    expect(currentHighStressStreak(entries, 9)).toEqual({ length: 3, startDay: '2026-03-02' });
  });

  it('пропущенный день прерывает серию', () => {
    const entries = [e('2026-03-01', 9), e('2026-03-02', 9), e('2026-03-04', 10)];
    expect(currentHighStressStreak(entries, 9)).toEqual({ length: 1, startDay: '2026-03-04' });
  });

  it('последний день без высокого стресса — серии нет', () => {
    const entries = [e('2026-03-01', 9), e('2026-03-02', 9), e('2026-03-03', 5)];
    expect(currentHighStressStreak(entries, 9)).toBeNull();
  });

  it('не отмеченный стресс прерывает серию', () => {
    const entries = [e('2026-03-01', 9), e('2026-03-02', null), e('2026-03-03', 9)];
    expect(currentHighStressStreak(entries, 9).length).toBe(1);
  });

  it('пустой дневник', () => {
    expect(currentHighStressStreak([], 9)).toBeNull();
  });
});

describe('показ сообщения', () => {
  const three = [e('2026-03-02', 9), e('2026-03-03', 10), e('2026-03-04', 9)];

  it('3 дня подряд — показать', () => {
    expect(shouldShowCare(three, null, 3, 9)).toEqual({ show: true, streakStart: '2026-03-02' });
  });
  it('2 дня — ещё не показывать', () => {
    expect(shouldShowCare(three.slice(1), null, 3, 9).show).toBe(false);
  });
  it('для той же серии второй раз не показывать', () => {
    expect(shouldShowCare([...three, e('2026-03-05', 10)], '2026-03-02', 3, 9).show).toBe(false);
  });
  it('новая серия после перерыва — показать снова', () => {
    const later = [...three, e('2026-03-05', 4), e('2026-03-06', 9), e('2026-03-07', 9), e('2026-03-08', 10)];
    expect(shouldShowCare(later, '2026-03-02', 3, 9)).toEqual({ show: true, streakStart: '2026-03-06' });
  });
});
