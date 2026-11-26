// Тесты гипотез: разделение дней на группы, сдвиг во времени,
// отбор данных только после фиксации, «один итог», проверка плана, фразы.
import { describe, it, expect } from 'vitest';
import {
  inCondition, buildObservations, progress, evaluate, createHypothesis, validatePlan,
  templateSentence, conditionText, differenceSentence,
} from '../src/logic/hypothesis.js';
import { allMetrics } from '../src/logic/series.js';
import { addDays } from '../src/logic/dates.js';

const metrics = allMetrics([{ id: 'f1', name: 'кофе', type: 'bool' }]);

// Дневник: сон по дням, кофе — по чётным дням.
function makeDiary(start, n, sleepFn) {
  return Array.from({ length: n }, (_, i) => ({
    day: addDays(start, i),
    sleepHours: sleepFn(i),
    stress: i % 10,
    causes: i % 3 === 0 ? ['учёба'] : [],
    factors: { f1: i % 2 === 0 },
  }));
}

// Сеансы теста: медиана реакции зависит от сна (меньше сна — медленнее).
function makeSessions(diary, lag = 0) {
  return diary.map((e, i) => ({
    id: `s${i}`,
    day: addDays(e.day, lag),
    startedAt: `${addDays(e.day, lag)}T10:00:00Z`,
    status: 'completed',
    practice: false,
    device: { type: 'computer' },
    medianRt: e.sleepHours < 7 ? 320 : 270,
  }));
}

const sleepPlan = {
  factorKey: 'sleepHours', factorKind: 'threshold', threshold: 7, side: 'below',
  outcomeKey: 'pvtMedian', direction: 'higher', lag: 0, minDays: 3,
};

describe('условие (группа A)', () => {
  it('порог «меньше» и «не меньше»', () => {
    expect(inCondition({ factorKind: 'threshold', threshold: 7, side: 'below' }, 6.5)).toBe(true);
    expect(inCondition({ factorKind: 'threshold', threshold: 7, side: 'below' }, 7)).toBe(false);
    expect(inCondition({ factorKind: 'threshold', threshold: 7, side: 'atLeast' }, 7)).toBe(true);
  });
  it('«да/нет»: условие — да', () => {
    expect(inCondition({ factorKind: 'boolean' }, 1)).toBe(true);
    expect(inCondition({ factorKind: 'boolean' }, 0)).toBe(false);
  });
});

describe('наблюдения: только после фиксации', () => {
  const diary = makeDiary('2026-03-01', 10, (i) => (i % 2 ? 6 : 8));
  const data = { diary, pvtSessions: makeSessions(diary) };

  it('день фиксации и дни до него не учитываются', () => {
    const obs = buildObservations(sleepPlan, metrics, data, '2026-03-04', 'computer');
    expect(obs.map((o) => o.factorDay)).toEqual([
      '2026-03-05', '2026-03-06', '2026-03-07', '2026-03-08', '2026-03-09', '2026-03-10',
    ]);
  });

  it('группы: сон < 7 → A, иначе B', () => {
    const obs = buildObservations(sleepPlan, metrics, data, '2026-02-28', 'computer');
    expect(obs.filter((o) => o.group === 'A').every((o) => o.factorValue < 7)).toBe(true);
    expect(obs.filter((o) => o.group === 'B').every((o) => o.factorValue >= 7)).toBe(true);
  });

  it('тренировочные сеансы и сеансы с другого устройства не попадают', () => {
    const sessions = makeSessions(diary).map((s, i) => (i === 5 ? { ...s, practice: true } : i === 6 ? { ...s, device: { type: 'phone' } } : s));
    const obs = buildObservations(sleepPlan, metrics, { diary, pvtSessions: sessions }, '2026-02-28', 'computer');
    expect(obs.map((o) => o.outcomeDay)).not.toContain('2026-03-06');
    expect(obs.map((o) => o.outcomeDay)).not.toContain('2026-03-07');
  });
});

