// =====================================================================
// Проверка контраста цветов по WCAG 2.x.
// Текст — не ниже 4,5:1; крупный текст и графические элементы
// (линии графиков, значки, рамки полей, рамка фокуса) — не ниже 3:1.
// =====================================================================

// Относительная яркость цвета '#rrggbb'.
export function luminance(hex) {
  const [r, g, b] = hex.replace('#', '').match(/../g).map((x) => {
    const v = parseInt(x, 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const METRICS = [
  ['m-stress', 'стресс'],
  ['m-fatigue', 'усталость'],
  ['m-sleep', 'сон'],
  ['m-concentration', 'концентрация'],
  ['m-test', 'тест'],
  ['m-pulse', 'пульс/давление'],
  ['m-pss', 'PSS-10'],
  ['m-other', 'прочие показатели'],
];

// Какие пары проверяем: [название, цвет переднего плана, цвет фона, минимум].
export const CONTRAST_PAIRS = [
  ['Основной текст / фон', 'text', 'bg', 4.5],
  ['Основной текст / карточка', 'text', 'surface', 4.5],
  ['Основной текст / всплывающее окно', 'text', 'surface-raised', 4.5],
  ['Основной текст / поле ввода', 'text', 'surface-sunken', 4.5],
  ['Основной текст / предупреждение', 'text', 'notice-bg', 4.5],
  ['Основной текст / выбранный вариант', 'text', 'accent-soft', 4.5],
  ['Второстепенный текст / фон', 'text-muted', 'bg', 4.5],
  ['Второстепенный текст / карточка', 'text-muted', 'surface', 4.5],
  ['Второстепенный текст / поле ввода', 'text-muted', 'surface-sunken', 4.5],
  ['Второстепенный текст / предупреждение', 'text-muted', 'notice-bg', 4.5],
  ['Второстепенный текст / выбранный вариант', 'text-muted', 'accent-soft', 4.5],
  ['Ссылка (акцент) / фон', 'accent', 'bg', 4.5],
  ['Ссылка (акцент) / карточка', 'accent', 'surface', 4.5],
  ['Текст на главной кнопке', 'on-accent', 'accent', 4.5],
  ['Текст на главной кнопке (наведение)', 'on-accent', 'accent-hover', 4.5],
  ['Подписи графиков / карточка', 'chart-label', 'surface', 4.5],
  ['Рамка поля ввода / карточка', 'border-strong', 'surface', 3],
  ['Рамка фокуса / фон', 'focus', 'bg', 3],
  ['Рамка фокуса / карточка', 'focus', 'surface', 3],
  ['Рамка «удалить» / карточка', 'danger', 'surface', 3],
  ['Контур талисмана / фон', 'mascot-line', 'bg', 3],
  ...METRICS.flatMap(([key, name]) => [
    [`Цвет «${name}» / карточка`, key, 'surface', 3],
    [`Цвет «${name}» / фон`, key, 'bg', 3],
  ]),
];

// Пары для экрана теста (одинаковы в обеих темах).
export const PVT_PAIRS = [
  ['Стимул / фон теста', 'pvt-stimulus', 'pvt-bg', 4.5],
  ['Время реакции / фон теста', 'pvt-feedback', 'pvt-bg', 4.5],
  ['Рамка / фон теста', 'pvt-frame', 'pvt-bg', 3],
];

// Проверить пары. tokens — { 'text': '#2b2724', ... }.
export function checkPairs(tokens, pairs = CONTRAST_PAIRS) {
  return pairs.map(([name, fg, bg, min]) => {
    const ratio = contrastRatio(tokens[fg], tokens[bg]);
    return { name, fg: tokens[fg], bg: tokens[bg], ratio, min, ok: ratio >= min };
  });
}

// Вытащить переменные из блока CSS: '--text: #2b2724;' → { text: '#2b2724' }.
export function parseTokens(cssBlock) {
  const tokens = {};
  for (const m of cssBlock.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\b/g)) tokens[m[1]] = m[2].toLowerCase();
  return tokens;
}
