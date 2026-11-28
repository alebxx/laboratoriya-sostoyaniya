// =====================================================================
// Шаг 1 «Наблюдай»: дневник, тест внимания и (если включено) пульс и давление.
// =====================================================================
import { get, getAll, getSetting } from '../db/repo.js';
import { cycleState } from '../logic/cycle.js';
import { dayKeyFor } from '../logic/dates.js';
import { icon } from '../ui/icons.js';

export async function renderObserve(root) {
  const today = dayKeyFor();
  const [todayEntry, diary, sessions, experiments, showPhysio] = await Promise.all([
    get('diary', today), getAll('diary'), getAll('pvtSessions'), getAll('experiments'), getSetting('showPhysio', false),
  ]);
  const pvtToday = sessions.some((x) => x.day === today && x.status === 'completed' && !x.practice);
  const cycle = cycleState({ diaryDays: diary.map((e) => e.day), experiments, today });
  const tile = (href, ic, metric, title, text, done) => `
    <li><a class="tile metric-${metric}" href="${href}">
      <span class="metric-badge">${icon(done ? 'Check' : ic, 20)}</span>
      <span class="tile-text"><strong>${title}</strong><span>${text}</span></span>
    </a></li>`;

  root.innerHTML = `
    <h1>Шаг 1. Наблюдай</h1>
    <p class="lead">Каждый день — короткая запись и тест. Из этих наблюдений потом видно,
      что меняется вместе со стрессом, и становится понятно, что проверить на себе.</p>
    ${cycle.step === 'observe' ? `
      <div class="progress-row card">
        <div class="progress-label">Неделя наблюдения: <strong>${cycle.observeCount} из ${cycle.observeGoal}</strong> дней с записью</div>
        <progress max="${cycle.observeGoal}" value="${cycle.observeCount}" aria-label="Неделя наблюдения: ${cycle.observeCount} из ${cycle.observeGoal}"></progress>
      </div>` : ''}
    <ul class="tiles">
      ${tile('#/diary', 'NotebookPen', 'stress', 'Дневник', todayEntry ? 'Запись за сегодня есть — можно открыть и дополнить.' : 'Как прошёл день: 1–2 минуты.', Boolean(todayEntry))}
      ${tile('#/pvt', 'Timer', 'test', 'Тест внимания', pvtToday ? 'Сегодня уже пройден.' : 'Три минуты: нажимать, как только появится сигнал.', pvtToday)}
      ${showPhysio ? tile('#/physio', 'HeartPulse', 'pulse', 'Пульс и давление', 'Записать свои измерения.', false) : ''}
    </ul>
    ${showPhysio ? '' : '<p class="hint">Записи пульса и давления можно включить в «Настройках и данных».</p>'}`;
}