describe('сдвиг во времени', () => {
  it('сдвиг 1: фактор в день d, результат — в день d+1', () => {
    const diary = makeDiary('2026-03-01', 6, (i) => (i % 2 ? 6 : 8));
    const sessions = makeSessions(diary, 1); // тест на следующий день после записи сна
    const obs = buildObservations({ ...sleepPlan, lag: 1 }, metrics, { diary, pvtSessions: sessions }, '2026-02-28', 'computer');
    expect(obs[0]).toMatchObject({ factorDay: '2026-03-01', outcomeDay: '2026-03-02', factorValue: 8, outcome: 270 });
    expect(obs).toHaveLength(6);
  });

  it('сдвиг 1: последний день без результата на следующий день — не учитывается', () => {
    const diary = makeDiary('2026-03-01', 3, () => 8);
    const sessions = makeSessions(diary, 0); // тест в тот же день, а не на следующий
    const obs = buildObservations({ ...sleepPlan, lag: 1 }, metrics, { diary, pvtSessions: sessions }, '2026-02-28', 'computer');
    // результат 02.03 и 03.03 есть (сеансы тех дней), для 03.03 → 04.03 — нет
    expect(obs.map((o) => o.factorDay)).toEqual(['2026-03-01', '2026-03-02']);
  });

  it('фактор до фиксации со сдвигом в день после — не учитывается (фактор уже был виден)', () => {
    const diary = makeDiary('2026-03-01', 4, () => 8);
    const sessions = makeSessions(diary, 1);
    const obs = buildObservations({ ...sleepPlan, lag: 1 }, metrics, { diary, pvtSessions: sessions }, '2026-03-02', 'computer');
    expect(obs.map((o) => o.factorDay)).toEqual(['2026-03-03', '2026-03-04']);
  });
});

describe('прогресс и «один итог»', () => {
  const obs = [
    { outcomeDay: '01', group: 'A' },
    { outcomeDay: '02', group: 'A' },
    { outcomeDay: '03', group: 'B' },
    { outcomeDay: '04', group: 'A' },
    { outcomeDay: '05', group: 'B' },
    { outcomeDay: '06', group: 'B' }, // здесь обе группы достигают 3
    { outcomeDay: '07', group: 'A' },
  ];

  it('пока не хватает дней — только прогресс', () => {
    expect(progress(obs.slice(0, 4), 3)).toEqual({ a: 3, b: 1, minDays: 3, ready: false, cutoffDay: null });
  });

  it('точка проверки — первый день, когда в обеих группах набрано минимум', () => {
    expect(progress(obs, 3)).toEqual({ a: 3, b: 3, minDays: 3, ready: true, cutoffDay: '06' });
  });

  it('итог считается по дням до точки проверки; более поздние дни не влияют', () => {
    const diary = makeDiary('2026-03-01', 20, (i) => (i % 2 ? 6 : 8));
    const data = { diary, pvtSessions: makeSessions(diary) };
    const hyp = createHypothesis({ id: 'h1', question: 'Сон и реакция', plan: sleepPlan }, new Date(2026, 1, 28, 12));
    const all = buildObservations(sleepPlan, metrics, data, hyp.lockDay, 'computer');
    const r1 = evaluate(hyp, all, { permutations: 500 });
    const r2 = evaluate(hyp, all.slice(0, 7), { permutations: 500 });
    expect(r1.cutoffDay).toBe('2026-03-06');
    expect(r1).toEqual(r2); // данные после точки проверки ничего не меняют
    expect(r1.nA).toBe(3);
    expect(r1.nB).toBe(3);
    expect(r1.medianA).toBe(320);
    expect(r1.medianB).toBe(270);
    expect(r1.diff).toBe(50);
    expect(r1.observations).toHaveLength(6);
  });

  it('данных мало — итога нет', () => {
    const hyp = createHypothesis({ id: 'h2', plan: { ...sleepPlan, minDays: 7 } });
    expect(evaluate(hyp, obs, { permutations: 100 })).toBeNull();
  });

  it('итог повторяется (зерно — из ID гипотезы)', () => {
    const diary = makeDiary('2026-03-01', 20, (i) => (i % 3 ? 6 : 8));
    const data = { diary, pvtSessions: makeSessions(diary) };
    const hyp = createHypothesis({ id: 'h3', plan: { ...sleepPlan, minDays: 5 } }, new Date(2026, 1, 28, 12));
    const o = buildObservations(hyp.plan, metrics, data, hyp.lockDay, 'computer');
    expect(evaluate(hyp, o, { permutations: 300 })).toEqual(evaluate(hyp, o, { permutations: 300 }));
  });
});

