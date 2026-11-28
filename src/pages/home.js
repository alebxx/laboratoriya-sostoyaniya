// =====================================================================
// Главная страница — вокруг цикла «Наблюдай → Заметь → Проверь → Используй».
// Показывает, на каком шаге человек, что сделать сегодня (дневник и тест
// или шаг эксперимента) и прогресс эксперимента. Без «серий» и упрёков.
// =====================================================================
import { getAllSettings, setSetting, get, getAll } from '../db/repo.js';
import { conditionForDay, isFinished } from '../logic/alternation.js';
import { loadAnalysisContext, ensureExperimentResult } from '../db/analysisData.js';
import { cycleState, STEPS, experimentProgress, toolkitVerdict, TOOLKIT_LABELS, pssReminder } from '../logic/cycle.js';
import { canTake } from '../logic/pss.js';
import { getStrategy } from '../data/strategies.js';
import { isAfterDue } from '../logic/pilot.js';
import { greetingFor, weeklyCheer } from '../logic/encourage.js';
import { escapeHtml } from '../ui/helpers.js';
import { icon } from '../ui/icons.js';
import { mascot } from '../ui/mascot.js';
import { themePickerHtml, setupThemePicker } from '../ui/layout.js';
import { dayKeyFor } from '../logic/dates.js';
import { hasUserData } from '../db/exportImport.js';
import { shouldRemindBackup, snoozeUntil } from '../logic/backupReminder.js';
import { NOT_MEDICAL, PRIVACY, CORRELATION_NOTE } from '../data/texts.js';

