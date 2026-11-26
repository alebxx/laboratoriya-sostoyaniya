// =====================================================================
// Страница пилотного исследования: анкеты «до» и «после», сводка,
// выгрузка данных для исследователя.
// =====================================================================
import { get, put, getAllData, getAllSettings } from '../db/repo.js';
import { dayKeyFor } from '../logic/dates.js';
import { afterAvailableFrom, isAfterDue, pilotSummary, buildResearcherExport, researcherCsvRow } from '../logic/pilot.js';
import { scoreSus, validateSus } from '../logic/sus.js';
import { rowsToCsv } from '../logic/csv.js';
import { FACTORS_QUESTION, FEEDBACK_QUESTIONS, PILOT_INFO } from '../data/pilotTexts.js';
import { SUS_ITEMS, SUS_ENDS, SUS_INSTRUCTION, SUS_SOURCE } from '../data/sus.js';
import { pssFormHtml, setupPssForm } from '../ui/pssForm.js';
import { escapeHtml, formatDateTime, downloadFile, fileDate } from '../ui/helpers.js';
import { getParam, rerender } from '../router.js';

export async function renderPilot(root) {
  const settings = await getAllSettings();
  const pilot = settings.pilot;
  if (!pilot?.enabled) {
    root.innerHTML = `
      <h1>Пилотное исследование</h1>
      <p class="notice">Режим пилотного исследования выключен. Его включают в разделе «Настройки и данные».</p>
      <p><a class="btn" href="#/settings">Открыть настройки</a></p>`;
    return;
  }
  const form = getParam('form');
  if (form === 'before') return renderBefore(root, settings);
  if (form === 'after') return renderAfter(root, settings);
  return renderOverview(root, settings);
}

// ----- Обзор -----
async function renderOverview(root, settings) {
  const pilot = settings.pilot;
  const before = await get('pilot', 'before');
  const after = await get('pilot', 'after');
  const data = await getAllData();
  const summary = pilotSummary(data);
  const today = dayKeyFor();
  const afterFrom = afterAvailableFrom(pilot);
  const afterDue = isAfterDue(pilot, today);

  root.innerHTML = `
    <h1>Пилотное исследование</h1>
    <section class="card">
      <p>Код участника: <strong class="code">${escapeHtml(pilot.code)}</strong></p>
      <p class="hint">Начало: ${formatDateTime(pilot.startedAt)}. Анкета «после» — через ${pilot.afterDays} дней, с ${fmtDay(afterFrom)}.</p>
      <p>${escapeHtml(PILOT_INFO)}</p>
    </section>

    <section class="card" aria-labelledby="h-forms">
      <h2 id="h-forms">Анкеты</h2>
      <ul class="recent-list">
        <li><span>Анкета «до»</span>
          ${before?.completedAt ? `<span class="tag">заполнена ${formatDateTime(before.completedAt)}</span>`
            : '<a class="btn btn-primary" href="#/pilot?form=before">Заполнить</a>'}</li>
        <li><span>Анкета «после»</span>
          ${after?.completedAt ? `<span class="tag">заполнена ${formatDateTime(after.completedAt)}</span>`
            : afterDue ? '<a class="btn btn-primary" href="#/pilot?form=after">Заполнить</a>'
              : `<span class="tag">будет доступна с ${fmtDay(afterFrom)}</span>`}</li>
      </ul>
    </section>

    <section class="card" aria-labelledby="h-summary">
      <h2 id="h-summary">Сводка участия</h2>
      <dl class="plan-list">
        <div><dt>Дней с записями в дневнике</dt><dd>${summary.diaryDays}</dd></div>
        <div><dt>Сеансов теста (завершённых)</dt><dd>${summary.pvtSessions}</dd></div>
        <div><dt>Гипотез создано</dt><dd>${summary.hypothesesCreated}</dd></div>
        <div><dt>Гипотез завершено</dt><dd>${summary.hypothesesCompleted}</dd></div>
        <div><dt>Самоэкспериментов</dt><dd>${summary.experimentsCreated}</dd></div>
      </dl>
    </section>

    <section class="card" aria-labelledby="h-export">
      <h2 id="h-export">Выгрузить данные для исследователя</h2>
      <p>Один файл с кодом участника в названии. Демо-данные в выгрузку не попадают.
        Личные подробности убраны: заметки, «своя причина», тексты вопросов и выводов по гипотезам,
        названия своих факторов (заменены на «фактор 1», «фактор 2»…) и сведения о браузере.</p>
      <div class="actions">
        <button type="button" class="btn btn-primary" id="export-json">Выгрузить данные для исследователя (JSON)</button>
        <button type="button" class="btn" id="export-csv">Краткая строка для таблицы (CSV)</button>
      </div>
      <p class="hint">JSON — все данные пилота. CSV — одна строка: сводка и ответы анкет (удобно собрать строки всех участников в одну таблицу).</p>
      <p role="status" id="export-status" class="hint"></p>
    </section>`;

  const questionnaires = { before: before || null, after: after || null };
  const factors = settings.customFactors || [];

  root.querySelector('#export-json').addEventListener('click', () => {
    const exp = buildResearcherExport({ pilot: settings.pilot, questionnaires, data, factors });
    downloadFile(`pilot-${settings.pilot.code}-${fileDate()}.json`, JSON.stringify(exp, null, 2), 'application/json');
    root.querySelector('#export-status').textContent = 'Файл скачан.';
  });
  root.querySelector('#export-csv').addEventListener('click', () => {
    const row = researcherCsvRow({ pilot: settings.pilot, questionnaires, data: { ...data, pss: data.pss.filter((p) => !p.demo) } });
    downloadFile(`pilot-${settings.pilot.code}-${fileDate()}.csv`, rowsToCsv([row]), 'text/csv;charset=utf-8');
    root.querySelector('#export-status').textContent = 'Файл скачан.';
  });
}

