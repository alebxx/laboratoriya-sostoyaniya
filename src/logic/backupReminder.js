// =====================================================================
// Нужно ли сейчас напомнить о резервной копии (экспорте данных)?
// =====================================================================
import { BACKUP } from '../config.js';

const DAY_MS = 24 * 60 * 60 * 1000;

// settings — объект настроек, где могут быть поля (даты в формате ISO):
//   firstRunAt     — когда пользователь впервые зашёл;
//   lastBackupAt   — когда последний раз делал экспорт;
//   backupSnoozedUntil — до какого момента напоминание отложено.
// hasData — есть ли вообще что сохранять (пустую базу копировать незачем).
// now — текущий момент (передаётся параметром, чтобы функцию было легко тестировать).
export function shouldRemindBackup(settings, hasData, now = new Date(), remindEveryDays = BACKUP.remindEveryDays) {
  if (!hasData) return false;

  // Напоминание отложено и срок ещё не прошёл.
  if (settings.backupSnoozedUntil && now < new Date(settings.backupSnoozedUntil)) {
    return false;
  }

  // Отсчёт ведём от последней копии, а если её не было — от первого входа.
  const since = settings.lastBackupAt || settings.firstRunAt;
  if (!since) return true;

  return now - new Date(since) >= remindEveryDays * DAY_MS;
}

// Момент, до которого откладывается напоминание по кнопке «Отложить».
export function snoozeUntil(now = new Date(), days = BACKUP.snoozeDays) {
  return new Date(now.getTime() + days * DAY_MS).toISOString();
}
