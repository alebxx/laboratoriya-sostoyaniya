// Страница-образец оформления: обе темы рядом.
import '@fontsource-variable/inter-tight';
import '../src/styles/tokens.css';
import './sample.css';
import {
  createElement, House, NotebookPen, Timer, HeartPulse, ChartLine, FlaskConical, Wind, BookOpen, Settings,
  GraduationCap, Briefcase, Users, Heart, Moon, Ellipsis, MessageCircleQuestion, ClipboardList, Lock, Search,
  Lightbulb, Brain, Gauge, BatteryLow, ClipboardCheck, Check, Sprout,
} from 'lucide';
import { mascot } from '../src/ui/mascot.js';
import { checkPairs, CONTRAST_PAIRS, PVT_PAIRS } from '../src/logic/contrast.js';

// Иконка Lucide → строка SVG.
const icon = (I, size = 22) => {
  const el = createElement(I);
  el.setAttribute('width', size);
  el.setAttribute('height', size);
  el.setAttribute('aria-hidden', 'true');
  return el.outerHTML;
};

// Показатели: токен цвета, иконка, название.
const METRICS = [
  ['--m-stress', Gauge, 'Стресс'],
  ['--m-fatigue', BatteryLow, 'Усталость'],
  ['--m-sleep', Moon, 'Сон'],
  ['--m-concentration', Brain, 'Концентрация'],
  ['--m-test', Timer, 'Тест внимания'],
  ['--m-pulse', HeartPulse, 'Пульс и давление'],
  ['--m-pss', ClipboardCheck, 'PSS-10'],
];

const UI_TOKENS = ['--bg', '--surface', '--surface-raised', '--surface-sunken', '--border', '--text', '--text-muted', '--accent', '--accent-soft', '--notice-bg', '--focus', '--danger'];

// Приветствие по времени суток (граница ночи — 4:00, как у суток в дневнике).
function greeting(date = new Date()) {
  const h = date.getHours();
  if (h >= 4 && h < 12) return 'Доброе утро';
  if (h >= 12 && h < 18) return 'Добрый день';
  if (h >= 18) return 'Добрый вечер';
  return 'Доброй ночи';
}

// ----- Шрифты -----
document.getElementById('font-compare').innerHTML = `
  <div class="font-card is-recommended" style="font-family:var(--font)">
    <strong>Inter Tight — шрифт сайта</strong>
    <p class="big">Лаборатория состояния</p>
    <p>Съешь же ещё этих мягких французских булок, да выпей чаю. Ёлка, щётка, «цитаты» — 0123456789 мс.</p>
    <p style="font-weight:400">Обычный 400 · <span style="font-weight:600">полужирный 600</span> · <span style="font-weight:800">жирный 800</span></p>
    <p style="font-size:.85rem;opacity:.8">Лицензия SIL Open Font License 1.1, файлы лежат в проекте.</p>
  </div>`;

