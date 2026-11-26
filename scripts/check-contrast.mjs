// =====================================================================
// Проверка контраста всех пар цветов в обеих темах (WCAG AA).
// Запуск: npm run contrast
// Читает цвета из src/styles/tokens.css и записывает таблицы в docs/design.md
// (между пометками <!-- contrast:start --> и <!-- contrast:end -->).
// Если хоть одна пара не проходит — команда завершается с ошибкой.
// =====================================================================
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { checkPairs, parseTokens, CONTRAST_PAIRS, PVT_PAIRS } from '../src/logic/contrast.js';

const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');
const block = (start) => {
  const i = css.indexOf(start);
  if (i < 0) throw new Error(`Не найден блок «${start}» в tokens.css`);
  return css.slice(i, css.indexOf('}', i));
};
const light = parseTokens(block('.theme-light {'));
const dark = parseTokens(block('.theme-dark {'));
const pvt = parseTokens(block('--pvt-bg'));
pvt['pvt-bg'] = css.match(/--pvt-bg:\s*(#[0-9a-f]{6})/i)[1];

const table = (title, rows) => [
  `### ${title}`,
  '',
  '| Пара | Цвета | Контраст | Нужно | Итог |',
  '|---|---|---|---|---|',
  ...rows.map((r) => `| ${r.name} | \`${r.fg}\` на \`${r.bg}\` | ${r.ratio.toFixed(2)}:1 | ≥ ${r.min}:1 | ${r.ok ? '✓' : '✗ НЕ ПРОХОДИТ'} |`),
  '',
].join('\n');

const results = {
  'Дневная лаборатория (светлая тема)': checkPairs(light),
  'Ночная лаборатория (тёмная тема)': checkPairs(dark),
  'Экран теста PVT (одинаков в обеих темах)': checkPairs(pvt, PVT_PAIRS),
};

const failed = Object.values(results).flat().filter((r) => !r.ok);
const summary = `Проверено пар: ${Object.values(results).flat().length}. Не проходят: ${failed.length}.`;
const md = [
  '<!-- contrast:start -->',
  `_Сгенерировано командой \`npm run contrast\`. ${summary}_`,
  '',
  ...Object.entries(results).map(([t, rows]) => table(t, rows)),
  '<!-- contrast:end -->',
].join('\n');

const docPath = new URL('../docs/design.md', import.meta.url);
let doc = existsSync(docPath) ? readFileSync(docPath, 'utf8') : '';
if (doc.includes('<!-- contrast:start -->')) {
  doc = doc.replace(/<!-- contrast:start -->[\s\S]*<!-- contrast:end -->/, md);
} else {
  doc += `\n\n## Проверка контраста\n\n${md}\n`;
}
writeFileSync(docPath, doc);

console.log(summary);
for (const r of failed) console.log(`  ✗ ${r.name}: ${r.ratio.toFixed(2)}:1 (нужно ${r.min})`);
process.exit(failed.length ? 1 : 0);
