// =====================================================================
// Экспорт (выгрузка) и импорт (загрузка) всех данных.
// =====================================================================
import { APP_ID, SCHEMA_VERSION } from '../config.js';
import { getDb, STORE_NAMES } from './db.js';
import { rowsToCsv } from '../logic/csv.js';
import { validateImport, migrateImport } from '../logic/importCheck.js';
import { diaryRowsForCsv } from '../logic/diary.js';
import { sessionRowsForCsv, trialRowsForCsv } from '../logic/pvt.js';
import { exclusionReason } from '../logic/sessionFilter.js';
import { hypothesisRowsForCsv } from '../logic/hypothesis.js';
import { allMetrics } from '../logic/series.js';
import { physioRowsForCsv } from '../logic/physio.js';
import { pssRowsForCsv } from '../logic/pss.js';

// Какие таблицы выгружаются в CSV и как называются файлы.
export const CSV_TABLES = [
  { store: 'diary', file: 'dnevnik', title: 'Дневник' },
  { store: 'physio', file: 'fiziologiya', title: 'Пульс и давление' },
  { store: 'pvtSessions', file: 'test-seansy', title: 'Сеансы теста на внимание' },
  { store: 'pvtTrials', file: 'test-popytki', title: 'Попытки теста на внимание' },
  { store: 'pss', file: 'pss10', title: 'PSS-10' },
  { store: 'hypotheses', file: 'gipotezy', title: 'Гипотезы' },
  { store: 'experiments', file: 'samoeksperimenty', title: 'Самоэксперименты' },
];

// Полная копия всех данных одним объектом (для JSON-файла).
export async function exportAllData(now = new Date()) {
  const db = await getDb();
  const data = {};
  for (const name of STORE_NAMES) {
    data[name] = await db.getAll(name);
  }
  return {
    app: APP_ID,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    data,
  };
}

// Одна таблица в формате CSV.
export async function exportStoreCsv(store) {
  const db = await getDb();
  const rows = await db.getAll(store);
  if (store === 'diary') {
    // Для дневника — понятные столбцы: каждый свой фактор отдельно.
    const factorsRow = await db.get('settings', 'customFactors');
    return rowsToCsv(diaryRowsForCsv(rows, factorsRow ? factorsRow.value : []));
  }
  if (store === 'pvtSessions') {
    const primaryRow = await db.get('settings', 'primaryDevice');
    const primaryType = primaryRow ? primaryRow.value.type : null;
    return rowsToCsv(sessionRowsForCsv(rows, (s) => exclusionReason(s, primaryType)));
  }
  if (store === 'pss') {
    return rowsToCsv(pssRowsForCsv(rows));
  }
  if (store === 'physio') {
    return rowsToCsv(physioRowsForCsv(rows));
  }
  if (store === 'pvtTrials') {
    return rowsToCsv(trialRowsForCsv(rows));
  }
  if (store === 'hypotheses') {
    const factorsRow = await db.get('settings', 'customFactors');
    return rowsToCsv(hypothesisRowsForCsv(rows, allMetrics(factorsRow ? factorsRow.value : [])));
  }
  if (store === 'experiments') {
    // Одна строка на день эксперимента.
    const out = [];
    for (const e of rows) {
      for (const s of e.schedule) {
        out.push({
          'ID эксперимента': e.id,
          'Условие A': e.conditionA,
          'Условие B': e.conditionB,
          'Показатель': e.outcomeKey,
          'День': s.day,
          'Назначено': s.condition,
          'Условие выполнено': e.followed?.[s.day] === true ? 'да' : e.followed?.[s.day] === false ? 'нет' : '',
          'Итог эксперимента': e.result ? (e.result.insufficient ? 'данных недостаточно' : e.result.verdict) : '',
          'Демо-данные': e.demo ? 'да' : '',
        });
      }
    }
    return rowsToCsv(out);
  }
  return rowsToCsv(rows);
}

// Загрузить данные из объекта JSON. ВНИМАНИЕ: текущие данные заменяются.
// Возвращает { ok: true } или { ok: false, error }.
export async function importAllData(obj) {
  const check = validateImport(obj);
  if (!check.ok) return check;

  const migrated = migrateImport(obj);
  const db = await getDb();
  // Одна транзакция: либо загрузится всё, либо (при ошибке) ничего не изменится.
  const tx = db.transaction(STORE_NAMES, 'readwrite');
  for (const name of STORE_NAMES) {
    const store = tx.objectStore(name);
    await store.clear();
    for (const row of migrated.data[name] || []) {
      await store.put(row);
    }
  }
  await tx.done;
  return { ok: true };
}

// Есть ли в базе хоть какие-то данные пользователя (кроме настроек).
export async function hasUserData() {
  const db = await getDb();
  for (const name of STORE_NAMES) {
    if (name === 'settings') continue;
    if ((await db.count(name)) > 0) return true;
  }
  return false;
}
