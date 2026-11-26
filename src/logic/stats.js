// =====================================================================
// Простая статистика: медиана, квартили, межквартильный размах, среднее.
// =====================================================================

// Только настоящие числа (без null, undefined, NaN), отсортированные по возрастанию.
function cleanSorted(values) {
  return values.filter((v) => typeof v === 'number' && Number.isFinite(v)).sort((a, b) => a - b);
}

// Среднее арифметическое. Пустой список → null.
export function mean(values) {
  const xs = cleanSorted(values);
  if (xs.length === 0) return null;
  return xs.reduce((sum, x) => sum + x, 0) / xs.length;
}

// Квантиль (q от 0 до 1) с линейной интерполяцией между соседними значениями.
// Это самый распространённый способ (так считают Excel QUARTILE.INC и R по умолчанию).
export function quantile(values, q) {
  const xs = cleanSorted(values);
  if (xs.length === 0) return null;
  const pos = (xs.length - 1) * q;
  const lower = Math.floor(pos);
  const upper = Math.ceil(pos);
  return xs[lower] + (xs[upper] - xs[lower]) * (pos - lower);
}

// Медиана — значение «посередине»: половина значений меньше, половина больше.
// Её мало сдвигают отдельные очень большие значения (например, одна долгая реакция).
export function median(values) {
  return quantile(values, 0.5);
}

// Межквартильный размах: от 1-го квартиля (25 %) до 3-го (75 %).
// Показывает, в каких пределах лежит «средняя половина» значений.
export function iqr(values) {
  const q1 = quantile(values, 0.25);
  const q3 = quantile(values, 0.75);
  if (q1 === null) return null;
  return { q1, q3, iqr: q3 - q1 };
}
