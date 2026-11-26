// Настройки сборщика Vite.
import { defineConfig } from 'vite';

export default defineConfig({
  // './' — относительные пути к файлам. Благодаря этому собранный сайт
  // работает в любой папке, в том числе на GitHub Pages (адрес вида
  // https://имя.github.io/название-репозитория/).
  base: './',
  test: {
    // Тесты лежат в папке tests/ и запускаются командой npm test.
    include: ['tests/**/*.test.js'],
    environment: 'node',
  },
});
