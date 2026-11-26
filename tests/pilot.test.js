// Тесты: SUS, код участника, сроки анкеты «после», сводка, выгрузка без личных данных и демо.
import { describe, it, expect } from 'vitest';
import { scoreSus, validateSus } from '../src/logic/sus.js';
import {
  generateCode, isValidCode, afterAvailableFrom, isAfterDue, hasDemoData, pilotSummary,
  sanitizeForResearcher, buildResearcherExport, researcherCsvRow,
} from '../src/logic/pilot.js';

describe('подсчёт SUS', () => {
  it('все ответы «3» — 50 баллов', () => {
    expect(scoreSus(Array(10).fill(3))).toBe(50);
  });
  it('лучший вариант (нечётные 5, чётные 1) — 100', () => {
    expect(scoreSus([5, 1, 5, 1, 5, 1, 5, 1, 5, 1])).toBe(100);
  });
  it('худший вариант (нечётные 1, чётные 5) — 0', () => {
    expect(scoreSus([1, 5, 1, 5, 1, 5, 1, 5, 1, 5])).toBe(0);
  });
  it('пример, посчитанный вручную', () => {
    // нечётные: (4-1)+(5-1)+(3-1)+(4-1)+(5-1) = 3+4+2+3+4 = 16
    // чётные:   (5-2)+(5-1)+(5-2)+(5-3)+(5-1) = 3+4+3+2+4 = 16
    // (16 + 16) × 2,5 = 80
    expect(scoreSus([4, 2, 5, 1, 3, 2, 4, 3, 5, 1])).toBe(80);
  });
  it('не все ответы — ошибка', () => {
    expect(validateSus([1, 2, null, 4, 5, 1, 2, 3, 4, 5])).toMatch(/пункты: 3/);
    expect(() => scoreSus([1, 2])).toThrow();
  });
});

describe('код участника', () => {
  it('формат P и три цифры', () => {
    expect(generateCode(() => 0.07)).toBe('P070');
    expect(generateCode(() => 0)).toBe('P000');
    expect(generateCode(() => 0.9999)).toBe('P999');
  });
  it('допустимы только латиница и цифры, без пробелов и имён по-русски', () => {
    expect(isValidCode('P07')).toBe(true);
    expect(isValidCode('school-12')).toBe(true);
    expect(isValidCode('Маша')).toBe(false);
    expect(isValidCode('P 07')).toBe(false);
    expect(isValidCode('')).toBe(false);
  });
});

describe('анкета «после»', () => {
  const pilot = { startedAt: new Date(2026, 2, 1, 12).toISOString(), afterDays: 14 };
  it('доступна через заданное число дней', () => {
    expect(afterAvailableFrom(pilot)).toBe('2026-03-15');
    expect(isAfterDue(pilot, '2026-03-14')).toBe(false);
    expect(isAfterDue(pilot, '2026-03-15')).toBe(true);
  });
});

const data = {
  diary: [
    { day: '2026-03-01', stress: 5, note: 'поругался с Петей', causeOther: 'переезд', factors: { f1: true } },
    { day: '2026-03-02', stress: 3, note: '', factors: {} },
    { day: '2026-03-03', stress: 9, demo: true, factors: {} },
  ],
  pvtSessions: [
    { id: 's1', status: 'completed', device: { type: 'computer', isPrimary: true, userAgent: 'Mozilla/5.0 (Mac)' } },
    { id: 's2', status: 'aborted', device: { type: 'computer', userAgent: 'x' } },
    { id: 's3', status: 'completed', demo: true, device: { type: 'computer' } },
  ],
  pvtTrials: [],
  physio: [],
  pss: [{ id: 'p1', total: 30, helplessness: 18, selfEfficacy: 12, scale: '1-5' }],
  hypotheses: [
    { id: 'h1', question: 'Связано ли с Петей?', reflection: 'Понял, что...', plan: { factorKey: 'factor:f1', outcomeKey: 'stress' }, result: { verdict: 'unclear', observations: [{ day: 'x' }] } },
    { id: 'h2', question: '', plan: { factorKey: 'sleepHours', outcomeKey: 'stress' }, result: null },
  ],
  experiments: [],
};
const factors = [{ id: 'f1', name: 'встреча с Петей', type: 'bool' }];

describe('сводка участия', () => {
  it('без демо: дни дневника, завершённые сеансы, гипотезы', () => {
    expect(pilotSummary(data)).toMatchObject({
      diaryDays: 2, pvtSessions: 1, pvtSessionsAll: 2, hypothesesCreated: 2, hypothesesCompleted: 1,
    });
  });
  it('демо-данные замечаются', () => {
    expect(hasDemoData(data)).toBe(true);
    expect(hasDemoData({ diary: [{ day: '1' }] })).toBe(false);
  });
});

describe('выгрузка для исследователя: без личных данных и демо', () => {
  const clean = sanitizeForResearcher(data, factors);
  const text = JSON.stringify(clean);

  it('нет демо-записей', () => {
    expect(clean.diary).toHaveLength(2);
    expect(clean.pvtSessions.map((s) => s.id)).toEqual(['s1', 's2']);
  });
  it('нет заметок, «своей причины», вопросов и выводов — только пометка «заполнено»', () => {
    expect(text).not.toMatch(/Петей|Петя|переезд|Понял/);
    expect(clean.diary[0]).toMatchObject({ noteFilled: true, causeOtherFilled: true });
    expect(clean.hypotheses[0]).toMatchObject({ questionFilled: true, reflectionFilled: true });
  });
  it('нет user agent, тип устройства остаётся', () => {
    expect(text).not.toMatch(/Mozilla/);
    expect(clean.pvtSessions[0].device).toEqual({ type: 'computer', isPrimary: true });
  });
  it('названия своих факторов заменены на «фактор 1»', () => {
    expect(clean.factors).toEqual([{ alias: 'фактор 1', type: 'bool', hidden: false }]);
    expect(clean.diary[0].factors).toEqual({ 'фактор 1': true });
    expect(clean.hypotheses[0].plan.factorKey).toBe('фактор 1');
  });
  it('в итоге гипотезы нет снимка дней (только числа итога)', () => {
    expect(clean.hypotheses[0].result).toEqual({ verdict: 'unclear' });
  });
  it('полная выгрузка содержит код участника и анкеты', () => {
    const exp = buildResearcherExport({
      pilot: { code: 'P07', startedAt: '2026-03-01T10:00:00Z', afterDays: 14 },
      questionnaires: { before: { factorsAnswer: 'сон' } },
      data, factors, now: new Date('2026-03-20T10:00:00Z'),
    });
    expect(exp).toMatchObject({ kind: 'pilot-export', participant: 'P07', questionnaires: { before: { factorsAnswer: 'сон' } } });
    expect(exp.summary.diaryDays).toBe(2);
  });
  it('строка CSV: код, сводка, баллы анкет', () => {
    const row = researcherCsvRow({
      pilot: { code: 'P07', startedAt: '2026-03-01T10:00:00Z' },
      questionnaires: { before: { pssId: 'p1', factorsAnswer: 'сон' }, after: { sus: { score: 80, answers: [4, 2, 5, 1, 3, 2, 4, 3, 5, 1] }, feedback: { 'что удобно': 'графики' } } },
      data,
    });
    expect(row['Код участника']).toBe('P07');
    expect(row['До: PSS-10 общий балл']).toBe(30);
    expect(row['SUS: балл (0–100)']).toBe(80);
    expect(row['SUS: пункт 1']).toBe(4);
    expect(row['Отзыв: что удобно']).toBe('графики');
    expect(row['Дней с записями в дневнике']).toBe(2);
  });
});
