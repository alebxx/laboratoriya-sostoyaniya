// =====================================================================
// Элементы ввода, которые повторяются на разных страницах.
//
// Ползунок с состоянием «не отмечено»: у обычного ползунка всегда есть
// какое-то значение, и нельзя понять, ответил человек или просто не трогал.
// Поэтому пока ползунок не сдвинут, его значение считается пустым (null),
// а рядом написано «не отмечено». Кнопка «Сбросить» возвращает это состояние.
// =====================================================================
import { escapeHtml } from './helpers.js';

// HTML ползунка.
//   opts: { key, label, min, max, step, minLabel, maxLabel, unit }
//   value: сохранённое значение или null
export function sliderHtml(opts, value) {
  const { key, label, min, max, step = 1, minLabel = '', maxLabel = '', unit = '' } = opts;
  const touched = value !== null && value !== undefined;
  const start = touched ? value : (min + max) / 2;
  return `
    <div class="slider-field ${touched ? '' : 'is-unset'}" data-slider="${key}">
      <div class="slider-head">
        <label for="s-${key}">${escapeHtml(label)}</label>
        <output id="o-${key}" for="s-${key}" aria-hidden="true"></output>
      </div>
      <input type="range" id="s-${key}" name="${key}"
        min="${min}" max="${max}" step="${step}" value="${start}"
        data-touched="${touched}" data-unit="${escapeHtml(unit)}"
        aria-describedby="e-${key}" />
      <div class="slider-ends" id="e-${key}">
        <span>${escapeHtml(minLabel)}</span><span>${escapeHtml(maxLabel)}</span>
      </div>
      <button type="button" class="btn btn-ghost btn-small" data-clear="${key}">Сбросить</button>
    </div>`;
}

// Красиво показать число: 6.5 → «6,5».
function formatNumber(n) {
  return String(n).replace('.', ',');
}

// Обновить подпись ползунка и его описание для программ чтения с экрана.
function refreshSlider(input) {
  const field = input.closest('.slider-field');
  const output = field.querySelector('output');
  const touched = input.dataset.touched === 'true';
  const unit = input.dataset.unit ? ' ' + input.dataset.unit : '';
  const text = touched ? formatNumber(input.value) + unit : 'не отмечено';
  output.textContent = text;
  input.setAttribute('aria-valuetext', text);
  field.classList.toggle('is-unset', !touched);
}

// Подключить поведение всем ползункам внутри root.
export function setupSliders(root) {
  for (const input of root.querySelectorAll('.slider-field input[type="range"]')) {
    // Любое движение (мышью, пальцем, стрелками на клавиатуре) — значение отмечено.
    input.addEventListener('input', () => {
      input.dataset.touched = 'true';
      refreshSlider(input);
    });
    // Клик по ползунку без движения тоже считаем ответом.
    input.addEventListener('pointerup', () => {
      if (input.dataset.touched !== 'true') {
        input.dataset.touched = 'true';
        refreshSlider(input);
      }
    });
    refreshSlider(input);
  }
  for (const btn of root.querySelectorAll('[data-clear]')) {
    btn.addEventListener('click', () => {
      const input = root.querySelector(`#s-${btn.dataset.clear}`);
      input.dataset.touched = 'false';
      input.value = (Number(input.min) + Number(input.max)) / 2;
      refreshSlider(input);
    });
  }
}

// Значение ползунка: число или null, если не отмечено.
export function readSlider(root, key) {
  const input = root.querySelector(`#s-${key}`);
  return input.dataset.touched === 'true' ? Number(input.value) : null;
}
