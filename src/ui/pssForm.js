// =====================================================================
// Форма опросника PSS-10 и сохранение результата.
// Используется на странице PSS-10 и в анкетах пилотного исследования.
// =====================================================================
import { put } from '../db/repo.js';
import { PSS } from '../config.js';
import { PSS_INSTRUCTION, PSS_ITEMS, PSS_ANSWER_LABELS, PSS_SOURCE, hasPlaceholders } from '../data/pss10.js';
import { scorePss, validateAnswers } from '../logic/pss.js';
import { dayKeyFor } from '../logic/dates.js';
import { makeId } from '../logic/id.js';
import { escapeHtml } from './helpers.js';

// HTML формы.
export function pssFormHtml() {
  const labels = PSS_ANSWER_LABELS[PSS.scale];
  return `
    ${hasPlaceholders(PSS.scale) ? `<p class="notice"><strong>Для автора проекта:</strong> тексты вопросов ещё не вставлены из опубликованной версии опросника
      (файл <code>src/data/pss10.js</code>). Пока на их месте заглушки.</p>` : ''}
    <form id="pss-form" novalidate>
      <p>${escapeHtml(PSS_INSTRUCTION)}</p>
      ${PSS_ITEMS.map((text, i) => `
        <fieldset class="card pss-item">
          <legend><span class="pss-num">${i + 1}.</span> ${escapeHtml(text)}</legend>
          <div class="radio-row">
            ${labels.map((l) => `
              <label class="radio-card"><input type="radio" name="q${i + 1}" value="${l.value}" /><span>${escapeHtml(l.label)}</span></label>`).join('')}
          </div>
        </fieldset>`).join('')}
      <p class="hint">Источник опросника: ${escapeHtml(PSS_SOURCE)}</p>
      <div id="pss-errors" role="alert"></div>
      <div class="actions">
        <button type="submit" class="btn btn-primary">Сохранить ответы</button>
      </div>
    </form>`;
}

// Подключить форму. onSaved(result) вызывается после сохранения.
//   context — повод: 'regular' (обычный), 'pilot-before', 'pilot-after'.
export function setupPssForm(root, { context = 'regular', onSaved }) {
  root.querySelector('#pss-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const answers = PSS_ITEMS.map((_, i) => {
      const v = e.target.querySelector(`input[name="q${i + 1}"]:checked`)?.value;
      return v === undefined ? null : Number(v);
    });
    const error = validateAnswers(answers, PSS.scale);
    if (error) {
      root.querySelector('#pss-errors').innerHTML = `<p class="error">${escapeHtml(error)}</p>`;
      // Перевести фокус на первый вопрос без ответа.
      const first = answers.findIndex((a) => a === null);
      if (first >= 0) e.target.querySelector(`input[name="q${first + 1}"]`).focus();
      return;
    }
    const now = new Date();
    const scores = scorePss(answers, PSS.scale);
    const result = {
      id: makeId(),
      day: dayKeyFor(now),
      completedAt: now.toISOString(),
      context,
      scale: PSS.scale,
      answers,
      total: scores.total,
      helplessness: scores.helplessness,
      selfEfficacy: scores.selfEfficacy,
    };
    await put('pss', result);
    onSaved(result);
  });
}
