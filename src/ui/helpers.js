// =====================================================================
// Мелкие помощники для страниц.
// =====================================================================

// Защита текста пользователя при вставке в HTML.
// Без неё заметка вида «<b>» сломала бы страницу.
export function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Скачать файл, созданный прямо в браузере (никуда не отправляется).
export function downloadFile(fileName, content, mimeType) {
  // Для CSV добавляем специальный знак в начало (BOM),
  // чтобы Excel правильно показал русские буквы.
  const body = mimeType.startsWith('text/csv') ? '﻿' + content : content;
  const blob = new Blob([body], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Дата и время в привычном виде: «26.11.2026, 20:15».
export function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Сегодняшняя дата для имени файла: 2026-11-26.
export function fileDate(date = new Date()) {
  return date.toISOString().slice(0, 10);
}
