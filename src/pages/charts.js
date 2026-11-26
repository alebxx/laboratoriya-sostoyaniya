// =====================================================================
// Страница «Карта состояния»: графики показателей во времени
// и сравнение двух показателей.
// Подписи нейтральные: графики показывают изменения, но не оценивают их.
// =====================================================================
import { getAll, getAllSettings } from '../db/repo.js';
import { ANALYSIS } from '../config.js';
import { dayKeyFor } from '../logic/dates.js';
import { allMetrics, dailyValues, periodRange, listDays, inPeriod, pairByDay } from '../logic/series.js';
import { EXCLUSION_LABELS } from '../logic/sessionFilter.js';
import { Chart, themeColors, shortDay, axis, baseOptions } from '../ui/charts.js';
import { escapeHtml } from '../ui/helpers.js';

// Выбор пользователя сохраняется, пока открыта вкладка.
const state = {
  period: 'month',
  showExcluded: true,
  includeOtherDevices: false,
  compareA: 'stress',
  compareB: 'pvtMedian',
  compareView: 'overlay',
};

const PERIODS = [
  ['week', 'Неделя'],
  ['month', 'Месяц'],
  ['all', 'Всё время'],
];

const REASON_LABELS = { ...EXCLUSION_LABELS, notFirst: 'не первый сеанс за день' };

// Текст-предупреждение о случайных «связях» (режим «Исследую»).
export const EXPLORE_NOTE = `Здесь можно искать идеи для гипотез. Найденные совпадения — не выводы:
если перебирать много показателей, случайные «связи» найдутся обязательно.`;

