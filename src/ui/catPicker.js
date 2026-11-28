// =====================================================================
// Выбор котика-персонажа (первый вход и «Настройки и данные»).
// Каждый вариант — крупная карточка с котиком, именем и окрасом.
// =====================================================================
import { CATS, mascot } from './mascot.js';
import { escapeHtml } from './helpers.js';

export function catPickerHtml(name, selected) {
  return `
    <fieldset>
      <legend>Какой котик будет вашим персонажем?</legend>
      <div class="cat-picker">
        ${CATS.map((c) => `
          <label class="cat-option">
            <input type="radio" name="${name}" value="${c.id}" ${c.id === selected ? 'checked' : ''} />
            ${mascot('greet', { cat: c.id, size: 96 })}
            <strong>${escapeHtml(c.name)}</strong>
            <span>${escapeHtml(c.description)}</span>
          </label>`).join('')}
      </div>
    </fieldset>`;
}

// Выбранный в форме котик.
export function readCatPicker(root, name) {
  return root.querySelector(`input[name="${name}"]:checked`)?.value || CATS[0].id;
}
