// Тесты: когда напоминать о резервной копии.
import { describe, it, expect } from 'vitest';
import { shouldRemindBackup, snoozeUntil } from '../src/logic/backupReminder.js';

const now = new Date('2026-03-20T12:00:00Z');

describe('напоминание о резервной копии', () => {
  it('нет данных — не напоминаем', () => {
    expect(shouldRemindBackup({ firstRunAt: '2026-01-01T00:00:00Z' }, false, now)).toBe(false);
  });
  it('копия была 3 дня назад — не напоминаем', () => {
    expect(shouldRemindBackup({ lastBackupAt: '2026-03-17T12:00:00Z' }, true, now)).toBe(false);
  });
  it('копия была 7 дней назад — напоминаем', () => {
    expect(shouldRemindBackup({ lastBackupAt: '2026-03-13T12:00:00Z' }, true, now)).toBe(true);
  });
  it('копии не было, первый вход 8 дней назад — напоминаем', () => {
    expect(shouldRemindBackup({ firstRunAt: '2026-03-12T12:00:00Z' }, true, now)).toBe(true);
  });
  it('копии не было, первый вход вчера — не напоминаем', () => {
    expect(shouldRemindBackup({ firstRunAt: '2026-03-19T12:00:00Z' }, true, now)).toBe(false);
  });
  it('напоминание отложено и срок не прошёл — не напоминаем', () => {
    const s = { lastBackupAt: '2026-03-01T00:00:00Z', backupSnoozedUntil: '2026-03-21T00:00:00Z' };
    expect(shouldRemindBackup(s, true, now)).toBe(false);
  });
  it('срок откладывания прошёл — снова напоминаем', () => {
    const s = { lastBackupAt: '2026-03-01T00:00:00Z', backupSnoozedUntil: '2026-03-20T00:00:00Z' };
    expect(shouldRemindBackup(s, true, now)).toBe(true);
  });
  it('«Отложить» сдвигает на 1 день', () => {
    expect(snoozeUntil(now, 1)).toBe('2026-03-21T12:00:00.000Z');
  });
});
