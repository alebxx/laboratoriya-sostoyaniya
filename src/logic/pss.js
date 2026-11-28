// =====================================================================
// Подсчёт PSS-10 (Cohen, Kamarck, Mermelstein, 1983).
// Шкала НЕ является диагнозом: здесь нет порогов «норма / стресс».
//
// Правила (из ТЗ проекта, сверить с выбранной версией опросника):
//   — пункты 4, 5, 7, 8 — обратные: ответ «переворачивается»
//     (для шкалы 1–5: 1↔5, 2↔4, 3=3; для шкалы 0–4: 0↔4, 1↔3, 2=2);
//   — подшкала «беспомощность»: пункты 1, 2, 3, 6, 9, 10;
//   — подшкала «самоэффективность»: пункты 4, 5, 7, 8 (после переворота);
//   — общий балл — сумма всех 10 пунктов (после переворота).
// =====================================================================
import { PSS } from '../config.js';

export const REVERSED_ITEMS = [4, 5, 7, 8];
export const HELPLESSNESS_ITEMS = [1, 2, 3, 6, 9, 10];
export const SELF_EFFICACY_ITEMS = [4, 5, 7, 8];

// Границы шкалы ответов.
export function scaleRange(scale) {
  return scale === '0-4' ? { min: 0, max: 4 } : { min: 1, max: 5 };
}

// «Перевернуть» ответ обратного пункта: min ↔ max.
export function reverse(answer, scale) {
  const { min, max } = scaleRange(scale);
  return min + max - answer;
}

// Проверить ответы: ровно 10, все в пределах шкалы. Возвращает текст ошибки или null.
export function validateAnswers(answers, scale) {
  const { min, max } = scaleRange(scale);
  if (!Array.isArray(answers) || answers.length !== 10) return 'Нужно ответить на все 10 вопросов.';
  const missing = answers.map((a, i) => (Number.isInteger(a) && a >= min && a <= max ? null : i + 1)).filter(Boolean);
  if (missing.length) return `Ответьте, пожалуйста, на вопросы: ${missing.join(', ')}.`;
  return null;
}

// Подсчёт баллов. answers — массив из 10 ответов в порядке вопросов.
export function scorePss(answers, scale = PSS.scale) {
  const error = validateAnswers(answers, scale);
  if (error) throw new Error(error);
  // Ответы после переворота обратных пунктов (номера пунктов — с 1).
  const scored = answers.map((a, i) => (REVERSED_ITEMS.includes(i + 1) ? reverse(a, scale) : a));
  const sum = (items) => items.reduce((s, n) => s + scored[n - 1], 0);
  return {
    total: sum([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
    helplessness: sum(HELPLESSNESS_ITEMS),
    selfEfficacy: sum(SELF_EFFICACY_ITEMS),
    scored,
  };
}

// Возможный диапазон общего балла и подшкал (для подписи «из скольких»).
export function scoreRanges(scale = PSS.scale) {
  const { min, max } = scaleRange(scale);
  return {
    total: { min: 10 * min, max: 10 * max },
    helplessness: { min: 6 * min, max: 6 * max },
    selfEfficacy: { min: 4 * min, max: 4 * max },
  };
}

// Можно ли пройти опросник сейчас: не чаще раза в месяц (календарный).
// Следующий раз — в тот же день следующего месяца (31.01 → 28.02 или 29.02).
// Возвращает { allowed, nextDay } — nextDay: с какого дня можно снова.
export function canTake(results, today, minMonthsBetween = PSS.minMonthsBetween) {
  const regular = results.filter((r) => !r.demo);
  if (regular.length === 0) return { allowed: true, nextDay: null };
  const lastDay = regular.map((r) => r.day).sort().at(-1);
  const nextDay = addMonths(lastDay, minMonthsBetween);
  if (today >= nextDay) return { allowed: true, nextDay: null };
  return { allowed: false, nextDay };
}

// «2026-01-31» + 1 месяц → «2026-02-28» (если такого числа нет — последний день месяца).
export function addMonths(day, n) {
  const [y, m, d] = day.split('-').map(Number);
  const lastOfTarget = new Date(Date.UTC(y, m - 1 + n + 1, 0)).getUTCDate();
  const date = new Date(Date.UTC(y, m - 1 + n, Math.min(d, lastOfTarget)));
  return date.toISOString().slice(0, 10);
}

// Изменение по сравнению с прошлым разом (только при той же шкале ответов).
// Возвращает null, если сравнивать не с чем.
export function changeFromPrevious(results, current) {
  const previous = results
    .filter((r) => r.id !== current.id && r.scale === current.scale && r.completedAt < current.completedAt)
    .sort((a, b) => a.completedAt.localeCompare(b.completedAt))
    .at(-1);
  if (!previous) return null;
  return {
    previous,
    total: current.total - previous.total,
    helplessness: current.helplessness - previous.helplessness,
    selfEfficacy: current.selfEfficacy - previous.selfEfficacy,
  };
}

// CSV с русскими заголовками.
export function pssRowsForCsv(results) {
  return [...results]
    .sort((a, b) => a.completedAt.localeCompare(b.completedAt))
    .map((r) => {
      const row = {
        'ID': r.id,
        'День': r.day,
        'Когда пройден': r.completedAt,
        'Повод': { regular: 'обычный', 'pilot-before': 'пилот: анкета «до»', 'pilot-after': 'пилот: анкета «после»' }[r.context] || r.context || '',
        'Шкала ответов': r.scale,
      };
      (r.answers || []).forEach((a, i) => {
        row[`Ответ ${i + 1}${REVERSED_ITEMS.includes(i + 1) ? ' (обратный)' : ''}`] = a;
      });
      row['Общий балл'] = r.total;
      row['Беспомощность'] = r.helplessness;
      row['Самоэффективность'] = r.selfEfficacy;
      row['Демо-данные'] = r.demo ? 'да' : '';
      return row;
    });
}
