// =====================================================================
// Навигация между страницами.
// Адрес страницы хранится после знака # (например, …/#/diary).
// Так сайт работает на GitHub Pages без настройки сервера.
// =====================================================================
import { getSetting } from './db/repo.js';
import { markCurrentNav } from './ui/layout.js';
import { renderOnboarding } from './pages/onboarding.js';
import { renderHome } from './pages/home.js';
import { renderSettings } from './pages/settings.js';
import { renderDiary } from './pages/diary.js';
import { renderPvt } from './pages/pvt.js';
import { renderSelfcheck } from './pages/selfcheck.js';
import { renderCharts } from './pages/charts.js';
import { renderHypotheses } from './pages/hypotheses.js';
import { renderHypothesisNew } from './pages/hypothesisNew.js';
import { renderHypothesisView } from './pages/hypothesisView.js';
import { renderExperimentNew } from './pages/experimentNew.js';
import { renderExperimentView } from './pages/experimentView.js';
import { placeholder } from './pages/placeholder.js';

// Таблица «адрес → функция, которая рисует страницу».
const routes = {
  '/': renderHome,
  '/onboarding': renderOnboarding,
  '/settings': renderSettings,
  '/diary': renderDiary,
  '/pvt': renderPvt,
  '/pvt-selfcheck': renderSelfcheck,
  '/charts': renderCharts,
  '/hypotheses': renderHypotheses,
  '/hypotheses/new': renderHypothesisNew,
  '/hypotheses/view': renderHypothesisView,
  '/experiments/new': renderExperimentNew,
  '/experiments/view': renderExperimentView,
  '/physio': placeholder('Пульс и давление', 6),
  '/pss': placeholder('PSS-10', 7),
  '/regulation': placeholder('Саморегуляция', 8),
  '/learn': placeholder('Как это устроено', 8),
};

function currentPath() {
  const hash = location.hash;
  // Адреса страниц начинаются с «#/». Всё остальное считаем главной.
  if (!hash.startsWith('#/')) return '/';
  // Часть после «?» — параметры (например, #/diary?day=2026-03-10).
  return hash.slice(1).split('?')[0];
}

// Параметры из адреса: для #/diary?day=2026-03-10 → getParam('day') = '2026-03-10'.
export function getParam(name) {
  const query = location.hash.split('?')[1] || '';
  return new URLSearchParams(query).get(name);
}

let cleanup = null;

async function render() {
  const path = currentPath();

  // Пока человек не прошёл первый вход, показываем только его.
  const onboardingDone = await getSetting('onboardingDone', false);
  if (!onboardingDone && path !== '/onboarding') {
    location.hash = '#/onboarding';
    return;
  }
  document.body.classList.toggle('is-onboarding', path === '/onboarding');

  // Если прошлая страница оставила «уборку» (например, остановить тест) — выполняем.
  if (cleanup) {
    cleanup();
    cleanup = null;
  }

  const page = routes[path] || notFound;
  const root = document.getElementById('app');
  root.innerHTML = '';
  // Страница может вернуть функцию уборки — она выполнится при уходе со страницы.
  const result = await page(root);
  if (typeof result === 'function') cleanup = result;

  markCurrentNav(path);
  window.scrollTo(0, 0);
  // Переводим фокус на заголовок — так программа чтения с экрана
  // сразу сообщает, на какой странице оказался пользователь.
  const h1 = root.querySelector('h1');
  if (h1) {
    h1.setAttribute('tabindex', '-1');
    h1.focus({ preventScroll: true });
  }
}

function notFound(root) {
  root.innerHTML = `
    <h1>Страница не найдена</h1>
    <p><a href="#/">Вернуться на главную</a></p>`;
}

export function startRouter() {
  window.addEventListener('hashchange', render);
  render();
}

// Перерисовать текущую страницу (например, после изменения данных).
export function rerender() {
  return render();
}
