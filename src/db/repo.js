// =====================================================================
// Простые функции для чтения и записи данных.
// Остальной код сайта работает с базой только через этот файл.
// =====================================================================
import { getDb, STORE_NAMES } from './db.js';

// Все записи из хранилища (например, getAll('diary') — весь дневник).
export async function getAll(store) {
  return (await getDb()).getAll(store);
}

// Одна запись по ключу.
export async function get(store, key) {
  return (await getDb()).get(store, key);
}

// Сохранить запись (новую или изменённую).
export async function put(store, record) {
  return (await getDb()).put(store, record);
}

// Сохранить сразу много записей одной транзакцией (быстрее и надёжнее:
// либо сохранятся все, либо ни одной).
export async function putMany(store, records) {
  const db = await getDb();
  const tx = db.transaction(store, 'readwrite');
  for (const r of records) tx.store.put(r);
  await tx.done;
}

// Удалить одну запись по ключу.
export async function remove(store, key) {
  return (await getDb()).delete(store, key);
}

// Записи с определённым значением индексного поля
// (например, все попытки одного сеанса теста).
export async function getAllByIndex(store, indexName, value) {
  return (await getDb()).getAllFromIndex(store, indexName, value);
}

// ----- Настройки -----

export async function getSetting(key, defaultValue = undefined) {
  const row = await get('settings', key);
  return row === undefined ? defaultValue : row.value;
}

export async function setSetting(key, value) {
  return put('settings', { key, value });
}

// Все настройки одним объектом: { onboardingDone: true, ... }
export async function getAllSettings() {
  const rows = await getAll('settings');
  const result = {};
  for (const row of rows) result[row.key] = row.value;
  return result;
}

// ----- Полное удаление -----

// Стирает ВСЕ данные во всех хранилищах (без возможности восстановления).
export async function clearEverything() {
  const db = await getDb();
  const tx = db.transaction(STORE_NAMES, 'readwrite');
  await Promise.all(STORE_NAMES.map((name) => tx.objectStore(name).clear()));
  await tx.done;
  // Тема оформления хранится отдельно (в localStorage) — стираем и её.
  try {
    localStorage.removeItem('theme');
  } catch {
    // localStorage может быть недоступен — это не страшно.
  }
}
