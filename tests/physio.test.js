// Тесты: пульс и давление — проверка правдоподобия, время суток, запись, CSV.
import { describe, it, expect } from 'vitest';
import { checkValues, timeOfDay, buildRecord, physioRowsForCsv } from '../src/logic/physio.js';

describe('проверка правдоподобия (только опечатки, не нормы)', () => {
  it('обычные значения принимаются', () => {
    const r = checkValues({ pulse: '72', systolic: '118', diastolic: '76' });
    expect(r.errors).toEqual([]);
    expect(r.values).toEqual({ pulse: 72, systolic: 118, diastolic: 76 });
  });
  it('можно ввести только пульс', () => {
    expect(checkValues({ pulse: '65', systolic: '', diastolic: '' }).errors).toEqual([]);
  });
  it('пустая форма — ошибка', () => {
    expect(checkValues({ pulse: '', systolic: '', diastolic: '' }).errors.join()).toMatch(/хотя бы одно/);
  });
  it('пульс вне 30–220 — похоже на опечатку', () => {
    expect(checkValues({ pulse: '7' }).errors.join()).toMatch(/опечатку/);
    expect(checkValues({ pulse: '221' }).errors.join()).toMatch(/от 30 до 220/);
    expect(checkValues({ pulse: '30' }).errors).toEqual([]);
    expect(checkValues({ pulse: '220' }).errors).toEqual([]);
  });
  it('не число и дробь — ошибка', () => {
    expect(checkValues({ pulse: 'abc' }).errors.join()).toMatch(/целое/);
    expect(checkValues({ pulse: '72,5' }).errors.join()).toMatch(/целое/);
  });
  it('давление только одним числом — ошибка', () => {
    expect(checkValues({ systolic: '120', diastolic: '' }).errors.join()).toMatch(/двумя числами/);
  });
  it('верхнее не больше нижнего — подсказка про перепутанные числа', () => {
    expect(checkValues({ systolic: '70', diastolic: '110' }).errors.join()).toMatch(/перепутаны/);
  });
  it('в сообщениях нет медицинских оценок', () => {
    const all = [
      ...checkValues({ pulse: '7' }).errors,
      ...checkValues({ systolic: '300', diastolic: '200' }).errors,
    ].join(' ');
    expect(all).not.toMatch(/норм|повышен|понижен|опасн/i);
  });
});

describe('время суток', () => {
  it('утро, день, вечер, ночь', () => {
    expect(timeOfDay(new Date(2026, 2, 1, 4, 0))).toBe('утро');
    expect(timeOfDay(new Date(2026, 2, 1, 11, 59))).toBe('утро');
    expect(timeOfDay(new Date(2026, 2, 1, 12, 0))).toBe('день');
    expect(timeOfDay(new Date(2026, 2, 1, 18, 0))).toBe('вечер');
    expect(timeOfDay(new Date(2026, 2, 1, 3, 59))).toBe('ночь');
  });
});

describe('запись измерения', () => {
  it('день — с учётом границы суток, контекст сохраняется', () => {
    const rec = buildRecord('m1', { pulse: 70, systolic: null, diastolic: null }, { posture: 'sitting', rested: true, caffeine: false, exercise: null }, new Date(2026, 2, 10, 1, 30));
    expect(rec.day).toBe('2026-03-09');
    expect(rec.timeOfDay).toBe('ночь');
    expect(rec).toMatchObject({ pulse: 70, posture: 'sitting', rested5min: true, caffeine2h: false, exercise1h: null });
  });
  it('CSV: русские заголовки, да/нет', () => {
    const rec = buildRecord('m1', { pulse: 70, systolic: 120, diastolic: 80 }, { posture: 'sitting', rested: true, caffeine: false }, new Date(2026, 2, 10, 9, 5));
    const [row] = physioRowsForCsv([rec]);
    expect(row['Пульс, уд/мин']).toBe(70);
    expect(row['Поза']).toBe('сидя');
    expect(row['Отдых 5 минут']).toBe('да');
    expect(row['Кофеин за 2 часа']).toBe('нет');
    expect(row['Нагрузка за час']).toBe('');
    expect(row['Время измерения']).toBe('2026-03-10 09:05');
  });
});
