// =====================================================================
// Цикл «Наблюдай → Заметь → Проверь → Используй».
//
// Здесь решается, на каком шаге цикла человек, и считается всё,
// что нужно главной, дневнику, «Моему набору помощи» и подсказкам.
// Функции не трогают базу и интерфейс — их проверяют тесты.
// =====================================================================
import { CYCLE } from '../config.js';
import { lastDay } from './alternation.js';
import { median } from './stats.js';
import { addDays } from './dates.js';

export const STEPS = [
  { id: 'observe', number: 1, title: 'Наблюдай', href: '#/observe' },
  { id: 'notice', number: 2, title: 'Заметь', href: '#/charts' },
  { id: 'test', number: 3, title: 'Проверь', href: '#/strategies' },
  { id: 'use', number: 4, title: 'Используй', href: '#/toolkit' },
];

// Идущий эксперимент: итога ещё нет и последний день не прошёл.
// Одновременно идёт только один (самый новый, если вдруг их несколько).
export function activeExperiment(experiments, today) {
  return experiments
    .filter((e) => !e.result && today <= lastDay(e))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] || null;
}

// Завершённые эксперименты (последний день прошёл), новые — первыми.
export function finishedExperiments(experiments, today) {
  return experiments
    .filter((e) => e.result || today > lastDay(e))
    .sort((a, b) => lastDay(b).localeCompare(lastDay(a)));
}

// На каком шаге цикла человек.
//   diaryDays — дни, за которые есть запись в дневнике.
// Неделя наблюдения — это CYCLE.observeDays дней С ЗАПИСЬЮ (пропуски её не сбрасывают).
export function cycleState({ diaryDays, experiments, today }) {
  const observeCount = new Set(diaryDays).size;
  const active = activeExperiment(experiments, today);
  const finished = finishedExperiments(experiments, today);
  let step;
  if (active) step = 'test';
  else if (finished.length) step = 'use';
  else if (observeCount < CYCLE.observeDays) step = 'observe';
  else step = 'notice';
  return { step, observeCount, observeGoal: CYCLE.observeDays, active, finished };
}

// Прогресс эксперимента: сколько дней расписания уже прошло (включая сегодня).
export function experimentProgress(experiment, today) {
  const total = experiment.schedule.length;
  const done = experiment.schedule.filter((s) => s.day <= today).length;
  return { done, total };
}

// ----- Итог для «Моего набора помощи» -----
// Переводит итог перестановочного теста в одну из трёх подписей.
//   consistent   (разница в ожидаемую сторону)  → «похоже, помогает»;
//   inconsistent (разница в обратную сторону)   → «похоже, не помогает»;
//   всё остальное, включая «мало данных»        → «пока неясно».
export const TOOLKIT_LABELS = {
  helps: 'Похоже, помогает',
  'not-helps': 'Похоже, не помогает',
  unclear: 'Пока неясно',
};

export function toolkitVerdict(result) {
  if (!result || result.insufficient) return 'unclear';
  if (result.verdict === 'consistent') return 'helps';
  if (result.verdict === 'inconsistent') return 'not-helps';
  return 'unclear';
}

// ----- Отметка в дневнике «Выполнили ли сегодня стратегию?» -----
export const STRATEGY_ANSWERS = [
  { value: 'yes', label: 'да' },
  { value: 'no', label: 'нет' },
  { value: 'off-plan', label: 'не по плану' },
];

// Соблюдено ли расписание: в день A стратегию выполнили, в день B — нет.
// «Не по плану» (сделали иначе, чем задумано) — расписание не соблюдено.
export function followedSchedule(condition, answer) {
  if (!answer) return null;
  if (answer === 'off-plan') return false;
  return condition === 'A' ? answer === 'yes' : answer === 'no';
}

