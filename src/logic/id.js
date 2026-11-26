// Уникальный идентификатор для новой записи.
export function makeId() {
  if (globalThis.crypto && crypto.randomUUID) return crypto.randomUUID();
  // Запасной вариант для очень старых браузеров.
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}
