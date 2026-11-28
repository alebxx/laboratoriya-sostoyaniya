// =====================================================================
// Шаг 3 «Проверь»: библиотека стратегий.
// Каждая карточка — название, описание, научный источник и кнопка
// «Проверить на себе» (самоэксперимент с чередованием дней).
// Тексты — в src/data/strategies.js.
// =====================================================================
import { getAll } from '../db/repo.js';
import { STRATEGIES, isPlaceholder, getStrategy } from '../data/strategies.js';
import { activeExperiment, experimentProgress } from '../logic/cycle.js';
import { dayKeyFor } from '../logic/dates.js';
import { escapeHtml } from '../ui/helpers.js';
import { icon } from '../ui/icons.js';

export async function renderStrategies(root) {
  const today = dayKeyFor();
  const experiments = await getAll('experiments');
  const active = activeExperiment(experiments, today);
  const tested = new Set(experiments.filter((e) => e.strategyId && e !== active).map((e) => e.strategyId));

  root.innerHTML = `
    <h1>Шаг 3. Проверь: библиотека стратегий</h1>
    <p class="lead">То, что помогает одним, может не помогать другим. Выберите стратегию и проверьте её на себе:
      сайт случайно распределит дни «со стратегией» и «без неё», а потом сравнит их.</p>

    ${active ? activeHtml(active, today) : ''}

    <ul class="strategy-list">
      ${STRATEGIES.map((s) => `
        <li class="card strategy-card">
          <h2 class="card-title">${icon(s.tool === 'breathing' ? 'Wind' : 'FlaskConical', 20)}${escapeHtml(s.title)}</h2>
          ${isPlaceholder(s) ? '<p class="notice"><strong>Для автора проекта:</strong> текст этой стратегии ещё не вставлен (файл <code>src/data/strategies.js</code>).</p>' : ''}
          <p>${escapeHtml(s.description)}</p>
          <p class="hint">Источник: ${s.url
            ? `<a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(s.source)}</a>`
            : escapeHtml(s.source)}</p>
          ${tested.has(s.id) ? '<p class="hint">Вы уже проверяли эту стратегию — итог в «Моём наборе помощи». Можно проверить ещё раз.</p>' : ''}
          <div class="actions">
            ${active
              ? '<span class="hint">Сначала завершите текущий эксперимент: одновременно идёт только один.</span>'
              : `<a class="btn btn-primary" href="#/experiments/new?strategy=${encodeURIComponent(s.id)}">${icon('Shuffle', 18)}Проверить на себе</a>`}
            ${s.tool === 'breathing' ? `<a class="btn" href="#/breathing">${icon('Wind', 18)}Открыть упражнение</a>` : ''}
          </div>
        </li>`).join('')}
    </ul>

    <section class="card" aria-labelledby="h-own">
      <h2 id="h-own">Своя стратегия</h2>
      <p>Хотите проверить то, чего нет в списке? Опишите сами, что делать в дни A и в дни B.</p>
      ${active ? '' : '<a class="btn btn-ghost" href="#/experiments/new">Свой самоэксперимент</a>'}
    </section>`;
}

function activeHtml(e, today) {
  const p = experimentProgress(e, today);
  const name = getStrategy(e.strategyId)?.title || e.conditionA;
  return `
    <section class="card card-important" aria-labelledby="h-active">
      <h2 id="h-active" class="card-title">${icon('FlaskConical', 20)}Сейчас вы проверяете: ${escapeHtml(name)}</h2>
      <div class="progress-row">
        <div class="progress-label">Прошло дней: <strong>${p.done} из ${p.total}</strong></div>
        <progress max="${p.total}" value="${p.done}" aria-label="Эксперимент: ${p.done} из ${p.total} дней"></progress>
      </div>
      <a class="btn" href="#/experiments/view?id=${encodeURIComponent(e.id)}">Открыть эксперимент</a>
    </section>`;
}
