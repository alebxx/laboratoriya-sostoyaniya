// Тесты подсчёта PSS-10: обратные пункты, подшкалы, обе шкалы ответов,
// проверка ответов, «не чаще раза в месяц», изменение с прошлого раза.
import { describe, it, expect } from 'vitest';
import { scorePss, reverse, validateAnswers, scoreRanges, canTake, addMonths, changeFromPrevious, pssRowsForCsv } from '../src/logic/pss.js';
import { PSS_ITEMS, PSS_ANSWER_LABELS, hasPlaceholders } from '../src/data/pss10.js';
import { PSS } from '../src/config.js';

describe('переворот обратных пунктов', () => {
  it('шкала 1–5: 1↔5, 2↔4, 3=3', () => {
    expect([1, 2, 3, 4, 5].map((a) => reverse(a, '1-5'))).toEqual([5, 4, 3, 2, 1]);
  });
  it('шкала 0–4: 0↔4, 1↔3, 2=2', () => {
    expect([0, 1, 2, 3, 4].map((a) => reverse(a, '0-4'))).toEqual([4, 3, 2, 1, 0]);
  });
});

describe('подсчёт, шкала 1–5', () => {
  it('все ответы «3» — 30 баллов (переворот 3 даёт 3)', () => {
    const r = scorePss(Array(10).fill(3), '1-5');
    expect(r).toMatchObject({ total: 30, helplessness: 18, selfEfficacy: 12 });
  });

  it('все ответы «1»: прямые пункты по 1, обратные (4, 5, 7, 8) — по 5', () => {
    const r = scorePss(Array(10).fill(1), '1-5');
    expect(r.scored).toEqual([1, 1, 1, 5, 5, 1, 5, 5, 1, 1]);
    expect(r.total).toBe(6 * 1 + 4 * 5); // 26
    expect(r.helplessness).toBe(6);
    expect(r.selfEfficacy).toBe(20);
  });

  it('пример с разными ответами, посчитанный вручную', () => {
    // пункт:   1  2  3  4  5  6  7  8  9  10
    const a = [2, 4, 3, 2, 1, 5, 4, 3, 2, 1];
    // обратные: 4→4, 5→5, 7→2, 8→3
    // беспомощность (1,2,3,6,9,10): 2+4+3+5+2+1 = 17
    // самоэффективность (4,5,7,8 после переворота): 4+5+2+3 = 14
    const r = scorePss(a, '1-5');
    expect(r.helplessness).toBe(17);
    expect(r.selfEfficacy).toBe(14);
    expect(r.total).toBe(31);
  });

  it('общий балл = беспомощность + самоэффективность', () => {
    const r = scorePss([5, 1, 4, 2, 3, 3, 5, 1, 2, 4], '1-5');
    expect(r.total).toBe(r.helplessness + r.selfEfficacy);
  });

  it('диапазоны: общий 10–50, подшкалы 6–30 и 4–20', () => {
    expect(scoreRanges('1-5')).toEqual({ total: { min: 10, max: 50 }, helplessness: { min: 6, max: 30 }, selfEfficacy: { min: 4, max: 20 } });
  });
});

describe('подсчёт, шкала 0–4 (оригинал Коэна)', () => {
  it('все ответы «0»: обратные пункты по 4 — итого 16', () => {
    const r = scorePss(Array(10).fill(0), '0-4');
    expect(r.total).toBe(16);
    expect(r.selfEfficacy).toBe(16);
    expect(r.helplessness).toBe(0);
  });
  it('диапазон общего балла 0–40', () => {
    expect(scoreRanges('0-4').total).toEqual({ min: 0, max: 40 });
  });
});

