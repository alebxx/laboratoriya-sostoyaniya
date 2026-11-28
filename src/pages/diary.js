// =====================================================================
// Страница «Дневник»: одна запись на день, её можно редактировать.
// Заполнение — 1–2 минуты, в основном ползунками и кнопками.
// =====================================================================
import { get, put, remove, getAll, getSetting, setSetting } from '../db/repo.js';
import { dayKeyFor } from '../logic/dates.js';
import { makeId } from '../logic/id.js';
import {
  SCALES, MOODS, SLEEP_HOURS, SLEEP_QUALITY, CAUSES, NOTE_MAX_LENGTH,
  buildEntry, isEntryEmpty, validateFactor,
} from '../logic/diary.js';
import { shouldShowCare } from '../logic/care.js';
import { CARE_MESSAGE } from '../data/messages.js';
import { sliderHtml, setupSliders, readSlider } from '../ui/fields.js';
import { escapeHtml, formatDateTime, statusInner } from '../ui/helpers.js';
import { icon, CAUSE_ICONS } from '../ui/icons.js';
import { mascot } from '../ui/mascot.js';
import { getParam, rerender } from '../router.js';
import { conditionForDay } from '../logic/alternation.js';
import { STRATEGY_ANSWERS } from '../logic/cycle.js';
import { setStrategyAnswer } from '../db/strategyAnswer.js';

// Сообщение, которое нужно показать после перерисовки страницы
// (например, «Запись сохранена»).
let flash = '';
// Нужно ли показать сообщение мягкой заботы после перерисовки.
let showCareCard = false;

