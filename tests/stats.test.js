// Тесты: медиана, квартили, межквартильный размах, среднее.
import { describe, it, expect } from 'vitest';
import { median, quantile, iqr, mean } from '../src/logic/stats.js';

describe('медиана', () => {
  it('нечётное число значений — среднее по порядку', () => {
    expect(median([300, 200, 250])).toBe(250);
  });
  it('чётное число — среднее двух центральных', () => {
    expect(median([200, 300, 250, 260])).toBe(255);
  });
  it('одно очень большое значение почти не сдвигает медиану', () => {
    expect(median([240, 250, 260, 30000])).toBe(255);
  });
  it('пустые значения пропускаются', () => {
    expect(median([null, 5, undefined, 7, NaN])).toBe(6);
  });
  it('пустой список — null', () => {
    expect(median([])).toBeNull();
  });
});

describe('квартили и межквартильный размах', () => {
  it('значения 1…9: Q1 = 3, Q3 = 7, размах 4', () => {
    expect(iqr([1, 2, 3, 4, 5, 6, 7, 8, 9])).toEqual({ q1: 3, q3: 7, iqr: 4 });
  });
  it('интерполяция между соседями (как Excel QUARTILE.INC)', () => {
    expect(quantile([1, 2, 3, 4], 0.25)).toBe(1.75);
    expect(quantile([1, 2, 3, 4], 0.75)).toBe(3.25);
  });
  it('одно значение — размах 0', () => {
    expect(iqr([5])).toEqual({ q1: 5, q3: 5, iqr: 0 });
  });
  it('пусто — null', () => {
    expect(iqr([])).toBeNull();
  });
});

describe('среднее', () => {
  it('обычное среднее', () => {
    expect(mean([2, 4, 6])).toBe(4);
    expect(mean([])).toBeNull();
  });
});