describe('проверка ответов', () => {
  it('не все ответы — ошибка с номерами вопросов', () => {
    const a = [1, 2, null, 4, 5, 1, 2, 3, undefined, 5];
    expect(validateAnswers(a, '1-5')).toBe('Ответьте, пожалуйста, на вопросы: 3, 9.');
  });
  it('ответ вне шкалы — ошибка', () => {
    expect(validateAnswers([0, 1, 1, 1, 1, 1, 1, 1, 1, 1], '1-5')).toMatch(/вопросы: 1/);
    expect(validateAnswers([5, 1, 1, 1, 1, 1, 1, 1, 1, 1], '0-4')).toMatch(/вопросы: 1/);
  });
  it('не 10 ответов — ошибка', () => {
    expect(validateAnswers([1, 2, 3], '1-5')).toMatch(/все 10/);
  });
  it('подсчёт с ошибкой в ответах не выполняется', () => {
    expect(() => scorePss([1, 2, 3], '1-5')).toThrow();
  });
});

describe('не чаще раза в месяц', () => {
  it('первый раз — можно', () => {
    expect(canTake([], '2026-03-01')).toEqual({ allowed: true, nextDay: null });
  });
  it('месяц ещё не прошёл — нельзя, следующий день указан', () => {
    const r = canTake([{ day: '2026-03-15' }], '2026-04-14');
    expect(r.allowed).toBe(false);
    expect(r.nextDay).toBe('2026-04-15');
  });
  it('в тот же день следующего месяца — можно', () => {
    expect(canTake([{ day: '2026-03-15' }], '2026-04-15').allowed).toBe(true);
  });
  it('считается от последнего прохождения', () => {
    expect(canTake([{ day: '2026-01-10' }, { day: '2026-03-15' }], '2026-04-01').allowed).toBe(false);
  });
  it('31-е число → последний день следующего месяца', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-12-05', 1)).toBe('2027-01-05');
  });
  it('демо-результаты не мешают пройти опросник', () => {
    expect(canTake([{ day: '2026-03-20', demo: true }], '2026-03-21').allowed).toBe(true);
  });
});

describe('тексты опросника', () => {
  it('10 вопросов без заглушек, шкала 0–4 с подписями всех ответов', () => {
    expect(PSS_ITEMS).toHaveLength(10);
    expect(PSS_ITEMS.every((t) => t.startsWith('Как часто за последний месяц'))).toBe(true);
    expect(PSS.scale).toBe('0-4');
    expect(hasPlaceholders('0-4')).toBe(false);
    const labels = PSS_ANSWER_LABELS['0-4'];
    expect(labels.map((l) => l.value)).toEqual([0, 1, 2, 3, 4]);
    expect(labels.map((l) => l.label)).toEqual(['никогда', 'почти никогда', 'иногда', 'часто', 'очень часто']);
  });
});

describe('изменение по сравнению с прошлым разом', () => {
  const r1 = { id: 'a', scale: '1-5', completedAt: '2026-03-01T10:00:00Z', total: 30, helplessness: 18, selfEfficacy: 12 };
  const r2 = { id: 'b', scale: '1-5', completedAt: '2026-04-01T10:00:00Z', total: 26, helplessness: 15, selfEfficacy: 11 };
  it('разница с предыдущим результатом', () => {
    expect(changeFromPrevious([r1, r2], r2)).toMatchObject({ total: -4, helplessness: -3, selfEfficacy: -1 });
  });
  it('первый результат — сравнивать не с чем', () => {
    expect(changeFromPrevious([r1], r1)).toBeNull();
  });
  it('разные шкалы ответов не сравниваются', () => {
    expect(changeFromPrevious([r1, { ...r2, scale: '0-4' }], { ...r2, scale: '0-4' })).toBeNull();
  });
});

describe('CSV', () => {
  it('ответы по пунктам, обратные помечены, баллы', () => {
    const [row] = pssRowsForCsv([{ id: 'a', day: '2026-03-01', completedAt: '2026-03-01T10:00:00Z', scale: '1-5', context: 'regular', answers: [1, 2, 3, 4, 5, 1, 2, 3, 4, 5], total: 30, helplessness: 16, selfEfficacy: 14 }]);
    expect(row['Ответ 4 (обратный)']).toBe(4);
    expect(row['Ответ 1']).toBe(1);
    expect(row['Общий балл']).toBe(30);
    expect(row['Повод']).toBe('обычный');
  });
});
