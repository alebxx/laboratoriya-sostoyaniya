// =====================================================================
// База данных в браузере (IndexedDB).
// Данные никуда не отправляются: они лежат только в этом браузере
// на этом устройстве. Для удобства используется маленькая библиотека idb.
// =====================================================================
import { openDB, deleteDB } from 'idb';

export const DB_NAME = 'laboratoriya-sostoyaniya';

// Версия структуры базы. Если в будущем понадобится новое хранилище
// или индекс — увеличьте число и добавьте шаг в функцию upgrade ниже.
export const DB_VERSION = 1;

// Хранилища («таблицы») и их ключи.
//   keyPath — поле, по которому запись однозначно находится;
//   indexes — поля, по которым нужен быстрый поиск.
export const STORES = {
  settings: { keyPath: 'key' }, // настройки: { key, value }
  diary: { keyPath: 'day' }, // дневник: одна запись на день, ключ — дата 'ГГГГ-ММ-ДД'
  physio: { keyPath: 'id', indexes: ['day'] }, // пульс и давление
  pvtSessions: { keyPath: 'id', indexes: ['day'] }, // сеансы теста на внимание
  pvtTrials: { keyPath: 'id', indexes: ['sessionId'] }, // отдельные попытки теста
  pss: { keyPath: 'id' }, // результаты PSS-10
  hypotheses: { keyPath: 'id' }, // гипотезы
  experiments: { keyPath: 'id' }, // самоэксперименты с чередованием
  pilot: { keyPath: 'id' }, // анкеты пилотного исследования
};

export const STORE_NAMES = Object.keys(STORES);

// Создание и обновление структуры базы (миграции).
// oldVersion — версия, которая была у пользователя до обновления (0 — базы не было).
export function upgrade(db, oldVersion) {
  if (oldVersion < 1) {
    // Версия 1: создаём все хранилища.
    for (const name of STORE_NAMES) {
      const { keyPath, indexes = [] } = STORES[name];
      const store = db.createObjectStore(name, { keyPath });
      for (const field of indexes) store.createIndex(field, field);
    }
  }
  // Пример на будущее:
  // if (oldVersion < 2) {
  //   db.createObjectStore('новоеХранилище', { keyPath: 'id' });
  // }
}

let dbPromise = null;

// Открыть базу (один раз за сеанс работы со страницей).
export function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        upgrade(db, oldVersion);
      },
    });
  }
  return dbPromise;
}

// Закрыть и полностью стереть базу (используется в тестах).
export async function destroyDb() {
  if (dbPromise) {
    (await dbPromise).close();
    dbPromise = null;
  }
  await deleteDB(DB_NAME);
}
