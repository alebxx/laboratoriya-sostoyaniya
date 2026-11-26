// =====================================================================
// Новый самоэксперимент с чередованием условий A и B.
// =====================================================================
import { put } from '../db/repo.js';
import { loadAnalysisContext } from '../db/analysisData.js';
import { generateSchedule, scheduleSeed, EXPERIMENT_LIMITS } from '../logic/alternation.js';
import { dayKeyFor, addDays } from '../logic/dates.js';
import { makeId } from '../logic/id.js';
import { WHY_RANDOM } from '../data/hypothesisTexts.js';
import { escapeHtml } from '../ui/helpers.js';
import { getParam } from '../router.js';

export async function renderExperimentNew(root) {
  const ctx = await loadAnalysisContext();
  const outcomes = ctx.metrics.filter((m) => !m.boolean);
  const id = makeId(); // от ID зависит случайное расписание
  const today = dayKeyFor();

  root.innerHTML = `
    <p><a href="#/hypotheses?tab=experiment">← Самоэксперименты</a></p>
    <h1>Новый самоэксперимент</h1>

    <section class="card card-important">
      <h2>Зачем случайное чередование</h2>
      <ul>${WHY_RANDOM.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>
    </section>

    <form id="exp" class="card" novalidate>
      <label class="field">
        <span>Условие A (что делать в дни A)</span>
        <input type="text" id="condA" maxlength="80" value="${escapeHtml(getParam('a') || '')}" placeholder="Например: перерыв 10 минут перед тестом" />
      </label>
      <label class="field">
        <span>Условие B (что делать в дни B)</span>
        <input type="text" id="condB" maxlength="80" value="${escapeHtml(getParam('b') || '')}" placeholder="Например: без перерыва" />
      </label>
      <label class="field">
        <span>Что сравнивать (показатель в тот же день)</span>
        <select id="outcome">
          ${outcomes.map((m) => `<option value="${m.key}" ${m.key === 'stress' ? 'selected' : ''}>${escapeHtml(m.label)}</option>`).join('')}
        </select>
      </label>
      <fieldset>
        <legend>Что вы ожидаете? В дни A показатель будет…</legend>
        <div class="radio-row">
          <label class="radio-card"><input type="radio" name="direction" value="higher" /><span>выше, чем в дни B</span></label>
          <label class="radio-card"><input type="radio" name="direction" value="lower" checked /><span>ниже, чем в дни B</span></label>
        </div>
      </fieldset>
      <label class="field">
        <span>Сколько дней (от ${EXPERIMENT_LIMITS.minDays} до ${EXPERIMENT_LIMITS.maxDays})</span>
        <input type="number" id="days" min="${EXPERIMENT_LIMITS.minDays}" max="${EXPERIMENT_LIMITS.maxDays}" step="1" value="${EXPERIMENT_LIMITS.defaultDays}" />
      </label>
      <fieldset>
        <legend>Начало</legend>
        <div class="radio-row">
          <label class="radio-card"><input type="radio" name="start" value="1" checked /><span>с завтрашнего дня</span></label>
          <label class="radio-card"><input type="radio" name="start" value="0" /><span>с сегодняшнего дня</span></label>
        </div>
      </fieldset>
      <div id="errors" role="alert"></div>
    </form>

    <section class="card" aria-labelledby="h-sched">
      <h2 id="h-sched">Расписание</h2>
      <p class="hint">Составлено случайно. После начала эксперимента его нельзя изменить.</p>
      <div id="schedule"></div>
    </section>

    <div class="actions">
      <a class="btn btn-ghost" href="#/hypotheses?tab=experiment">Отмена</a>
      <button type="button" class="btn btn-primary" id="start">Начать эксперимент</button>
    </div>`;

  const form = root.querySelector('#exp');
  const read = () => {
    const days = Number(form.querySelector('#days').value);
    const startOffset = Number(form.querySelector('input[name="start"]:checked').value);
    return {
      conditionA: form.querySelector('#condA').value.trim(),
      conditionB: form.querySelector('#condB').value.trim(),
      outcomeKey: form.querySelector('#outcome').value,
      direction: form.querySelector('input[name="direction"]:checked').value,
      days,
      startDay: addDays(today, startOffset),
    };
  };
  const validDays = (d) => Number.isInteger(d) && d >= EXPERIMENT_LIMITS.minDays && d <= EXPERIMENT_LIMITS.maxDays;

  const showSchedule = () => {
    const v = read();
    const box = root.querySelector('#schedule');
    if (!validDays(v.days)) {
      box.innerHTML = `<p class="hint">Укажите число дней от ${EXPERIMENT_LIMITS.minDays} до ${EXPERIMENT_LIMITS.maxDays}.</p>`;
      return;
    }
    const schedule = generateSchedule(v.startDay, v.days, scheduleSeed(id));
    box.innerHTML = `<ol class="schedule">${schedule.map((s) => `
      <li class="sched-${s.condition}"><span>${s.day.slice(8, 10)}.${s.day.slice(5, 7)}</span><strong>${s.condition}</strong></li>`).join('')}</ol>`;
  };
  showSchedule();
  form.addEventListener('input', showSchedule);
  form.addEventListener('change', showSchedule);

  root.querySelector('#start').addEventListener('click', async () => {
    const v = read();
    const errors = [];
    if (!v.conditionA || !v.conditionB) errors.push('Опишите оба условия: A и B.');
    if (v.conditionA && v.conditionA === v.conditionB) errors.push('Условия A и B должны различаться.');
    if (!validDays(v.days)) errors.push(`Число дней — от ${EXPERIMENT_LIMITS.minDays} до ${EXPERIMENT_LIMITS.maxDays}.`);
    if (errors.length) {
      root.querySelector('#errors').innerHTML = `<ul class="error">${errors.map((e) => `<li>${escapeHtml(e)}</li>`).join('')}</ul>`;
      return;
    }
    const experiment = {
      id,
      createdAt: new Date().toISOString(),
      conditionA: v.conditionA,
      conditionB: v.conditionB,
      outcomeKey: v.outcomeKey,
      direction: v.direction,
      schedule: generateSchedule(v.startDay, v.days, scheduleSeed(id)),
      followed: {},
      result: null,
    };
    await put('experiments', experiment);
    location.hash = `#/experiments/view?id=${encodeURIComponent(id)}`;
  });
}