// «2026-03-10» → «вторник, 10 марта».
export function formatDay(day) {
  return new Date(day + 'T12:00:00').toLocaleDateString('ru-RU', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

export async function renderDiary(root) {
  const today = dayKeyFor();
  let day = getParam('day');
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day) || day > today) day = today;

  const allFactors = await getSetting('customFactors', []);
  const factors = allFactors.filter((f) => !f.hidden);
  const entry = await get('diary', day);
  const recent = (await getAll('diary')).sort((a, b) => b.day.localeCompare(a.day)).slice(0, 14);
  const v = entry || {}; // сохранённые значения (или пусто для новой записи)
  // Эксперимент со стратегией, в расписание которого входит этот день (итог ещё не посчитан).
  let experiment = (await getAll('experiments')).find((e) => e.strategyId && !e.result && conditionForDay(e, day));

  root.innerHTML = `
    <h1>Дневник</h1>
    <p role="status" id="status" class="status ${flash ? 'pop' : ''}">${statusInner(flash)}</p>
    ${showCareCard ? careCardHtml() : ''}

    <div class="card day-picker">
      <label class="field">
        <span>День записи</span>
        <input type="date" id="day" value="${day}" max="${today}" />
      </label>
      <p class="hint">${day === today ? 'Сегодня, ' : ''}${formatDay(day)}.
        ${entry
          ? `Запись за этот день уже есть (сохранена ${formatDateTime(entry.updatedAt)}) — вы её редактируете.`
          : 'Записи за этот день пока нет.'}
        Все поля необязательны.</p>
    </div>

    <form id="diary-form" novalidate>
      <section class="card" aria-labelledby="h-state">
        <h2 id="h-state" class="card-title">Состояние</h2>
        ${SCALES.map((s) => sliderHtml(s, v[s.key])).join('')}
      </section>

      <section class="card" aria-labelledby="h-mood">
        <h2 id="h-mood" class="card-title metric-other"><span class="metric-badge">${icon('Smile', 20)}</span>Настроение</h2>
        <fieldset>
          <legend class="visually-hidden">Настроение сегодня</legend>
          <div class="mood-row">
            ${MOODS.map((m) => `
              <label class="mood-option">
                <input type="radio" name="mood" value="${m.value}" ${v.mood === m.value ? 'checked' : ''} />
                <span class="mood-emoji" aria-hidden="true">${m.emoji}</span>
                <span class="mood-label">${m.label}</span>
              </label>`).join('')}
          </div>
        </fieldset>
        <button type="button" class="btn btn-ghost btn-small" id="mood-clear">Сбросить</button>
      </section>

      <section class="card" aria-labelledby="h-sleep">
        <h2 id="h-sleep" class="card-title metric-sleep"><span class="metric-badge">${icon('Moon', 20)}</span>Сон прошлой ночью</h2>
        ${sliderHtml({ key: 'sleepHours', metric: 'sleepHours', label: 'Сколько часов спал(а)', ...SLEEP_HOURS, minLabel: `${SLEEP_HOURS.min} ч`, maxLabel: `${SLEEP_HOURS.max} ч`, unit: 'ч' }, v.sleepHours)}
        ${sliderHtml(SLEEP_QUALITY, v.sleepQuality)}
      </section>

      <section class="card" aria-labelledby="h-causes">
        <h2 id="h-causes">Возможные причины стресса</h2>
        <fieldset>
          <legend>Можно выбрать несколько</legend>
          <div class="radio-row">
            ${CAUSES.map((c) => `
              <label class="radio-card">
                <input type="checkbox" name="causes" value="${c}" ${(v.causes || []).includes(c) ? 'checked' : ''} />
                ${icon(CAUSE_ICONS[c], 18)}<span>${c}</span>
              </label>`).join('')}
          </div>
        </fieldset>
        <label class="field">
          <span>Своё (необязательно)</span>
          <input type="text" name="causeOther" maxlength="100" value="${escapeHtml(v.causeOther || '')}" />
        </label>
      </section>

      ${experiment ? strategyQuestionHtml(experiment, day, today) : ''}

      <section class="card" aria-labelledby="h-factors">
        <h2 id="h-factors">Мои факторы</h2>
        ${factors.length === 0
          ? '<p class="hint">Своих факторов пока нет. Их можно добавить ниже, в блоке «Настроить мои факторы» (например, «кофе», «контрольная», «спорт»).</p>'
          : factors.map((f) => factorInputHtml(f, v.factors ? v.factors[f.id] : undefined)).join('')}
      </section>

      <section class="card" aria-labelledby="h-note">
        <h2 id="h-note">Заметка</h2>
        <label class="field">
          <span>Коротко о дне (необязательно, до ${NOTE_MAX_LENGTH} символов)</span>
          <textarea name="note" rows="3" maxlength="${NOTE_MAX_LENGTH}">${escapeHtml(v.note || '')}</textarea>
        </label>
      </section>

      <div class="actions sticky-actions">
        <button type="submit" class="btn btn-primary">${icon('Check', 18)}${entry ? 'Сохранить изменения' : 'Сохранить запись'}</button>
      </div>
    </form>
    ${entry ? '<div class="actions"><button type="button" class="btn btn-ghost" id="delete-entry">Удалить запись за этот день</button></div>' : ''}

    <details class="card" id="factor-settings">
      <summary>Настроить мои факторы</summary>
      <p class="hint">Свой фактор — то, что вы хотите отмечать каждый день, чтобы потом проверить, связано ли это с другими показателями.
        Скрытый фактор пропадает из формы, но уже сделанные отметки сохраняются.</p>
      <ul class="factor-list">
        ${allFactors.map((f) => `
          <li>
            <span>${escapeHtml(f.name)} <span class="hint">(${f.type === 'bool' ? 'да/нет' : 'число'}${f.hidden ? ', скрыт' : ''})</span></span>
            <button type="button" class="btn btn-ghost btn-small" data-toggle-factor="${f.id}">${f.hidden ? 'Показать' : 'Скрыть'}</button>
          </li>`).join('') || '<li class="hint">Пока пусто.</li>'}
      </ul>
      <form id="factor-form" novalidate>
        <label class="field">
          <span>Название нового фактора</span>
          <input type="text" name="factorName" maxlength="40" autocomplete="off" />
        </label>
        <fieldset>
          <legend>Как отмечать</legend>
          <div class="radio-row">
            <label class="radio-card"><input type="radio" name="type" value="bool" checked /><span>да / нет</span></label>
            <label class="radio-card"><input type="radio" name="type" value="number" /><span>число (например, чашки, часы)</span></label>
          </div>
        </fieldset>
        <p id="factor-error" class="error" role="alert"></p>
        <button type="submit" class="btn">Добавить фактор</button>
      </form>
    </details>

    <section aria-labelledby="h-recent">
      <h2 id="h-recent">Последние записи</h2>
      ${recent.length === 0 ? `<div class="empty-state">${mascot('notebook', { size: 96 })}<p>Записей пока нет. Первая запись появится здесь.</p></div>` : `
        <ul class="recent-list">
          ${recent.map((r) => `
            <li><a href="#/diary?day=${r.day}" ${r.day === day ? 'aria-current="true"' : ''}>${formatDay(r.day)}</a>
              <span class="hint">${r.stress !== null && r.stress !== undefined ? `стресс ${r.stress}` : ''}${r.demo ? ' · демо' : ''}</span></li>`).join('')}
        </ul>`}
    </section>`;

  flash = '';
  const wasCareShown = showCareCard;
  showCareCard = false;
  if (wasCareShown) {
    root.querySelector('#care-ok').addEventListener('click', () => root.querySelector('#care-card').remove());
  }

  setupSliders(root);

  // Были ли изменения в форме после открытия страницы (ещё не сохранённые).
  let formDirty = false;
  const diaryForm = root.querySelector('#diary-form');
  diaryForm.addEventListener('input', () => (formDirty = true));
  diaryForm.addEventListener('change', () => (formDirty = true));
  // Перед перерисовкой страницы (добавление/скрытие фактора) предупреждаем,
  // что несохранённые отметки пропадут.
  const okToLoseChanges = () =>
    !formDirty || confirm('В форме есть несохранённые отметки. Они пропадут. Продолжить?');

  // Выбор дня
  root.querySelector('#day').addEventListener('change', (e) => {
    if (e.target.value) location.hash = `#/diary?day=${e.target.value}`;
  });

  // Сброс настроения
  root.querySelector('#mood-clear').addEventListener('click', () => {
    for (const r of root.querySelectorAll('input[name="mood"]')) r.checked = false;
  });

  // Сохранение записи
  root.querySelector('#diary-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const values = {
      stress: readSlider(root, 'stress'),
      fatigue: readSlider(root, 'fatigue'),
      concentration: readSlider(root, 'concentration'),
      sleepHours: readSlider(root, 'sleepHours'),
      sleepQuality: readSlider(root, 'sleepQuality'),
      mood: form.querySelector('input[name="mood"]:checked')?.value ?? null,
      causes: [...form.querySelectorAll('input[name="causes"]:checked')].map((c) => c.value),
      causeOther: form.causeOther.value,
      note: form.note.value,
      // Отметки скрытых факторов не теряем — берём из прежней записи.
      factors: { ...(entry?.factors || {}) },
    };
    for (const f of factors) {
      if (f.type === 'bool') {
        values.factors[f.id] = form.querySelector(`input[name="factor-${f.id}"]:checked`)?.value ?? '';
      } else {
        values.factors[f.id] = form.querySelector(`#factor-${f.id}`).value;
      }
    }

    // Ответ про стратегию хранится в эксперименте (сохраняем, даже если запись пустая).
    if (experiment) {
      const answer = form.querySelector('input[name="strategy"]:checked')?.value || null;
      if (answer !== (experiment.answers?.[day] || null)) experiment = await setStrategyAnswer(experiment, day, answer);
    }

    const newEntry = buildEntry(day, values, entry, allFactors);
    if (isEntryEmpty(newEntry)) {
      root.querySelector('#status').textContent = 'Ничего не отмечено — отметьте хотя бы одно поле.';
      return;
    }
    await put('diary', newEntry);
    flash = 'Запись сохранена.';

    // Мягкая забота: проверяем серию дней с очень высоким стрессом.
    const care = shouldShowCare(await getAll('diary'), await getSetting('careShownStreakStart', null));
    if (care.show) {
      showCareCard = true;
      await setSetting('careShownStreakStart', care.streakStart); // показываем один раз на серию
    }
    await rerender();
  });

  // Удаление записи за день
  const delBtn = root.querySelector('#delete-entry');
  if (delBtn) {
    delBtn.addEventListener('click', async () => {
      if (!confirm(`Удалить запись за ${formatDay(day)}?`)) return;
      await remove('diary', day);
      flash = 'Запись удалена.';
      await rerender();
    });
  }

  // Добавление своего фактора
  root.querySelector('#factor-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    // (поле называется factorName: имя «name» у формы уже занято)
    const name = e.target.factorName.value.trim();
    const type = e.target.querySelector('input[name="type"]:checked').value;
    const error = validateFactor(name, type, allFactors);
    if (error) {
      root.querySelector('#factor-error').textContent = error;
      return;
    }
    if (!okToLoseChanges()) return;
    await setSetting('customFactors', [...allFactors, { id: makeId(), name, type, hidden: false, createdAt: new Date().toISOString() }]);
    flash = `Фактор «${name}» добавлен.`;
    await rerender();
    document.getElementById('factor-settings').open = true;
  });

  // Скрыть / показать фактор
  for (const btn of root.querySelectorAll('[data-toggle-factor]')) {
    btn.addEventListener('click', async () => {
      if (!okToLoseChanges()) return;
      const updated = allFactors.map((f) => (f.id === btn.dataset.toggleFactor ? { ...f, hidden: !f.hidden } : f));
      await setSetting('customFactors', updated);
      await rerender();
      document.getElementById('factor-settings').open = true;
    });
  }
}

