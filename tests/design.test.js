// Тесты оформления: приветствие, мягкие поздравления, талисман,
// соответствие «показатель → цвет», контраст всех цветов темы.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { greetingFor, entriesLastWeek, weeklyCheer } from '../src/logic/encourage.js';
import { mascot, MASCOT_POSES, CATS, DEFAULT_CAT, setMascotCat, catName, currentCatId, mascotLabel } from '../src/ui/mascot.js';
import { metricGroup } from '../src/ui/metricStyle.js';
import { checkPairs, parseTokens, PVT_PAIRS } from '../src/logic/contrast.js';

describe('приветствие по времени суток', () => {
  it('утро, день, вечер, ночь (граница ночи — 4:00)', () => {
    expect(greetingFor(new Date(2026, 0, 1, 4))).toBe('Доброе утро');
    expect(greetingFor(new Date(2026, 0, 1, 12))).toBe('Добрый день');
    expect(greetingFor(new Date(2026, 0, 1, 18))).toBe('Добрый вечер');
    expect(greetingFor(new Date(2026, 0, 1, 3, 59))).toBe('Доброй ночи');
  });
});

describe('мягкие поздравления за регулярность', () => {
  const today = '2026-03-10';
  it('считаются только последние 7 дней (с 04.03 по 10.03 включительно)', () => {
    expect(entriesLastWeek(['2026-03-03', '2026-03-04', '2026-03-10', '2026-03-02'], today)).toBe(2);
  });
  it('нет записей — ничего не говорим (без упрёков)', () => {
    expect(weeklyCheer([], today)).toBeNull();
    expect(weeklyCheer(['2026-02-01'], today)).toBeNull();
  });
  it('есть записи — поздравление, без «серий» и оценок', () => {
    const texts = [
      weeklyCheer(['2026-03-10'], today),
      weeklyCheer(['2026-03-09', '2026-03-10'], today),
      weeklyCheer(['2026-03-05', '2026-03-06', '2026-03-07', '2026-03-08', '2026-03-10'], today),
    ];
    expect(texts[1]).toMatch(/2 записи/);
    expect(texts[2]).toMatch(/5 записей/);
    for (const t of texts) expect(t).not.toMatch(/серия|прерван|отлично|плохо|пропуст/i);
  });
});

describe('талисман «Пипетка»', () => {
  it('9 поз, каждая — SVG без внешних ссылок и картинок', () => {
    expect(MASCOT_POSES).toEqual(['greet', 'magnifier', 'notebook', 'sprouts', 'diploma', 'lock', 'breathe', 'oops', 'sleep']);
    for (const pose of MASCOT_POSES) {
      const svg = mascot(pose);
      expect(svg.startsWith('<svg')).toBe(true);
      expect(svg).not.toMatch(/https?:\/\/|<image|href=/);
    }
  });
  it('у каждой позы ночные детали и усы из темы', () => {
    for (const pose of MASCOT_POSES) {
      const svg = mascot(pose);
      expect(svg).toMatch(/display: var\(--night-only\)/);
      expect(svg).toMatch(/var\(--pip-whisker\)/);
    }
  });
  it('у каждой картинки свои маски (несколько Пипеток на странице не мешают друг другу)', () => {
    const ids = (svg) => [...svg.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
    const a = ids(mascot('greet'));
    const b = ids(mascot('greet'));
    expect(a.length).toBeGreaterThan(0);
    expect(a.some((id) => b.includes(id))).toBe(false);
    // каждая ссылка url(#…) указывает на маску из той же картинки
    const svg = mascot('lock');
    for (const [, ref] of svg.matchAll(/url\(#([^)]+)\)/g)) expect(ids(svg)).toContain(ref);
  });
  it('неизвестная поза — приветствие', () => {
    expect(mascot('нет-такой')).toMatch(/mascot-greet/);
  });
  it('декоративная по умолчанию, с подписью — доступна программам чтения', () => {
    expect(mascot('greet')).toMatch(/aria-hidden="true"/);
    expect(mascot('greet', { label: 'Пипетка машет лапкой' })).toMatch(/role="img" aria-label="Пипетка машет лапкой"/);
  });
});

describe('выбор котика', () => {
  it('6 котиков, у каждого все 9 поз без заготовок редактора', () => {
    expect(CATS.map((c) => c.id)).toEqual(['pipetka', 'menzurka', 'kolba', 'buretka', 'retorta', 'kaplya']);
    for (const c of CATS) {
      for (const pose of MASCOT_POSES) {
        const svg = mascot(pose, { cat: c.id });
        expect(svg).toMatch(new RegExp(`cat-${c.id}`));
        expect(svg).toContain(`--coat: ${c.colors.coat}`);
        expect(svg).not.toMatch(/\{\{/); // {{accent}} в рисунке — чёрная колба
      }
    }
  });
  it('вислоухие уши — только у Мензурки', () => {
    const fold = 'M42 70 Q36 40 62 34';
    for (const c of CATS) {
      const svg = mascot('greet', { cat: c.id });
      expect(svg.includes(fold)).toBe(c.ears === 'fold');
    }
    expect(CATS.filter((c) => c.ears === 'fold').map((c) => c.id)).toEqual(['menzurka']);
  });
  it('выбранный котик рисуется по умолчанию; неизвестный — Пипетка', () => {
    setMascotCat('kolba');
    expect(mascot('greet')).toMatch(/cat-kolba/);
    expect(catName()).toBe('Колба');
    expect(mascotLabel('magnifier')).toBe('Колба с лупой');
    setMascotCat('нет-такого');
    expect(currentCatId()).toBe(DEFAULT_CAT);
    setMascotCat(null);
    expect(catName()).toBe('Пипетка');
  });
  it('у всех котиков есть имя и описание окраса', () => {
    for (const c of CATS) {
      expect(c.name.length).toBeGreaterThan(0);
      expect(c.description.length).toBeGreaterThan(0);
    }
  });
});

describe('цвет каждого показателя', () => {
  it('показатели попадают в свои группы', () => {
    expect(metricGroup('stress')).toBe('stress');
    expect(metricGroup('sleepHours')).toBe('sleep');
    expect(metricGroup('sleepQuality')).toBe('sleep');
    expect(metricGroup('pvtMedian')).toBe('test');
    expect(metricGroup('pvtLapses')).toBe('test');
    expect(metricGroup('systolic')).toBe('pulse');
    expect(metricGroup('pssTotal')).toBe('pss');
    expect(metricGroup('factor:abc')).toBe('other');
    expect(metricGroup('cause:учёба')).toBe('other');
  });
});

describe('контраст цветов темы (WCAG AA)', () => {
  const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');
  const block = (start) => css.slice(css.indexOf(start), css.indexOf('}', css.indexOf(start)));
  it('все пары светлой темы проходят', () => {
    const failed = checkPairs(parseTokens(block('.theme-light {'))).filter((r) => !r.ok);
    expect(failed).toEqual([]);
  });
  it('все пары тёмной темы проходят', () => {
    const failed = checkPairs(parseTokens(block('.theme-dark {'))).filter((r) => !r.ok);
    expect(failed).toEqual([]);
  });
  it('экран теста: стимул и рамка достаточно контрастны', () => {
    const pvt = parseTokens(block('--pvt-bg'));
    expect(checkPairs(pvt, PVT_PAIRS).every((r) => r.ok)).toBe(true);
  });
  it('медиа-блок тёмной темы совпадает с ручным выбором тёмной темы', () => {
    const media = parseTokens(block(":root:not([data-theme='light']) {"));
    const manual = parseTokens(block('.theme-dark {'));
    expect(media).toEqual(manual);
  });
});
