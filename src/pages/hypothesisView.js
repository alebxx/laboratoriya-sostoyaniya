// =====================================================================
// Страница гипотезы: шаг 4 (Наблюдение) и шаг 5 (Рассуждение и открытие).
// =====================================================================
import { get, put, remove } from '../db/repo.js';
import { loadAnalysisContext, ensureHypothesisResult } from '../db/analysisData.js';
import {
  buildObservations, progress, templateSentence, conditionText, otherConditionText, differenceSentence,
} from '../logic/hypothesis.js';
import { VERDICT_LABELS, chanceText } from '../logic/permutation.js';
import { median } from '../logic/stats.js';
import { addDays } from '../logic/dates.js';
import { HOW_PERMUTATION, WHY_ONCE, otherInfluences } from '../data/hypothesisTexts.js';
import { drawDotPlot } from '../ui/dotplot.js';
import { escapeHtml, formatDateTime, showStatus } from '../ui/helpers.js';
import { icon, STEP_ICONS } from '../ui/icons.js';
import { mascot, catName } from '../ui/mascot.js';
import { getParam } from '../router.js';

export async function renderHypothesisView(root) {
  const id = getParam('id');
  let hyp = id ? await get('hypotheses', id) : null;
  if (!hyp) {
    root.innerHTML = '<h1>Гипотеза не найдена</h1><p><a href="#/hypotheses?tab=check">К списку гипотез</a></p>';
    return;
  }
  const ctx = await loadAnalysisContext();
  hyp = await ensureHypothesisResult(hyp, ctx); // если пора — итог считается сейчас, один раз
  const factor = ctx.metrics.find((m) => m.key === hyp.plan.factorKey);
  const outcome = ctx.metrics.find((m) => m.key === hyp.plan.outcomeKey);
  const observations = buildObservations(hyp.plan, ctx.metrics, ctx.data, hyp.lockDay, ctx.primaryType);
  const labelA = conditionText(hyp.plan, factor);
  const labelB = otherConditionText(hyp.plan, factor);
  const r = hyp.result;
  let chart = null;

  root.innerHTML = `
    <p><a href="#/hypotheses?tab=check">← Все гипотезы</a></p>
    <h1>Гипотеза</h1>
    <ol class="steps" aria-label="Шаги проверки">
      <li class="is-done">${icon('Check', 16)}1. Вопрос</li><li class="is-done">${icon('Check', 16)}2. План</li><li class="is-done">${icon('Check', 16)}3. Фиксация</li>
      <li class="${r ? 'is-done' : 'is-current'}" ${r ? '' : 'aria-current="step"'}>${icon(r ? 'Check' : STEP_ICONS[3], 16)}4. Наблюдение</li>
      <li class="${r ? 'is-current' : ''}" ${r ? 'aria-current="step"' : ''}>${icon(STEP_ICONS[4], 16)}5. Рассуждение</li>
    </ol>

    <section class="card">
      ${hyp.question ? `<p><strong>Вопрос:</strong> ${escapeHtml(hyp.question)}</p>` : ''}
      <p><strong>Гипотеза:</strong> ${escapeHtml(templateSentence(hyp.plan, factor, outcome))}</p>
      <p class="hint">Зафиксирована ${formatDateTime(hyp.lockedAt)}. Учитываются дни начиная с ${fmtDay(addDays(hyp.lockDay, 1))}.
        Группа A — ${escapeHtml(labelA)}; группа B — ${escapeHtml(labelB)}. Минимум ${hyp.plan.minDays} дней в каждой группе.
        ${hyp.demo ? '<span class="tag">демо</span>' : ''}</p>
    </section>

    ${r ? resultHtml() : observingHtml()}

    <div class="actions">
      <button type="button" class="btn btn-ghost" id="delete">Удалить гипотезу</button>
    </div>`;

  // ----- Шаг 4. Наблюдение -----
  function observingHtml() {
    const p = progress(observations, hyp.plan.minDays);
    const bar = (n, label) => `
      <div class="progress-row">
        <div class="progress-label">${escapeHtml(label)}: собрано <strong>${Math.min(n, p.minDays)} из ${p.minDays}</strong> дней</div>
        <progress max="${p.minDays}" value="${Math.min(n, p.minDays)}" aria-label="${escapeHtml(label)}: ${n} из ${p.minDays}"></progress>
      </div>`;
    return `
      <section class="card" aria-labelledby="h-obs">
        <div class="with-mascot">${mascot('magnifier', { size: 76 })}<div><h2 id="h-obs" style="margin:0">Шаг 4. Наблюдение</h2><p class="hint">${catName()} наблюдает вместе с вами: данные собираются с каждым днём.</p></div></div>
        ${bar(p.a, `A (${labelA})`)}
        ${bar(p.b, `B (${labelB})`)}
        <p class="hint">День учитывается, когда за него есть и фактор, и результат${hyp.plan.lag === 1 ? ' (результат — на следующий день)' : ''}.
          Продолжайте вести дневник${outcome?.source === 'pvt' ? ' и проходить тест' : ''} как обычно.</p>
        <p class="hint">${escapeHtml(WHY_ONCE)}</p>
      </section>`;
  }

  // ----- Шаг 5. Рассуждение и открытие -----
  function resultHtml() {
    const after = observations.filter((o) => o.outcomeDay > r.cutoffDay);
    const afterA = after.filter((o) => o.group === 'A').map((o) => o.outcome);
    const afterB = after.filter((o) => o.group === 'B').map((o) => o.outcome);
    return `
      <section class="card" aria-labelledby="h-res">
        <div class="with-mascot">${mascot('diploma', { size: 80 })}<div><h2 id="h-res" style="margin:0">Шаг 5. Рассуждение</h2><p class="hint">Проверка завершена — какой бы ни был итог, это результат.</p></div></div>
        <p class="hint">Итог посчитан ${formatDateTime(hyp.resultComputedAt)} по дням до ${fmtDay(r.cutoffDay)} включительно и больше не пересчитывается.</p>
        <p class="verdict">${VERDICT_LABELS[r.verdict]}</p>
        <p>${escapeHtml(differenceSentence(r, hyp.plan, factor, outcome))}</p>
        <p>Если бы связи не было, разница такого размера или больше в ожидаемую сторону получалась бы случайно
          <strong>${chanceText(r.pExpected)}</strong>.
          ${r.verdict === 'inconsistent' ? `А разница в обратную сторону — ${chanceText(r.pOpposite)}.` : ''}</p>
        <p class="hint">Это совпадение в ваших данных, а не доказательство причины.</p>

        <div class="table-wrap">
          <table>
            <thead><tr><th scope="col">Группа</th><th scope="col">Дней</th><th scope="col">Медиана</th><th scope="col">Разброс (от Q1 до Q3)</th></tr></thead>
            <tbody>
              <tr><th scope="row">A: ${escapeHtml(labelA)}</th><td>${r.nA}</td><td>${fmt(r.medianA)}</td><td>${fmt(r.iqrA.q1)} – ${fmt(r.iqrA.q3)}</td></tr>
              <tr><th scope="row">B: ${escapeHtml(labelB)}</th><td>${r.nB}</td><td>${fmt(r.medianB)}</td><td>${fmt(r.iqrB.q1)} – ${fmt(r.iqrB.q3)}</td></tr>
            </tbody>
          </table>
        </div>
        <p class="hint">Разброс — межквартильный размах: в этих пределах лежит средняя половина значений группы.</p>

        <div class="chart-box chart-box-tall"><canvas id="dots" role="img"
          aria-label="Точечная диаграмма: значения показателя по дням в группах A и B, черта — медиана"></canvas></div>

        <details class="table-details">
          <summary>Как это посчитано (перестановочный тест)</summary>
          <ul>${HOW_PERMUTATION.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>
          <p class="hint">Перестановок: ${r.permutations}. Граница «редко»: ${String(r.alpha).replace('.', ',')}. Доля для ожидаемого направления: ${fmt(r.pExpected, 4)}, для обратного: ${fmt(r.pOpposite, 4)}.</p>
        </details>
      </section>

      <section class="card card-warning" aria-labelledby="h-other">
        <h2 id="h-other">Что ещё могло повлиять</h2>
        <ul>${otherInfluences({ outcomeIsTest: outcome?.source === 'pvt', factorLabel: labelA }).map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>
      </section>

      <section class="card" aria-labelledby="h-reflect">
        <h2 id="h-reflect">Что я понял(а) и что проверю дальше</h2>
        <label class="field">
          <span class="visually-hidden">Ваши выводы и планы</span>
          <textarea id="reflection" rows="4" maxlength="2000">${escapeHtml(hyp.reflection || '')}</textarea>
        </label>
        <p role="status" id="saved" class="status"></p>
        <div class="actions">
          <button type="button" class="btn" id="save-reflection">Сохранить</button>
          <a class="btn btn-primary" href="#/hypotheses/new?from=${encodeURIComponent(hyp.id)}">Создать новую гипотезу на основе этой</a>
        </div>
      </section>

      ${after.length ? `
        <section class="card" aria-labelledby="h-after">
          <h2 id="h-after">После завершения проверки</h2>
          <p class="hint">Эти дни собраны после итога и <strong>в него не входят</strong>. Их можно смотреть, но выводы по ним — уже не проверка, а наблюдение.</p>
          <p>A: ${afterA.length} дн., медиана ${afterA.length ? fmt(median(afterA)) : '—'} · B: ${afterB.length} дн., медиана ${afterB.length ? fmt(median(afterB)) : '—'}</p>
        </section>` : ''}`;
  }

  // ----- Поведение -----
  if (r) {
    const a = r.observations.filter((o) => o.group === 'A').map((o) => o.outcome);
    const b = r.observations.filter((o) => o.group === 'B').map((o) => o.outcome);
    const draw = () => {
      if (chart) chart.destroy();
      chart = drawDotPlot(root.querySelector('#dots'), [
        { label: `A: ${labelA}`, values: a, median: r.medianA },
        { label: `B: ${labelB}`, values: b, median: r.medianB },
      ], outcome?.label || '', hyp.plan.outcomeKey);
    };
    draw();
    window.addEventListener('themechange', draw);

    root.querySelector('#save-reflection').addEventListener('click', async () => {
      hyp = { ...hyp, reflection: root.querySelector('#reflection').value };
      await put('hypotheses', hyp);
      showStatus(root.querySelector('#saved'), 'Сохранено.');
    });

    root.querySelector('#delete').addEventListener('click', onDelete);
    return () => {
      window.removeEventListener('themechange', draw);
      if (chart) chart.destroy();
    };
  }
  root.querySelector('#delete').addEventListener('click', onDelete);

  async function onDelete() {
    if (!confirm('Удалить эту гипотезу? Это нельзя отменить.')) return;
    await remove('hypotheses', hyp.id);
    location.hash = '#/hypotheses?tab=check';
  }
}

function fmt(n, digits = 2) {
  if (n === null || n === undefined) return '—';
  const k = 10 ** digits;
  return String(Math.round(n * k) / k).replace('.', ',');
}

function fmtDay(day) {
  return day.split('-').reverse().join('.');
}
