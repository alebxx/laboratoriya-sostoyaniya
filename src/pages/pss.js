// =====================================================================
// Страница «PSS-10» (Шкала воспринимаемого стресса).
// Доступна с 13 лет, проходится не чаще раза в месяц.
// Все прохождения хранятся и показываются на графике.
// Без порогов «норма / стресс»: показываются только баллы и изменение.
// =====================================================================
import { getAll, getSetting } from '../db/repo.js';
import { PSS_DESCRIPTION } from '../data/pss10.js';
import { Chart, themeColors, axis, baseOptions, shortDay } from '../ui/charts.js';
import { escapeHtml } from '../ui/helpers.js';
import { rerender } from '../router.js';
import { MIN_AGE, PSS } from '../config.js';
import { canTake, changeFromPrevious, scoreRanges } from '../logic/pss.js';
import { dayKeyFor } from '../logic/dates.js';
import { pssFormHtml, setupPssForm } from '../ui/pssForm.js';
import { formatDateTime } from '../ui/helpers.js';
import { icon } from '../ui/icons.js';

const NOT_DIAGNOSIS = `Это не диагноз и не медицинская оценка:
балл нельзя перевести в «есть стресс / нет стресса», и сайт не сравнивает его с нормами
или с результатами других людей. Имеет смысл только сравнение ваших собственных результатов во времени.`;

export async function renderPss(root) {
  const age13plus = await getSetting('age13plus', false);
  if (!age13plus) {
    root.innerHTML = `
      <h1>PSS-10</h1>
      <p class="notice">Опросник PSS-10 доступен пользователям ${MIN_AGE} лет и старше.
        Если вы ответили на вопрос о возрасте по ошибке, это можно изменить в разделе «Настройки и данные».</p>
      <p><a href="#/">На главную</a></p>`;
    return;
  }

  const results = (await getAll('pss')).sort((a, b) => a.completedAt.localeCompare(b.completedAt));
  const status = canTake(results, dayKeyFor());

  root.innerHTML = `
    <h1 class="card-title metric-pss" style="font-size:1.85rem"><span class="metric-badge">${icon('ClipboardCheck', 22)}</span>PSS-10: шкала воспринимаемого стресса</h1>
    <section class="card"><p>${escapeHtml(PSS_DESCRIPTION)}</p></section>
    <section class="card card-important"><p>${NOT_DIAGNOSIS}</p></section>
    <div id="pss-area"></div>
    ${historyHtml(results)}`;
  const stopChart = drawHistory(root, results);

  const area = root.querySelector('#pss-area');
  if (status.allowed) {
    area.innerHTML = `
      <p class="hint">Опросник можно проходить не чаще раза в месяц: вопросы относятся к последнему месяцу. Все ваши прохождения сохраняются и видны на графике ниже.</p>
      ${pssFormHtml()}`;
    setupPssForm(area, {
      context: 'regular',
      onSaved: (result) => { stopChart(); showResult(root, [...results, result], result); },
    });
  } else {
    area.innerHTML = `
      <p class="notice">Вы уже проходили опросник ${formatDateTime(results.filter((r) => !r.demo).at(-1).completedAt)}.
        Следующий раз — с ${status.nextDay.split('-').reverse().join('.')}: опросник можно проходить не чаще раза в месяц.</p>`;
  }
  return stopChart;
}

