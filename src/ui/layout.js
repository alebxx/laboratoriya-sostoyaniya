// =====================================================================
// Общие элементы страницы: меню, переключатель темы, ссылка «к содержимому».
// =====================================================================

import { icon, NAV_ICONS } from './icons.js';
import { mascot } from './mascot.js';

const THEMES = ['system', 'light', 'dark'];
const THEME_NAMES = { system: 'как в системе', light: 'дневная', dark: 'ночная' };
const THEME_ICONS = { system: 'SunMoon', light: 'Sun', dark: 'Moon' };

// Тема, которая сейчас фактически на экране: 'light' или 'dark'.
export function effectiveTheme() {
  const t = getTheme();
  if (t !== 'system') return t;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// Переключатель темы (на главной и в настройках). Выбор запоминается в браузере.
export function themePickerHtml(name = 'theme') {
  const current = getTheme();
  return `
    <fieldset>
      <legend>Тема оформления</legend>
      <div class="theme-picker">
        ${[['system', 'Как в системе'], ['light', 'Дневная лаборатория'], ['dark', 'Ночная лаборатория']]
          .map(([v, l]) => `<label class="radio-card"><input type="radio" name="${name}" value="${v}" ${current === v ? 'checked' : ''} />${icon(THEME_ICONS[v], 18)}<span>${l}</span></label>`)
          .join('')}
      </div>
    </fieldset>`;
}

export function setupThemePicker(root, name = 'theme') {
  for (const input of root.querySelectorAll(`input[name="${name}"]`)) {
    input.addEventListener('change', () => setTheme(input.value));
  }
}

// Текущая тема: 'system' | 'light' | 'dark'.
export function getTheme() {
  try {
    const t = localStorage.getItem('theme');
    return t === 'light' || t === 'dark' ? t : 'system';
  } catch {
    return 'system';
  }
}

export function setTheme(theme) {
  try {
    if (theme === 'system') localStorage.removeItem('theme');
    else localStorage.setItem('theme', theme);
  } catch {
    // Если localStorage недоступен, тема просто не запомнится.
  }
  if (theme === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  updateThemeButton();
  // Сообщаем страницам, что цвета поменялись (графики перерисуются).
  window.dispatchEvent(new Event('themechange'));
}

function updateThemeButton() {
  const btn = document.getElementById('theme-toggle');
  if (btn) {
    const name = THEME_NAMES[getTheme()];
    // На узком экране часть «: дневная» скрывается стилями (класс theme-name).
    btn.innerHTML = `${icon(THEME_ICONS[getTheme()], 18)}<span>Тема<span class="theme-name">: ${name}</span></span>`;
    btn.setAttribute('aria-label', `Тема оформления: ${name}. Нажмите, чтобы сменить`);
  }
}

export function setupLayout() {
  // Кнопка темы перебирает варианты по кругу.
  document.getElementById('theme-toggle').addEventListener('click', () => {
    const next = THEMES[(THEMES.indexOf(getTheme()) + 1) % THEMES.length];
    setTheme(next);
  });
  updateThemeButton();

  // Значок у логотипа и значки пунктов меню.
  document.getElementById('logo-icon').innerHTML = icon('FlaskConical', 24);
  for (const a of document.querySelectorAll('#main-nav a')) {
    const name = NAV_ICONS[a.getAttribute('href')];
    if (name) a.insertAdjacentHTML('afterbegin', icon(name, 18));
  }

  // Плашка «нет интернета» (сайт при этом продолжает работать).
  const offline = document.getElementById('offline-banner');
  document.getElementById('offline-mascot').innerHTML = mascot('oops', { size: 40 });
  const updateOnline = () => {
    offline.hidden = navigator.onLine;
  };
  window.addEventListener('online', updateOnline);
  window.addEventListener('offline', updateOnline);
  updateOnline();

  // Тема «как в системе»: если система переключилась на тёмную/светлую — тоже сообщаем.
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getTheme() === 'system') window.dispatchEvent(new Event('themechange'));
  });

  // Меню на телефоне открывается и закрывается кнопкой.
  const menuBtn = document.getElementById('menu-toggle');
  const nav = document.getElementById('main-nav');
  menuBtn.addEventListener('click', () => {
    const open = menuBtn.getAttribute('aria-expanded') === 'true';
    menuBtn.setAttribute('aria-expanded', String(!open));
    nav.classList.toggle('is-open', !open);
  });
  // После выбора раздела меню закрывается.
  nav.addEventListener('click', (e) => {
    if (e.target.closest('a')) {
      menuBtn.setAttribute('aria-expanded', 'false');
      nav.classList.remove('is-open');
    }
  });

  // «Перейти к содержимому» — для тех, кто пользуется клавиатурой.
  document.getElementById('skip-link').addEventListener('click', () => {
    document.getElementById('app').focus();
  });
}

// Подсветить в меню текущий раздел.
// Вложенные страницы подсвечивают свой раздел: #/diary → «Наблюдай».
// Шаг «Наблюдай» объединяет дневник, тест и пульс; «Проверь» — стратегии и эксперимент.
const SECTION_OF = {
  diary: 'observe', pvt: 'observe', 'pvt-selfcheck': 'observe', physio: 'observe',
  experiments: 'strategies', breathing: 'strategies', regulation: 'strategies',
};

export function markCurrentNav(path) {
  const first = path.split('/')[1] || '';
  const section = '/' + (SECTION_OF[first] || first);
  for (const a of document.querySelectorAll('#main-nav a')) {
    if (a.getAttribute('href') === '#' + section) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
}
