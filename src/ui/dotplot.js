// =====================================================================
// Точечная диаграмма двух групп рядом: каждая точка — один день,
// горизонтальная черта — медиана группы.
// =====================================================================
import { Chart, themeColors, axis, baseOptions } from './charts.js';

// Небольшой сдвиг точек вбок, чтобы одинаковые значения не слипались.
// Сдвиг не случайный, а по порядку — картинка каждый раз одинаковая.
function spread(i) {
  const offsets = [0, -0.12, 0.12, -0.24, 0.24, -0.06, 0.06, -0.18, 0.18];
  return offsets[i % offsets.length];
}

// groups: [{ label, values, median }] — ровно две группы.
export function drawDotPlot(canvas, groups, valueLabel) {
  const colors = themeColors();
  const palette = [colors.series1, colors.series2];
  const datasets = [];
  groups.forEach((g, gi) => {
    // Одинаковые значения раздвигаем: считаем, сколько раз значение уже встретилось.
    const seen = new Map();
    datasets.push({
      label: g.label,
      data: g.values.map((v) => {
        const k = seen.get(v) || 0;
        seen.set(v, k + 1);
        return { x: gi + spread(k), y: v };
      }),
      backgroundColor: palette[gi],
      borderColor: colors.surface,
      borderWidth: 2,
      pointRadius: 6,
      pointStyle: gi === 0 ? 'circle' : 'rect',
    });
    if (g.median !== null && g.median !== undefined) {
      datasets.push({
        label: `Медиана: ${g.label}`,
        type: 'line',
        data: [{ x: gi - 0.35, y: g.median }, { x: gi + 0.35, y: g.median }],
        borderColor: colors.text,
        borderWidth: 3,
        pointRadius: 0,
        showLine: true,
      });
    }
  });

  const options = baseOptions(colors);
  options.plugins.legend.labels.filter = (item) => !item.text.startsWith('Медиана');
  options.plugins.tooltip.callbacks = {
    label: (ctx) => (ctx.dataset.label.startsWith('Медиана') ? `${ctx.dataset.label}: ${fmt(ctx.parsed.y)}` : `${ctx.dataset.label}: ${fmt(ctx.parsed.y)}`),
  };
  options.interaction = { mode: 'nearest', intersect: true };
  options.scales = {
    x: axis(colors, '', {
      type: 'linear',
      min: -0.6,
      max: 1.6,
      ticks: {
        color: colors.muted,
        stepSize: 1,
        callback: (v) => (v === 0 ? 'A' : v === 1 ? 'B' : ''),
      },
      grid: { display: false },
    }),
    y: axis(colors, valueLabel),
  };
  return new Chart(canvas, { type: 'scatter', data: { datasets }, options });
}

function fmt(n) {
  return String(Math.round(n * 100) / 100).replace('.', ',');
}