export async function renderHome(root) {
  const settings = await getAllSettings();
  const today = dayKeyFor();
  const userData = await hasUserData();
  const remind = shouldRemindBackup(settings, userData);
  const todayEntry = await get('diary', today);
  const diaryDays = (await getAll('diary')).map((e) => e.day);
  const cheer = weeklyCheer(diaryDays, today);
  // Вечером и ночью, если записи за день ещё нет, Пипетка спит —
  // мягкое напоминание о дневнике (без упрёков).
  const hour = new Date().getHours();
  const evening = hour >= 20 || hour < 4;
  const greetPose = !todayEntry && evening ? 'sleep' : 'greet';

  // Пилот: какая анкета ждёт заполнения.
  let pilotCard = '';
  if (settings.pilot?.enabled) {
    const before = await get('pilot', 'before');
    const after = await get('pilot', 'after');
    if (!before?.completedAt) pilotCard = 'Заполните анкету «до» — это займёт несколько минут.';
    else if (!after?.completedAt && isAfterDue(settings.pilot, today)) pilotCard = 'Пора заполнить анкету «после» и выгрузить данные для исследователя.';
  }
  // Шаг цикла.
  let experiments = await getAll('experiments');
  // Если эксперимент закончился, а итога ещё нет — посчитать его (один раз).
  if (experiments.some((e) => !e.result && isFinished(e, today))) {
    const ctx = await loadAnalysisContext();
    experiments = await Promise.all(experiments.map((e) => ensureExperimentResult(e, ctx)));
  }
  const cycle = cycleState({ diaryDays, experiments, today });
  const pvtToday = (await getAll('pvtSessions')).some((x) => x.day === today && x.status === 'completed' && !x.practice);
  const pssResults = await getAll('pss');
  const pssNote = settings.age13plus ? pssReminder(pssResults, canTake(pssResults, today).allowed) : null;

  root.innerHTML = `
    <section class="card with-mascot" aria-labelledby="hello">
      ${mascot(greetPose, { size: 96 })}
      <div>
        <h1 id="hello" style="margin:0">${greetingFor()}!</h1>
        <p class="lead" style="margin:4px 0 0">${todayEntry
          ? 'Запись за сегодня уже есть. Можно посмотреть графики или пройти тест.'
          : evening
            ? 'Перед сном можно отметить, как прошёл день, — это займёт пару минут.'
            : 'Как прошёл день? Запись в дневнике займёт пару минут.'}</p>
        <div class="actions" style="margin-top:12px">
          ${todayEntry
            ? `<a class="btn btn-primary" href="#/diary">${icon('NotebookPen', 18)}Открыть запись за сегодня</a>`
            : `<a class="btn btn-primary" href="#/diary">${icon('NotebookPen', 18)}Заполнить дневник</a>`}
        </div>
      </div>
    </section>

    ${cheer ? `<p class="cheer">${icon('Sprout', 22)}<span>${cheer}</span></p>` : ''}

    ${remind ? `
      <section class="card card-warning" id="backup-reminder" aria-labelledby="backup-title">
        <h2 id="backup-title" class="card-title">${icon('Download', 20)}Пора сделать резервную копию</h2>
        <p>Данные хранятся только в этом браузере. Если очистить браузер или потерять устройство, они пропадут.
           Сохраните копию в файл — это займёт секунду.</p>
        <div class="actions">
          <a class="btn" href="#/settings">Перейти к экспорту</a>
          <button type="button" class="btn btn-ghost" id="snooze">Отложить</button>
        </div>
      </section>` : ''}

    ${pilotCard ? `
      <section class="card card-important" aria-labelledby="pilot-title">
        <h2 id="pilot-title" class="card-title">${icon('Users', 20)}Пилотное исследование (${escapeHtml(settings.pilot.code)})</h2>
        <p>${pilotCard}</p>
        <a class="btn" href="#/pilot">Открыть</a>
      </section>` : ''}

    ${cycleBarHtml(cycle.step)}
    ${stepCardHtml(cycle, { today, todayEntry, pvtToday })}

    ${pssNote ? `
      <section class="card metric-pss" aria-labelledby="pss-title">
        <h2 id="pss-title" class="card-title"><span class="metric-badge">${icon('ClipboardCheck', 20)}</span>${pssNote === 'first' ? 'Опросник PSS-10 в начале' : 'Пора повторить PSS-10'}</h2>
        <p>${pssNote === 'first'
          ? 'Опросник о том, как вы воспринимали последний месяц. Пройдите его сейчас, а через 4 недели — ещё раз, чтобы сравнить.'
          : 'Прошло достаточно времени с прошлого раза. Пройдите опросник ещё раз — сайт покажет изменение без оценок.'}</p>
        <a class="btn" href="#/pss">Пройти PSS-10</a>
      </section>` : ''}

    ${!userData ? `
      <section class="card with-mascot" aria-labelledby="demo-title">
        ${mascot('magnifier', { size: 72 })}
        <div>
          <h2 id="demo-title" style="margin:0">Хотите посмотреть на примере?</h2>
          <p>В настройках можно заполнить сайт выдуманными данными за 30 дней и посмотреть, как выглядят графики и проверка гипотез.
            Демо-данные удаляются одной кнопкой.</p>
          <a class="btn btn-ghost" href="#/settings">Перейти к демо-режиму</a>
        </div>
      </section>` : ''}

    <section class="card card-important" aria-labelledby="not-medical-title">
      <h2 id="not-medical-title" class="card-title">${icon('Info', 20)}Важно знать</h2>
      <p>${NOT_MEDICAL}</p>
      <p>${CORRELATION_NOTE}</p>
      <p>${PRIVACY}</p>
    </section>

    <section class="card" aria-label="Оформление">
      ${themePickerHtml('home-theme')}
    </section>`;

  setupThemePicker(root, 'home-theme');

  const snoozeBtn = root.querySelector('#snooze');
  if (snoozeBtn) {
    snoozeBtn.addEventListener('click', async () => {
      await setSetting('backupSnoozedUntil', snoozeUntil());
      root.querySelector('#backup-reminder').remove();
    });
  }
}

// Полоска цикла: четыре шага, текущий выделен.
function cycleBarHtml(step) {
  return `
    <ol class="cycle-bar" aria-label="Цикл: на каком вы шаге">
      ${STEPS.map((s) => `
        <li class="${s.id === step ? 'is-current' : ''}" ${s.id === step ? 'aria-current="step"' : ''}>
          <a href="${s.href}"><span class="nav-step">${s.number}</span>${s.title}</a>
        </li>`).join('')}
    </ol>`;
}

