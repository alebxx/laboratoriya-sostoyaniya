// Тесты перестановочного теста на данных с известным ответом.
import { describe, it, expect } from 'vitest';
import { permutationTest, verdict, chanceText } from '../src/logic/permutation.js';
import { createRandom, seedFromString, shuffle } from '../src/logic/random.js';

describe('случайные числа с зерном', () => {
  it('одно зерно — одна и та же последовательность', () => {
    const r1 = createRandom(42);
    const r2 = createRandom(42);
    expect([r1(), r1(), r1()]).toEqual([r2(), r2(), r2()]);
  });
  it('числа от 0 до 1', () => {
    const r = createRandom(1);
    for (let i = 0; i < 1000; i++) {
      const x = r();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
  it('зерно из текста повторяемо', () => {
    expect(seedFromString('abc')).toBe(seedFromString('abc'));
    expect(seedFromString('abc')).not.toBe(seedFromString('abd'));
  });
  it('перемешивание не теряет и не добавляет элементы', () => {
    expect(shuffle([1, 2, 3, 4, 5], createRandom(3)).sort()).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('перестановочный тест', () => {
  it('группы явно различаются: A заметно больше — p маленькое', () => {
    const a = [10, 11, 12, 13, 14, 15, 16];
    const b = [1, 2, 3, 4, 5, 6, 7];
    const t = permutationTest(a, b, { permutations: 2000, seed: 1 });
    expect(t.diff).toBe(9);
    // Точное значение: разбиение «7 самых больших в A» — одно из C(14,7) = 3432,
    // то есть доля ≈ 0.0003. С поправкой +1 при 2000 перестановках — около 0.0005.
    expect(t.pGreater).toBeLessThan(0.01);
    expect(t.pLess).toBeGreaterThan(0.99);
  });

  it('одинаковые группы — разница 0, p большое в обе стороны', () => {
    const a = [5, 6, 7, 8, 9];
    const b = [5, 6, 7, 8, 9];
    const t = permutationTest(a, b, { permutations: 2000, seed: 2 });
    expect(t.diff).toBe(0);
    expect(t.pGreater).toBeGreaterThan(0.4);
    expect(t.pLess).toBeGreaterThan(0.4);
  });

  it('p никогда не равно 0 (поправка +1)', () => {
    const t = permutationTest([100, 101, 102], [1, 2, 3], { permutations: 100, seed: 3 });
    expect(t.pGreater).toBeGreaterThan(0);
  });

  it('при одном зерне результат повторяется', () => {
    const a = [3, 5, 4, 6, 8];
    const b = [2, 4, 3, 5, 3];
    expect(permutationTest(a, b, { seed: 9, permutations: 500 })).toEqual(permutationTest(a, b, { seed: 9, permutations: 500 }));
  });

  it('точная проверка на маленьких данных: A=[3], B=[1,2]', () => {
    // Всего 3 разбиения: в A попадает 3, 2 или 1 → разницы 1.5, 0, −1.5.
    // Настоящая разница 1.5 — самая большая: доля ≈ 1/3.
    const t = permutationTest([3], [1, 2], { permutations: 30000, seed: 4 });
    expect(t.diff).toBe(1.5);
    expect(t.pGreater).toBeCloseTo(1 / 3, 1);
  });
});

describe('правило итога', () => {
  const strong = { diff: 9, pGreater: 0.001, pLess: 0.999 };
  const weak = { diff: 1, pGreater: 0.3, pLess: 0.75 };
  const opposite = { diff: -9, pGreater: 0.999, pLess: 0.001 };
  const zero = { diff: 0, pGreater: 0.55, pLess: 0.55 };

  it('ожидали «выше», разница большая в ту же сторону — согласуются', () => {
    expect(verdict(strong, 'higher').verdict).toBe('consistent');
  });
  it('ожидали «ниже», а разница большая вверх — не согласуются', () => {
    expect(verdict(strong, 'lower').verdict).toBe('inconsistent');
  });
  it('ожидали «выше», разница в обратную сторону и редкая — не согласуются', () => {
    expect(verdict(opposite, 'higher').verdict).toBe('inconsistent');
  });
  it('разница в нужную сторону, но частая — пока неясно', () => {
    expect(verdict(weak, 'higher').verdict).toBe('unclear');
  });
  it('нулевая разница — пока неясно', () => {
    expect(verdict(zero, 'higher').verdict).toBe('unclear');
    expect(verdict(zero, 'lower').verdict).toBe('unclear');
  });
  it('граница: p ровно 0,05 — ещё «согласуются»', () => {
    expect(verdict({ diff: 2, pGreater: 0.05, pLess: 0.96 }, 'higher').verdict).toBe('consistent');
    expect(verdict({ diff: 2, pGreater: 0.0501, pLess: 0.96 }, 'higher').verdict).toBe('unclear');
  });
  it('возвращает p для ожидаемого и обратного направления', () => {
    expect(verdict(strong, 'lower')).toMatchObject({ pExpected: 0.999, pOpposite: 0.001 });
  });
});

describe('понятная фраза о случайности', () => {
  it('N из 100', () => {
    expect(chanceText(0.03)).toBe('примерно в 3 случаях из 100');
    expect(chanceText(0.21)).toBe('примерно в 21 случае из 100');
    expect(chanceText(0.004)).toBe('меньше чем в 1 случае из 100');
  });
});
