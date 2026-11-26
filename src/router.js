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
import { placeholder } from './pages/placeholder.js';

// Таблица «адрес → функция, которая рисует страницу».
const routes = {
  '/': renderHome,
  '/onboarding': renderOnboarding,
  '/settings': renderSettings,
  '/diary': renderDiary,
  '/pvt': placeholder('Тест внимания', 3),
  '/charts': placeholder('Карта состояния', 4),
  '/hypotheses': placeholder('Гипотезы', 5),
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

async function render() {
  const path = currentPath();

  // Пока человек не прошёл первый вход, показываем только его.
  const onboardingDone = await getSetting('onboardingDone', false);
  if (!onboardingDone && path !== '/onboarding') {
    location.hash = '#/onboarding';
    return;
  }
  document.body.classList.toggle('is-onboarding', path === '/onboarding');

  const page = routes[path] || notFound;
  const root = document.getElementById('app');
  root.innerHTML = '';
  await page(root);

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