export async function renderCharts(root) {
  const [diary, pvtSessions, physio, pss, settings] = await Promise.all([
    getAll('diary'), getAll('pvtSessions'), getAll('physio'), getAll('pss'), getAllSettings(),
  ]);
  const data = { diary, pvtSessions, physio, pss };
  const primaryType = settings.primaryDevice?.type || null;
  const metrics = allMetrics(settings.customFactors || []);
  const today = dayKeyFor();
  const allDays = [...diary, ...pvtSessions, ...physio, ...pss].map((r) => r.day).filter(Boolean).sort();
  const firstDataDay = allDays[0] || today;

  let charts = []; // созданные графики — чтобы удалить их при перерисовке

  root.innerHTML = `
    <h1>Карта состояния</h1>
    <p class="lead">Как менялись ваши показатели во времени. Графики ничего не оценивают — они только показывают значения.</p>

    <section class="card controls" aria-label="Настройки графиков">
      <fieldset>
        <legend>Период</legend>
        <div class="radio-row">
          ${PERIODS.map(([v, l]) => `
            <label class="radio-card"><input type="radio" name="period" value="${v}" ${state.period === v ? 'checked' : ''} /><span>${l}</span></label>`).join('')}
        </div>
      </fieldset>
      <label class="check-row">
        <input type="checkbox" id="show-excluded" ${state.showExcluded ? 'checked' : ''} />
        <span>Показывать исключённые сеансы теста (тренировочные, незавершённые, с другого устройства, повторные за день) — серыми ромбами</span>
      </label>
      <label class="check-row">
        <input type="checkbox" id="all-devices" ${state.includeOtherDevices ? 'checked' : ''} />
        <span>Учитывать сеансы теста со всех устройств (по умолчанию — только с основного)</span>
      </label>
    </section>

    <div id="charts-area"></div>

    <section aria-labelledby="h-compare">
      <h2 id="h-compare">Сравнить два показателя</h2>
      <p class="notice">${EXPLORE_NOTE}</p>
      <div class="card">
        <div class="compare-selects">
          ${selectHtml('compare-a', 'Показатель A', metrics, state.compareA)}
          ${selectHtml('compare-b', 'Показатель B', metrics, state.compareB)}
        </div>
        <fieldset>
          <legend>Как показать</legend>
          <div class="radio-row">
            <label class="radio-card"><input type="radio" name="view" value="overlay" ${state.compareView === 'overlay' ? 'checked' : ''} /><span>На одном графике по дням</span></label>
            <label class="radio-card"><input type="radio" name="view" value="scatter" ${state.compareView === 'scatter' ? 'checked' : ''} /><span>Рассеяние: A против B</span></label>
          </div>
        </fieldset>
        <div id="compare-area"></div>
      </div>
    </section>`;

  // ----- Управление -----
  for (const r of root.querySelectorAll('input[name="period"]')) {
    r.addEventListener('change', () => { state.period = r.value; drawAll(); });
  }
  root.querySelector('#show-excluded').addEventListener('change', (e) => { state.showExcluded = e.target.checked; drawAll(); });
  root.querySelector('#all-devices').addEventListener('change', (e) => { state.includeOtherDevices = e.target.checked; drawAll(); });
  root.querySelector('#compare-a').addEventListener('change', (e) => { state.compareA = e.target.value; drawAll(); });
  root.querySelector('#compare-b').addEventListener('change', (e) => { state.compareB = e.target.value; drawAll(); });
  for (const r of root.querySelectorAll('input[name="view"]')) {
    r.addEventListener('change', () => { state.compareView = r.value; drawAll(); });
  }

  drawAll();
  // Сменили тему — перерисовываем графики новыми цветами.
  window.addEventListener('themechange', drawAll);

  // При уходе со страницы удаляем графики.
  return () => {
    window.removeEventListener('themechange', drawAll);
    charts.forEach((c) => c.destroy());
  };

  // ---------------------------------------------------------------
  function drawAll() {
    charts.forEach((c) => c.destroy());
    charts = [];
    const colors = themeColors();
    const range = periodRange(state.period, today, firstDataDay);
    const days = listDays(range.from, range.to);
    const opts = { primaryType, includeOtherDevices: state.includeOtherDevices };

    // Ряды всех показателей за всё время.
    const series = metrics.map((m) => ({ metric: m, ...dailyValues(m, data, opts) }));
    const withData = series.filter((s) => s.points.length + s.excluded.length > 0);
    const noData = series.filter((s) => s.points.length + s.excluded.length === 0 && !s.metric.key.startsWith('factor:'));

    const area = root.querySelector('#charts-area');
    area.innerHTML = `
      <h2>Показатели во времени</h2>
      ${withData.length === 0 ? '<p class="notice">Данных пока нет. Заполните дневник или пройдите тест — и здесь появятся графики.</p>' : ''}
      <div class="chart-grid">
        ${withData.map((s, i) => {
          const pts = inPeriod(s.points, range);
          const exc = state.showExcluded ? inPeriod(s.excluded, range) : [];
          return chartCardHtml(i, s.metric, pts, exc);
        }).join('')}
      </div>
      ${noData.length ? `<p class="hint">Пока нет данных: ${noData.map((s) => escapeHtml(s.metric.label)).join(', ')}.</p>` : ''}`;

    withData.forEach((s, i) => {
      const pts = inPeriod(s.points, range);
      const exc = state.showExcluded ? inPeriod(s.excluded, range) : [];
      charts.push(timeChart(area.querySelector(`#chart-${i}`), s.metric, pts, exc, days, colors));
    });

    drawCompare(series, range, days, colors);
  }

  function drawCompare(series, range, days, colors) {
    const area = root.querySelector('#compare-area');
    const a = series.find((s) => s.metric.key === state.compareA);
    const b = series.find((s) => s.metric.key === state.compareB);
    if (!a || !b) {
      area.innerHTML = '<p class="hint">Выберите два показателя.</p>';
      return;
    }
    if (a.metric.key === b.metric.key) {
      area.innerHTML = '<p class="hint">Выберите два разных показателя.</p>';
      return;
    }
    const ptsA = inPeriod(a.points, range);
    const ptsB = inPeriod(b.points, range);
    const pairs = pairByDay(ptsA, ptsB);

    area.innerHTML = `
      <div class="chart-box chart-box-tall"><canvas id="compare-chart" role="img"
        aria-label="${escapeHtml(`Сравнение: ${a.metric.label} и ${b.metric.label}`)}"></canvas></div>
      <p class="hint">Дней, когда есть оба показателя: <strong>${pairs.length}</strong>.
        ${state.compareView === 'overlay'
          ? 'У показателей разные шкалы: левая ось — A (сплошная линия), правая — B (пунктир). Сравнивайте, совпадают ли подъёмы и спады по дням, а не высоту линий: она зависит от выбранных шкал.'
          : 'Каждая точка — один день: по горизонтали значение A, по вертикали — B.'}
        Исключённые сеансы теста здесь не показываются.</p>
      ${pairs.length < ANALYSIS.minPointsForConclusions ? `<p class="notice">Данных пока мало для выводов (меньше ${ANALYSIS.minPointsForConclusions} дней с обоими показателями).</p>` : ''}
      ${tableHtml(['День', `A: ${a.metric.label}`, `B: ${b.metric.label}`], pairs.map((p) => [p.day, p.a, p.b]))}`;

    const canvas = area.querySelector('#compare-chart');
    if (state.compareView === 'overlay') {
      charts.push(overlayChart(canvas, a.metric, b.metric, ptsA, ptsB, days, colors));
    } else {
      charts.push(scatterChart(canvas, a.metric, b.metric, pairs, colors));
    }
  }
}

