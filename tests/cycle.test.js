// Цикл «Наблюдай → Заметь → Проверь → Используй»: шаг, итог для набора помощи,
// отметки «выполнили стратегию», подсказки, изменение PSS-10.
import { describe, it, expect } from 'vitest';
import {
  cycleState, activeExperiment, experimentProgress, toolkitVerdict, followedSchedule,
  adherenceSummary, patternHints, strategiesForHint, pssOverallChange, pssReminder,
} from '../src/logic/cycle.js';
import { STRATEGIES, getStrategy, isPlaceholder } from '../src/data/strategies.js';

const exp = (id, start, conds, extra = {}) => ({
  id,
  createdAt: `${start}T08:00:00Z`,
  schedule: conds.split('').map((c, i) => ({ day: addDay(start, i), condition: c })),
  result: null,
  ...extra,
});

function addDay(day, n) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const days = (n, from = '2026-03-01') => Array.from({ length: n }, (_, i) => addDay(from, i));

describe('шаг цикла', () => {
  it('меньше 7 дней с записью — наблюдение', () => {
    const s = cycleState({ diaryDays: days(3), experiments: [], today: '2026-03-10' });
    expect(s.step).toBe('observe');
    expect(s.observeCount).toBe(3);
  });
  it('пропуски не сбрасывают неделю: считаются дни с записью', () => {
    const scattered = ['2026-03-01', '2026-03-03', '2026-03-06', '2026-03-09', '2026-03-12', '2026-03-15', '2026-03-20'];
    expect(cycleState({ diaryDays: scattered, experiments: [], today: '2026-03-21' }).step).toBe('notice');
  });
  it('идёт эксперимент — «Проверь»', () => {
    const e = exp('e1', '2026-03-10', 'ABAB');
    const s = cycleState({ diaryDays: days(7), experiments: [e], today: '2026-03-11' });
    expect(s.step).toBe('test');
    expect(s.active.id).toBe('e1');
  });
  it('эксперимент закончился — «Используй»', () => {
    const e = exp('e1', '2026-03-10', 'ABAB');
    expect(cycleState({ diaryDays: days(7), experiments: [e], today: '2026-03-14' }).step).toBe('use');
  });
  it('из нескольких идущих выбирается самый новый', () => {
    const old = exp('old', '2026-03-01', 'ABABABABAB');
    const fresh = { ...exp('new', '2026-03-05', 'ABABAB'), createdAt: '2026-03-05T09:00:00Z' };
    expect(activeExperiment([old, fresh], '2026-03-06').id).toBe('new');
  });
  it('прогресс эксперимента', () => {
    expect(experimentProgress(exp('e', '2026-03-10', 'ABAB'), '2026-03-11')).toEqual({ done: 2, total: 4 });
  });
});

describe('итог для «Моего набора помощи»', () => {
  it('три подписи', () => {
    expect(toolkitVerdict({ verdict: 'consistent' })).toBe('helps');
    expect(toolkitVerdict({ verdict: 'inconsistent' })).toBe('not-helps');
    expect(toolkitVerdict({ verdict: 'unclear' })).toBe('unclear');
    expect(toolkitVerdict({ insufficient: true })).toBe('unclear');
    expect(toolkitVerdict(null)).toBe('unclear');
  });
});

describe('отметка «выполнили ли стратегию»', () => {
  it('день A: «да» — по плану; день B: «нет» — по плану; «не по плану» — нет', () => {
    expect(followedSchedule('A', 'yes')).toBe(true);
    expect(followedSchedule('A', 'no')).toBe(false);
    expect(followedSchedule('B', 'no')).toBe(true);
    expect(followedSchedule('B', 'yes')).toBe(false);
    expect(followedSchedule('A', 'off-plan')).toBe(false);
    expect(followedSchedule('A', undefined)).toBeNull();
  });
  it('сводка за прошедшие дни', () => {
    const e = exp('e', '2026-03-10', 'ABAB', { answers: { '2026-03-10': 'yes', '2026-03-11': 'yes', '2026-03-12': 'off-plan' } });
    expect(adherenceSummary(e, '2026-03-13')).toEqual({ onPlan: 1, offPlan: 2, missing: 1, days: 4 });
  });
});

