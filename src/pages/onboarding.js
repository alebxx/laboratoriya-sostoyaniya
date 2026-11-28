// =====================================================================
// Первый вход: объяснение, вопрос о возрасте, выбор устройства.
// Три шага на одной странице; переход по кнопке «Дальше».
// =====================================================================
import { setSetting } from '../db/repo.js';
import { NOT_MEDICAL, PRIVACY, STORAGE_WARNING, CORRELATION_NOTE } from '../data/texts.js';
import { MIN_AGE } from '../config.js';
import { escapeHtml } from '../ui/helpers.js';
import { mascot, setMascotCat, DEFAULT_CAT } from '../ui/mascot.js';
import { catPickerHtml, readCatPicker } from '../ui/catPicker.js';
import { icon } from '../ui/icons.js';

export const DEVICE_TYPES = [
  { value: 'phone', label: 'Телефон' },
  { value: 'tablet', label: 'Планшет' },
  { value: 'computer', label: 'Компьютер' },
];

export function renderOnboarding(root) {
  // Ответы копим здесь и сохраняем в базу в самом конце.
  const answers = { age13plus: null, cat: DEFAULT_CAT };

  // ----- Шаг 1. Что это за сайт -----
  function step1() {
    root.innerHTML = `
      <div class="with-mascot">
        ${mascot('greet', { size: 110 })}
        <div>
          <p class="step-label">Шаг 1 из 5</p>
          <h1 style="margin-top:0">Добро пожаловать в «Лабораторию состояния»</h1>
        </div>
      </div>

      <section class="card">
        <h2 class="card-title">${icon('FlaskConical', 22)}Что делает сайт</h2>
        <ul>
          <li>Помогает вести короткий дневник: стресс, усталость, сон, настроение.</li>
          <li>Предлагает трёхминутный тест на внимание (время реакции).</li>
          <li>Позволяет записывать пульс и давление, если вы их измеряете сами.</li>
          <li>Помогает проверять собственные гипотезы: например, «когда я сплю меньше 7 часов, моя реакция медленнее».</li>
        </ul>
      </section>

      <section class="card card-important">
        <h2 class="card-title">${icon('Info', 22)}Чего сайт не делает</h2>
        <p>${NOT_MEDICAL}</p>
        <p>${CORRELATION_NOTE}</p>
      </section>

      <section class="card with-mascot">
        ${mascot('lock', { size: 84 })}
        <div>
          <h2 style="margin-top:0">Где хранятся данные</h2>
          <p>${PRIVACY}</p>
          <p>В разделе «Настройки и данные» можно в любой момент выгрузить все записи в файл (CSV или JSON) и полностью удалить их.</p>
        </div>
      </section>

      <section class="card card-warning">
        <h2 class="card-title">${icon('Download', 22)}Чтобы данные не потерялись</h2>
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
      <p class="step-label">Шаг 2 из 5</p>
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
    next.addEventListener('click', stepCat);
    focusHeading();
  }

  // ----- Шаг 3. Свой котик-персонаж -----
  function stepCat() {
    root.innerHTML = `
      <h1>Ваш персонаж</h1>
      <p class="step-label">Шаг 3 из 5</p>
      <form id="cat-form" class="card" novalidate>
        <p>Котик-исследователь будет встречать вас на сайте: здороваться, наблюдать вместе с вами и радоваться любому итогу проверки.
           Он ничего не оценивает. Сменить котика можно в любой момент в «Настройках и данных».</p>
        ${catPickerHtml('cat', answers.cat)}
        <div class="actions">
          <button type="button" class="btn btn-ghost" id="backCat">Назад</button>
          <button type="submit" class="btn btn-primary">Дальше</button>
        </div>
      </form>`;
    const form = root.querySelector('#cat-form');
    // Выбор сразу показываем — котик на следующих экранах будет уже ваш.
    form.addEventListener('change', () => {
      answers.cat = readCatPicker(form, 'cat');
      setMascotCat(answers.cat);
    });
    root.querySelector('#backCat').addEventListener('click', step2);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      answers.cat = readCatPicker(form, 'cat');
      setMascotCat(answers.cat);
      step3();
    });
    focusHeading();
  }

  // ----- Шаг 4. Основное устройство для теста -----
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
      <p class="step-label">Шаг 4 из 5</p>
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
          <button type="submit" class="btn btn-primary">Дальше</button>
        </div>
      </form>`;

    root.querySelector('#back3').addEventListener('click', stepCat);
    root.querySelector('#device-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = new FormData(e.target);
      const type = form.get('device');
      const typeLabel = DEVICE_TYPES.find((d) => d.value === type).label;
      const name = String(form.get('deviceName') || '').trim();

      answers.device = { type, name: name || typeLabel, userAgent: navigator.userAgent };
      stepCycle();
    });
    focusHeading();
  }

  // ----- Шаг 5. Как устроена работа: цикл -----
  function stepCycle() {
    root.innerHTML = `
      <p class="step-label">Шаг 5 из 5</p>
      <h1>Как это работает</h1>
      <section class="card">
        <p>Сайт помогает найти, что именно <strong>вам</strong> помогает справляться со стрессом. Для этого есть цикл из четырёх шагов:</p>
        <ol class="cycle-steps">
          <li><strong>Наблюдай.</strong> Неделю отмечайте в дневнике, как прошёл день, и проходите трёхминутный тест.</li>
          <li><strong>Заметь.</strong> Сайт покажет, что меняется вместе со стрессом, и подскажет, какие стратегии можно проверить.</li>
          <li><strong>Проверь.</strong> Выберите стратегию. Сайт случайно распределит дни «с ней» и «без неё» и через 2 недели сравнит их.</li>
          <li><strong>Используй.</strong> Итог попадёт в «Мой набор помощи». Потом можно проверить следующую стратегию.</li>
        </ol>
        ${answers.age13plus ? '<p>Ещё есть опросник PSS-10: его стоит пройти в начале и через 4 недели, чтобы сравнить.</p>' : ''}
      </section>
      <div class="actions">
        <button type="button" class="btn" id="back4">Назад</button>
        <button type="button" class="btn btn-primary" id="go-observe">Начать неделю наблюдения</button>
        ${answers.age13plus ? '<button type="button" class="btn" id="go-pss">Сначала пройти PSS-10</button>' : ''}
      </div>`;
    root.querySelector('#back4').addEventListener('click', step3);
    root.querySelector('#go-observe').addEventListener('click', () => finish('#/'));
    root.querySelector('#go-pss')?.addEventListener('click', () => finish('#/pss'));
    focusHeading();
  }

  // Сохранить ответы первого входа и перейти дальше.
  async function finish(target) {
    await setSetting('age13plus', answers.age13plus);
    await setSetting('cat', answers.cat);
    await setSetting('primaryDevice', answers.device);
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
    location.hash = target;
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
