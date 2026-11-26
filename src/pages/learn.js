// =====================================================================
// Раздел «Как это устроено»: список тем и страница темы.
// Тексты — в src/data/learn.js.
// =====================================================================
import { LEARN_TOPICS } from '../data/learn.js';
import { escapeHtml } from '../ui/helpers.js';
import { mascot } from '../ui/mascot.js';
import { icon } from '../ui/icons.js';
import { DIAGRAMS } from '../data/learnDiagrams.js';
import { getParam } from '../router.js';

export function renderLearn(root) {
  const topic = LEARN_TOPICS.find((t) => t.id === getParam('topic'));
  if (topic) {
    renderTopic(root, topic);
    return;
  }
  root.innerHTML = `
    <div class="with-mascot">
      ${mascot('magnifier', { size: 96 })}
      <div>
        <h1 style="margin-top:0">Как это устроено</h1>
        <p class="lead">Короткие объяснения простым языком: что измеряет сайт, чего он не может и как читать результаты.</p>
      </div>
    </div>
    <ul class="tiles">
      ${LEARN_TOPICS.map((t) => `
        <li><a class="tile" href="#/learn?topic=${t.id}"><span class="metric-badge">${icon('BookOpen', 20)}</span><span class="tile-text"><strong>${escapeHtml(t.title)}</strong><span>${escapeHtml(t.summary)}</span></span></a></li>`).join('')}
    </ul>`;
}

function renderTopic(root, topic) {
  const i = LEARN_TOPICS.indexOf(topic);
  const next = LEARN_TOPICS[i + 1];
  root.innerHTML = `
    <p><a href="#/learn">← Все темы</a></p>
    <h1>${escapeHtml(topic.title)}</h1>
    ${DIAGRAMS[topic.id] ? DIAGRAMS[topic.id]() : ''}
    ${topic.sections.map((s) => `
      <section>
        <h2>${escapeHtml(s.heading)}</h2>
        <p>${escapeHtml(s.text)}</p>
      </section>`).join('')}
    <section class="card">
      <h2>Источники</h2>
      <ul>${topic.sources.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ul>
    </section>
    ${next ? `<p><a class="btn" href="#/learn?topic=${next.id}">Дальше: ${escapeHtml(next.title)}</a></p>` : ''}`;
}
