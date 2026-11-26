// Тесты: перевод записей в CSV.
import { describe, it, expect } from 'vitest';
import { rowsToCsv, formatCell, collectColumns } from '../src/logic/csv.js';

describe('CSV', () => {
  it('простая таблица с точкой с запятой', () => {
    const csv = rowsToCsv([
      { day: '2026-03-01', stress: 5 },
      { day: '2026-03-02', stress: 7 },
    ]);
    expect(csv).toBe('day;stress\r\n2026-03-01;5\r\n2026-03-02;7');
  });

  it('пустые значения — пустая ячейка', () => {
    expect(formatCell(null)).toBe('');
    expect(formatCell(undefined)).toBe('');
  });

  it('текст с разделителем, кавычками и переносом берётся в кавычки', () => {
    expect(formatCell('кофе; чай')).toBe('"кофе; чай"');
    expect(formatCell('сказал "привет"')).toBe('"сказал ""привет"""');
    expect(formatCell('строка 1\nстрока 2')).toBe('"строка 1\nстрока 2"');
  });

  it('списки записываются как JSON', () => {
    expect(formatCell(['учёба', 'сон'], ',')).toBe('"[""учёба"",""сон""]"');
  });

  it('столбцы собираются из всех записей', () => {
    expect(collectColumns([{ a: 1 }, { b: 2, a: 3 }])).toEqual(['a', 'b']);
    expect(rowsToCsv([{ a: 1 }, { b: 2 }])).toBe('a;b\r\n1;\r\n;2');
  });

  it('пустая таблица — пустая строка заголовка', () => {
    expect(rowsToCsv([])).toBe('');
  });
});