// ----- HTML -----

function selectHtml(id, label, metrics, selected) {
  return `
    <label class="field">
      <span>${label}</span>
      <select id="${id}">
        ${metrics.map((m) => `<option value="${m.key}" ${m.key === selected ? 'selected' : ''}>${escapeHtml(m.label)}</option>`).join('')}
      </select>
    </label>`;
}

function chartCardHtml(i, metric, points, excluded) {
  const few = points.length < ANALYSIS.minPointsForConclusions;
  return `
    <section class="card chart-card" aria-labelledby="ct-${i}">
      <h3 id="ct-${i}">${escapeHtml(metric.label)}</h3>
      <div class="chart-box"><canvas id="chart-${i}" role="img"
        aria-label="${escapeHtml(`График «${metric.label}»: ${points.length} точек за период`)}"></canvas></div>
      <p class="hint">Точек данных за период: <strong>${points.length}</strong>${excluded.length ? `; исключённых сеансов (в счёт не входят): ${excluded.length}` : ''}.</p>
      ${few ? `<p class="notice notice-small">Данных пока мало для выводов (меньше ${ANALYSIS.minPointsForConclusions} точек).</p>` : ''}
      ${tableHtml(['День', 'Значение', 'Примечание'], [
        ...points.map((p) => [p.day, p.value, '']),
        ...excluded.map((p) => [p.day, p.value, `исключён: ${REASON_LABELS[p.reason] || p.reason}`]),
      ].sort((x, y) => String(x[0]).localeCompare(String(y[0]))))}
    </section>`;
}

// Таблица под графиком — для тех, кому удобнее цифры (и для программ чтения с экрана).
function tableHtml(headers, rows) {
  if (rows.length === 0) return '';
  return `
    <details class="table-details">
      <summary>Показать таблицей</summary>
      <div class="table-wrap">
        <table>
          <thead><tr>${headers.map((h) => `<th scope="col">${escapeHtml(h)}</th>`).join('')}</tr></thead>
          <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(formatValue(c))}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
      </div>
    </details>`;
}

function formatValue(v) {
  if (typeof v === 'number') return String(Math.round(v * 1000) / 1000).replace('.', ',');
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return `${v.slice(8, 10)}.${v.slice(5, 7)}.${v.slice(0, 4)}`;
  return v ?? '';
}

// ----- Графики -----

// Ось «дни»: подписи вида 10.03.
function dayAxis(colors) {
  return axis(colors, '', {
    ticks: {
      color: colors.muted, maxRotation: 0, autoSkip: true, autoSkipPadding: 12,
      callback(value) { return shortDay(this.getLabelForValue(value)); },
    },
  });
}

function valueAxis(colors, metric, extra = {}) {
  const result = axis(colors, '', {
    ...(metric.min !== undefined ? { min: metric.min } : {}),
    ...(metric.max !== undefined ? { max: metric.max } : {}),
    ...extra,
  });
  // Для целых значений (пропуски, настроение, «да/нет») — деления без дробей.
  if (metric.integer) result.ticks = { ...result.ticks, precision: 0, stepSize: 1 };
  return result;
}

function tooltipTitle(items) {
  const day = items[0]?.raw?.x || items[0]?.label;
  return day ? formatValue(day) : '';
}

