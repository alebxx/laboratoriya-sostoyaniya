// =====================================================================
// Мягкая забота: заметить, что очень высокий стресс отмечен
// несколько дней подряд, и один раз показать спокойное сообщение.
// Это не оценка состояния и не диагноз — только напоминание о поддержке.
// =====================================================================
import { CARE } from '../config.js';
import { addDays } from './dates.js';

// Найти серию дней подряд с высоким стрессом, которая заканчивается
// последней записью. Возвращает { length, startDay } или null.
// Пропущенный день (без записи) прерывает серию.
export function currentHighStressStreak(entries, highFrom = CARE.highStressFrom) {
  const byDay = new Map(entries.map((e) => [e.day, e]));
  const days = [...byDay.keys()].sort();
  if (days.length === 0) return null;

  let day = days[days.length - 1];
  let length = 0;
  let startDay = null;
  while (byDay.has(day) && byDay.get(day).stress !== null && byDay.get(day).stress >= highFrom) {
    length++;
    startDay = day;
    day = addDays(day, -1);
  }
  return length > 0 ? { length, startDay } : null;
}

// Показать ли сообщение. Для каждой серии — только один раз:
// lastShownStreakStart — первый день серии, для которой сообщение уже показывали.
export function shouldShowCare(entries, lastShownStreakStart, consecutiveDays = CARE.consecutiveDays, highFrom = CARE.highStressFrom) {
  const streak = currentHighStressStreak(entries, highFrom);
  if (!streak || streak.length < consecutiveDays) return { show: false };
  if (lastShownStreakStart === streak.startDay) return { show: false };
  return { show: true, streakStart: streak.startDay };
}
