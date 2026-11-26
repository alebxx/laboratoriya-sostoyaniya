// Тесты: экспорт, импорт, проверка файла, удаление.
// Вместо настоящего браузера используется «поддельная» IndexedDB (fake-indexeddb).
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { destroyDb, STORE_NAMES } from '../src/db/db.js';
import { put, getAll, setSetting, getSetting, clearEverything } from '../src/db/repo.js';
import { exportAllData, importAllData, exportStoreCsv, hasUserData } from '../src/db/exportImport.js';
import { validateImport, migrateImport } from '../src/logic/importCheck.js';
import { APP_ID, SCHEMA_VERSION } from '../src/config.js';

beforeEach(async () => {
  await destroyDb();
});

describe('база данных', () => {
  it('создаются все хранилища', async () => {
    const data = await exportAllData();
    expect(Object.keys(data.data).sort()).toEqual([...STORE_NAMES].sort());
  });

  it('одна запись дневника на день: повторное сохранение заменяет запись', async () => {
    await put('diary', { day: '2026-03-01', stress: 3 });
    await put('diary', { day: '2026-03-01', stress: 6 });
    const rows = await getAll('diary');
    expect(rows).toEqual([{ day: '2026-03-01', stress: 6 }]);
  });
});

describe('экспорт и импорт', () => {
  it('экспорт → удаление → импорт возвращает те же данные', async () => {
    await setSetting('onboardingDone', true);
    await put('diary', { day: '2026-03-01', stress: 4, causes: ['учёба'] });
    await put('pvtSessions', { id: 's1', day: '2026-03-01', medianRt: 280 });

    const exported = await exportAllData(new Date('2026-03-02T10:00:00Z'));
    expect(exported.app).toBe(APP_ID);
    expect(exported.schemaVersion).toBe(SCHEMA_VERSION);
    expect(exported.exportedAt).toBe('2026-03-02T10:00:00.000Z');

    await clearEverything();
    expect(await hasUserData()).toBe(false);

    // Имитируем сохранение в файл и чтение обратно.
    const fromFile = JSON.parse(JSON.stringify(exported));
    const result = await importAllData(fromFile);
    expect(result.ok).toBe(true);
    expect(await getAll('diary')).toEqual([{ day: '2026-03-01', stress: 4, causes: ['учёба'] }]);
    expect(await getAll('pvtSessions')).toHaveLength(1);
    expect(await getSetting('onboardingDone')).toBe(true);
  });

  it('импорт заменяет текущие данные, а не добавляет', async () => {
    await put('diary', { day: '2026-03-05', stress: 9 });
    const file = {
      app: APP_ID,
      schemaVersion: 1,
      data: { diary: [{ day: '2026-03-01', stress: 1 }] },
    };
    await importAllData(file);
    expect(await getAll('diary')).toEqual([{ day: '2026-03-01', stress: 1 }]);
  });

  it('неправильный файл не меняет данные', async () => {
    await put('diary', { day: '2026-03-05', stress: 9 });
    const result = await importAllData({ app: 'другой-сайт', schemaVersion: 1, data: {} });
    expect(result.ok).toBe(false);
    expect(await getAll('diary')).toHaveLength(1);
  });

  it('CSV-таблица дневника: русские заголовки и столбец для своего фактора', async () => {
    await setSetting('customFactors', [{ id: 'f1', name: 'кофе', type: 'bool' }]);
    await put('diary', { day: '2026-03-01', stress: 4, causes: ['учёба'], factors: { f1: true } });
    const [header, row] = (await exportStoreCsv('diary')).split('\r\n');
    const cols = header.split(';');
    const cells = row.split(';');
    expect(cols[0]).toBe('День');
    expect(cells[cols.indexOf('Стресс (0–10)')]).toBe('4');
    expect(cells[cols.indexOf('Причины стресса')]).toBe('учёба');
    expect(cells[cols.indexOf('Фактор: кофе')]).toBe('да');
  });

  it('CSV других таблиц — столбцы по полям записей', async () => {
    await put('pss', { id: 'p1', total: 20 });
    expect(await exportStoreCsv('pss')).toBe('id;total\r\np1;20');
  });
});

describe('проверка файла импорта', () => {
  const good = { app: APP_ID, schemaVersion: 1, data: { diary: [] } };

  it('правильный файл проходит проверку', () => {
    expect(validateImport(good).ok).toBe(true);
  });
  it('чужой файл отклоняется', () => {
    expect(validateImport({ ...good, app: 'x' }).ok).toBe(false);
    expect(validateImport(null).ok).toBe(false);
    expect(validateImport('текст').ok).toBe(false);
  });
  it('файл из более новой версии отклоняется с понятным объяснением', () => {
    const r = validateImport({ ...good, schemaVersion: SCHEMA_VERSION + 1 });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/более новой версией/);
  });
  it('нет версии — отклоняется', () => {
    expect(validateImport({ app: APP_ID, data: {} }).ok).toBe(false);
  });
  it('неизвестный раздел или повреждённый раздел — отклоняется', () => {
    expect(validateImport({ ...good, data: { secret: [] } }).ok).toBe(false);
    expect(validateImport({ ...good, data: { diary: 'не список' } }).ok).toBe(false);
  });
  it('миграция приводит файл к текущей версии и не портит исходный объект', () => {
    const original = { app: APP_ID, schemaVersion: 1, data: { diary: [{ day: '2026-03-01' }] } };
    const migrated = migrateImport(original);
    expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);
    expect(migrated.data.diary).toEqual([{ day: '2026-03-01' }]);
    expect(migrated.data).not.toBe(original.data);
  });
});

describe('удаление всех данных', () => {
  it('стирает и записи, и настройки', async () => {
    await setSetting('onboardingDone', true);
    await put('diary', { day: '2026-03-01', stress: 4 });
    await clearEverything();
    expect(await getAll('diary')).toEqual([]);
    expect(await getSetting('onboardingDone', false)).toBe(false);
  });
});
