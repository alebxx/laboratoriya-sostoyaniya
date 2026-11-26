// =====================================================================
// Главная страница.
// =====================================================================
import { getAllSettings, setSetting, get, getAll } from '../db/repo.js';
import { conditionForDay } from '../logic/alternation.js';
import { isAfterDue } from '../logic/pilot.js';
import { escapeHtml } from '../ui/helpers.js';
import { dayKeyFor } from '../logic/dates.js';
import { hasUserData } from '../db/exportImport.js';
import { shouldRemindBackup, snoozeUntil } from '../logic/backupReminder.js';
import { NOT_MEDICAL, PRIVACY, CORRELATION_NOTE } from '../data/texts.js';

// Плитки разделов на главной.
const SECTIONS = [
  { href: '#/diary', title: 'Дневник', text: 'Отметить, как прошёл день: 1–2 минуты.' },
  { href: '#/pvt', title: 'Тест внимания', text: 'Три минуты: нажимать, как только появится сигнал.' },
  { href: '#/physio', title: 'Пульс и давление', text: 'Записать свои измерения (необязательно).' },
  { href: '#/charts', title: 'Карта состояния', text: 'Графики ваших записей во времени.' },
  { href: '#/hypotheses', title: 'Гипотезы', text: 'Проверить своё предположение на своих данных.' },
  { href: '#/regulation', title: 'Саморегуляция', text: 'Дыхательное упражнение и советы.' },
];

export async function renderHome(root) {
  const settings = await getAllSettings();
  const remind = shouldRemindBackup(settings, await hasUserData());
  const todayEntry = await get('diary', dayKeyFor());
  // Пилот: какая анкета ждёт заполнения.
  let pilotCard = '';
  if (settings.pilot?.enabled) {
    const before = await get('pilot', 'before');
    const after = await get('pilot', 'after');
    if (!before?.completedAt) pilotCard = 'Заполните анкету «до» — это займёт несколько минут.';
    else if (!after?.completedAt && isAfterDue(settings.pilot, dayKeyFor())) pilotCard = 'Пора заполнить анкету «после» и выгрузить данные для исследователя.';
  }
  // Идущие самоэксперименты: какое условие сегодня.
  const todayConditions = (await getAll('experiments'))
    .filter((e) => !e.result)
    .map((e) => ({ e, cond: conditionForDay(e, dayKeyFor()) }))
    .filter((x) => x.cond);

  root.innerHTML = `
    <h1>Лаборатория состояния</h1>
    <p class="lead">Исследуйте собственное состояние: записывайте, смотрите на графики и проверяйте свои гипотезы.</p>

    ${
      remind
        ? `<section class="card card-warning" id="backup-reminder" aria-labelledby="backup-title">
            <h2 id="backup-title">Пора сделать резервную копию</h2>
            <p>Данные хранятся только в этом браузере. Если очистить браузер или потерять устройство, они пропадут.
               Сохраните копию в файл — это займёт секунду.</p>
            <div class="actions">
              <a class="btn btn-primary" href="#/settings">Перейти к экспорту</a>
              <button type="button" class="btn btn-ghost" id="snooze">Отложить</button>
            </div>
          </section>`
        : ''
    }

    ${pilotCard ? `
      <section class="card card-important" aria-labelledby="pilot-title">
        <h2 id="pilot-title">Пилотное исследование (${escapeHtml(settings.pilot.code)})</h2>
        <p>${pilotCard}</p>
        <a class="btn btn-primary" href="#/pilot">Открыть</a>
      </section>` : ''}

    <section class="card" aria-labelledby="today-title">
      <h2 id="today-title">Сегодня</h2>
      ${todayEntry
        ? '<p>Запись в дневнике за сегодня есть.</p><a class="btn" href="#/diary">Открыть и изменить</a>'
        : '<p>Записи в дневнике за сегодня пока нет. Это займёт 1–2 минуты.</p><a class="btn btn-primary" href="#/diary">Заполнить дневник</a>'}
    </section>

    ${todayConditions.map(({ e, cond }) => `
      <section class="card card-important" aria-label="Самоэксперимент: условие на сегодня">
        <h2>Самоэксперимент: сегодня условие ${cond}</h2>
        <p class="big-condition">${escapeHtml(cond === 'A' ? e.conditionA : e.conditionB)}</p>
        <a class="btn" href="#/experiments/view?id=${encodeURIComponent(e.id)}">Открыть эксперимент</a>
      </section>`).join('')}

    <section class="card card-important" aria-labelledby="not-medical-title">
      <h2 id="not-medical-title">Важно знать</h2>
      <p>${NOT_MEDICAL}</p>
      <p>${CORRELATION_NOTE}</p>
      <p>${PRIVACY}</p>
    </section>

    <h2>Разделы</h2>
    <ul class="tiles">
      ${SECTIONS.map(
        (s) => `<li><a class="tile" href="${s.href}"><strong>${s.title}</strong><span>${s.text}</span></a></li>`
      ).join('')}
    </ul>`;

  const snoozeBtn = root.querySelector('#snooze');
  if (snoozeBtn) {
    snoozeBtn.addEventListener('click', async () => {
      await setSetting('backupSnoozedUntil', snoozeUntil());
      root.querySelector('#backup-reminder').remove();
    });
  }
}