describe('подсказки на странице «Заметь»', () => {
  const entry = (day, sleepHours, stress, causes = []) => ({ day, sleepHours, stress, causes });
  it('стресс выше после короткого сна — подсказка про сон', () => {
    const diary = days(10).map((d, i) => (i < 5 ? entry(d, 5, 8) : entry(d, 8, 3)));
    const hints = patternHints(diary, '2026-03-11');
    expect(hints.map((h) => h.id)).toContain('sleep-stress');
    const sleep = hints.find((h) => h.id === 'sleep-stress');
    expect(sleep.text).toMatch(/медиана 8 против 3/);
    expect(strategiesForHint(sleep, STRATEGIES).every((s) => s.tags.includes('sleep'))).toBe(true);
  });
  it('нет разницы — нет подсказки про сон', () => {
    const diary = days(10).map((d, i) => entry(d, i < 5 ? 5 : 8, 5));
    expect(patternHints(diary, '2026-03-11').map((h) => h.id)).not.toContain('sleep-stress');
  });
  it('мало дней — подсказок нет', () => {
    const diary = days(4).map((d, i) => entry(d, i < 2 ? 5 : 8, i < 2 ? 9 : 1));
    expect(patternHints(diary, '2026-03-05')).toEqual([]);
  });
  it('частая причина «учёба» — подсказка про перерывы и пространство', () => {
    const diary = days(4).map((d) => entry(d, null, null, ['учёба']));
    const h = patternHints(diary, '2026-03-05').find((x) => x.id === 'cause-учёба');
    expect(h.tags).toContain('breaks');
  });
  it('формулировки осторожные', () => {
    const diary = days(10).map((d, i) => (i < 5 ? entry(d, 5, 8, ['недосып']) : entry(d, 8, 3)));
    for (const h of patternHints(diary, '2026-03-11')) {
      expect(h.text).not.toMatch(/доказано|причина стресса —|потому что/);
    }
  });
});

describe('PSS-10: в начале и через 4 недели', () => {
  const r = (id, at, total, extra = {}) => ({ id, completedAt: at, scale: '0-4', total, helplessness: total - 10, selfEfficacy: 10, ...extra });
  it('изменение между первым и последним обычным прохождением', () => {
    const c = pssOverallChange([r('b', '2026-04-01', 18), r('a', '2026-03-01', 24), r('d', '2026-03-15', 30, { demo: true })]);
    expect(c.first.id).toBe('a');
    expect(c.last.id).toBe('b');
    expect(c.total).toBe(-6);
  });
  it('одно прохождение — сравнивать не с чем', () => {
    expect(pssOverallChange([r('a', '2026-03-01', 24)])).toBeNull();
  });
  it('напоминание: в начале и когда снова можно пройти', () => {
    expect(pssReminder([], true)).toBe('first');
    expect(pssReminder([r('a', '2026-03-01', 24)], true)).toBe('repeat');
    expect(pssReminder([r('a', '2026-03-01', 24)], false)).toBeNull();
  });
});

describe('библиотека стратегий', () => {
  it('у каждой стратегии есть id, название, описание, источник и темы', () => {
    const ids = STRATEGIES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of STRATEGIES) {
      expect(s.title && s.description && s.source).toBeTruthy();
      expect(s.tags.length).toBeGreaterThan(0);
    }
  });
  it('дыхание заполнено, остальные — заглушки до вставки из источника', () => {
    expect(isPlaceholder(getStrategy('breathing'))).toBe(false);
    expect(STRATEGIES.filter((s) => s.id !== 'breathing').every(isPlaceholder)).toBe(true);
    expect(getStrategy('нет такой')).toBeNull();
  });
});
