// Тесты: исключение тренировочных, незавершённых и «чужих» сеансов; тип устройства.
import { describe, it, expect } from 'vitest';
import { exclusionReason, sessionsForAnalysis, isNextPractice, nextPracticeNumber } from '../src/logic/sessionFilter.js';
import { guessDeviceType } from '../src/logic/device.js';

const s = (id, status, practice, type) => ({ id, status, practice, device: { type } });
const sessions = [
  s('a', 'completed', true, 'computer'), // тренировочный
  s('b', 'aborted', false, 'computer'), // прерван
  s('c', 'running', false, 'computer'), // «завис» (страницу закрыли)
  s('d', 'completed', false, 'phone'), // другое устройство
  s('e', 'completed', false, 'computer'), // учитывается
];

describe('исключение сеансов из анализа', () => {
  it('причины исключения', () => {
    expect(exclusionReason(sessions[0], 'computer')).toBe('practice');
    expect(exclusionReason(sessions[1], 'computer')).toBe('incomplete');
    expect(exclusionReason(sessions[2], 'computer')).toBe('incomplete');
    expect(exclusionReason(sessions[3], 'computer')).toBe('otherDevice');
    expect(exclusionReason(sessions[4], 'computer')).toBeNull();
  });
  it('по умолчанию — только завершённые, не тренировочные, с основного устройства', () => {
    expect(sessionsForAnalysis(sessions, 'computer').map((x) => x.id)).toEqual(['e']);
  });
  it('с переключателем «все устройства» добавляется сеанс с телефона', () => {
    expect(sessionsForAnalysis(sessions, 'computer', true).map((x) => x.id)).toEqual(['d', 'e']);
  });
  it('если основным стал телефон — учитывается сеанс с телефона', () => {
    expect(sessionsForAnalysis(sessions, 'phone').map((x) => x.id)).toEqual(['d']);
  });
  it('незавершённый тренировочным не считается, но всё равно исключён', () => {
    expect(exclusionReason(s('x', 'aborted', true, 'computer'), 'computer')).toBe('incomplete');
  });
});

describe('тренировочные сеансы', () => {
  it('первые 3 завершённых — тренировочные, прерванные не считаются', () => {
    const list = [s('1', 'completed'), s('2', 'aborted'), s('3', 'completed')];
    expect(isNextPractice(list, 3)).toBe(true); // завершено 2 → следующий 3-й
    expect(nextPracticeNumber(list)).toBe(3);
    expect(isNextPractice([...list, s('4', 'completed')], 3)).toBe(false);
  });
  it('число тренировочных настраивается (0 — без тренировки)', () => {
    expect(isNextPractice([], 0)).toBe(false);
  });
});

describe('догадка о типе устройства', () => {
  it('iPhone и Android-телефон — телефон', () => {
    expect(guessDeviceType('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe('phone');
    expect(guessDeviceType('Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Safari')).toBe('phone');
  });
  it('iPad (даже притворяющийся Mac) и Android-планшет — планшет', () => {
    expect(guessDeviceType('Mozilla/5.0 (iPad; CPU OS 17_0)')).toBe('tablet');
    expect(guessDeviceType('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe('tablet');
    expect(guessDeviceType('Mozilla/5.0 (Linux; Android 14; SM-X710) Safari')).toBe('tablet');
  });
  it('Mac и Windows без сенсора — компьютер', () => {
    expect(guessDeviceType('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe('computer');
    expect(guessDeviceType('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('computer');
  });
});