// ----- Содержимое колонки темы -----
function column(theme) {
  const isDark = theme === 'dark';
  const stressValues = [3, 5, 4, 6, 7, 5, 4, 3, 6, 8, 6, 5, 4, 5];
  const sleepValues = [8, 7, 7.5, 6.5, 6, 7, 8, 8, 6.5, 5.5, 6.5, 7, 7.5, 7];

  return `
    <h2>${isDark ? 'Ночная лаборатория' : 'Дневная лаборатория'}</h2>

    <div class="card greeting">
      ${mascot('greet', { size: 96 })}
      <div>
        <strong style="font-size:1.25rem">${greeting()}!</strong>
        <p class="muted">Как прошёл день? Запись займёт пару минут.</p>
      </div>
    </div>

    <div class="card">
      <h3>Основные цвета</h3>
      <div class="swatches">
        ${UI_TOKENS.map((t) => `<div class="swatch"><i style="background:var(${t})"></i><span>${t.slice(2)}<br><code class="muted" data-token="${t}"></code></span></div>`).join('')}
      </div>
    </div>

    <div class="card">
      <h3>Цвет каждого показателя</h3>
      <p class="muted" style="margin-top:0">Один и тот же везде: карточки, графики, значки. Цвет — «имя» показателя, а не оценка.</p>
      <div class="metric-list">
        ${METRICS.map(([t, I, name]) => `<div class="metric-chip" style="--m:var(${t})">${icon(I)}<span>${name}<code data-token="${t}"></code></span></div>`).join('')}
      </div>
    </div>

    <div class="card">
      <h3>Кнопки</h3>
      <p class="muted" style="margin-top:0">На экране одна главная кнопка (заливка), остальные — обводка или прозрачные.</p>
      <div class="btn-row">
        <button class="btn btn-primary">${icon(Check, 18)} Сохранить запись</button>
        <button class="btn btn-secondary">Назад</button>
        <button class="btn btn-ghost">Сбросить</button>
        <button class="btn btn-danger">Удалить</button>
      </div>
      <p class="saved" data-saved>${icon(Check, 20)} Запись сохранена</p>
    </div>

    <div class="card slider-demo">
      <h3>Ползунок меняет оттенок</h3>
      <label for="s-${theme}">Стресс сегодня <span class="slider-value" data-out>5</span></label>
      <input type="range" id="s-${theme}" min="0" max="10" value="5" data-slider />
      <div class="slider-ends"><span>0 — совсем нет</span><span>10 — очень сильный</span></div>
      <h3 style="margin-top:16px">Настроение</h3>
      <div class="mood-row" role="group" aria-label="Настроение">
        ${['😣', '🙁', '😐', '🙂', '😄'].map((e, i) => `<button type="button" aria-pressed="${i === 3}" aria-label="вариант ${i + 1}">${e}</button>`).join('')}
      </div>
      <p class="muted" style="font-size:.85rem">Смайлики — только при вводе своего самочувствия. На результатах и графиках их нет.</p>
    </div>

    <div class="card chart">
      <h3>${icon(Gauge, 18)} Стресс, 2 недели</h3>
      ${lineChart([{ values: stressValues, color: 'var(--m-stress)', max: 10 }])}
      <p class="muted" style="font-size:.85rem;margin-bottom:0">Точек данных: 14. Сетка едва заметна, подписи приглушены${isDark ? ', линия чуть толще' : ''}.</p>
    </div>

    <div class="card chart">
      <h3>Сравнение двух показателей</h3>
      ${lineChart([
        { values: stressValues, color: 'var(--m-stress)', max: 10 },
        { values: sleepValues, color: 'var(--m-sleep)', max: 10, dashed: true },
      ])}
      <div class="legend"><span style="--c:var(--m-stress)">A: стресс (сплошная, круги)</span><span class="dashed" style="--c:var(--m-sleep)">B: сон (пунктир, квадраты)</span></div>
    </div>

    <div class="card">
      <h3>Мастер гипотез: шаги</h3>
      <ol class="steps">
        <li>${icon(MessageCircleQuestion, 16)} Вопрос</li>
        <li>${icon(ClipboardList, 16)} План</li>
        <li class="is-current">${icon(Lock, 16)} Фиксация</li>
        <li>${icon(Search, 16)} Наблюдение</li>
        <li>${icon(Lightbulb, 16)} Рассуждение</li>
      </ol>
    </div>

    <div class="card">
      <h3>Иконки: причины стресса и меню</h3>
      <div class="icon-grid">
        ${[[GraduationCap, 'учёба'], [Briefcase, 'работа'], [Users, 'отношения'], [Heart, 'здоровье'], [Moon, 'недосып'], [Ellipsis, 'другое']]
          .map(([I, n]) => `<div class="icon-cell">${icon(I, 26)}${n}</div>`).join('')}
      </div>
      <div class="icon-grid" style="margin-top:10px">
        ${[[House, 'главная'], [NotebookPen, 'дневник'], [Timer, 'тест'], [HeartPulse, 'пульс'], [ChartLine, 'карта'], [FlaskConical, 'гипотезы'], [Wind, 'дыхание'], [BookOpen, 'как устроено'], [Settings, 'настройки']]
          .map(([I, n]) => `<div class="icon-cell">${icon(I, 26)}${n}</div>`).join('')}
      </div>
    </div>

    <div class="card">
      <h3>Талисман «Колбочка»</h3>
      <p class="muted" style="margin-top:0">${isDark ? 'Ночью — светлый контур, мягкое свечение, звёздочки и лампа.' : 'Днём — тёмный контур, без свечения.'}</p>
      <div class="mascots">
        ${[
          ['greet', 'Привет', 'первый вход, главная'],
          ['magnifier', 'С лупой', '«Исследую», «Как это устроено»'],
          ['notebook', 'С пустым блокнотом', 'пустые экраны'],
          ['sprouts', 'Ростки-графики', '«данных пока мало»'],
          ['diploma', 'Халат и диплом', 'итог гипотезы, конец пилота'],
          ['lock', 'С замочком', 'фиксация, приватность'],
          ['oops', 'Перевёрнутая колба', 'офлайн, ошибка'],
        ].map(([pose, name, use]) => `<div class="mascot-cell">${mascot(pose, { size: 96 })}<strong>${name}</strong>${use}</div>`).join('')}
      </div>
    </div>

    <div class="card">
      <h3>Сообщения</h3>
      <div class="notice">Данных пока мало для выводов (меньше 7 точек).</div>
      <div class="cheer" style="margin-top:10px">${icon(Sprout)}<span>На этой неделе вы заполнили дневник 5 раз. Каждая запись — новые данные для ваших гипотез.</span></div>
      <p class="muted" style="font-size:.85rem">Поздравления — только за то, что сделано. Никаких «серия прервана».</p>
      <div class="care" style="margin-top:10px">
        <strong>Мягкая забота</strong>
        <p style="margin:6px 0 0">Спокойный текст без картинок и украшений (текст вставит автор).</p>
      </div>
      <div class="popover" style="margin-top:10px">Всплывающая подсказка: ${isDark ? 'светлее карточки, с тонкой рамкой' : 'белая, с тенью'}.</div>
    </div>`;
}

