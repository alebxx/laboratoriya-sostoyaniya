// =====================================================================
// Дыхательное упражнение: какая сейчас фаза (вдох или выдох)
// и сколько осталось. Только расчёты — анимация на странице.
// =====================================================================
import { BREATHING } from '../config.js';

// Фаза в момент elapsedMs от начала упражнения.
// Цикл: вдох (inhaleSec) → выдох (exhaleSec) → снова вдох…
// Возвращает { phase: 'inhale' | 'exhale', secondsLeftInPhase, cycle (с 1), progressInPhase (0–1) }.
export function phaseAt(elapsedMs, inhaleSec, exhaleSec) {
  const cycleMs = (inhaleSec + exhaleSec) * 1000;
  const inCycle = elapsedMs % cycleMs;
  const cycle = Math.floor(elapsedMs / cycleMs) + 1;
  if (inCycle < inhaleSec * 1000) {
    return {
      phase: 'inhale',
      secondsLeftInPhase: Math.ceil((inhaleSec * 1000 - inCycle) / 1000),
      progressInPhase: inCycle / (inhaleSec * 1000),
      cycle,
    };
  }
  const inExhale = inCycle - inhaleSec * 1000;
  return {
    phase: 'exhale',
    secondsLeftInPhase: Math.ceil((exhaleSec * 1000 - inExhale) / 1000),
    progressInPhase: inExhale / (exhaleSec * 1000),
    cycle,
  };
}

// Сколько полных циклов поместится в упражнение.
// Упражнение заканчивается после последнего ЦЕЛОГО цикла (на выдохе),
// поэтому реальная длительность может быть чуть меньше выбранной.
export function plannedCycles(durationMin, inhaleSec, exhaleSec) {
  return Math.max(1, Math.floor((durationMin * 60) / (inhaleSec + exhaleSec)));
}

export function totalMs(durationMin, inhaleSec, exhaleSec) {
  return plannedCycles(durationMin, inhaleSec, exhaleSec) * (inhaleSec + exhaleSec) * 1000;
}

// Проверить настройки: числа в допустимых пределах. Возвращает исправленные значения.
export function clampSettings({ inhaleSec, exhaleSec, durationMin }, limits = BREATHING) {
  const clamp = (v, min, max, def) => (Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def);
  return {
    inhaleSec: clamp(inhaleSec, limits.minPhaseSec, limits.maxPhaseSec, limits.inhaleSec),
    exhaleSec: clamp(exhaleSec, limits.minPhaseSec, limits.maxPhaseSec, limits.exhaleSec),
    durationMin: clamp(durationMin, limits.minDurationMin, limits.maxDurationMin, limits.durationMin),
  };
}
