// =====================================================================
// Проверка собственной гипотезы (режим «Проверяю»).
// Модель персональной науки: вопрос → план → фиксация → наблюдение →
// рассуждение (Wolf, De Groot, 2020).
//
// Главные правила (подробно — docs/methodology.md, раздел 9):
//   1. После фиксации параметры не меняются.
//   2. В анализ попадают только дни ПОСЛЕ дня фиксации.
//   3. Итог считается ОДИН раз — когда в обеих группах набрано
//      заданное число дней. Потом не пересчитывается.
// =====================================================================
import { dailyValues } from './series.js';
import { addDays, dayKeyFor } from './dates.js';
import { median, iqr } from './stats.js';
import { permutationTest, verdict } from './permutation.js';
import { seedFromString } from './random.js';
import { ANALYSIS } from '../config.js';

// Попадает ли значение фактора в «условие» (группа A).
//   Для «да/нет»: условие — «да» (1).
//   Для чисел: условие — «меньше порога» (side 'below') или «не меньше порога» ('atLeast').
export function inCondition(plan, value) {
  if (plan.factorKind === 'boolean') return value === 1;
  return plan.side === 'below' ? value < plan.threshold : value >= plan.threshold;
}

// Пары «значение фактора → результат» по дням, только после фиксации.
//   plan — { factorKey, factorKind, threshold, side, outcomeKey, lag }
//   lockDay — день фиксации ('ГГГГ-ММ-ДД'); дни до него и сам он не учитываются.
// Возвращает массив { factorDay, outcomeDay, factorValue, outcome, group: 'A' | 'B' },
// упорядоченный по дню результата.
export function buildObservations(plan, metrics, data, lockDay, primaryType) {
  const factorMetric = metrics.find((m) => m.key === plan.factorKey);
  const outcomeMetric = metrics.find((m) => m.key === plan.outcomeKey);
  if (!factorMetric || !outcomeMetric) return [];

  const options = { primaryType, includeOtherDevices: false };
  const factorPoints = dailyValues(factorMetric, data, options).points;
  const outcomeByDay = new Map(dailyValues(outcomeMetric, data, options).points.map((p) => [p.day, p.value]));

  const result = [];
  for (const f of factorPoints) {
    if (f.day <= lockDay) continue; // только после дня фиксации
    const outcomeDay = addDays(f.day, plan.lag); // сдвиг: тот же день (0) или следующий (1)
    if (!outcomeByDay.has(outcomeDay)) continue;
    result.push({
      factorDay: f.day,
      outcomeDay,
      factorValue: f.value,
      outcome: outcomeByDay.get(outcomeDay),
      group: inCondition(plan, f.value) ? 'A' : 'B',
    });
  }
  return result.sort((x, y) => x.outcomeDay.localeCompare(y.outcomeDay) || x.factorDay.localeCompare(y.factorDay));
}

// Сколько дней собрано в каждой группе и где «точка проверки».
// Точка проверки — первый день, к концу которого в ОБЕИХ группах набралось
// минимальное число дней. Итог считается по наблюдениям до этого дня включительно.
export function progress(observations, minDays) {
  let a = 0;
  let b = 0;
  let cutoffDay = null;
  for (const o of observations) {
    if (o.group === 'A') a++;
    else b++;
    if (a >= minDays && b >= minDays) {
      cutoffDay = o.outcomeDay;
      break;
    }
  }
  // Если точка проверки найдена, в счёт идут все наблюдения этого дня.
  if (cutoffDay) {
    a = observations.filter((o) => o.outcomeDay <= cutoffDay && o.group === 'A').length;
    b = observations.filter((o) => o.outcomeDay <= cutoffDay && o.group === 'B').length;
  } else {
    a = observations.filter((o) => o.group === 'A').length;
    b = observations.filter((o) => o.group === 'B').length;
  }
  return { a, b, minDays, ready: cutoffDay !== null, cutoffDay };
}

