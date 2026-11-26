// =====================================================================
// Ряды данных для графиков: «показатель по дням».
// Здесь решается, какое значение показывается за каждый день
// и какие сеансы теста считаются исключёнными.
// Функции не трогают базу и интерфейс — их проверяют тесты.
// =====================================================================
import { exclusionReason } from './sessionFilter.js';
import { addDays } from './dates.js';

// Все показатели, которые можно показать на графике.
//   source — откуда берутся данные; field — поле записи;
//   min/max — постоянные границы шкалы (для шкал 0–10), иначе подбираются сами;
//   integer — значения только целые (деления оси без дробей).
export const METRICS = [
  { key: 'stress', label: 'Стресс', source: 'diary', field: 'stress', min: 0, max: 10 },
  { key: 'fatigue', label: 'Усталость', source: 'diary', field: 'fatigue', min: 0, max: 10 },
  { key: 'concentration', label: 'Концентрация', source: 'diary', field: 'concentration', min: 0, max: 10 },
  { key: 'mood', label: 'Настроение', source: 'diary', field: 'mood', min: 1, max: 5, integer: true },
  { key: 'sleepHours', label: 'Сон, ч', source: 'diary', field: 'sleepHours' },
  { key: 'sleepQuality', label: 'Качество сна', source: 'diary', field: 'sleepQuality', min: 0, max: 10 },
  { key: 'pvtMedian', label: 'Тест: медиана реакции, мс', source: 'pvt', field: 'medianRt' },
  { key: 'pvtLapses', label: 'Тест: пропуски', source: 'pvt', field: 'lapses', min: 0, integer: true },
  { key: 'pvtSpeed', label: 'Тест: скорость реакции (1/RT)', source: 'pvt', field: 'meanSpeed' },
  { key: 'pulse', label: 'Пульс, уд/мин', source: 'physio', field: 'pulse' },
  { key: 'systolic', label: 'Давление систолическое', source: 'physio', field: 'systolic' },
  { key: 'diastolic', label: 'Давление диастолическое', source: 'physio', field: 'diastolic' },
  { key: 'pssTotal', label: 'PSS-10: общий балл', source: 'pss', field: 'total' },
];

// Список показателей вместе со своими факторами пользователя.
// «Да/нет» показывается как 1 (да) и 0 (нет).
export function allMetrics(factors = []) {
  const custom = factors.map((f) => ({
    key: `factor:${f.id}`,
    label: `Фактор: ${f.name}${f.type === 'bool' ? ' (1 — да, 0 — нет)' : ''}`,
    source: 'factor',
    factorId: f.id,
    factorType: f.type,
    ...(f.type === 'bool' ? { min: 0, max: 1, integer: true } : {}),
  }));
  return [...METRICS, ...custom];
}

function isNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

// Значения показателя по дням.
//   data — { diary, pvtSessions, physio, pss } (массивы записей);
//   options.primaryType — тип основного устройства;
//   options.includeOtherDevices — учитывать ли сеансы с других устройств.
// Возвращает:
//   points   — учитываемые значения, не больше одного на день: [{ day, value }];
//   excluded — исключённые сеансы теста: [{ day, value, reason }].
export function dailyValues(metric, data, options = {}) {
  const { primaryType = null, includeOtherDevices = false } = options;
  let points = [];
  const excluded = [];

  if (metric.source === 'diary') {
    points = (data.diary || [])
      .filter((e) => isNumber(e[metric.field]))
      .map((e) => ({ day: e.day, value: e[metric.field] }));
  } else if (metric.source === 'factor') {
    for (const e of data.diary || []) {
      const v = e.factors ? e.factors[metric.factorId] : undefined;
      if (v === true || v === false) points.push({ day: e.day, value: v ? 1 : 0 });
      else if (isNumber(v)) points.push({ day: e.day, value: v });
    }
  } else if (metric.source === 'pvt') {
    // За день берём ПЕРВЫЙ учитываемый сеанс (завершён, не тренировочный,
    // с основного устройства). Остальные сеансы — исключённые.
    const sessions = [...(data.pvtSessions || [])].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
    const daysTaken = new Set();
    for (const s of sessions) {
      const value = s[metric.field];
      if (!isNumber(value)) continue;
      const reason = exclusionReason(s, primaryType, includeOtherDevices);
      if (reason) {
        excluded.push({ day: s.day, value, reason });
      } else if (!daysTaken.has(s.day)) {
        daysTaken.add(s.day);
        points.push({ day: s.day, value });
      } else {
        excluded.push({ day: s.day, value, reason: 'notFirst' });
      }
    }
  } else if (metric.source === 'physio') {
    // За день берём ПЕРВОЕ измерение.
    points = firstPerDay(data.physio || [], 'measuredAt', metric.field);
  } else if (metric.source === 'pss') {
    points = firstPerDay(data.pss || [], 'completedAt', metric.field);
  }

  points.sort((a, b) => a.day.localeCompare(b.day));
  return { points, excluded };
}

// Первая по времени запись каждого дня, у которой есть значение поля.
function firstPerDay(records, timeField, field) {
  const sorted = [...records]
    .filter((r) => isNumber(r[field]))
    .sort((a, b) => String(a[timeField] || '').localeCompare(String(b[timeField] || '')));
  const seen = new Set();
  const result = [];
  for (const r of sorted) {
    if (seen.has(r.day)) continue;
    seen.add(r.day);
    result.push({ day: r.day, value: r[field] });
  }
  return result;
}

// ----- Периоды -----

// Первый и последний день периода.
//   period: 'week' (7 дней), 'month' (30 дней) или 'all' (с первой записи).
//   firstDataDay — самый ранний день, за который есть данные.
export function periodRange(period, today, firstDataDay = today) {
  if (period === 'week') return { from: addDays(today, -6), to: today };
  if (period === 'month') return { from: addDays(today, -29), to: today };
  const from = firstDataDay && firstDataDay < today ? firstDataDay : today;
  return { from, to: today };
}

// Все дни от from до to включительно: ['2026-03-01', '2026-03-02', …].
export function listDays(from, to) {
  const days = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  return days;
}

// Оставить только точки внутри периода.
export function inPeriod(items, range) {
  return items.filter((p) => p.day >= range.from && p.day <= range.to);
}

// ----- Сравнение двух показателей -----

// Пары значений за дни, когда есть оба показателя: [{ day, a, b }].
export function pairByDay(pointsA, pointsB) {
  const mapB = new Map(pointsB.map((p) => [p.day, p.value]));
  return pointsA.filter((p) => mapB.has(p.day)).map((p) => ({ day: p.day, a: p.value, b: mapB.get(p.day) }));
}
