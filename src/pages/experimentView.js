// =====================================================================
// Страница самоэксперимента: условие на сегодня, расписание,
// отметки «условие выполнено», итог после последнего дня.
// =====================================================================
import { get, put, remove } from '../db/repo.js';
import { loadAnalysisContext, ensureExperimentResult } from '../db/analysisData.js';
import { conditionForDay, isFinished, lastDay, experimentObservations } from '../logic/alternation.js';
import { VERDICT_LABELS, chanceText } from '../logic/permutation.js';
import { dayKeyFor } from '../logic/dates.js';
import { HOW_PERMUTATION, EXPERIMENT_INFLUENCES } from '../data/hypothesisTexts.js';
import { drawDotPlot } from '../ui/dotplot.js';
import { escapeHtml, formatDateTime } from '../ui/helpers.js';
import { mascot } from '../ui/mascot.js';
import { getParam, rerender } from '../router.js';

export async function renderExperimentView(root) {
  const id = getParam('id');
  let exp = id ? await get('experiments', id) : null;
  if (!exp) {
    root.innerHTML = '<h1>Эксперимент не найден</h1><p><a href="#/hypotheses?tab=experiment">К списку</a></p>';
    return;
  }
  const ctx = await loadAnalysisContext();
  exp = await ensureExperimentResult(exp, ctx);
  const today = dayKeyFor();
  const outcome = ctx.metrics.find((m) => m.key === exp.outcomeKey);
  const todayCond = conditionForDay(exp, today);
  const finished = isFinished(exp, today);
  // Есть ли за день значение показателя (сами значения до конца не показываем).
  const daysWithData = new Set(experimentObservations(exp, ctx.metrics, ctx.data, ctx.primaryType).map((o) => o.day));
  const r = exp.result;
  let chart = null;

  root.innerHTML = `
    <p><a href="#/hypotheses?tab=experiment">← Самоэксперименты</a></p>
    <h1>Самоэксперимент</h1>
    <section class="card">
      <p><strong>A:</strong> ${escapeHtml(exp.conditionA)}<br /><strong>B:</strong> ${escapeHtml(exp.conditionB)}</p>
      <p class="hint">Сравнивается: ${escapeHtml(outcome?.label || exp.outcomeKey)}. Ожидание: в дни A ${exp.direction === 'higher' ? 'выше' : 'ниже'}, чем в дни B.
        ${exp.schedule.length} дней, с ${fmtDay(exp.schedule[0].day)} по ${fmtDay(lastDay(exp))}. Создан ${formatDateTime(exp.createdAt)}.</p>
    </section>

    ${todayCond && !finished ? `
      <section class="card card-important today-condition" aria-live="polite">
        <h2>Сегодня — условие ${todayCond}</h2>
        <p class="big-condition">${escapeHtml(todayCond === 'A' ? exp.conditionA : exp.conditionB)}</p>
      </section>` : ''}

    ${r ? resultHtml() : `
      <p class="hint">Итог будет посчитан один раз, после последнего дня. До этого показывается только,
        есть ли за день данные — без промежуточных результатов.</p>`}

    <section class="card" aria-labelledby="h-sched">
      <h2 id="h-sched">Расписание</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th scope="col">День</th><th scope="col">Условие</th><th scope="col">Данные</th><th scope="col">Условие выполнено?</th></tr></thead>
          <tbody>
            ${exp.schedule.map((s) => {
              const past = s.day <= today;
              const mark = exp.followed?.[s.day];
              return `<tr class="${s.day === today ? 'is-today' : ''}">
                <td>${fmtDay(s.day)}${s.day === today ? ' (сегодня)' : ''}</td>
                <td><strong>${s.condition}</strong></td>
                <td>${daysWithData.has(s.day) ? 'есть' : past ? 'нет' : ''}</td>
                <td>${past && !r ? `
                  <div class="choice-row compact" role="group" aria-label="Условие ${fmtDay(s.day)} выполнено?">
                    <button type="button" class="btn btn-choice btn-small" data-day="${s.day}" data-val="yes" aria-pressed="${mark === true}">да</button>
                    <button type="button" class="btn btn-choice btn-small" data-day="${s.day}" data-val="no" aria-pressed="${mark === false}">нет</button>
                  </div>` : mark === true ? 'да' : mark === false ? 'нет' : ''}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </section>

    <div class="actions">
      <button type="button" class="btn btn-ghost" id="delete">Удалить эксперимент</button>
    </div>`;

  function resultHtml() {
    if (r.insufficient) {
      return `
        <section class="card">
          <h2>Итог</h2>
          <p class="verdict">Данных недостаточно</p>
          <p>Дней с данными: A — ${r.nA}, B — ${r.nB}. Нужно хотя бы по 3 дня в каждой группе.</p>
        </section>`;
    }
    const diffWord = r.diff > 0 ? 'выше' : r.diff < 0 ? 'ниже' : 'такая же';
    return `
      <section class="card" aria-labelledby="h-res">
        <div class="with-mascot">${mascot('diploma', { size: 80 })}<div><h2 id="h-res" style="margin:0">Итог</h2></div></div>
        <p class="hint">Посчитан ${formatDateTime(exp.resultComputedAt)} и больше не пересчитывается.</p>
        <p class="verdict">${VERDICT_LABELS[r.verdict]}</p>
        <p>В дни A медиана показателя «${escapeHtml((outcome?.name || outcome?.label || '').toLowerCase())}» была ${diffWord}${r.diff !== 0 ? ` на ${fmt(Math.abs(r.diff))}` : ''}:
          ${fmt(r.medianA)} против ${fmt(r.medianB)} в дни B.</p>
        <p>Если бы условие не имело значения, такая разница или больше в ожидаемую сторону получалась бы случайно <strong>${chanceText(r.pExpected)}</strong>.</p>
        ${r.notFollowed ? `<p class="hint">Дней, когда условие не удалось выполнить: ${r.notFollowed}. Дни всё равно сравниваются по расписанию.</p>` : ''}
        <div class="table-wrap">
          <table>
            <thead><tr><th scope="col">Условие</th><th scope="col">Дней</th><th scope="col">Медиана</th><th scope="col">Разброс (Q1–Q3)</th></tr></thead>
            <tbody>
              <tr><th scope="row">A: ${escapeHtml(exp.conditionA)}</th><td>${r.nA}</td><td>${fmt(r.medianA)}</td><td>${fmt(r.iqrA.q1)} – ${fmt(r.iqrA.q3)}</td></tr>
              <tr><th scope="row">B: ${escapeHtml(exp.conditionB)}</th><td>${r.nB}</td><td>${fmt(r.medianB)}</td><td>${fmt(r.iqrB.q1)} – ${fmt(r.iqrB.q3)}</td></tr>
            </tbody>
          </table>
        </div>
        <div class="chart-box chart-box-tall"><canvas id="dots" role="img" aria-label="Точечная диаграмма: дни A и B, черта — медиана"></canvas></div>
        <details class="table-details">
          <summary>Как это посчитано</summary>
          <ul>${HOW_PERMUTATION.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>
        </details>
      </section>
      <section class="card card-warning">
        <h2>Что ещё могло повлиять</h2>
        <ul>${EXPERIMENT_INFLUENCES.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>
      </section>`;
  }

  // Отметки «условие выполнено».
  for (const btn of root.querySelectorAll('[data-day]')) {
    btn.addEventListener('click', async () => {
      const followed = { ...(exp.followed || {}), [btn.dataset.day]: btn.dataset.val === 'yes' };
      exp = { ...exp, followed };
      await put('experiments', exp);
      await rerender();
    });
  }

  root.querySelector('#delete').addEventListener('click', async () => {
    if (!confirm('Удалить этот эксперимент? Это нельзя отменить.')) return;
    await remove('experiments', exp.id);
    location.hash = '#/hypotheses?tab=experiment';
  });

  if (r && !r.insufficient) {
    const a = r.observations.filter((o) => o.group === 'A').map((o) => o.outcome);
    const b = r.observations.filter((o) => o.group === 'B').map((o) => o.outcome);
    const draw = () => {
      if (chart) chart.destroy();
      chart = drawDotPlot(root.querySelector('#dots'), [
        { label: `A: ${exp.conditionA}`, values: a, median: r.medianA },
        { label: `B: ${exp.conditionB}`, values: b, median: r.medianB },
      ], outcome?.label || '', exp.outcomeKey);
    };
    draw();
    window.addEventListener('themechange', draw);
    return () => {
      window.removeEventListener('themechange', draw);
      if (chart) chart.destroy();
    };
  }
}

function fmt(n) {
  if (n === null || n === undefined) return '—';
  return String(Math.round(n * 100) / 100).replace('.', ',');
}

function fmtDay(day) {
  return day.split('-').reverse().join('.');
}
