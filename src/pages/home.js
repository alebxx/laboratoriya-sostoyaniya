// =====================================================================
// Главная страница.
// Приветствие по времени суток, что сделать сегодня, мягкое поздравление
// за регулярность (без «серий» и упрёков), разделы и переключатель темы.
// На экране одна главная кнопка — «Заполнить дневник» (или «Открыть запись»).
// =====================================================================
import { getAllSettings, setSetting, get, getAll } from '../db/repo.js';
import { conditionForDay } from '../logic/alternation.js';
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

// Плитки разделов: значок в цвете своего показателя.
const SECTIONS = [
  { href: '#/diary', title: 'Дневник', text: 'Отметить, как прошёл день: 1–2 минуты.', icon: 'NotebookPen', metric: 'stress' },
  { href: '#/pvt', title: 'Тест внимания', text: 'Три минуты: нажимать, как только появится сигнал.', icon: 'Timer', metric: 'test' },
  { href: '#/physio', title: 'Пульс и давление', text: 'Записать свои измерения (необязательно).', icon: 'HeartPulse', metric: 'pulse' },
  { href: '#/charts', title: 'Карта состояния', text: 'Графики ваших записей во времени.', icon: 'ChartLine', metric: 'sleep' },
  { href: '#/hypotheses', title: 'Гипотезы', text: 'Проверить своё предположение на своих данных.', icon: 'FlaskConical', metric: 'concentration' },
  { href: '#/regulation', title: 'Саморегуляция', text: 'Дыхательное упражнение и советы.', icon: 'Wind', metric: 'fatigue' },
];

export async function renderHome(root) {
  const settings = await getAllSettings();
  const today = dayKeyFor();
  const userData = await hasUserData();
  const remind = shouldRemindBackup(settings, userData);
  const todayEntry = await get('diary', today);
  const diaryDays = (await getAll('diary')).map((e) => e.day);
  const cheer = weeklyCheer(diaryDays, today);

  // Пилот: какая анкета ждёт заполнения.
  let pilotCard = '';
  if (settings.pilot?.enabled) {
    const before = await get('pilot', 'before');
    const after = await get('pilot', 'after');
    if (!before?.completedAt) pilotCard = 'Заполните анкету «до» — это займёт несколько минут.';
    else if (!after?.completedAt && isAfterDue(settings.pilot, today)) pilotCard = 'Пора заполнить анкету «после» и выгрузить данные для исследователя.';
  }
  // Идущие самоэксперименты: какое условие сегодня.
  const todayConditions = (await getAll('experiments'))
    .filter((e) => !e.result)
    .map((e) => ({ e, cond: conditionForDay(e, today) }))
    .filter((x) => x.cond);

  root.innerHTML = `
    <section class="card with-mascot" aria-labelledby="hello">
      ${mascot('greet', { size: 92 })}
      <div>
        <h1 id="hello" style="margin:0">${greetingFor()}!</h1>
        <p class="lead" style="margin:4px 0 0">${todayEntry ? 'Запись за сегодня уже есть. Можно посмотреть графики или пройти тест.' : 'Как прошёл день? Запись в дневнике займёт пару минут.'}</p>
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

    ${todayConditions.map(({ e, cond }) => `
      <section class="card card-important" aria-label="Самоэксперимент: условие на сегодня">
        <h2 class="card-title">${icon('Shuffle', 20)}Самоэксперимент: сегодня условие ${cond}</h2>
        <p class="big-condition">${escapeHtml(cond === 'A' ? e.conditionA : e.conditionB)}</p>
        <a class="btn" href="#/experiments/view?id=${encodeURIComponent(e.id)}">Открыть эксперимент</a>
      </section>`).join('')}

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

    <h2>Разделы</h2>
    <ul class="tiles">
      ${SECTIONS.map((s) => `
        <li><a class="tile metric-${s.metric}" href="${s.href}">
          <span class="metric-badge">${icon(s.icon, 20)}</span>
          <span class="tile-text"><strong>${s.title}</strong><span>${s.text}</span></span>
        </a></li>`).join('')}
    </ul>

    <section class="statement" aria-labelledby="not-medical-title">
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
