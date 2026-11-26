// =====================================================================
// Загрузка всех данных, нужных для анализа (графики, гипотезы, эксперименты),
// и «один итог» для гипотез и экспериментов.
// =====================================================================
import { getAll, getAllSettings, put } from './repo.js';
import { allMetrics } from '../logic/series.js';
import { buildObservations, evaluate } from '../logic/hypothesis.js';
import { experimentObservations, evaluateExperiment, isFinished } from '../logic/alternation.js';
import { dayKeyFor } from '../logic/dates.js';

export async function loadAnalysisContext() {
  const [diary, pvtSessions, physio, pss, settings] = await Promise.all([
    getAll('diary'), getAll('pvtSessions'), getAll('physio'), getAll('pss'), getAllSettings(),
  ]);
  return {
    data: { diary, pvtSessions, physio, pss },
    metrics: allMetrics(settings.customFactors || []),
    primaryType: settings.primaryDevice?.type || null,
    settings,
  };
}

// Если в гипотезе уже набрано нужное число дней, а итога ещё нет —
// посчитать его ОДИН раз и сохранить. Возвращает гипотезу (возможно, с итогом).
export async function ensureHypothesisResult(hyp, ctx) {
  if (hyp.result) return hyp;
  const observations = buildObservations(hyp.plan, ctx.metrics, ctx.data, hyp.lockDay, ctx.primaryType);
  const result = evaluate(hyp, observations);
  if (!result) return hyp;
  const updated = { ...hyp, result, resultComputedAt: new Date().toISOString() };
  await put('hypotheses', updated);
  return updated;
}

// То же для самоэксперимента: итог — после последнего дня, один раз.
export async function ensureExperimentResult(exp, ctx) {
  if (exp.result || !isFinished(exp, dayKeyFor())) return exp;
  const observations = experimentObservations(exp, ctx.metrics, ctx.data, ctx.primaryType);
  const result = evaluateExperiment(exp, observations);
  const updated = { ...exp, result, resultComputedAt: new Date().toISOString() };
  await put('experiments', updated);
  return updated;
}
