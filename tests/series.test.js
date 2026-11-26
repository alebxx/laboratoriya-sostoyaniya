// Тесты: ряды данных для графиков, исключение сеансов, периоды, пары.
import { describe, it, expect } from 'vitest';
import { METRICS, allMetrics, dailyValues, periodRange, listDays, inPeriod, pairByDay } from '../src/logic/series.js';

const metric = (key) => METRICS.find((m) => m.key === key);

const diary = [
  { day: '2026-03-02', stress: 4, sleepHours: 7, factors: { f1: true } },
  { day: '2026-03-01', stress: null, sleepHours: 6, factors: { f1: false, f2: 3 } },
  { day: '2026-03-03', stress: 0, factors: {} },
];

const session = (id, day, time, medianRt, extra = {}) => ({
  id, day, startedAt: `${day}T${time}:00Z`, status: 'completed', practice: false,
  device: { type: 'computer' }, medianRt, ...extra,
});

describe('значения из дневника', () => {
  it('пустые значения пропускаются, 0 — остаётся; сортировка по дню', () => {
    const { points } = dailyValues(metric('stress'), { diary });
    expect(points).toEqual([
      { day: '2026-03-02', value: 4 },
      { day: '2026-03-03', value: 0 },
    ]);
  });

  it('свой фактор «да/нет» — 1 и 0, числовой — как есть', () => {
    const metrics = allMetrics([{ id: 'f1', name: 'кофе', type: 'bool' }, { id: 'f2', name: 'чашки', type: 'number' }]);
    const coffee = metrics.find((m) => m.key === 'factor:f1');
    const cups = metrics.find((m) => m.key === 'factor:f2');
    expect(dailyValues(coffee, { diary }).points).toEqual([
      { day: '2026-03-01', value: 0 },
      { day: '2026-03-02', value: 1 },
    ]);
    expect(dailyValues(cups, { diary }).points).toEqual([{ day: '2026-03-01', value: 3 }]);
    expect(coffee.label).toMatch(/кофе/);
  });
});

describe('значения теста: исключение сеансов', () => {
  const pvtSessions = [
    session('p', '2026-03-01', '09:00', 400, { practice: true }),
    session('a', '2026-03-02', '18:00', 290),
    session('b', '2026-03-02', '09:00', 270), // раньше в тот же день → он «первый»
    session('x', '2026-03-03', '09:00', 500, { status: 'aborted' }),
    session('t', '2026-03-04', '09:00', 330, { device: { type: 'phone' } }),
    session('n', '2026-03-05', '09:00', null), // без значения — пропускается
  ];
  const data = { pvtSessions };

  it('за день — первый учитываемый сеанс, остальные — исключённые с причиной', () => {
    const { points, excluded } = dailyValues(metric('pvtMedian'), data, { primaryType: 'computer' });
    expect(points).toEqual([{ day: '2026-03-02', value: 270 }]);
    expect(excluded).toEqual([
      { day: '2026-03-01', value: 400, reason: 'practice' },
      { day: '2026-03-02', value: 290, reason: 'notFirst' },
      { day: '2026-03-03', value: 500, reason: 'incomplete' },
      { day: '2026-03-04', value: 330, reason: 'otherDevice' },
    ]);
  });

  it('с «учитывать все устройства» сеанс с телефона становится точкой', () => {
    const { points } = dailyValues(metric('pvtMedian'), data, { primaryType: 'computer', includeOtherDevices: true });
    expect(points.map((p) => p.day)).toEqual(['2026-03-02', '2026-03-04']);
  });
});

describe('физиология и PSS: первое значение за день', () => {
  it('первое измерение пульса за день', () => {
    const physio = [
      { day: '2026-03-01', measuredAt: '2026-03-01T20:00:00Z', pulse: 80 },
      { day: '2026-03-01', measuredAt: '2026-03-01T08:00:00Z', pulse: 70 },
      { day: '2026-03-02', measuredAt: '2026-03-02T08:00:00Z', pulse: null, systolic: 120 },
    ];
    expect(dailyValues(metric('pulse'), { physio }).points).toEqual([{ day: '2026-03-01', value: 70 }]);
    expect(dailyValues(metric('systolic'), { physio }).points).toEqual([{ day: '2026-03-02', value: 120 }]);
  });

  it('баллы PSS-10', () => {
    const pss = [{ day: '2026-03-01', completedAt: '2026-03-01T10:00:00Z', total: 25 }];
    expect(dailyValues(metric('pssTotal'), { pss }).points).toEqual([{ day: '2026-03-01', value: 25 }]);
  });
});

describe('периоды', () => {
  it('неделя — 7 дней включая сегодня, месяц — 30 дней', () => {
    expect(periodRange('week', '2026-03-10')).toEqual({ from: '2026-03-04', to: '2026-03-10' });
    expect(periodRange('month', '2026-03-30')).toEqual({ from: '2026-03-01', to: '2026-03-30' });
  });
  it('всё время — с первого дня с данными', () => {
    expect(periodRange('all', '2026-03-10', '2026-01-15')).toEqual({ from: '2026-01-15', to: '2026-03-10' });
    expect(periodRange('all', '2026-03-10', null)).toEqual({ from: '2026-03-10', to: '2026-03-10' });
  });
  it('список дней и фильтр по периоду', () => {
    expect(listDays('2026-02-27', '2026-03-02')).toEqual(['2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02']);
    const pts = [{ day: '2026-03-01' }, { day: '2026-03-05' }];
    expect(inPeriod(pts, { from: '2026-03-02', to: '2026-03-10' })).toEqual([{ day: '2026-03-05' }]);
  });
});

describe('пары для сравнения двух показателей', () => {
  it('только дни, когда есть оба значения', () => {
    const a = [{ day: '1', value: 7 }, { day: '2', value: 5 }, { day: '3', value: 8 }];
    const b = [{ day: '2', value: 300 }, { day: '3', value: 280 }, { day: '4', value: 260 }];
    expect(pairByDay(a, b)).toEqual([
      { day: '2', a: 5, b: 300 },
      { day: '3', a: 8, b: 280 },
    ]);
  });
});
