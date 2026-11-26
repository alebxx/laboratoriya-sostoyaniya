// Тесты: сборка записи дневника, пустая запись, свои факторы, CSV.
import { describe, it, expect } from 'vitest';
import { buildEntry, isEntryEmpty, validateFactor, diaryRowsForCsv, localDateTime } from '../src/logic/diary.js';

const now = new Date('2026-03-10T19:00:00Z');
const factors = [
  { id: 'f1', name: 'кофе', type: 'bool' },
  { id: 'f2', name: 'часы спорта', type: 'number' },
];

describe('buildEntry — сборка записи', () => {
  it('сохраняет отмеченные значения и время записи', () => {
    const e = buildEntry('2026-03-10', { stress: '7', mood: '4', sleepHours: '6.5' }, undefined, [], now);
    expect(e.day).toBe('2026-03-10');
    expect(e.stress).toBe(7);
    expect(e.mood).toBe(4);
    expect(e.sleepHours).toBe(6.5);
    expect(e.createdAt).toBe('2026-03-10T19:00:00.000Z');
    expect(e.updatedAt).toBe('2026-03-10T19:00:00.000Z');
  });

  it('не отмеченные поля — null, а не 0', () => {
    const e = buildEntry('2026-03-10', { stress: '' }, undefined, [], now);
    expect(e.stress).toBeNull();
    expect(e.fatigue).toBeNull();
  });

  it('0 — это настоящее значение, а не «не отмечено»', () => {
    const e = buildEntry('2026-03-10', { stress: '0' }, undefined, [], now);
    expect(e.stress).toBe(0);
    expect(isEntryEmpty(e)).toBe(false);
  });

  it('значения вне шкалы отбрасываются', () => {
    const e = buildEntry('2026-03-10', { stress: '11', mood: '0', sleepHours: '30' }, undefined, [], now);
    expect(e.stress).toBeNull();
    expect(e.mood).toBeNull();
    expect(e.sleepHours).toBeNull();
  });

  it('при редактировании время создания сохраняется, время изменения обновляется', () => {
    const prev = { createdAt: '2026-03-10T08:00:00.000Z' };
    const e = buildEntry('2026-03-10', { stress: '3' }, prev, [], now);
    expect(e.createdAt).toBe('2026-03-10T08:00:00.000Z');
    expect(e.updatedAt).toBe('2026-03-10T19:00:00.000Z');
  });

  it('пометка демо-данных сохраняется при редактировании', () => {
    const e = buildEntry('2026-03-10', { stress: '3' }, { createdAt: 'x', demo: true }, [], now);
    expect(e.demo).toBe(true);
  });

  it('причины: только из списка, своё поле обрезается', () => {
    const e = buildEntry('2026-03-10', { causes: ['учёба', 'взлом'], causeOther: '  переезд  ' }, undefined, [], now);
    expect(e.causes).toEqual(['учёба']);
    expect(e.causeOther).toBe('переезд');
  });

  it('свои факторы: да/нет и число, не отмеченные не сохраняются', () => {
    const e = buildEntry('2026-03-10', { factors: { f1: 'no', f2: '1.5' } }, undefined, factors, now);
    expect(e.factors).toEqual({ f1: false, f2: 1.5 });
    const e2 = buildEntry('2026-03-10', { factors: { f1: '', f2: '' } }, undefined, factors, now);
    expect(e2.factors).toEqual({});
  });

  it('заметка ограничена 500 символами', () => {
    const e = buildEntry('2026-03-10', { note: 'а'.repeat(600) }, undefined, [], now);
    expect(e.note).toHaveLength(500);
  });
});

describe('isEntryEmpty', () => {
  it('пустая форма — пустая запись', () => {
    expect(isEntryEmpty(buildEntry('2026-03-10', {}, undefined, factors, now))).toBe(true);
  });
  it('только заметка — уже не пустая', () => {
    expect(isEntryEmpty(buildEntry('2026-03-10', { note: 'день как день' }, undefined, [], now))).toBe(false);
  });
});

describe('validateFactor', () => {
  it('пустое название и повтор не принимаются', () => {
    expect(validateFactor('  ', 'bool', [])).toMatch(/название/);
    expect(validateFactor('Кофе', 'bool', factors)).toMatch(/уже есть/);
  });
  it('нормальный фактор принимается', () => {
    expect(validateFactor('контрольная', 'bool', factors)).toBeNull();
  });
  it('неизвестный тип не принимается', () => {
    expect(validateFactor('чай', 'text', [])).toMatch(/тип/);
  });
});

describe('diaryRowsForCsv', () => {
  it('русские заголовки, факторы — отдельные столбцы, причины через запятую, сортировка по дню', () => {
    const entries = [
      { day: '2026-03-11', stress: 2, causes: [], factors: { f2: 2 } },
      { day: '2026-03-10', stress: 7, causes: ['учёба', 'недосып'], factors: { f1: true }, demo: true },
    ];
    const rows = diaryRowsForCsv(entries, factors);
    expect(rows[0]['День']).toBe('2026-03-10');
    expect(rows[0]['Стресс (0–10)']).toBe(7);
    expect(rows[0]['Причины стресса']).toBe('учёба, недосып');
    expect(rows[0]['Фактор: кофе']).toBe('да');
    expect(rows[0]['Фактор: часы спорта']).toBeUndefined();
    expect(rows[0]['Демо-данные']).toBe('да');
    expect(rows[1]['Фактор: часы спорта']).toBe(2);
  });

  it('время — по местному времени в виде «ГГГГ-ММ-ДД ЧЧ:ММ»', () => {
    const local = new Date(2026, 2, 10, 20, 36); // 10 марта 2026, 20:36 по местному времени
    expect(localDateTime(local.toISOString())).toBe('2026-03-10 20:36');
    expect(localDateTime(undefined)).toBe('');
  });
});
