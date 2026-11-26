// =====================================================================
// Самоэксперимент с чередованием условий (A и B).
//
// Пример: A — «перерыв 10 минут перед тестом», B — «без перерыва».
// Сайт заранее и СЛУЧАЙНО решает, какой день будет A, а какой B.
// Почему это лучше простого наблюдения: когда условие выбирает жребий,
// а не сам человек, на него не влияют настроение, усталость и другие
// обстоятельства дня. Поэтому разница между днями A и B ближе
// к ответу на вопрос «помогает ли это мне?».
// =====================================================================
import { addDays } from './dates.js';
import { createRandom, shuffle, seedFromString } from './random.js';
import { median, iqr } from './stats.js';
import { permutationTest, verdict } from './permutation.js';
import { dailyValues } from './series.js';
import { ANALYSIS } from '../config.js';

export const EXPERIMENT_LIMITS = { minDays: 10, maxDays: 60, defaultDays: 14 };

// Случайное расписание: поровну дней A и B (при нечётном числе — один лишний
// достаётся случайно), порядок перемешан.
export function generateSchedule(startDay, totalDays, seed) {
  const random = createRandom(seed);
  const half = Math.floor(totalDays / 2);
  const labels = [...Array(half).fill('A'), ...Array(half).fill('B')];
  if (totalDays % 2 === 1) labels.push(random() < 0.5 ? 'A' : 'B');
  const order = shuffle(labels, random);
  return order.map((condition, i) => ({ day: addDays(startDay, i), condition }));
}

// Какое условие назначено на день (или null, если день вне эксперимента).
export function conditionForDay(experiment, day) {
  const item = experiment.schedule.find((s) => s.day === day);
  return item ? item.condition : null;
}

export function lastDay(experiment) {
  return experiment.schedule[experiment.schedule.length - 1].day;
}

// Эксперимент закончился, когда последний день уже прошёл.
export function isFinished(experiment, today) {
  return today > lastDay(experiment);
}

// Наблюдения: значение показателя в каждый день расписания.
// Дни сравниваются ПО РАСПИСАНИЮ (какое условие было назначено),
// даже если в какой-то день условие не удалось выполнить. Так сохраняется
// главное достоинство жребия; число таких дней показывается отдельно.
export function experimentObservations(experiment, metrics, data, primaryType) {
  const metric = metrics.find((m) => m.key === experiment.outcomeKey);
  if (!metric) return [];
  const byDay = new Map(dailyValues(metric, data, { primaryType, includeOtherDevices: false }).points.map((p) => [p.day, p.value]));
  return experiment.schedule
    .filter((s) => byDay.has(s.day))
    .map((s) => ({
      day: s.day,
      group: s.condition,
      outcome: byDay.get(s.day),
      followed: experiment.followed ? experiment.followed[s.day] ?? null : null,
    }));
}

// Итог эксперимента (считается один раз, после последнего дня).
export const MIN_PER_GROUP = 3;

export function evaluateExperiment(experiment, observations, { permutations = ANALYSIS.permutations, alpha = ANALYSIS.alpha } = {}) {
  const a = observations.filter((o) => o.group === 'A').map((o) => o.outcome);
  const b = observations.filter((o) => o.group === 'B').map((o) => o.outcome);
  const notFollowed = observations.filter((o) => o.followed === false).length;
  if (a.length < MIN_PER_GROUP || b.length < MIN_PER_GROUP) {
    return { insufficient: true, nA: a.length, nB: b.length, notFollowed, observations };
  }
  const seed = seedFromString(experiment.id);
  const test = permutationTest(a, b, { permutations, seed });
  const v = verdict(test, experiment.direction, alpha);
  return {
    insufficient: false,
    nA: a.length,
    nB: b.length,
    medianA: median(a),
    medianB: median(b),
    iqrA: iqr(a),
    iqrB: iqr(b),
    diff: test.diff,
    pExpected: v.pExpected,
    pOpposite: v.pOpposite,
    verdict: v.verdict,
    notFollowed,
    permutations,
    alpha,
    seed,
    observations,
  };
}

// Зерно для расписания: из ID эксперимента (расписание можно воспроизвести).
export function scheduleSeed(id) {
  return seedFromString(`schedule:${id}`);
}
