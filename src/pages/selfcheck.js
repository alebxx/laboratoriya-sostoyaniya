// =====================================================================
// «Самопроверка теста» — раздел для автора проекта.
// Показывает распределение всех времён реакции, чтобы заметить
// возможную техническую задержку (например, медленный экран или сенсор).
// =====================================================================
import { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip } from 'chart.js';
import { getAll } from '../db/repo.js';
import { PVT } from '../config.js';
import { median } from '../logic/stats.js';
import { SELFCHECK_TYPICAL } from '../data/pvtTexts.js';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

const DEVICE_NAMES = { phone: 'Телефон', tablet: 'Планшет', computer: 'Компьютер' };
const BIN_MS = 25; // ширина столбика гистограммы
const MIN_MS = 100;
const MAX_MS = 600; // всё, что медленнее, — в последнем столбике

// Разложить времена реакции по столбикам гистограммы.
export function histogram(rts, binMs = BIN_MS, minMs = MIN_MS, maxMs = MAX_MS) {
  const labels = [];
  const counts = [];
  for (let from = minMs; from < maxMs; from += binMs) {
    labels.push(`${from}–${from + binMs - 1}`);
    counts.push(0);
  }
  labels.push(`${maxMs}+`);
  counts.push(0);
  for (const rt of rts) {
    if (rt < minMs) continue;
    const i = rt >= maxMs ? counts.length - 1 : Math.floor((rt - minMs) / binMs);
    counts[i]++;
  }
  return { labels, counts };
}

export async function renderSelfcheck(root) {
  const sessions = (await getAll('pvtSessions')).filter((s) => s.status === 'completed');
  const trials = await getAll('pvtTrials');
  const completedIds = new Set(sessions.map((s) => s.id));
  // Только ответы на сигнал из завершённых сеансов (без фальстартов и «нет ответа»).
  const rts = trials
    .filter((t) => completedIds.has(t.sessionId) && t.type !== 'falseStart' && !t.timedOut && typeof t.rt === 'number')
    .map((t) => t.rt);

  // Сводка по типам устройств.
  const byDevice = {};
  for (const s of sessions) {
    const type = s.device?.type || 'computer';
    (byDevice[type] ||= []).push(s);
  }

  root.innerHTML = `
    <h1>Самопроверка теста</h1>
    <p class="lead">Раздел для автора проекта: проверить, не мешает ли измерению техника.</p>

    <section class="card card-important">
      <p>${SELFCHECK_TYPICAL.text}</p>
      <p class="hint">Это не оценка внимания пользователя, а проверка устройства и браузера.</p>
    </section>

    <section class="card" aria-labelledby="h-hist">
      <h2 id="h-hist">Распределение времени реакции</h2>
      <p>Завершённых сеансов: <strong>${sessions.length}</strong>, реакций: <strong>${rts.length}</strong>,
         общая медиана: <strong>${rts.length ? Math.round(median(rts)) + ' мс' : '—'}</strong>.</p>
      ${rts.length === 0
        ? '<p class="notice">Пока нет данных. Пройдите тест хотя бы один раз.</p>'
        : `<div class="chart-box"><canvas id="hist" role="img"
             aria-label="Гистограмма времени реакции: сколько реакций попало в каждый интервал по ${BIN_MS} мс"></canvas></div>
           <p class="hint">Вертикальная линия-ориентир не рисуется намеренно: сравнивать нужно не с нормой, а между устройствами и сеансами.
             Пропусками считаются реакции от ${PVT.lapseMs} мс.</p>`}
    </section>

    <section class="card" aria-labelledby="h-dev">
      <h2 id="h-dev">По устройствам</h2>
      ${Object.keys(byDevice).length === 0 ? '<p class="hint">Пока нет данных.</p>' : `
      <div class="table-wrap">
        <table>
          <thead><tr><th scope="col">Устройство</th><th scope="col">Сеансов</th><th scope="col">Медиана медиан, мс</th><th scope="col">Кадр экрана, мс</th></tr></thead>
          <tbody>
            ${Object.entries(byDevice).map(([type, list]) => `
              <tr>
                <th scope="row">${DEVICE_NAMES[type] || type}</th>
                <td>${list.length}</td>
                <td>${fmtMs(median(list.map((s) => s.medianRt)))}</td>
                <td>${fmtMs(median(list.map((s) => s.frameMs)), 1)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <p class="hint">«Кадр экрана» — сколько миллисекунд длится один кадр (16,7 мс — экран 60 Гц, 8,3 мс — 120 Гц).
        Сигнал не может появиться точнее, чем один кадр. Если медианы на разных устройствах заметно различаются,
        это и есть техническая разница — поэтому в анализе по умолчанию учитывается только основное устройство.</p>`}
    </section>

    <p><a href="#/pvt">← К тесту</a></p>`;

  if (rts.length > 0) {
    const { labels, counts } = histogram(rts);
    // Нарисовать гистограмму цветами текущей темы.
    const draw = () => {
      const css = getComputedStyle(document.documentElement);
      const color = css.getPropertyValue('--m-test').trim();
      const text = css.getPropertyValue('--chart-label').trim();
      const grid = css.getPropertyValue('--chart-grid').trim();
      return new Chart(root.querySelector('#hist'), {
        type: 'bar',
        data: { labels, datasets: [{ label: 'Число реакций', data: counts, backgroundColor: color, borderRadius: 4 }] },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { title: { display: true, text: 'Время реакции, мс', color: text }, ticks: { color: text }, grid: { color: grid } },
            y: { title: { display: true, text: 'Число реакций', color: text }, ticks: { color: text, precision: 0 }, grid: { color: grid }, beginAtZero: true },
          },
        },
      });
    };
    let chart = draw();
    // Сменили тему — пересоздаём график новыми цветами.
    const redraw = () => {
      chart.destroy();
      chart = draw();
    };
    window.addEventListener('themechange', redraw);
    // При уходе со страницы всё убираем.
    return () => {
      window.removeEventListener('themechange', redraw);
      chart.destroy();
    };
  }
}

function fmtMs(v, digits = 0) {
  if (v === null || v === undefined) return '—';
  const k = 10 ** digits;
  return String(Math.round(v * k) / k).replace('.', ',');
}
