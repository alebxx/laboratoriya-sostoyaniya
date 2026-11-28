// =====================================================================
// Шаг 4 «Используй»: мой набор помощи.
// Завершённые эксперименты с итогом («похоже, помогает / похоже, не помогает /
// пока неясно»), датами и графиком; изменение PSS-10 с начала — без оценок.
// =====================================================================
import { getAll } from '../db/repo.js';
import { loadAnalysisContext, ensureExperimentResult } from '../db/analysisData.js';
import { finishedExperiments, toolkitVerdict, TOOLKIT_LABELS, pssOverallChange } from '../logic/cycle.js';
import { lastDay } from '../logic/alternation.js';
import { dayKeyFor } from '../logic/dates.js';
import { drawDotPlot } from '../ui/dotplot.js';
import { escapeHtml, formatDateTime } from '../ui/helpers.js';
import { icon } from '../ui/icons.js';
import { mascot } from '../ui/mascot.js';

const GROUPS = ['helps', 'unclear', 'not-helps'];

export async function renderToolkit(root) {
  const today = dayKeyFor();
  const ctx = await loadAnalysisContext();
  const experiments = await Promise.all((await getAll('experiments')).map((e) => ensureExperimentResult(e, ctx)));
  const finished = finishedExperiments(experiments, today).filter((e) => e.result);
  const pssChange = pssOverallChange(await getAll('pss'));
  const charts = [];

  const card = (e, i) => {
    const r = e.result;
    const outcome = ctx.metrics.find((m) => m.key === e.outcomeKey);
    return `
      <li class="card strategy-card">
        <h3>${escapeHtml(e.conditionA)}</h3>
        <p><span class="toolkit-label">${TOOLKIT_LABELS[toolkitVerdict(r)]}</span></p>
        <p class="hint">${fmtDay(e.schedule[0].day)} — ${fmtDay(lastDay(e))}, ${e.schedule.length} дней. Сравнивалось: ${escapeHtml((outcome?.label || e.outcomeKey).toLowerCase())}.</p>
        ${r.insufficient
          ? `<p>Данных оказалось мало: дней с записью A — ${r.nA}, B — ${r.nB}. Можно проверить ещё раз.</p>`
          : `<p>Медиана в дни со стратегией — ${fmt(r.medianA)}, в дни без неё — ${fmt(r.medianB)}.</p>
             <div class="chart-box"><canvas id="tk-${i}" role="img"
               aria-label="Точечная диаграмма: ${escapeHtml(outcome?.label || '')} в дни со стратегией и без неё; черта — медиана. Числа — в тексте выше."></canvas></div>`}
        <a href="#/experiments/view?id=${encodeURIComponent(e.id)}">Подробнее об эксперименте</a>
      </li>`;
  };

  root.innerHTML = `
    <h1>Шаг 4. Используй: мой набор помощи</h1>
    <p class="lead">Здесь собраны стратегии, которые вы проверили на себе, и что показали ваши данные.</p>
    <p class="hint">Итог — это совпадение в ваших данных за время эксперимента, а не доказательство.
      Обстоятельства меняются, поэтому стратегию можно проверить ещё раз.</p>

    ${finished.length ? GROUPS.map((g) => {
      const list = finished.filter((e) => toolkitVerdict(e.result) === g);
      if (!list.length) return '';
      return `
        <section aria-labelledby="h-${g}">
          <h2 id="h-${g}">${TOOLKIT_LABELS[g]}</h2>
          <ul class="strategy-list">${list.map((e) => card(e, finished.indexOf(e))).join('')}</ul>
        </section>`;
    }).join('') : `
      <section class="card empty-state">
        ${mascot('notebook', { size: 110 })}
        <h2>Пока здесь пусто</h2>
        <p>Когда закончится первый эксперимент со стратегией, его итог появится здесь.</p>
      </section>`}

    <div class="actions">
      <a class="btn btn-primary" href="#/strategies">${icon('FlaskConical', 18)}Проверить следующую стратегию</a>
    </div>

    <section class="card metric-pss" aria-labelledby="h-pss-change">
      <h2 id="h-pss-change" class="card-title"><span class="metric-badge">${icon('ClipboardCheck', 20)}</span>PSS-10: с начала и сейчас</h2>
      ${pssChange ? `
        <p>${formatDateTime(pssChange.first.completedAt)} → ${formatDateTime(pssChange.last.completedAt)}:</p>
        <ul>
          <li>Общий балл: ${pssChange.first.total} → ${pssChange.last.total} (${changeText(pssChange.total)}).</li>
          <li>Беспомощность: ${pssChange.first.helplessness} → ${pssChange.last.helplessness} (${changeText(pssChange.helplessness)}).</li>
          <li>Самоэффективность: ${pssChange.first.selfEfficacy} → ${pssChange.last.selfEfficacy} (${changeText(pssChange.selfEfficacy)}).</li>
        </ul>
        <p class="hint">Это изменение ваших ответов, а не оценка. Небольшие изменения могут быть случайными.</p>`
        : '<p>Пройдите опросник в начале и через 4 недели — здесь появится изменение.</p><a class="btn" href="#/pss">Открыть PSS-10</a>'}
    </section>`;

  const draw = () => {
    while (charts.length) charts.pop().destroy();
    finished.forEach((e, i) => {
      const canvas = root.querySelector(`#tk-${i}`);
      if (!canvas) return;
      const obs = e.result.observations;
      const outcome = ctx.metrics.find((m) => m.key === e.outcomeKey);
      charts.push(drawDotPlot(canvas, [
        { label: 'Со стратегией', values: obs.filter((o) => o.group === 'A').map((o) => o.outcome), median: e.result.medianA },
        { label: 'Без неё', values: obs.filter((o) => o.group === 'B').map((o) => o.outcome), median: e.result.medianB },
      ], outcome?.label || '', e.outcomeKey));
    });
  };
  draw();
  window.addEventListener('themechange', draw);
  return () => {
    window.removeEventListener('themechange', draw);
    while (charts.length) charts.pop().destroy();
  };
}

// Изменение словами, без оценок «лучше/хуже».
function changeText(diff) {
  if (diff === 0) return 'без изменений';
  const n = Math.abs(diff);
  const m10 = n % 10;
  const m100 = n % 100;
  const word = m10 === 1 && m100 !== 11 ? 'балл' : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? 'балла' : 'баллов';
  return `на ${n} ${word} ${diff > 0 ? 'больше' : 'меньше'}`;
}

function fmt(n) {
  if (n === null || n === undefined) return '—';
  return String(Math.round(n * 100) / 100).replace('.', ',');
}

function fmtDay(day) {
  return day.split('-').reverse().join('.');
}
