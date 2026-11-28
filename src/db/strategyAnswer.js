// =====================================================================
// Отметка «Выполнили ли сегодня стратегию?» (да / нет / не по плану).
// Хранится в эксперименте: answers[день] — ответ, followed[день] — соблюдено ли
// расписание (в день A стратегию выполнили, в день B — нет).
// =====================================================================
import { put } from './repo.js';
import { conditionForDay } from '../logic/alternation.js';
import { followedSchedule } from '../logic/cycle.js';

export async function setStrategyAnswer(experiment, day, answer) {
  const answers = { ...(experiment.answers || {}) };
  const followed = { ...(experiment.followed || {}) };
  if (answer) {
    answers[day] = answer;
    followed[day] = followedSchedule(conditionForDay(experiment, day), answer);
  } else {
    delete answers[day];
    delete followed[day];
  }
  const updated = { ...experiment, answers, followed };
  await put('experiments', updated);
  return updated;
}
