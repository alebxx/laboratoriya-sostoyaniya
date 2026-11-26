// Тесты: таблицы CSV для теста и гистограмма самопроверки.
import { describe, it, expect } from 'vitest';
import { sessionRowsForCsv, trialRowsForCsv } from '../src/logic/pvt.js';
import { exclusionReason } from '../src/logic/sessionFilter.js';
import { histogram } from '../src/pages/selfcheck.js';

describe('CSV сеансов и попыток', () => {
  const sessions = [
    { id: 'b', day: '2026-03-02', startedAt: '2026-03-02T10:00:00Z', status: 'completed', practice: false, device: { type: 'phone' }, medianRt: 260 },
    { id: 'a', day: '2026-03-01', startedAt: '2026-03-01T10:00:00Z', status: 'completed', practice: true, device: { type: 'computer', isPrimary: true }, medianRt: 300 },
  ];

  it('сеансы по порядку, с пометками «тренировочный» и «в анализе»', () => {
    const rows = sessionRowsForCsv(sessions, (s) => exclusionReason(s, 'computer'));
    expect(rows.map((r) => r['ID сеанса'])).toEqual(['a', 'b']);
    expect(rows[0]['Тренировочный']).toBe('да');
    expect(rows[0]['В анализе']).toBe('нет'); // тренировочный
    expect(rows[1]['В анализе']).toBe('нет'); // другое устройство
    expect(rows[1]['Устройство']).toBe('телефон');
    expect(rows[1]['Медиана RT, мс']).toBe(260);
  });

  it('попытки: тип по-русски, порядок по сеансу и номеру', () => {
    const rows = trialRowsForCsv([
      { sessionId: 's1', index: 2, type: 'lapse', rt: 400 },
      { sessionId: 's1', index: 1, type: 'falseStart', rt: null, early: true },
    ]);
    expect(rows[0]['Номер попытки']).toBe(1);
    expect(rows[0]['Тип']).toBe('фальстарт');
    expect(rows[0]['Нажатие до сигнала']).toBe('да');
    expect(rows[1]['Тип']).toBe('пропуск');
  });
});

describe('гистограмма', () => {
  it('столбики по 25 мс, медленные — в последнем', () => {
    const { labels, counts } = histogram([100, 124, 125, 599, 700, 50]);
    expect(labels[0]).toBe('100–124');
    expect(labels.at(-1)).toBe('600+');
    expect(counts[0]).toBe(2); // 100 и 124
    expect(counts[1]).toBe(1); // 125
    expect(counts.at(-2)).toBe(1); // 599
    expect(counts.at(-1)).toBe(1); // 700; 50 мс не попадает никуда
  });
});
