// Тесты самоэксперимента с чередованием.
import { describe, it, expect } from 'vitest';
import { generateSchedule, conditionForDay, isFinished, lastDay, experimentObservations, evaluateExperiment } from '../src/logic/alternation.js';
import { allMetrics } from '../src/logic/series.js';

describe('расписание', () => {
  it('поровну A и B, дни подряд с даты начала', () => {
    const s = generateSchedule('2026-03-30', 14, 123);
    expect(s).toHaveLength(14);
    expect(s[0].day).toBe('2026-03-30');
    expect(s[13].day).toBe('2026-04-12');
    expect(s.filter((x) => x.condition === 'A')).toHaveLength(7);
  });
  it('при нечётном числе дней разница не больше одного', () => {
    const s = generateSchedule('2026-03-01', 11, 5);
    const a = s.filter((x) => x.condition === 'A').length;
    expect(Math.abs(a - (11 - a))).toBe(1);
  });
  it('одно зерно — одно расписание; разные зёрна — обычно разные', () => {
    expect(generateSchedule('2026-03-01', 14, 7)).toEqual(generateSchedule('2026-03-01', 14, 7));
    expect(generateSchedule('2026-03-01', 14, 7)).not.toEqual(generateSchedule('2026-03-01', 14, 8));
  });
  it('условие на день и конец эксперимента', () => {
    const exp = { schedule: generateSchedule('2026-03-01', 10, 1) };
    expect(['A', 'B']).toContain(conditionForDay(exp, '2026-03-05'));
    expect(conditionForDay(exp, '2026-04-01')).toBeNull();
    expect(lastDay(exp)).toBe('2026-03-10');
    expect(isFinished(exp, '2026-03-10')).toBe(false);
    expect(isFinished(exp, '2026-03-11')).toBe(true);
  });
});

describe('итог эксперимента', () => {
  const metrics = allMetrics();
  const schedule = generateSchedule('2026-03-01', 14, 42);
  // Стресс: в дни A — 2–4, в дни B — 6–8 (известный ответ: в A ниже).
  // Внутри групп есть разброс, как в настоящих данных.
  const diary = schedule.map((s, i) => ({ day: s.day, stress: (s.condition === 'A' ? 2 : 6) + (i % 3) }));
  const exp = { id: 'e1', schedule, outcomeKey: 'stress', direction: 'lower', followed: { [schedule[0].day]: false } };

  it('сравнение по расписанию, с учётом дней, когда условие не выполнено', () => {
    const obs = experimentObservations(exp, metrics, { diary }, 'computer');
    expect(obs).toHaveLength(14);
    const r = evaluateExperiment(exp, obs, { permutations: 1000 });
    expect(r.medianA).toBeGreaterThanOrEqual(2);
    expect(r.medianA).toBeLessThanOrEqual(4);
    expect(r.medianB).toBeGreaterThanOrEqual(6);
    expect(r.diff).toBeLessThan(0);
    expect(r.verdict).toBe('consistent');
    expect(r.notFollowed).toBe(1);
  });

  it('ожидали «выше» — не согласуются', () => {
    const obs = experimentObservations({ ...exp, direction: 'higher' }, metrics, { diary }, 'computer');
    expect(evaluateExperiment({ ...exp, direction: 'higher' }, obs, { permutations: 1000 }).verdict).toBe('inconsistent');
  });

  it('ограничение медианы: если в группах всего два разных значения, тест осторожен', () => {
    // Все дни A = 3, все дни B = 7. Медиана «грубая»: почти при любом
    // перемешивании разница медиан снова −4, поэтому итог — «пока неясно».
    const flat = schedule.map((s) => ({ day: s.day, stress: s.condition === 'A' ? 3 : 7 }));
    const obs = experimentObservations(exp, metrics, { diary: flat }, 'computer');
    expect(evaluateExperiment(exp, obs, { permutations: 1000 }).verdict).toBe('unclear');
  });

  it('мало дней с данными — итог «данных недостаточно»', () => {
    const obs = experimentObservations(exp, metrics, { diary: diary.slice(0, 3) }, 'computer');
    expect(evaluateExperiment(exp, obs, { permutations: 100 }).insufficient).toBe(true);
  });
});
