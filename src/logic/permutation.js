// =====================================================================
// Перестановочный тест — простыми словами.
//
// Вопрос: насколько часто такая разница между группами получалась бы
// СЛУЧАЙНО, если бы на самом деле связи не было?
//
// Как отвечаем: если связи нет, то метки «группа A» и «группа B» ничего
// не значат, и их можно перемешать. Перемешиваем много раз (по умолчанию 5000),
// каждый раз считаем разницу медиан и смотрим, в какой доле случаев
// она получилась не меньше настоящей (в ожидаемую сторону).
// Эта доля — p. Маленькое p значит: случайно такое бывает редко.
// =====================================================================
import { ANALYSIS } from '../config.js';
import { median } from './stats.js';
import { createRandom, shuffle } from './random.js';

// a, b — значения показателя в группах A и B.
// Возвращает:
//   diff      — разница медиан (A минус B);
//   pGreater  — доля перестановок, где разница ≥ настоящей (проверка «A больше B»);
//   pLess     — доля перестановок, где разница ≤ настоящей (проверка «A меньше B»).
// К счёту прибавляется 1 (настоящее разбиение тоже одна из перестановок),
// поэтому p никогда не бывает ровно 0.
export function permutationTest(a, b, { permutations = ANALYSIS.permutations, seed = 1 } = {}) {
  const observed = median(a) - median(b);
  const all = [...a, ...b];
  const random = createRandom(seed);
  let greaterOrEqual = 0;
  let lessOrEqual = 0;
  // Маленький допуск, чтобы не путаться в погрешностях дробных чисел.
  const eps = 1e-9;
  for (let i = 0; i < permutations; i++) {
    const mixed = shuffle(all, random);
    const diff = median(mixed.slice(0, a.length)) - median(mixed.slice(a.length));
    if (diff >= observed - eps) greaterOrEqual++;
    if (diff <= observed + eps) lessOrEqual++;
  }
  return {
    diff: observed,
    pGreater: (greaterOrEqual + 1) / (permutations + 1),
    pLess: (lessOrEqual + 1) / (permutations + 1),
    permutations,
  };
}

// Итог проверки по правилу, зафиксированному в methodology.md:
//   'consistent'   — разница в ожидаемую сторону и p ≤ alpha;
//   'inconsistent' — разница в обратную сторону и p ≤ alpha для обратного направления;
//   'unclear'      — всё остальное.
// expected: 'higher' (ожидаем, что в группе A показатель выше) или 'lower'.
export function verdict(test, expected, alpha = ANALYSIS.alpha) {
  const pExpected = expected === 'higher' ? test.pGreater : test.pLess;
  const pOpposite = expected === 'higher' ? test.pLess : test.pGreater;
  const inExpectedDirection = expected === 'higher' ? test.diff > 0 : test.diff < 0;
  const inOppositeDirection = expected === 'higher' ? test.diff < 0 : test.diff > 0;
  let result = 'unclear';
  if (inExpectedDirection && pExpected <= alpha) result = 'consistent';
  else if (inOppositeDirection && pOpposite <= alpha) result = 'inconsistent';
  return { verdict: result, pExpected, pOpposite };
}

export const VERDICT_LABELS = {
  consistent: 'Данные согласуются с гипотезой',
  inconsistent: 'Данные не согласуются с гипотезой',
  unclear: 'Пока неясно',
};

// p → понятная фраза «в N случаях из 100».
export function chanceText(p) {
  const n = Math.round(p * 100);
  if (n < 1) return 'меньше чем в 1 случае из 100';
  if (n >= 100) return 'почти всегда (в 100 случаях из 100)';
  return `примерно в ${n} ${pluralCases(n)} из 100`;
}

function pluralCases(n) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'случае';
  return 'случаях';
}