// Вопрос о факторах концентрации (общий для обеих анкет).
function factorsQuestionHtml(value = '') {
  return `
    <section class="card">
      <label class="field">
        <span><strong>${escapeHtml(FACTORS_QUESTION)}</strong></span>
        <textarea id="factors-answer" rows="4" maxlength="1500">${escapeHtml(value)}</textarea>
      </label>
      <p class="hint">Отвечайте своими словами. Можно написать «не знаю».</p>
    </section>`;
}

// ----- Анкета «до»: вопрос о факторах + PSS-10 -----
async function renderBefore(root, settings) {
  const existing = await get('pilot', 'before');
  if (existing?.completedAt) {
    location.hash = '#/pilot';
    return;
  }
  const withPss = Boolean(settings.age13plus);
  root.innerHTML = `
    <p><a href="#/pilot">← Пилотное исследование</a></p>
    <h1>Анкета «до»</h1>
    ${factorsQuestionHtml()}
    ${withPss ? `<h2>Опросник PSS-10</h2>${pssFormHtml()}` : `
      <p class="notice">Опросник PSS-10 доступен с 13 лет, поэтому в анкете его нет.</p>
      <div class="actions"><button type="button" class="btn btn-primary" id="save">Сохранить анкету</button></div>`}`;

  const save = async (pssId) => {
    await put('pilot', {
      id: 'before',
      completedAt: new Date().toISOString(),
      factorsAnswer: root.querySelector('#factors-answer').value.trim(),
      pssId,
    });
    location.hash = '#/pilot';
  };
  if (withPss) setupPssForm(root, { context: 'pilot-before', onSaved: (r) => save(r.id) });
  else root.querySelector('#save').addEventListener('click', () => save(null));
}