// Посчитать итог (один раз). Возвращает объект, который сохраняется
// вместе с гипотезой и больше не меняется.
export function evaluate(hypothesis, observations, { permutations = ANALYSIS.permutations, alpha = ANALYSIS.alpha } = {}) {
  const prog = progress(observations, hypothesis.plan.minDays);
  if (!prog.ready) return null;
  const used = observations.filter((o) => o.outcomeDay <= prog.cutoffDay);
  const a = used.filter((o) => o.group === 'A').map((o) => o.outcome);
  const b = used.filter((o) => o.group === 'B').map((o) => o.outcome);
  const seed = seedFromString(hypothesis.id);
  const test = permutationTest(a, b, { permutations, seed });
  const v = verdict(test, hypothesis.plan.direction, alpha);
  return {
    cutoffDay: prog.cutoffDay,
    nA: a.length,
    nB: b.length,
    medianA: median(a),
    medianB: median(b),
    iqrA: iqr(a),
    iqrB: iqr(b),
    diff: test.diff,
    pGreater: test.pGreater,
    pLess: test.pLess,
    pExpected: v.pExpected,
    pOpposite: v.pOpposite,
    verdict: v.verdict,
    permutations,
    alpha,
    seed,
    // Снимок данных, по которым посчитан итог: даже если потом записи
    // в дневнике поменяются, итог останется тем же.
    observations: used,
  };
}

// Новая зафиксированная гипотеза.
export function createHypothesis({ id, question, plan, parentId = null }, now = new Date()) {
  return {
    id,
    question: String(question || '').trim(),
    plan: { ...plan },
    lockedAt: now.toISOString(),
    lockDay: dayKeyFor(now),
    parentId,
    result: null,
    reflection: '',
  };
}

// Проверить план перед фиксацией. Возвращает список ошибок (пустой — всё хорошо).
export function validatePlan(plan, metrics) {
  const errors = [];
  const factor = metrics.find((m) => m.key === plan.factorKey);
  const outcome = metrics.find((m) => m.key === plan.outcomeKey);
  if (!factor) errors.push('Выберите фактор — то, по чему делятся дни.');
  if (!outcome) errors.push('Выберите показатель-результат.');
  if (factor && outcome && factor.key === outcome.key && plan.lag === 0) {
    errors.push('Фактор и результат совпадают — выберите разные показатели (или сдвиг на следующий день).');
  }
  if (factor && !factor.boolean) {
    if (typeof plan.threshold !== 'number' || !Number.isFinite(plan.threshold)) errors.push('Укажите порог — число, по которому делятся дни.');
    if (plan.side !== 'below' && plan.side !== 'atLeast') errors.push('Выберите, какая сторона порога — «условие».');
  }
  if (plan.direction !== 'higher' && plan.direction !== 'lower') errors.push('Выберите ожидаемое направление: выше или ниже.');
  if (plan.lag !== 0 && plan.lag !== 1) errors.push('Выберите сдвиг: тот же день или следующий.');
  if (!Number.isInteger(plan.minDays) || plan.minDays < 5 || plan.minDays > 60) errors.push('Минимум дней в группе — целое число от 5 до 60.');
  return errors;
}

// ----- Фразы для интерфейса -----

function fmt(n) {
  return String(Math.round(n * 100) / 100).replace('.', ',');
}

// Условие словами: «сон, ч меньше 7» или «кофе: да».
export function conditionText(plan, factorMetric) {
  const name = factorMetric?.name || factorMetric?.label || 'фактор';
  if (plan.factorKind === 'boolean') return factorMetric?.source === 'cause' ? name : `${name}: да`;
  return `${name.toLowerCase()} ${plan.side === 'below' ? 'меньше' : 'не меньше'} ${fmt(plan.threshold)}`;
}

