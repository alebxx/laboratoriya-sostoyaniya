// =====================================================================
// Проверка файла импорта и перевод старых форматов в текущий.
// Эти функции ничего не пишут в базу — только проверяют и преобразуют,
// поэтому их легко тестировать.
// =====================================================================
import { APP_ID, SCHEMA_VERSION } from '../config.js';
import { STORE_NAMES } from '../db/db.js';

// Проверить, что объект похож на наш файл экспорта.
// Возвращает { ok: true } или { ok: false, error: 'понятное объяснение' }.
export function validateImport(obj) {
  if (!obj || typeof obj !== 'object') {
    return { ok: false, error: 'Файл не похож на копию данных этого сайта.' };
  }
  if (obj.app !== APP_ID) {
    return { ok: false, error: 'Этот файл создан не сайтом «Лаборатория состояния».' };
  }
  if (!Number.isInteger(obj.schemaVersion) || obj.schemaVersion < 1) {
    return { ok: false, error: 'В файле не указана версия формата данных.' };
  }
  if (obj.schemaVersion > SCHEMA_VERSION) {
    return {
      ok: false,
      error: `Файл создан более новой версией сайта (формат ${obj.schemaVersion}, здесь — ${SCHEMA_VERSION}). Обновите страницу или сайт.`,
    };
  }
  if (!obj.data || typeof obj.data !== 'object') {
    return { ok: false, error: 'В файле нет раздела с данными.' };
  }
  for (const name of Object.keys(obj.data)) {
    if (!STORE_NAMES.includes(name)) {
      return { ok: false, error: `Неизвестный раздел данных в файле: «${name}».` };
    }
    if (!Array.isArray(obj.data[name])) {
      return { ok: false, error: `Раздел «${name}» повреждён.` };
    }
  }
  return { ok: true };
}

// Миграции формата экспорта: как перевести данные из версии N в N+1.
// Пока версия одна, поэтому список пуст. Пример на будущее:
//   2: (data) => { data.diary.forEach((r) => { r.newField = null; }); return data; },
const MIGRATIONS = {};

// Перевести объект экспорта любой старой версии в текущую.
export function migrateImport(obj) {
  let data = structuredClone(obj.data);
  for (let v = obj.schemaVersion + 1; v <= SCHEMA_VERSION; v++) {
    if (MIGRATIONS[v]) data = MIGRATIONS[v](data);
  }
  return { ...obj, schemaVersion: SCHEMA_VERSION, data };
}
