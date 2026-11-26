// =====================================================================
// Перевод таблицы (массива записей) в текст формата CSV.
// CSV открывается в Excel, Google Таблицах, LibreOffice.
// =====================================================================
import { CSV_SEPARATOR } from '../config.js';

// Подготовить одно значение для ячейки.
export function formatCell(value, sep = CSV_SEPARATOR) {
  if (value === null || value === undefined) return '';
  let text;
  if (typeof value === 'object') {
    // Списки и вложенные объекты записываем как JSON-текст.
    text = JSON.stringify(value);
  } else {
    text = String(value);
  }
  // Если в тексте есть разделитель, кавычки или перенос строки —
  // берём его в кавычки, а кавычки внутри удваиваем (правило CSV).
  if (text.includes(sep) || text.includes('"') || text.includes('\n') || text.includes('\r')) {
    text = '"' + text.replace(/"/g, '""') + '"';
  }
  return text;
}

// Список столбцов: все поля, которые встречаются хотя бы в одной записи,
// в порядке первого появления.
export function collectColumns(rows) {
  const columns = [];
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!columns.includes(key)) columns.push(key);
    }
  }
  return columns;
}

// Массив записей → текст CSV (первая строка — названия столбцов).
export function rowsToCsv(rows, sep = CSV_SEPARATOR) {
  const columns = collectColumns(rows);
  const lines = [columns.map((c) => formatCell(c, sep)).join(sep)];
  for (const row of rows) {
    lines.push(columns.map((c) => formatCell(row[c], sep)).join(sep));
  }
  return lines.join('\r\n');
}
