// =====================================================================
// Общие настройки графиков (библиотека Chart.js, лежит в проекте —
// из интернета ничего не загружается).
// =====================================================================
import {
  Chart, LineController, LineElement, PointElement, ScatterController,
  LinearScale, CategoryScale, Tooltip, Legend,
} from 'chart.js';

Chart.register(LineController, LineElement, PointElement, ScatterController, LinearScale, CategoryScale, Tooltip, Legend);

// Шрифт графиков — тот же, что у сайта.
Chart.defaults.font.family = getComputedStyle(document.documentElement).getPropertyValue('--font').trim() || 'system-ui';

// Цвета берём из текущей темы (светлой или тёмной) — из CSS-переменных.
export function themeColors() {
  const css = getComputedStyle(document.documentElement);
  const v = (name) => css.getPropertyValue(name).trim();
  return {
    accent: v('--accent'),
    text: v('--text'),
    muted: v('--chart-label'), // подписи осей — приглушённые
    grid: v('--chart-grid'), // сетка — едва заметная
    surface: v('--surface'),
    raised: v('--surface-raised'),
    border: v('--border'),
    // Толщина линий данных: в тёмной теме чуть толще.
    line: parseFloat(v('--chart-line')) || 2,
    font: v('--font'),
  };
}

// «2026-03-10» → «10.03» для подписей оси.
export function shortDay(day) {
  return `${day.slice(8, 10)}.${day.slice(5, 7)}`;
}

// Оформление оси: подписи и сетка приглушённые, чтобы не спорить с данными.
export function axis(colors, title, extra = {}) {
  return {
    title: { display: Boolean(title), text: title, color: colors.muted },
    ticks: { color: colors.muted, maxRotation: 0, autoSkip: true, autoSkipPadding: 12 },
    grid: { color: colors.grid },
    border: { color: colors.grid },
    ...extra,
  };
}

// Общие настройки: без анимации, подсказка при наведении.
export function baseOptions(colors) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: 'nearest', intersect: false },
    plugins: {
      legend: { labels: { color: colors.text, usePointStyle: true, boxWidth: 8 } },
      // Всплывающая подсказка: светлее карточки, с тонкой рамкой.
      tooltip: { backgroundColor: colors.raised, titleColor: colors.text, bodyColor: colors.text, borderColor: colors.border, borderWidth: 1, cornerRadius: 10, padding: 10 },
    },
  };
}

export { Chart };
