// =====================================================================
// Первый вход: объяснение, вопрос о возрасте, выбор устройства.
// Три шага на одной странице; переход по кнопке «Дальше».
// =====================================================================
import { setSetting } from '../db/repo.js';
import { NOT_MEDICAL, PRIVACY, STORAGE_WARNING, CORRELATION_NOTE } from '../data/texts.js';
import { MIN_AGE } from '../config.js';
import { escapeHtml } from '../ui/helpers.js';

export const DEVICE_TYPES = [
  { value: 'phone', label: 'Телефон' },
  { value: 'tablet', label: 'Планшет' },
  { value: 'computer', label: 'Компьютер' },
];

export function renderOnboarding(root) {
  // Ответы копим здесь и сохраняем в базу в самом конце.
  const answers = { age13plus: null };

  // ----- Шаг 1. Что это за сайт -----
  function step1() {
    root.innerHTML = `
      <h1>Добро пожаловать в «Лабораторию состояния»</h1>
      <p class="step-label">Шаг 1 из 3</p>

      <section class="card">
        <h2>Что делает сайт</h2>
        <ul>
          <li>Помогает вести короткий дневник: стресс, усталость, сон, настроение.</li>
          <li>Предлагает трёхминутный тест на внимание (время реакции).</li>
          <li>Позволяет записывать пульс и давление, если вы их измеряете сами.</li>
          <li>Помогает проверять собственные гипотезы: например, «когда я сплю меньше 7 часов, моя реакция медленнее».</li>
        </ul>
      </section>

      <section class="card card-important">
        <h2>Чего сайт не делает</h2>
        <p>${NOT_MEDICAL}</p>
        <p>${CORRELATION_NOTE}</p>
      </section>

      <section class="card">
        <h2>Где хранятся данные</h2>
        <p>${PRIVACY}</p>
        <p>В разделе «Настройки и данные» можно в любой момент выгрузить все записи в файл (CSV или JSON) и полностью удалить их.</p>
      </section>

      <section class="card card-warning">
        <h2>Чтобы данные не потерялись</h2>
        <p>${STORAGE_WARNING}</p>
      </section>

      <div class="actions">
        <button type="button" class="btn btn-primary" id="next1">Понятно, дальше</button>
      </div>`;
    root.querySelector('#next1').addEventListener('click', step2);
    focusHeading();
  }

  // ----- Шаг 2. Возраст -----
  function step2() {
    root.innerHTML = `
      <h1>Возраст</h1>
      <p class="step-label">Шаг 2 из 3</p>
      <section class="card">
        <p>Сайт рассчитан на пользователей ${MIN_AGE} лет и старше. Дату рождения мы не спрашиваем.</p>
        <p id="age-q"><strong>Вам ${MIN_AGE} лет или больше?</strong></p>
        <div class="choice-row" role="group" aria-labelledby="age-q">
          <button type="button" class="btn btn-choice" data-age="yes">Да</button>
          <button type="button" class="btn btn-choice" data-age="no">Нет</button>
        </div>
        <div id="age-message" role="status"></div>
      </section>
      <div class="actions">
        <button type="button" class="btn btn-ghost" id="back2">Назад</button>
        <button type="button" class="btn btn-primary" id="next2" disabled>Дальше</button>
      </div>`;

    const msg = root.querySelector('#age-message');
    const next = root.querySelector('#next2');
    for (const btn of root.querySelectorAll('[data-age]')) {
      btn.addEventListener('click', () => {
        answers.age13plus = btn.dataset.age === 'yes';
        for (const b of root.querySelectorAll('[data-age]')) {
          b.setAttribute('aria-pressed', String(b === btn));
        }
        msg.innerHTML = answers.age13plus
          ? ''
          : `<p class="notice">Сайт рассчитан на пользователей ${MIN_AGE} лет и старше.
             Вы можете им пользоваться, но опросник PSS-10 будет недоступен.
             Если что-то непонятно, попросите помочь взрослого.</p>`;
        next.disabled = false;
      });
    }
    root.querySelector('#back2').addEventListener('click', step1);
    next.addEventListener('click', step3);
    focusHeading();
  }

  // ----- Шаг 3. Основное устройство для теста -----
  function step3() {
    const options = DEVICE_TYPES.map(
      (d, i) => `
        <label class="radio-card">
          <input type="radio" name="device" value="${d.value}" ${i === 0 ? 'required' : ''} />
          <span>${d.label}</span>
        </label>`
    ).join('');

    root.innerHTML = `
      <h1>Основное устройство</h1>
      <p class="step-label">Шаг 3 из 3</p>
      <form id="device-form" class="card">
        <p>Время реакции на разных устройствах измеряется по-разному: у экранов и сенсоров свои задержки.
           Поэтому лучше проходить тест всегда на одном устройстве. На каком вы будете проходить его чаще всего?</p>
        <fieldset>
          <legend>Тип устройства</legend>
          <div class="radio-row">${options}</div>
        </fieldset>
        <label class="field">
          <span>Название (необязательно), например «мой ноутбук»</span>
          <input type="text" name="deviceName" maxlength="40" autocomplete="off" />
        </label>
        <div class="actions">
          <button type="button" class="btn btn-ghost" id="back3">Назад</button>
          <button type="submit" class="btn btn-primary">Начать</button>
        </div>
      </form>`;

    root.querySelector('#back3').addEventListener('click', step2);
    root.querySelector('#device-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = new FormData(e.target);
      const type = form.get('device');
      const typeLabel = DEVICE_TYPES.find((d) => d.value === type).label;
      const name = String(form.get('deviceName') || '').trim();

      await setSetting('age13plus', answers.age13plus);
      await setSetting('primaryDevice', {
        type,
        name: name || typeLabel,
        userAgent: navigator.userAgent,
      });
      await setSetting('firstRunAt', new Date().toISOString());
      await setSetting('onboardingDone', true);

      // Просим браузер не удалять данные сайта при нехватке места.
      // Браузер может согласиться молча, спросить или отказать — это нормально.
      if (navigator.storage && navigator.storage.persist) {
        try {
          await navigator.storage.persist();
        } catch {
          /* не страшно */
        }
      }
      location.hash = '#/';
    });
    focusHeading();
  }

  function focusHeading() {
    const h1 = root.querySelector('h1');
    h1.setAttribute('tabindex', '-1');
    h1.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  step1();
}

// Название устройства для показа в интерфейсе.
export function deviceLabel(device) {
  if (!device) return 'не выбрано';
  return escapeHtml(device.name);
}