// Карточка «что сделать сегодня» — своя для каждого шага.
function stepCardHtml(cycle, { today, todayEntry, pvtToday }) {
  const tasks = `
    <ul class="today-tasks">
      <li class="${todayEntry ? 'is-done' : ''}">${icon(todayEntry ? 'Check' : 'NotebookPen', 18)}
        <a href="#/diary">Дневник</a>${todayEntry ? ' — запись есть' : ''}</li>
      <li class="${pvtToday ? 'is-done' : ''}">${icon(pvtToday ? 'Check' : 'Timer', 18)}
        <a href="#/pvt">Тест внимания</a>${pvtToday ? ' — пройден' : ' — 3 минуты'}</li>
    </ul>`;

  if (cycle.step === 'observe') {
    return `
      <section class="card card-important" aria-labelledby="step-title">
        <h2 id="step-title" class="card-title">${icon('Eye', 20)}Шаг 1. Неделя наблюдения</h2>
        <p>Отмечайте каждый день, как вы себя чувствуете, и проходите короткий тест. Через неделю станет видно,
          что меняется вместе со стрессом, — и можно будет выбрать, что проверить на себе.</p>
        <div class="progress-row">
          <div class="progress-label">Дней с записью: <strong>${cycle.observeCount} из ${cycle.observeGoal}</strong></div>
          <progress max="${cycle.observeGoal}" value="${cycle.observeCount}" aria-label="Неделя наблюдения: ${cycle.observeCount} из ${cycle.observeGoal} дней"></progress>
        </div>
        <h3>Сегодня</h3>
        ${tasks}
      </section>`;
  }

  if (cycle.step === 'notice') {
    return `
      <section class="card card-important" aria-labelledby="step-title">
        <h2 id="step-title" class="card-title">${icon('Search', 20)}Шаг 2. Неделя наблюдения пройдена</h2>
        <p>Посмотрите, что меняется вместе со стрессом, и выберите стратегию, которую хотите проверить на себе.</p>
        <div class="actions">
          <a class="btn btn-primary" href="#/strategies">${icon('FlaskConical', 18)}Выбрать стратегию</a>
          <a class="btn" href="#/charts">Что заметно в моих данных</a>
        </div>
        <h3>Сегодня</h3>
        ${tasks}
      </section>`;
  }

  if (cycle.step === 'test') {
    const e = cycle.active;
    const cond = conditionForDay(e, today);
    const p = experimentProgress(e, today);
    const name = e.strategyId ? (getStrategy(e.strategyId)?.title || e.conditionA) : e.conditionA;
    return `
      <section class="card card-important" aria-labelledby="step-title">
        <h2 id="step-title" class="card-title">${icon('FlaskConical', 20)}Шаг 3. Проверяю: ${escapeHtml(name)}</h2>
        ${cond ? `<p class="big-condition">${cond === 'A'
          ? `Сегодня — день со стратегией: ${escapeHtml(e.conditionA)}`
          : `Сегодня — день ${escapeHtml(e.conditionB)}`}</p>`
          : '<p>Эксперимент начнётся завтра.</p>'}
        <div class="progress-row">
          <div class="progress-label">Прошло дней: <strong>${p.done} из ${p.total}</strong></div>
          <progress max="${p.total}" value="${p.done}" aria-label="Эксперимент: ${p.done} из ${p.total} дней"></progress>
        </div>
        <h3>Сегодня</h3>
        ${tasks}
        <p class="hint">В дневнике отметьте, выполнили ли вы сегодня стратегию.</p>
        <a class="btn" href="#/experiments/view?id=${encodeURIComponent(e.id)}">Открыть эксперимент</a>
      </section>`;
  }

  // use
  const last = cycle.finished[0];
  const label = TOOLKIT_LABELS[toolkitVerdict(last.result)];
  return `
    <section class="card card-important" aria-labelledby="step-title">
      <h2 id="step-title" class="card-title">${icon('Backpack', 20)}Шаг 4. Используй то, что подходит</h2>
      <p>Последний эксперимент: <strong>${escapeHtml(last.conditionA)}</strong> — ${last.result ? label.toLowerCase() : 'итог готов, откройте эксперимент'}.</p>
      <div class="actions">
        <a class="btn btn-primary" href="#/toolkit">${icon('Backpack', 18)}Мой набор помощи</a>
        <a class="btn" href="#/strategies">Проверить следующую стратегию</a>
      </div>
      <h3>Сегодня</h3>
      ${tasks}
    </section>`;
}