// Сводка отметок за эксперимент: по плану / не по плану / без отметки.
export function adherenceSummary(experiment, today) {
  const past = experiment.schedule.filter((s) => s.day <= today);
  let onPlan = 0;
  let offPlan = 0;
  let missing = 0;
  for (const s of past) {
    const f = followedSchedule(s.condition, experiment.answers?.[s.day]);
    if (f === true) onPlan += 1;
    else if (f === false) offPlan += 1;
    else missing += 1;
  }
  return { onPlan, offPlan, missing, days: past.length };
}

// ----- Подсказки на странице «Заметь» -----
// Простые правила по записям дневника. Это повод проверить стратегию,
// а не вывод: совпадение в данных не означает причину.
// Пороги (CYCLE.hints) выбраны разработчиком, это не научные нормы.
export function patternHints(diary, today, hints = CYCLE.hints) {
  const result = [];
  const recent = diary.filter((e) => e.day > addDays(today, -hints.recentDays));

  // 1. Сон и стресс: дни после короткого сна против дней после длинного.
  const withSleep = diary.filter((e) => isNum(e.sleepHours) && isNum(e.stress));
  if (withSleep.length >= hints.minDaysPerGroup * 2) {
    const cut = median(withSleep.map((e) => e.sleepHours));
    const short = withSleep.filter((e) => e.sleepHours < cut).map((e) => e.stress);
    const long = withSleep.filter((e) => e.sleepHours >= cut).map((e) => e.stress);
    if (short.length >= hints.minDaysPerGroup && long.length >= hints.minDaysPerGroup) {
      const ms = median(short);
      const ml = median(long);
      if (ms - ml >= hints.minStressDiff) {
        result.push({
          id: 'sleep-stress',
          tags: ['sleep'],
          text: `В дни, когда вы спали меньше ${fmt(cut)} ч, стресс в дневнике был выше: медиана ${fmt(ms)} против ${fmt(ml)}.`,
        });
      }
    }
  }

  // 2. Причины стресса, которые часто отмечаются в последнее время.
  const CAUSE_TAGS = { недосып: ['sleep'], учёба: ['study', 'breaks', 'workspace'], работа: ['work', 'breaks', 'workspace'] };
  for (const [cause, tags] of Object.entries(CAUSE_TAGS)) {
    const n = recent.filter((e) => (e.causes || []).includes(cause)).length;
    if (n >= hints.minCauseDays) {
      if (cause === 'недосып' && result.some((h) => h.id === 'sleep-stress')) continue;
      result.push({
        id: `cause-${cause}`,
        tags,
        text: `За последние ${hints.recentDays} дней причина «${cause}» отмечена в дневнике ${n} раз.`,
      });
    }
  }
  return result;
}

// Стратегии, подходящие к подсказке (по общим темам).
export function strategiesForHint(hint, strategies) {
  return strategies.filter((s) => s.tags.some((t) => hint.tags.includes(t)));
}

// ----- PSS-10: в начале и через 4 недели -----
// Изменение между первым и последним обычным прохождением (одна шкала ответов).
export function pssOverallChange(results) {
  const regular = results
    .filter((r) => !r.demo && (!r.context || r.context === 'regular'))
    .sort((a, b) => a.completedAt.localeCompare(b.completedAt));
  if (regular.length < 2) return null;
  const first = regular[0];
  const last = regular.filter((r) => r.scale === first.scale).at(-1);
  if (last === first) return null;
  return {
    first,
    last,
    total: last.total - first.total,
    helplessness: last.helplessness - first.helplessness,
    selfEfficacy: last.selfEfficacy - first.selfEfficacy,
  };
}

// Нужно ли напомнить о PSS-10 на главной:
// нет ни одного прохождения — «пройдите в начале»; прошло 4 недели и опросник
// снова доступен — «пройдите повторно, чтобы сравнить».
export function pssReminder(results, canTakeNow) {
  const regular = results.filter((r) => !r.demo);
  if (regular.length === 0) return 'first';
  if (canTakeNow) return 'repeat';
  return null;
}

function isNum(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

function fmt(n) {
  return String(Math.round(n * 10) / 10).replace('.', ',');
}
