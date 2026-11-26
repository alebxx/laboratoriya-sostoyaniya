// Тесты демо-данных: все помечены, не перезаписывают настоящие дни,
// подходят для показа графиков и гипотез.
import { describe, it, expect } from 'vitest';
import { generateDemoData, DEMO_DAYS } from '../src/logic/demo.js';
import { summarizeSession } from '../src/logic/pvt.js';
import { allMetrics } from '../src/logic/series.js';
import { buildObservations, evaluate } from '../src/logic/hypothesis.js';
import { experimentObservations, evaluateExperiment } from '../src/logic/alternation.js';
import { addDays } from '../src/logic/dates.js';

const today = '2026-11-26';
const demo = generateDemoData(today);

describe('демо-данные', () => {
  it('у каждой записи пометка demo', () => {
    for (const key of ['diary', 'pvtSessions', 'pvtTrials', 'physio', 'pss', 'hypotheses', 'experiments']) {
      expect(demo[key].length).toBeGreaterThan(0);
      expect(demo[key].every((r) => r.demo === true)).toBe(true);
    }
    expect(demo.factor.demo).toBe(true);
  });

  it('дни — за последние 30 дней, не позже сегодняшнего', () => {
    const first = addDays(today, -(DEMO_DAYS - 1));
    expect(demo.diary.every((e) => e.day >= first && e.day <= today)).toBe(true);
    expect(demo.diary.length).toBeGreaterThan(20);
  });

  it('дни с настоящими записями пропускаются', () => {
    const real = [addDays(today, -3), addDays(today, -10)];
    const d = generateDemoData(today, { existingDiaryDays: real });
    expect(d.diary.map((e) => e.day)).not.toContain(real[0]);
    expect(d.diary.map((e) => e.day)).not.toContain(real[1]);
  });

  it('одно зерно — одни и те же данные', () => {
    expect(generateDemoData(today, { seed: 5 })).toEqual(generateDemoData(today, { seed: 5 }));
  });

  it('первые 3 завершённых сеанса — тренировочные, есть один незавершённый', () => {
    const completed = demo.pvtSessions.filter((s) => s.status === 'completed').sort((a, b) => a.startedAt.localeCompare(b.startedAt));
    expect(completed.slice(0, 3).every((s) => s.practice)).toBe(true);
    expect(completed.slice(3).every((s) => !s.practice)).toBe(true);
    expect(demo.pvtSessions.some((s) => s.status === 'aborted')).toBe(true);
  });

  it('показатели сеанса совпадают с расчётом по его попыткам', () => {
    const s = demo.pvtSessions.find((x) => x.status === 'completed');
    const trials = demo.pvtTrials.filter((t) => t.sessionId === s.id);
    const m = summarizeSession(trials);
    expect(s.medianRt).toBe(m.medianRt);
    expect(s.lapses).toBe(m.lapses);
    expect(s.stimuli).toBe(m.stimuli);
  });

  it('гипотеза о сне получает итог, гипотеза о кофе — ещё собирает данные', () => {
    const metrics = allMetrics([demo.factor]);
    const data = { diary: demo.diary, pvtSessions: demo.pvtSessions, physio: demo.physio, pss: demo.pss };
    const [sleepH, coffeeH] = demo.hypotheses;
    const r1 = evaluate(sleepH, buildObservations(sleepH.plan, metrics, data, sleepH.lockDay, 'computer'), { permutations: 500 });
    expect(r1).not.toBeNull();
    const r2 = evaluate(coffeeH, buildObservations(coffeeH.plan, metrics, data, coffeeH.lockDay, 'computer'), { permutations: 500 });
    expect(r2).toBeNull();
  });

  it('самоэксперимент закончился и даёт итог', () => {
    const metrics = allMetrics([demo.factor]);
    const exp = demo.experiments[0];
    const obs = experimentObservations(exp, metrics, { pvtSessions: demo.pvtSessions }, 'computer');
    const r = evaluateExperiment(exp, obs, { permutations: 300 });
    expect(r.nA + r.nB).toBeGreaterThan(6);
    expect(exp.schedule.at(-1).day < today).toBe(true);
  });
});
