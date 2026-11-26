// =====================================================================
// Мастер новой гипотезы: шаги 1–3 (Вопрос → План → Фиксация).
// Шаги 4–5 (Наблюдение, Рассуждение) — на странице гипотезы.
// =====================================================================
import { get, put } from '../db/repo.js';
import { loadAnalysisContext } from '../db/analysisData.js';
import { createHypothesis, validatePlan, templateSentence, conditionText, otherConditionText } from '../logic/hypothesis.js';
import { dailyValues } from '../logic/series.js';
import { median } from '../logic/stats.js';
import { makeId } from '../logic/id.js';
import { ANALYSIS } from '../config.js';
import { WHY_LOCK, WHY_ONCE } from '../data/hypothesisTexts.js';
import { escapeHtml } from '../ui/helpers.js';
import { getParam } from '../router.js';

const SOURCE_GROUPS = [
  ['diary', 'Дневник'],
  ['factor', 'Мои факторы'],
  ['cause', 'Причины стресса'],
  ['pvt', 'Тест внимания'],
  ['physio', 'Пульс и давление'],
  ['pss', 'PSS-10'],
];

export async function renderHypothesisNew(root) {
  const ctx = await loadAnalysisContext();
  const { metrics } = ctx;

  // Ответы мастера. Если гипотеза создаётся «на основе» другой — берём её план.
  const parentId = getParam('from');
  const parent = parentId ? await get('hypotheses', parentId) : null;
  const w = {
    step: 1,
    question: parent ? parent.question : '',
    plan: parent
      ? { ...parent.plan }
      : { factorKey: 'sleepHours', factorKind: 'threshold', threshold: 7, side: 'below', outcomeKey: 'pvtMedian', direction: 'higher', lag: 0, minDays: ANALYSIS.minDaysPerGroup },
  };

  const metric = (key) => metrics.find((m) => m.key === key);
  draw();

  function draw() {
    if (w.step === 1) step1();
    else if (w.step === 2) step2();
    else step3();
    const h1 = root.querySelector('h1');
    h1.setAttribute('tabindex', '-1');
    h1.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  function stepsHtml() {
    const names = ['Вопрос', 'План', 'Фиксация', 'Наблюдение', 'Рассуждение'];
    return `<ol class="steps" aria-label="Шаги проверки">
      ${names.map((n, i) => `<li class="${i + 1 === w.step ? 'is-current' : i + 1 < w.step ? 'is-done' : ''}" ${i + 1 === w.step ? 'aria-current="step"' : ''}>${i + 1}. ${n}</li>`).join('')}
    </ol>`;
  }

  // ----- Шаг 1. Вопрос -----
  function step1() {
    root.innerHTML = `
      <h1>Новая гипотеза</h1>
      ${stepsHtml()}
      ${parent ? `<p class="notice">Новая гипотеза на основе прежней. Вопрос и план скопированы — их можно изменить до фиксации.</p>` : ''}
      <section class="card">
        <h2>Шаг 1. Что вы хотите узнать?</h2>
        <label class="field">
          <span>Ваш вопрос своими словами</span>
          <textarea id="question" rows="3" maxlength="300" placeholder="Например: связана ли моя реакция с тем, сколько я сплю?">${escapeHtml(w.question)}</textarea>
        </label>
        <p class="hint">На следующем шаге вопрос превратится в проверяемую гипотезу по шаблону:
          <em>«Когда [условие], мой [показатель] [выше/ниже], чем обычно»</em>.</p>
      </section>
      <div class="actions">
        <a class="btn btn-ghost" href="#/hypotheses?tab=check">Отмена</a>
        <button type="button" class="btn btn-primary" id="next">Дальше: план</button>
      </div>`;
    root.querySelector('#next').addEventListener('click', () => {
      w.question = root.querySelector('#question').value.trim();
      w.step = 2;
      draw();
    });
  }

  // ----- Шаг 2. План -----
  function step2() {
    const factor = metric(w.plan.factorKey);
    const isBool = factor?.boolean;
    w.plan.factorKind = isBool ? 'boolean' : 'threshold';
    const factorValues = factor ? dailyValues(factor, ctx.data, { primaryType: ctx.primaryType }).points.map((p) => p.value) : [];
    const factorMedian = factorValues.length ? median(factorValues) : null;

    root.innerHTML = `
      <h1>Новая гипотеза</h1>
      ${stepsHtml()}
      <form id="plan" class="card" novalidate>
        <h2>Шаг 2. План проверки</h2>

        ${metricSelect('factor', 'Фактор — по чему делить дни', w.plan.factorKey, metrics)}

        ${isBool ? `
          <p class="hint">Дни разделятся на две группы: <strong>«${escapeHtml(conditionText(w.plan, factor))}»</strong> и <strong>«${escapeHtml(otherConditionText(w.plan, factor))}»</strong>.</p>` : `
          <label class="field">
            <span>Порог (число)</span>
            <input type="number" id="threshold" step="any" inputmode="decimal" value="${w.plan.threshold ?? ''}" />
          </label>
          ${factorMedian !== null ? `<p class="hint">Подсказка: медиана ваших значений этого фактора — ${String(Math.round(factorMedian * 100) / 100).replace('.', ',')}. Порог около медианы делит дни примерно пополам.</p>` : ''}
          <fieldset>
            <legend>Какие дни считать «условием» (группа A)?</legend>
            <div class="radio-row">
              <label class="radio-card"><input type="radio" name="side" value="below" ${w.plan.side === 'below' ? 'checked' : ''} /><span>меньше порога</span></label>
              <label class="radio-card"><input type="radio" name="side" value="atLeast" ${w.plan.side === 'atLeast' ? 'checked' : ''} /><span>не меньше порога</span></label>
            </div>
          </fieldset>`}

        ${metricSelect('outcome', 'Показатель-результат — что сравнивать', w.plan.outcomeKey, metrics.filter((m) => !m.boolean))}

        <fieldset>
          <legend>Что вы ожидаете? В группе A результат будет…</legend>
          <div class="radio-row">
            <label class="radio-card"><input type="radio" name="direction" value="higher" ${w.plan.direction === 'higher' ? 'checked' : ''} /><span>выше, чем в остальные дни</span></label>
            <label class="radio-card"><input type="radio" name="direction" value="lower" ${w.plan.direction === 'lower' ? 'checked' : ''} /><span>ниже, чем в остальные дни</span></label>
          </div>
        </fieldset>

        <fieldset>
          <legend>Сдвиг во времени</legend>
          <div class="radio-row">
            <label class="radio-card"><input type="radio" name="lag" value="0" ${w.plan.lag === 0 ? 'checked' : ''} /><span>тот же день</span></label>
            <label class="radio-card"><input type="radio" name="lag" value="1" ${w.plan.lag === 1 ? 'checked' : ''} /><span>следующий день</span></label>
          </div>
          <p class="hint">«Тот же день»: фактор и результат из одного дня. Например, сон прошлой ночью (он записан в дневнике сегодня) и тест сегодня.
            «Следующий день»: фактор сегодня — результат завтра. Например, кофе вечером и тест на следующий день.</p>
        </fieldset>

        <label class="field">
          <span>Минимум дней в каждой группе</span>
          <input type="number" id="minDays" min="5" max="60" step="1" value="${w.plan.minDays}" />
        </label>
        <p class="hint">Итог будет посчитан, когда в обеих группах наберётся столько дней. Больше дней — надёжнее, но дольше ждать.</p>

        <div class="card card-important">
          <p><strong>Гипотеза:</strong> <span id="sentence"></span></p>
        </div>
        <div id="errors" role="alert"></div>
      </form>
      <div class="actions">
        <button type="button" class="btn btn-ghost" id="back">Назад</button>
        <button type="button" class="btn btn-primary" id="next">Дальше: фиксация</button>
      </div>`;

    const form = root.querySelector('#plan');
    const read = () => {
      w.plan.factorKey = form.querySelector('#factor').value;
      w.plan.outcomeKey = form.querySelector('#outcome').value;
      const thr = form.querySelector('#threshold');
      if (thr) w.plan.threshold = thr.value === '' ? NaN : Number(thr.value);
      w.plan.side = form.querySelector('input[name="side"]:checked')?.value || w.plan.side;
      w.plan.direction = form.querySelector('input[name="direction"]:checked')?.value;
      w.plan.lag = Number(form.querySelector('input[name="lag"]:checked')?.value ?? 0);
      w.plan.minDays = Number(form.querySelector('#minDays').value);
    };
    const updateSentence = () => {
      read();
      form.querySelector('#sentence').textContent = templateSentence(w.plan, metric(w.plan.factorKey), metric(w.plan.outcomeKey));
    };
    updateSentence();
    form.addEventListener('input', updateSentence);
    form.addEventListener('change', updateSentence);
    // При смене фактора форма перерисовывается (у «да/нет» нет порога).
    form.querySelector('#factor').addEventListener('change', () => {
      read();
      const f = metric(w.plan.factorKey);
      if (!f?.boolean && !Number.isFinite(w.plan.threshold)) w.plan.threshold = null;
      step2();
    });

    root.querySelector('#back').addEventListener('click', () => { read(); w.step = 1; draw(); });
    root.querySelector('#next').addEventListener('click', () => {
      read();
      const errors = validatePlan(w.plan, metrics);
      if (errors.length) {
        root.querySelector('#errors').innerHTML = `<ul class="error">${errors.map((e) => `<li>${escapeHtml(e)}</li>`).join('')}</ul>`;
        return;
      }
      w.step = 3;
      draw();
    });
  }

  // ----- Шаг 3. Фиксация -----
  function step3() {
    const factor = metric(w.plan.factorKey);
    const outcome = metric(w.plan.outcomeKey);
    root.innerHTML = `
      <h1>Новая гипотеза</h1>
      ${stepsHtml()}
      <section class="card">
        <h2>Шаг 3. Фиксация</h2>
        ${w.question ? `<p><strong>Вопрос:</strong> ${escapeHtml(w.question)}</p>` : ''}
        <p><strong>Гипотеза:</strong> ${escapeHtml(templateSentence(w.plan, factor, outcome))}</p>
        <dl class="plan-list">
          <div><dt>Группа A</dt><dd>${escapeHtml(conditionText(w.plan, factor))}</dd></div>
          <div><dt>Группа B</dt><dd>${escapeHtml(otherConditionText(w.plan, factor))}</dd></div>
          <div><dt>Результат</dt><dd>${escapeHtml(outcome.label)}</dd></div>
          <div><dt>Ожидание</dt><dd>в группе A ${w.plan.direction === 'higher' ? 'выше' : 'ниже'}</dd></div>
          <div><dt>Сдвиг</dt><dd>${w.plan.lag === 1 ? 'результат на следующий день' : 'тот же день'}</dd></div>
          <div><dt>Минимум дней в группе</dt><dd>${w.plan.minDays}</dd></div>
        </dl>
      </section>
      <section class="card card-important">
        <h2>Зачем фиксировать</h2>
        <ul>${WHY_LOCK.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>
        <p>${escapeHtml(WHY_ONCE)}</p>
        <label class="check-row">
          <input type="checkbox" id="agree" />
          <span>Понимаю: после фиксации гипотезу и план изменить нельзя.</span>
        </label>
      </section>
      <div class="actions">
        <button type="button" class="btn btn-ghost" id="back">Назад</button>
        <button type="button" class="btn btn-primary" id="lock" disabled>Зафиксировать гипотезу</button>
      </div>`;
    const lockBtn = root.querySelector('#lock');
    root.querySelector('#agree').addEventListener('change', (e) => { lockBtn.disabled = !e.target.checked; });
    root.querySelector('#back').addEventListener('click', () => { w.step = 2; draw(); });
    lockBtn.addEventListener('click', async () => {
      const hyp = createHypothesis({ id: makeId(), question: w.question, plan: w.plan, parentId: parent ? parent.id : null });
      await put('hypotheses', hyp);
      location.hash = `#/hypotheses/view?id=${encodeURIComponent(hyp.id)}`;
    });
  }
}

// Выпадающий список показателей, сгруппированных по разделам.
function metricSelect(id, label, selected, metrics) {
  return `
    <label class="field">
      <span>${label}</span>
      <select id="${id}">
        ${SOURCE_GROUPS.map(([src, name]) => {
          const items = metrics.filter((m) => m.source === src);
          if (!items.length) return '';
          return `<optgroup label="${name}">${items.map((m) => `<option value="${m.key}" ${m.key === selected ? 'selected' : ''}>${escapeHtml(m.label)}</option>`).join('')}</optgroup>`;
        }).join('')}
      </select>
    </label>`;
}