describe('фиксация гипотезы', () => {
  it('сохраняет момент и день фиксации, план копируется', () => {
    const plan = { ...sleepPlan };
    const h = createHypothesis({ id: 'x', question: '  Влияет ли сон?  ', plan }, new Date(2026, 2, 10, 2, 30));
    expect(h.lockDay).toBe('2026-03-09'); // 02:30 ночи — ещё предыдущий день (граница 4:00)
    expect(h.question).toBe('Влияет ли сон?');
    expect(h.result).toBeNull();
    plan.threshold = 100;
    expect(h.plan.threshold).toBe(7); // изменение исходного объекта не меняет гипотезу
  });
});

describe('проверка плана', () => {
  it('правильный план — без ошибок', () => {
    expect(validatePlan({ ...sleepPlan, minDays: 7 }, metrics)).toEqual([]);
  });
  it('нет порога для числового фактора', () => {
    expect(validatePlan({ ...sleepPlan, threshold: NaN }, metrics).join()).toMatch(/порог/);
  });
  it('фактор совпадает с результатом в тот же день', () => {
    expect(validatePlan({ ...sleepPlan, outcomeKey: 'sleepHours' }, metrics).join()).toMatch(/совпадают/);
  });
  it('минимум дней вне 5–60', () => {
    expect(validatePlan({ ...sleepPlan, minDays: 2 }, metrics).join()).toMatch(/Минимум/);
  });
  it('для «да/нет» порог не нужен', () => {
    expect(validatePlan({ factorKey: 'factor:f1', factorKind: 'boolean', outcomeKey: 'stress', direction: 'lower', lag: 0, minDays: 7 }, metrics)).toEqual([]);
  });
});

describe('фразы', () => {
  const sleep = metrics.find((m) => m.key === 'sleepHours');
  const rt = metrics.find((m) => m.key === 'pvtMedian');
  const coffee = metrics.find((m) => m.key === 'factor:f1');
  const study = metrics.find((m) => m.key === 'cause:учёба');

  it('шаблон гипотезы', () => {
    expect(templateSentence(sleepPlan, sleep, rt)).toBe('Когда сон (часы) меньше 7, мой показатель «медиана реакции в тесте» выше, чем в остальные дни.');
    expect(templateSentence({ ...sleepPlan, lag: 1 }, sleep, rt)).toMatch(/^На следующий день после дней, когда/);
  });
  it('условие для «да/нет» и для причины стресса', () => {
    expect(conditionText({ factorKind: 'boolean' }, coffee)).toBe('кофе: да');
    expect(conditionText({ factorKind: 'boolean' }, study)).toBe('причина «учёба» отмечена');
  });
  it('разница медиан словами — осторожно, без причинности', () => {
    const text = differenceSentence({ diff: 50, medianA: 320, medianB: 270 }, sleepPlan, sleep, rt);
    expect(text).toBe('В дни, когда сон (часы) меньше 7, медиана показателя «медиана реакции в тесте» была выше на 50: 320 против 270 в остальные дни.');
    expect(text).not.toMatch(/вызыва|доказ|из-за/);
  });
});