// Один показатель во времени (+ исключённые сеансы серыми ромбами).
function timeChart(canvas, metric, points, excluded, days, colors) {
  const byDay = new Map(points.map((p) => [p.day, p.value]));
  const datasets = [{
    label: metric.label,
    data: days.map((d) => (byDay.has(d) ? byDay.get(d) : null)),
    borderColor: colors.series1,
    backgroundColor: colors.series1,
    borderWidth: 2,
    pointRadius: 4,
    pointHoverRadius: 6,
    spanGaps: true,
  }];
  if (excluded.length) {
    datasets.push({
      label: 'исключённые сеансы',
      data: excluded.map((p) => ({ x: p.day, y: p.value, reason: p.reason })),
      showLine: false,
      pointStyle: 'rectRot',
      pointRadius: 5,
      pointHoverRadius: 7,
      borderColor: colors.muted,
      backgroundColor: 'transparent',
      borderWidth: 2,
    });
  }
  const options = baseOptions(colors);
  options.plugins.legend.display = excluded.length > 0; // одна линия — легенда не нужна, название в заголовке
  options.plugins.tooltip.callbacks = {
    title: tooltipTitle,
    label(ctx) {
      const reason = ctx.raw?.reason;
      return reason ? `${formatValue(ctx.parsed.y)} — исключён: ${REASON_LABELS[reason] || reason}` : formatValue(ctx.parsed.y);
    },
  };
  options.scales = { x: dayAxis(colors), y: valueAxis(colors, metric) };
  return new Chart(canvas, { type: 'line', data: { labels: days, datasets }, options });
}

// Два показателя на одном графике, у каждого своя ось.
function overlayChart(canvas, ma, mb, ptsA, ptsB, days, colors) {
  const mapA = new Map(ptsA.map((p) => [p.day, p.value]));
  const mapB = new Map(ptsB.map((p) => [p.day, p.value]));
  const options = baseOptions(colors);
  options.interaction = { mode: 'index', intersect: false };
  options.plugins.tooltip.callbacks = { title: tooltipTitle };
  options.scales = {
    x: dayAxis(colors),
    yA: valueAxis(colors, ma, { position: 'left', title: { display: true, text: `A: ${ma.label}`, color: colors.muted } }),
    yB: valueAxis(colors, mb, { position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: `B: ${mb.label}`, color: colors.muted } }),
  };
  return new Chart(canvas, {
    type: 'line',
    data: {
      labels: days,
      datasets: [
        { label: `A: ${ma.label}`, data: days.map((d) => mapA.get(d) ?? null), yAxisID: 'yA', borderColor: colors.series1, backgroundColor: colors.series1, borderWidth: 2, pointRadius: 4, spanGaps: true },
        // B — пунктир и квадратные точки: различимо не только по цвету.
        { label: `B: ${mb.label}`, data: days.map((d) => mapB.get(d) ?? null), yAxisID: 'yB', borderColor: colors.series2, backgroundColor: colors.series2, borderWidth: 2, borderDash: [6, 4], pointStyle: 'rect', pointRadius: 4, spanGaps: true },
      ],
    },
    options,
  });
}

// Диаграмма рассеяния: каждая точка — день.
function scatterChart(canvas, ma, mb, pairs, colors) {
  const options = baseOptions(colors);
  options.plugins.legend.display = false;
  options.interaction = { mode: 'nearest', intersect: true };
  options.plugins.tooltip.callbacks = {
    title: (items) => formatValue(items[0]?.raw?.day),
    label: (ctx) => `A: ${formatValue(ctx.raw.x)}; B: ${formatValue(ctx.raw.y)}`,
  };
  options.scales = {
    x: valueAxis(colors, ma, { type: 'linear', title: { display: true, text: `A: ${ma.label}`, color: colors.muted } }),
    y: valueAxis(colors, mb, { title: { display: true, text: `B: ${mb.label}`, color: colors.muted } }),
  };
  return new Chart(canvas, {
    type: 'scatter',
    data: { datasets: [{ label: 'Дни', data: pairs.map((p) => ({ x: p.a, y: p.b, day: p.day })), backgroundColor: colors.series1, borderColor: colors.surface, borderWidth: 2, pointRadius: 6, pointHoverRadius: 8 }] },
    options,
  });
}