// Результат только что пройденного опросника.
function showResult(root, allResults, result) {
  const ranges = scoreRanges(result.scale);
  const change = changeFromPrevious(allResults, result);
  root.innerHTML = `
    <h1>Результат PSS-10</h1>
    <section class="card">
      <dl class="metrics">
        <div><dt>Общий балл</dt><dd>${result.total}</dd>
          <p class="hint">Возможный диапазон: от ${ranges.total.min} до ${ranges.total.max}.</p></div>
        <div><dt>Подшкала «беспомощность»</dt><dd>${result.helplessness}</dd>
          <p class="hint">Пункты 1, 2, 3, 6, 9, 10; диапазон ${ranges.helplessness.min}–${ranges.helplessness.max}.</p></div>
        <div><dt>Подшкала «самоэффективность»</dt><dd>${result.selfEfficacy}</dd>
          <p class="hint">Пункты 4, 5, 7, 8 (после переворота); диапазон ${ranges.selfEfficacy.min}–${ranges.selfEfficacy.max}.</p></div>
      </dl>
    </section>
    ${change ? `
      <section class="card">
        <h2>По сравнению с прошлым разом (${formatDateTime(change.previous.completedAt)})</h2>
        <ul>
          <li>Общий балл: ${changeText(change.total)}.</li>
          <li>Беспомощность: ${changeText(change.helplessness)}.</li>
          <li>Самоэффективность: ${changeText(change.selfEfficacy)}.</li>
        </ul>
        <p class="hint">Небольшие изменения могут быть случайными: ответы зависят от настроения в момент заполнения.</p>
      </section>` : '<p class="hint">Это ваш первый результат — сравнивать пока не с чем.</p>'}
    <p class="hint">${NOT_DIAGNOSIS}</p>
    <div class="actions">
      <button type="button" class="btn btn-primary" id="show-history">Все результаты и график</button>
      <a class="btn" href="#/">На главную</a>
    </div>`;
  // Адрес страницы тот же (#/pss), поэтому перерисовываем её сами.
  root.querySelector('#show-history').addEventListener('click', () => rerender());
  const h1 = root.querySelector('h1');
  h1.setAttribute('tabindex', '-1');
  h1.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

// Изменение словами, без оценок «лучше/хуже».
function changeText(diff) {
  if (diff === 0) return 'без изменений';
  const n = Math.abs(diff);
  return `на ${n} ${plural(n)} ${diff > 0 ? 'больше' : 'меньше'}`;
}

function plural(n) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'балл';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'балла';
  return 'баллов';
}

function historyHtml(results) {
  if (results.length === 0) return '';
  return `
    <section aria-labelledby="h-pss-history">
      <h2 id="h-pss-history">Ваши результаты</h2>
      <div class="chart-box metric-pss"><canvas id="pss-chart" role="img"
        aria-label="График: общий балл PSS-10 и подшкалы по датам прохождения. Те же числа — в списке ниже."></canvas></div>
      <p class="hint" id="pss-chart-note"></p>
      <ul class="recent-list">
        ${[...results].reverse().map((r) => `
          <li><span>${formatDateTime(r.completedAt)}</span>
            <span>общий балл ${r.total} · беспомощность ${r.helplessness} · самоэффективность ${r.selfEfficacy}
              ${r.context && r.context !== 'regular' ? '<span class="tag">пилот</span>' : ''}${r.demo ? '<span class="tag">демо</span>' : ''}</span></li>`).join('')}
      </ul>
    </section>`;
}

// График всех прохождений: общий балл и две подшкалы.
// На одном графике — только результаты с текущей шкалой ответов
// (баллы шкал 0–4 и 1–5 нельзя сравнивать напрямую).
function drawHistory(root, results) {
  const canvas = root.querySelector('#pss-chart');
  if (!canvas) return () => {};
  const scale = PSS.scale;
  const shown = results.filter((r) => r.scale === scale);
  const hidden = results.length - shown.length;
  root.querySelector('#pss-chart-note').textContent = [
    shown.length === 1 ? 'Пока одно прохождение — линия появится со второго.' : '',
    hidden ? `Не показано прохождений со старой шкалой ответов: ${hidden} (они есть в списке).` : '',
  ].filter(Boolean).join(' ');
  let chart = null;
  const draw = () => {
    if (chart) chart.destroy();
    const c = themeColors();
    const css = getComputedStyle(canvas.parentElement);
    const color = css.getPropertyValue('--m').trim() || c.accent;
    const ranges = scoreRanges(scale);
    const labels = shown.map((r) => shortDay(r.day));
    const line = (label, field, dash) => ({
      label, data: shown.map((r) => r[field]), borderColor: color, backgroundColor: color,
      borderWidth: c.line, borderDash: dash, pointRadius: 4, pointStyle: dash ? 'rectRot' : 'circle', tension: 0,
    });
    const options = baseOptions(c);
    options.scales = {
      x: axis(c, 'Дата прохождения'),
      y: axis(c, 'Баллы', { min: 0, max: ranges.total.max }),
    };
    chart = new Chart(canvas, {
      type: 'line',
      data: { labels, datasets: [
        line('Общий балл', 'total'),
        line('Беспомощность', 'helplessness', [6, 4]),
        line('Самоэффективность', 'selfEfficacy', [2, 3]),
      ] },
      options,
    });
  };
  draw();
  window.addEventListener('themechange', draw);
  return () => {
    window.removeEventListener('themechange', draw);
    if (chart) chart.destroy();
  };
}

