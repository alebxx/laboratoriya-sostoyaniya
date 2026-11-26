// Тесты: классификация попыток PVT, показатели сеанса, 1/RT, интервалы.
import { describe, it, expect } from 'vitest';
import { classifyTrial, summarizeSession, randomIsi } from '../src/logic/pvt.js';

const cfg = { falseStartMs: 100, lapseMs: 355, isiMinMs: 1000, isiMaxMs: 4000 };

describe('классификация попытки', () => {
  it('нажатие до сигнала — фальстарт', () => {
    expect(classifyTrial(null, true, cfg)).toBe('falseStart');
  });
  it('реакция быстрее 100 мс — фальстарт', () => {
    expect(classifyTrial(99.9, false, cfg)).toBe('falseStart');
  });
  it('ровно 100 мс — уже обычная реакция', () => {
    expect(classifyTrial(100, false, cfg)).toBe('valid');
  });
  it('354 мс — обычная, 355 мс — пропуск', () => {
    expect(classifyTrial(354.9, false, cfg)).toBe('valid');
    expect(classifyTrial(355, false, cfg)).toBe('lapse');
  });
});

describe('интервал ожидания', () => {
  it('равномерно от минимума до максимума', () => {
    expect(randomIsi(() => 0, cfg)).toBe(1000);
    expect(randomIsi(() => 0.5, cfg)).toBe(2500);
    expect(randomIsi(() => 0.999999, cfg)).toBeLessThan(4000);
  });
});

describe('показатели сеанса', () => {
  const trials = [
    { rt: 200, type: 'valid', early: false },
    { rt: 250, type: 'valid', early: false },
    { rt: 500, type: 'lapse', early: false },
    { rt: null, type: 'falseStart', early: true }, // нажал до сигнала
    { rt: 80, type: 'falseStart', early: false }, // слишком быстро после сигнала
  ];
  const s = summarizeSession(trials);

  it('медиана — по всем ответам, кроме фальстартов (пропуски входят)', () => {
    expect(s.medianRt).toBe(250);
  });
  it('скорость — среднее 1000/RT', () => {
    // (1000/200 + 1000/250 + 1000/500) / 3 = (5 + 4 + 2) / 3 = 3.667
    expect(s.meanSpeed).toBe(3.667);
  });
  it('пропуски и фальстарты', () => {
    expect(s.lapses).toBe(1);
    expect(s.falseStarts).toBe(2);
  });
  it('стимулы: нажатие до сигнала не считается стимулом', () => {
    expect(s.stimuli).toBe(4);
    expect(s.responses).toBe(3);
  });
  it('нет ответов — показатели пустые, а не 0', () => {
    const empty = summarizeSession([{ rt: null, type: 'falseStart', early: true }]);
    expect(empty.medianRt).toBeNull();
    expect(empty.meanSpeed).toBeNull();
  });
});
