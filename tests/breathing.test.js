// Тесты дыхательного упражнения: фазы, циклы, пределы настроек.
import { describe, it, expect } from 'vitest';
import { phaseAt, plannedCycles, totalMs, clampSettings } from '../src/logic/breathing.js';

describe('фаза дыхания (вдох 4 с, выдох 6 с)', () => {
  it('начало — вдох, осталось 4 с', () => {
    expect(phaseAt(0, 4, 6)).toMatchObject({ phase: 'inhale', secondsLeftInPhase: 4, cycle: 1, progressInPhase: 0 });
  });
  it('3,5 с — ещё вдох, осталась 1 с', () => {
    expect(phaseAt(3500, 4, 6)).toMatchObject({ phase: 'inhale', secondsLeftInPhase: 1 });
  });
  it('4 с — начинается выдох', () => {
    expect(phaseAt(4000, 4, 6)).toMatchObject({ phase: 'exhale', secondsLeftInPhase: 6, progressInPhase: 0 });
  });
  it('7 с — середина выдоха', () => {
    expect(phaseAt(7000, 4, 6)).toMatchObject({ phase: 'exhale', secondsLeftInPhase: 3, progressInPhase: 0.5 });
  });
  it('10 с — второй цикл, снова вдох', () => {
    expect(phaseAt(10000, 4, 6)).toMatchObject({ phase: 'inhale', cycle: 2 });
  });
});

describe('длительность', () => {
  it('2 минуты при цикле 10 с — 12 циклов, ровно 120 с', () => {
    expect(plannedCycles(2, 4, 6)).toBe(12);
    expect(totalMs(2, 4, 6)).toBe(120000);
  });
  it('1 минута при цикле 7 с — 8 целых циклов (56 с)', () => {
    expect(plannedCycles(1, 3, 4)).toBe(8);
    expect(totalMs(1, 3, 4)).toBe(56000);
  });
});

describe('пределы настроек', () => {
  it('значения вне пределов подрезаются, пустые — по умолчанию', () => {
    expect(clampSettings({ inhaleSec: 1, exhaleSec: 30, durationMin: 9 })).toEqual({ inhaleSec: 2, exhaleSec: 10, durationMin: 5 });
    expect(clampSettings({ inhaleSec: NaN, exhaleSec: NaN, durationMin: NaN })).toEqual({ inhaleSec: 4, exhaleSec: 6, durationMin: 2 });
  });
});