// Поле для одного своего фактора.
function factorInputHtml(f, value) {
  const name = escapeHtml(f.name);
  if (f.type === 'bool') {
    const opt = (val, label, checked) => `
      <label class="radio-card"><input type="radio" name="factor-${f.id}" value="${val}" ${checked ? 'checked' : ''} /><span>${label}</span></label>`;
    return `
      <fieldset>
        <legend>${name}</legend>
        <div class="radio-row">
          ${opt('', 'не отмечено', value === undefined)}
          ${opt('yes', 'да', value === true)}
          ${opt('no', 'нет', value === false)}
        </div>
      </fieldset>`;
  }
  return `
    <label class="field">
      <span>${name} (число)</span>
      <input type="number" id="factor-${f.id}" step="any" inputmode="decimal" value="${value ?? ''}" />
    </label>`;
}

// Карточка мягкой заботы (текст — из src/data/messages.js).
function careCardHtml() {
  return `
    <section class="card card-important" id="care-card" aria-labelledby="care-title">
      <h2 id="care-title">${escapeHtml(CARE_MESSAGE.title)}</h2>
      ${CARE_MESSAGE.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('')}
      <button type="button" class="btn btn-primary" id="care-ok">Понятно</button>
    </section>`;
}

// Вопрос «Выполнили ли сегодня стратегию?» — только пока идёт эксперимент.
function strategyQuestionHtml(e, day, today) {
  const cond = conditionForDay(e, day);
  const answer = e.answers?.[day] || '';
  const when = day === today ? 'сегодня' : 'в этот день';
  return `
    <section class="card card-important" aria-labelledby="h-strategy">
      <h2 id="h-strategy" class="card-title">${icon('FlaskConical', 20)}Эксперимент: ${escapeHtml(e.conditionA)}</h2>
      <p class="hint">По расписанию ${when} — ${cond === 'A' ? 'день со стратегией' : `день ${escapeHtml(e.conditionB)}`}.</p>
      <fieldset>
        <legend>Выполнили ли ${when} стратегию «${escapeHtml(e.conditionA)}»?</legend>
        <div class="radio-row">
          ${STRATEGY_ANSWERS.map((a) => `
            <label class="radio-card"><input type="radio" name="strategy" value="${a.value}" ${answer === a.value ? 'checked' : ''} /><span>${a.label}</span></label>`).join('')}
        </div>
      </fieldset>
      <p class="hint">«Не по плану» — если сделали иначе, чем задумано (например, частично или в другое время).</p>
    </section>`;
}
