// =====================================================================
// Приветствие по времени суток и мягкие поздравления за регулярность.
// Только за то, что сделано: никаких «серия прервана», упрёков и наказаний.
// =====================================================================
import { addDays } from './dates.js';

// Приветствие (граница ночи — 4:00, как у суток в дневнике).
export function greetingFor(date = new Date()) {
  const h = date.getHours();
  if (h >= 4 && h < 12) return 'Доброе утро';
  if (h >= 12 && h < 18) return 'Добрый день';
  if (h >= 18) return 'Добрый вечер';
  return 'Доброй ночи';
}

// Сколько записей дневника за последние 7 дней (включая сегодня).
export function entriesLastWeek(diaryDays, today) {
  const from = addDays(today, -6);
  return new Set(diaryDays.filter((d) => d >= from && d <= today)).size;
}

function plural(n, one, few, many) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

// Мягкое поздравление или null (если записей нет — ничего не говорим, без упрёков).
export function weeklyCheer(diaryDays, today) {
  const n = entriesLastWeek(diaryDays, today);
  if (n === 0) return null;
  const count = `${n} ${plural(n, 'запись', 'записи', 'записей')}`;
  if (n >= 5) return `За последние 7 дней — ${count} в дневнике. Получается настоящая неделя наблюдений.`;
  if (n >= 2) return `За последние 7 дней — ${count} в дневнике. Каждая запись — новые данные для ваших гипотез.`;
  return 'Первая запись за эту неделю уже есть. Спасибо, что наблюдаете за собой.';
}