// ----- Анкета «после»: шаг 1 — факторы + PSS-10; шаг 2 — SUS + отзыв -----
async function renderAfter(root, settings) {
  const existing = await get('pilot', 'after');
  if (existing?.completedAt) {
    location.hash = '#/pilot';
    return;
  }
  if (!isAfterDue(settings.pilot, dayKeyFor())) {
    root.innerHTML = `<h1>Анкета «после»</h1><p class="notice">Анкета будет доступна с ${fmtDay(afterAvailableFrom(settings.pilot))}.</p><p><a href="#/pilot">← Назад</a></p>`;
    return;
  }
  // Шаг 1 уже пройден — сразу шаг 2.
  if (existing?.step1Done) return renderAfterStep2(root, existing);

  const withPss = Boolean(settings.age13plus);
  root.innerHTML = `
    <p><a href="#/pilot">← Пилотное исследование</a></p>
    <h1>Анкета «после»</h1>
    <p class="step-label">Часть 1 из 2</p>
    ${factorsQuestionHtml()}
    ${withPss ? `<h2>Опросник PSS-10</h2>${pssFormHtml()}` : `
      <p class="notice">Опросник PSS-10 доступен с 13 лет, поэтому в анкете его нет.</p>
      <div class="actions"><button type="button" class="btn btn-primary" id="next">Дальше</button></div>`}`;

  const saveStep1 = async (pssId) => {
    const record = { id: 'after', step1Done: true, factorsAnswer: root.querySelector('#factors-answer').value.trim(), pssId };
    await put('pilot', record);
    await rerender();
  };
  if (withPss) setupPssForm(root, { context: 'pilot-after', onSaved: (r) => saveStep1(r.id) });
  else root.querySelector('#next').addEventListener('click', () => saveStep1(null));
}

function renderAfterStep2(root, record) {
  root.innerHTML = `
    <p><a href="#/pilot">← Пилотное исследование</a></p>
    <h1>Анкета «после»</h1>
    <p class="step-label">Часть 2 из 2</p>
    <form id="sus-form" novalidate>
      <h2>Удобство сайта (SUS)</h2>
      <p>${escapeHtml(SUS_INSTRUCTION)}</p>
      <p class="hint">1 — ${escapeHtml(SUS_ENDS.low)}; 5 — ${escapeHtml(SUS_ENDS.high)}.</p>
      ${SUS_ITEMS.map((text, i) => `
        <fieldset class="card pss-item">
          <legend><span class="pss-num">${i + 1}.</span> ${escapeHtml(text)}</legend>
          <div class="radio-row">
            ${[1, 2, 3, 4, 5].map((v) => `<label class="radio-card"><input type="radio" name="s${i + 1}" value="${v}" /><span>${v}</span></label>`).join('')}
          </div>
        </fieldset>`).join('')}
      <p class="hint">Источник опросника: ${escapeHtml(SUS_SOURCE)}</p>

      <h2>Ваш отзыв</h2>
      ${FEEDBACK_QUESTIONS.map((q, i) => `
        <label class="field">
          <span>${escapeHtml(q.text)}</span>
          <textarea id="fb-${i}" rows="3" maxlength="1500"></textarea>
        </label>`).join('')}
      <div id="sus-errors" role="alert"></div>
      <div class="actions"><button type="submit" class="btn btn-primary">Сохранить анкету</button></div>
    </form>`;

  root.querySelector('#sus-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const answers = SUS_ITEMS.map((_, i) => {
      const v = e.target.querySelector(`input[name="s${i + 1}"]:checked`)?.value;
      return v === undefined ? null : Number(v);
    });
    const error = validateSus(answers);
    if (error) {
      root.querySelector('#sus-errors').innerHTML = `<p class="error">${escapeHtml(error)}</p>`;
      return;
    }
    const feedback = {};
    FEEDBACK_QUESTIONS.forEach((q, i) => {
      feedback[q.key] = root.querySelector(`#fb-${i}`).value.trim();
    });
    await put('pilot', {
      ...record,
      completedAt: new Date().toISOString(),
      sus: { answers, score: scoreSus(answers) },
      feedback,
    });
    location.hash = '#/pilot';
  });
}

function fmtDay(day) {
  return day.split('-').reverse().join('.');
}
