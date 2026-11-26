// =====================================================================
// Раздел «Гипотезы»: три вкладки.
//   «Исследую»       — свободный поиск идей (графики и сравнение показателей);
//   «Проверяю»       — гипотезы, зафиксированные заранее;
//   «Самоэксперимент» — случайное чередование условий A и B.
// =====================================================================
import { getAll } from '../db/repo.js';
import { loadAnalysisContext, ensureHypothesisResult, ensureExperimentResult } from '../db/analysisData.js';
import { buildObservations, progress, templateSentence } from '../logic/hypothesis.js';
import { VERDICT_LABELS } from '../logic/permutation.js';
import { conditionForDay, isFinished, lastDay } from '../logic/alternation.js';
import { dayKeyFor } from '../logic/dates.js';
import { EXPLORE_INTRO, CHECK_INTRO } from '../data/hypothesisTexts.js';
import { escapeHtml, formatDateTime } from '../ui/helpers.js';
import { icon, STEP_ICONS } from '../ui/icons.js';
import { mascot } from '../ui/mascot.js';
import { getParam } from '../router.js';

const TABS = [
  ['explore', 'Исследую', 'Search'],
  ['check', 'Проверяю', 'Lock'],
  ['experiment', 'Самоэксперимент', 'Shuffle'],
];

export async function renderHypotheses(root) {
  const tab = TABS.some(([t]) => t === getParam('tab')) ? getParam('tab') : 'check';

  root.innerHTML = `
    <h1>Гипотезы</h1>
    <nav class="tabs" aria-label="Режимы">
      ${TABS.map(([t, label, ic]) => `<a class="tab tab-${t}" href="#/hypotheses?tab=${t}" ${t === tab ? 'aria-current="page"' : ''}>${icon(ic, 18)}${label}</a>`).join('')}
    </nav>
    <div id="tab-content"></div>`;

  const content = root.querySelector('#tab-content');
  if (tab === 'explore') renderExplore(content);
  else if (tab === 'check') await renderCheck(content);
  else await renderExperiments(content);
}

// ----- «Исследую» -----
function renderExplore(el) {
  el.innerHTML = `
    <section class="mode mode-explore" aria-labelledby="h-explore">
      <div class="with-mascot">${mascot('magnifier', { size: 84 })}<div><h2 id="h-explore" style="margin:0">Режим «Исследую»</h2></div></div>
      <p class="notice"><strong>Здесь можно искать идеи для гипотез.</strong> Найденные совпадения — не выводы:
        если перебирать много показателей, случайные «связи» найдутся обязательно.</p>
      <p>${EXPLORE_INTRO}</p>
      <div class="actions">
        <a class="btn btn-primary" href="#/charts">Открыть графики и сравнение показателей</a>
        <a class="btn btn-ghost" href="#/hypotheses?tab=check">Перейти к проверке гипотезы</a>
      </div>
    </section>`;
}

// ----- «Проверяю» -----
async function renderCheck(el) {
  const ctx = await loadAnalysisContext();
  let hypotheses = await getAll('hypotheses');
  // Для гипотез, где уже набралось нужное число дней, итог считается сейчас (один раз).
  hypotheses = await Promise.all(hypotheses.map((h) => ensureHypothesisResult(h, ctx)));
  hypotheses.sort((a, b) => b.lockedAt.localeCompare(a.lockedAt));

  el.innerHTML = `
    <section class="mode mode-check" aria-labelledby="h-check">
      <h2 id="h-check">Режим «Проверяю»</h2>
      <p>${CHECK_INTRO}</p>
      <ol class="steps-inline">
        ${['Вопрос', 'План', 'Фиксация', 'Наблюдение', 'Рассуждение'].map((n, i) => `<li>${icon(STEP_ICONS[i], 16)}${n}</li>`).join('')}
      </ol>
      <div class="actions"><a class="btn btn-primary" href="#/hypotheses/new">${icon('Plus', 18)}Новая гипотеза</a></div>
    </section>

    <h2>Мои гипотезы</h2>
    ${hypotheses.length === 0 ? `<div class="empty-state">${mascot('notebook', { size: 100 })}<p>Гипотез пока нет. Начните с вопроса, который вам интересен.</p></div>` : `
      <ul class="item-list">
        ${hypotheses.map((h) => {
          const factor = ctx.metrics.find((m) => m.key === h.plan.factorKey);
          const outcome = ctx.metrics.find((m) => m.key === h.plan.outcomeKey);
          let status;
          if (h.result) {
            status = `<span class="tag">Итог: ${VERDICT_LABELS[h.result.verdict]}</span>`;
          } else {
            const obs = buildObservations(h.plan, ctx.metrics, ctx.data, h.lockDay, ctx.primaryType);
            const p = progress(obs, h.plan.minDays);
            status = `<span class="tag">Собираются данные: ${p.a} и ${p.b} из ${p.minDays}</span>`;
          }
          return `
            <li class="card">
              <a href="#/hypotheses/view?id=${encodeURIComponent(h.id)}"><strong>${escapeHtml(h.question || templateSentence(h.plan, factor, outcome))}</strong></a>
              <p class="hint">${escapeHtml(templateSentence(h.plan, factor, outcome))}</p>
              <p class="hint">Зафиксирована ${formatDateTime(h.lockedAt)} ${status} ${h.demo ? '<span class="tag">демо</span>' : ''}</p>
            </li>`;
        }).join('')}
      </ul>`}`;
}

// ----- «Самоэксперимент» -----
async function renderExperiments(el) {
  const ctx = await loadAnalysisContext();
  let experiments = await getAll('experiments');
  experiments = await Promise.all(experiments.map((e) => ensureExperimentResult(e, ctx)));
  experiments.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const today = dayKeyFor();

  el.innerHTML = `
    <section class="mode mode-check" aria-labelledby="h-exp">
      <h2 id="h-exp">Самоэксперимент с чередованием</h2>
      <p>Вы задаёте два условия, например «перерыв 10 минут перед тестом» и «без перерыва».
        Сайт случайно распределяет дни между ними и каждый день напоминает, какое условие сегодня.
        В конце дни A и B сравниваются тем же способом, что и в гипотезах.</p>
      <div class="actions"><a class="btn btn-primary" href="#/experiments/new">${icon('Plus', 18)}Новый самоэксперимент</a></div>
    </section>

    <h2>Мои самоэксперименты</h2>
    ${experiments.length === 0 ? `<div class="empty-state">${mascot('notebook', { size: 100 })}<p>Самоэкспериментов пока нет.</p></div>` : `
      <ul class="item-list">
        ${experiments.map((e) => {
          const cond = conditionForDay(e, today);
          let status;
          if (e.result) status = e.result.insufficient ? 'Завершён: данных недостаточно' : `Итог: ${VERDICT_LABELS[e.result.verdict]}`;
          else if (isFinished(e, today)) status = 'Завершён';
          else if (cond) status = `Сегодня — условие ${cond}: ${escapeHtml(cond === 'A' ? e.conditionA : e.conditionB)}`;
          else status = `Начнётся ${e.schedule[0].day.split('-').reverse().join('.')}`;
          return `
            <li class="card">
              <a href="#/experiments/view?id=${encodeURIComponent(e.id)}"><strong>A: ${escapeHtml(e.conditionA)} · B: ${escapeHtml(e.conditionB)}</strong></a>
              <p class="hint">${e.schedule.length} дней, до ${lastDay(e).split('-').reverse().join('.')} · <span class="tag">${status}</span></p>
            </li>`;
        }).join('')}
      </ul>`}`;
}