// Противоположное условие (группа B).
export function otherConditionText(plan, factorMetric) {
  const name = factorMetric?.name || factorMetric?.label || 'фактор';
  if (plan.factorKind === 'boolean') return factorMetric?.source === 'cause' ? `${name.replace('отмечена', 'не отмечена')}` : `${name}: нет`;
  return `${name.toLowerCase()} ${plan.side === 'below' ? 'не меньше' : 'меньше'} ${fmt(plan.threshold)}`;
}

// Гипотеза одной фразой по шаблону «Когда [условие], мой [показатель] [выше/ниже], чем обычно».
export function templateSentence(plan, factorMetric, outcomeMetric) {
  const when = plan.lag === 1 ? 'На следующий день после дней, когда' : 'Когда';
  const outcome = (outcomeMetric?.name || outcomeMetric?.label || 'показатель').toLowerCase();
  return `${when} ${conditionText(plan, factorMetric)}, мой показатель «${outcome}» ${plan.direction === 'higher' ? 'выше' : 'ниже'}, чем в остальные дни.`;
}

// Разница медиан простыми словами.
export function differenceSentence(result, plan, factorMetric, outcomeMetric) {
  const outcome = (outcomeMetric?.name || outcomeMetric?.label || 'показатель').toLowerCase();
  const when = plan.lag === 1 ? 'на следующий день после дней, когда' : 'в дни, когда';
  if (result.diff === 0) {
    return `Медиана показателя «${outcome}» ${when} ${conditionText(plan, factorMetric)}, и в остальные дни одинаковая: ${fmt(result.medianA)}.`;
  }
  return `${capitalize(when)} ${conditionText(plan, factorMetric)}, медиана показателя «${outcome}» была ${result.diff > 0 ? 'выше' : 'ниже'} на ${fmt(Math.abs(result.diff))}: ${fmt(result.medianA)} против ${fmt(result.medianB)} в остальные дни.`;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ----- Таблица CSV (русские заголовки) -----

const VERDICTS = { consistent: 'согласуются', inconsistent: 'не согласуются', unclear: 'пока неясно' };

export function hypothesisRowsForCsv(hypotheses, metrics) {
  return [...hypotheses]
    .sort((a, b) => a.lockedAt.localeCompare(b.lockedAt))
    .map((h) => {
      const factor = metrics.find((m) => m.key === h.plan.factorKey);
      const outcome = metrics.find((m) => m.key === h.plan.outcomeKey);
      const r = h.result;
      return {
        'ID гипотезы': h.id,
        'Вопрос': h.question,
        'Гипотеза': templateSentence(h.plan, factor, outcome),
        'Фактор': factor?.label || h.plan.factorKey,
        'Порог': h.plan.factorKind === 'boolean' ? '' : h.plan.threshold,
        'Условие (группа A)': conditionText(h.plan, factor),
        'Результат': outcome?.label || h.plan.outcomeKey,
        'Ожидание': h.plan.direction === 'higher' ? 'в группе A выше' : 'в группе A ниже',
        'Сдвиг, дней': h.plan.lag,
        'Минимум дней в группе': h.plan.minDays,
        'Зафиксирована': h.lockedAt,
        'Статус': r ? 'завершена' : 'собираются данные',
        'Итог': r ? VERDICTS[r.verdict] : '',
        'Последний учтённый день': r?.cutoffDay ?? '',
        'Дней A': r?.nA ?? '',
        'Дней B': r?.nB ?? '',
        'Медиана A': r?.medianA ?? '',
        'Медиана B': r?.medianB ?? '',
        'Разница медиан (A − B)': r?.diff ?? '',
        'Доля случайных перестановок (ожидаемое направление)': r?.pExpected ?? '',
        'Доля (обратное направление)': r?.pOpposite ?? '',
        'Что я понял(а)': h.reflection,
        'На основе гипотезы': h.parentId || '',
        'Демо-данные': h.demo ? 'да' : '',
      };
    });
}
