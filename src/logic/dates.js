// =====================================================================
// Работа с датами: «к какому дню относится запись» и разница в днях.
// День хранится как текст 'ГГГГ-ММ-ДД' — так его легко сравнивать и сортировать.
// =====================================================================
import { DAY_START_HOUR } from '../config.js';

function pad(n) {
  return String(n).padStart(2, '0');
}

// Дата по местному времени → 'ГГГГ-ММ-ДД' (без учёта границы суток).
export function toDayString(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// К какому дню относится момент времени с учётом границы суток.
// Пример (граница 4:00): 15 марта 01:30 → '…-03-14'; 15 марта 04:00 → '…-03-15'.
export function dayKeyFor(date = new Date(), startHour = DAY_START_HOUR) {
  const d = new Date(date.getTime());
  if (d.getHours() < startHour) {
    d.setDate(d.getDate() - 1);
  }
  return toDayString(d);
}

// Сдвинуть день на n дней: addDays('2026-03-31', 1) → '2026-04-01'.
// Считаем в UTC, чтобы переход на летнее/зимнее время не сбивал счёт.
export function addDays(dayKey, n) {
  const [y, m, d] = dayKey.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + n));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

// Сколько дней от a до b: daysBetween('2026-03-01', '2026-03-08') → 7.
export function daysBetween(a, b) {
  const toUtc = (k) => {
    const [y, m, d] = k.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(b) - toUtc(a)) / 86400000);
}
