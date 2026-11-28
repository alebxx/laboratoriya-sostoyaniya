// =====================================================================
// Точка входа: отсюда запускается весь сайт.
// =====================================================================
// Шрифт Inter Tight лежит в проекте (лицензия SIL OFL 1.1) — без внешних запросов.
import '@fontsource-variable/inter-tight';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';

import { startRouter } from './router.js';
import { setupLayout } from './ui/layout.js';

setupLayout();
startRouter();

// Офлайн-режим: после первой загрузки сайт работает и без интернета.
// Включаем только в собранной версии (в режиме разработки он мешает).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // Если не получилось — сайт просто работает без офлайн-режима.
    });
  });
}
