// =====================================================================
// Постоянный цвет и значок каждого показателя.
// Цвет — «имя» показателя (одинаковый на карточках, графиках, значках),
// а не оценка «хорошо/плохо». Сами цвета — в src/styles/tokens.css.
// =====================================================================

export const METRIC_GROUPS = {
  stress: { token: '--m-stress', icon: 'Gauge', name: 'Стресс' },
  fatigue: { token: '--m-fatigue', icon: 'BatteryLow', name: 'Усталость' },
  sleep: { token: '--m-sleep', icon: 'Moon', name: 'Сон' },
  concentration: { token: '--m-concentration', icon: 'Brain', name: 'Концентрация' },
  test: { token: '--m-test', icon: 'Timer', name: 'Тест внимания' },
  pulse: { token: '--m-pulse', icon: 'HeartPulse', name: 'Пульс и давление' },
  pss: { token: '--m-pss', icon: 'ClipboardCheck', name: 'PSS-10' },
  other: { token: '--m-other', icon: 'Sparkles', name: 'Другое' },
};

// К какой группе относится показатель (ключ из src/logic/series.js или поле дневника).
export function metricGroup(key) {
  if (key === 'stress') return 'stress';
  if (key === 'fatigue') return 'fatigue';
  if (key === 'sleepHours' || key === 'sleepQuality') return 'sleep';
  if (key === 'concentration') return 'concentration';
  if (key.startsWith('pvt')) return 'test';
  if (['pulse', 'systolic', 'diastolic'].includes(key)) return 'pulse';
  if (key === 'pssTotal') return 'pss';
  if (key === 'mood') return 'other';
  if (key.startsWith('factor:')) return 'other';
  if (key.startsWith('cause:')) return 'other';
  return 'other';
}

export function metricStyle(key) {
  return METRIC_GROUPS[metricGroup(key)];
}

// CSS-класс, задающий переменную --m для блока (см. components.css).
export function metricClass(key) {
  return `metric-${metricGroup(key)}`;
}

// Текущий цвет показателя в активной теме (для графиков Chart.js).
export function metricColor(key) {
  return getComputedStyle(document.documentElement).getPropertyValue(metricStyle(key).token).trim();
}
