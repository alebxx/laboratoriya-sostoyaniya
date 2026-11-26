// =====================================================================
// Общие элементы страницы: меню, переключатель темы, ссылка «к содержимому».
// =====================================================================

const THEMES = ['system', 'light', 'dark'];
const THEME_NAMES = { system: 'как в системе', light: 'светлая', dark: 'тёмная' };

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
}

function updateThemeButton() {
  const btn = document.getElementById('theme-toggle');
  if (btn) {
    const name = THEME_NAMES[getTheme()];
    // На узком экране часть «: светлая» скрывается стилями (класс theme-name).
    btn.innerHTML = `Тема<span class="theme-name">: ${name}</span>`;
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
export function markCurrentNav(path) {
  for (const a of document.querySelectorAll('#main-nav a')) {
    if (a.getAttribute('href') === '#' + path) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
}