// Простой линейный график в SVG (в образце — без библиотеки).
function lineChart(series) {
  const W = 460, H = 170, padL = 28, padB = 22, padT = 10;
  const n = series[0].values.length;
  const x = (i) => padL + (i * (W - padL - 8)) / (n - 1);
  const y = (v, max) => padT + (1 - v / max) * (H - padT - padB);
  const grid = [0, 2.5, 5, 7.5, 10].map((v) => `
    <line x1="${padL}" x2="${W - 4}" y1="${y(v, 10)}" y2="${y(v, 10)}" stroke="var(--chart-grid)" stroke-width="1"/>
    <text x="${padL - 6}" y="${y(v, 10) + 4}" text-anchor="end" font-size="11" fill="var(--chart-label)">${v}</text>`).join('');
  const days = [0, 4, 9, 13].map((i) => `<text x="${x(i)}" y="${H - 4}" text-anchor="middle" font-size="11" fill="var(--chart-label)">${String(13 + i).padStart(2, '0')}.11</text>`).join('');
  const lines = series.map((s) => {
    const pts = s.values.map((v, i) => `${x(i)},${y(v, s.max)}`).join(' ');
    const marks = s.values.map((v, i) => s.dashed
      ? `<rect x="${x(i) - 4}" y="${y(v, s.max) - 4}" width="8" height="8" fill="${s.color}" stroke="var(--surface)" stroke-width="2"/>`
      : `<circle cx="${x(i)}" cy="${y(v, s.max)}" r="4.5" fill="${s.color}" stroke="var(--surface)" stroke-width="2"/>`).join('');
    return `<polyline points="${pts}" fill="none" stroke="${s.color}" style="stroke-width:var(--chart-line)" stroke-linejoin="round" ${s.dashed ? 'stroke-dasharray="7 5"' : ''}/>${marks}`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Пример графика">${grid}${days}${lines}</svg>`;
}

// ----- Отрисовка колонок -----
for (const col of document.querySelectorAll('.theme-col')) {
  const theme = col.classList.contains('theme-dark') ? 'dark' : 'light';
  col.innerHTML = column(theme);
  const css = getComputedStyle(col);
  for (const code of col.querySelectorAll('[data-token]')) code.textContent = css.getPropertyValue(code.dataset.token).trim();

  // Ползунок: чем больше значение, тем насыщеннее оттенок цвета «стресса».
  const slider = col.querySelector('[data-slider]');
  const out = col.querySelector('[data-out]');
  const paint = () => {
    const v = Number(slider.value);
    const pct = 25 + v * 7.5; // 25 %…100 % цвета показателя
    col.querySelector('.slider-demo').style.setProperty('--slider-color', `color-mix(in oklab, var(--m-stress) ${pct}%, var(--surface))`);
    out.style.setProperty('--slider-bg', `color-mix(in oklab, var(--m-stress) ${Math.round(pct / 4)}%, var(--surface))`);
    out.textContent = v;
  };
  slider.addEventListener('input', paint);
  paint();

  // Настроение: выбор варианта.
  for (const b of col.querySelectorAll('.mood-row button')) {
    b.addEventListener('click', () => col.querySelectorAll('.mood-row button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))));
  }

  // «Сохранить» — маленькая анимация галочки (отключается при «уменьшить движение»).
  col.querySelector('.btn-primary').addEventListener('click', () => {
    const s = col.querySelector('[data-saved]');
    s.classList.remove('pop');
    void s.offsetWidth;
    s.classList.add('pop');
  });
}

// ----- Таблицы контраста (из переменных каждой колонки) -----
const toHex = (v) => v.trim().toLowerCase();
const tables = [...document.querySelectorAll('.theme-col')].map((col) => {
  const css = getComputedStyle(col);
  const tokens = {};
  for (const [, fg, bg] of [...CONTRAST_PAIRS, ...PVT_PAIRS]) {
    tokens[fg] = toHex(css.getPropertyValue(`--${fg}`));
    tokens[bg] = toHex(css.getPropertyValue(`--${bg}`));
  }
  const rows = checkPairs(tokens, [...CONTRAST_PAIRS, ...(col.classList.contains('theme-light') ? PVT_PAIRS : [])]);
  const title = col.classList.contains('theme-dark') ? 'Ночная лаборатория' : 'Дневная лаборатория (и экран теста)';
  return `<div><h3>${title}</h3><table><thead><tr><th>Пара</th><th>Контраст</th><th>Нужно</th></tr></thead><tbody>
    ${rows.map((r) => `<tr><td>${r.name}</td><td>${r.ratio.toFixed(2)}:1</td><td class="${r.ok ? 'ok' : 'bad'}">${r.ok ? '✓' : '✗'} ≥ ${r.min}</td></tr>`).join('')}
  </tbody></table></div>`;
});
document.getElementById('contrast').innerHTML = tables.join('');
