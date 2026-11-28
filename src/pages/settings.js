// =====================================================================
// Настройки и данные: тема, устройство, возраст, экспорт, импорт, удаление.
// =====================================================================
import { getAllSettings, setSetting, clearEverything, getAllData, deleteDemoData } from '../db/repo.js';
import { generateCode, isValidCode, hasDemoData, PILOT_DEFAULT_AFTER_DAYS } from '../logic/pilot.js';
import { loadDemoData } from '../db/demoLoader.js';
import { exportAllData, exportStoreCsv, importAllData, CSV_TABLES } from '../db/exportImport.js';
import { setTheme, themePickerHtml, setupThemePicker } from '../ui/layout.js';
import { icon } from '../ui/icons.js';
import { catPickerHtml, readCatPicker } from '../ui/catPicker.js';
import { setMascotCat, DEFAULT_CAT, catName } from '../ui/mascot.js';
import { downloadFile, formatDateTime, fileDate, escapeHtml, showStatus } from '../ui/helpers.js';
import { DEVICE_TYPES } from './onboarding.js';
import { MIN_AGE } from '../config.js';
import { rerender } from '../router.js';

export async function renderSettings(root) {
  const s = await getAllSettings();
  const device = s.primaryDevice || {};
  const pilot = s.pilot || null;
  const demoPresent = hasDemoData(await getAllData());

  root.innerHTML = `
    <h1>Настройки и данные</h1>
    <p role="status" id="status" class="status"></p>

    <section class="card" aria-labelledby="h-theme">
      <h2 id="h-theme" class="card-title">${icon('SunMoon', 22)}Оформление</h2>
      ${themePickerHtml('theme')}
      <p class="hint">Экран теста внимания выглядит одинаково в обеих темах, чтобы тема не влияла на время реакции.</p>
    </section>

    <section class="card" aria-labelledby="h-cat">
      <h2 id="h-cat" class="card-title">${icon('Sparkles', 22)}Ваш котик</h2>
      <form id="cat-form" novalidate>
        ${catPickerHtml('cat', s.cat || DEFAULT_CAT)}
      </form>
      <p class="hint">Котик меняется сразу на всех страницах сайта.</p>
    </section>

    <section class="card metric-pulse" aria-labelledby="h-physio">
      <h2 id="h-physio" class="card-title"><span class="metric-badge">${icon('HeartPulse', 20)}</span>Пульс и давление</h2>
      <label class="check-row">
        <input type="checkbox" id="show-physio" ${s.showPhysio ? 'checked' : ''} />
        <span>Записывать пульс и давление (необязательно). Раздел появится в шаге «Наблюдай», показатели — на графиках.</span>
      </label>
      <p class="hint">Если выключить, уже сделанные записи не удаляются — они просто скрываются.</p>
    </section>

    <section class="card" aria-labelledby="h-device">
      <h2 id="h-device">Основное устройство для теста</h2>
      <p>Сейчас: <strong>${escapeHtml(device.name || 'не выбрано')}</strong></p>
      <form id="device-form">
        <fieldset>
          <legend>Тип устройства</legend>
          <div class="radio-row">
            ${DEVICE_TYPES.map(
              (d) => `<label class="radio-card">
                <input type="radio" name="device" value="${d.value}" ${device.type === d.value ? 'checked' : ''} required /><span>${d.label}</span>
              </label>`
            ).join('')}
          </div>
        </fieldset>
        <label class="field">
          <span>Название (необязательно)</span>
          <input type="text" name="deviceName" maxlength="40" autocomplete="off" value="${escapeHtml(device.name || '')}" />
        </label>
        <p class="hint">Если сменить основное устройство, в анализ по умолчанию будут попадать сеансы теста с нового устройства.</p>
        <button type="submit" class="btn">Сохранить устройство</button>
      </form>
    </section>

    <section class="card" aria-labelledby="h-age">
      <h2 id="h-age">Возраст</h2>
      <p>Ваш ответ: <strong>${s.age13plus ? `${MIN_AGE} лет или больше` : `младше ${MIN_AGE} лет`}</strong>.
         Опросник PSS-10 доступен с ${MIN_AGE} лет.</p>
      <button type="button" class="btn" id="age-toggle">
        ${s.age13plus ? `Изменить: мне меньше ${MIN_AGE} лет` : `Изменить: мне уже ${MIN_AGE} лет или больше`}
      </button>
    </section>

    <section class="card" aria-labelledby="h-export">
      <h2 id="h-export">Резервная копия и выгрузка</h2>
      <p>Последняя резервная копия (JSON): <strong>${formatDateTime(s.lastBackupAt)}</strong></p>
      <h3>Резервная копия (JSON)</h3>
      <p>Полная копия всех данных — для восстановления через «Загрузку из копии» на этом или другом устройстве.
         Этот файл предназначен для программы, а не для чтения: внутри он выглядит как код со скобками и кавычками. Так и должно быть.</p>
      <button type="button" class="btn btn-primary" id="export-json">${icon('Download', 18)}Скачать резервную копию (JSON)</button>

      <h3>Таблицы для просмотра (CSV)</h3>
      <p>Чтобы посмотреть свои данные в виде таблицы. Каждая таблица — отдельный файл.
         Открывайте его в Numbers, Excel или Google Таблицах: в обычном текстовом редакторе таблица выглядит как строки, разделённые точкой с запятой.</p>
      <div class="button-list">
        ${CSV_TABLES.map(
          (t) => `<button type="button" class="btn" data-csv="${t.store}" data-file="${t.file}">${t.title}</button>`
        ).join('')}
      </div>
    </section>

    <section class="card" aria-labelledby="h-import">
      <h2 id="h-import">Загрузка из копии</h2>
      <p><strong>Внимание:</strong> загрузка заменит все текущие данные данными из файла.</p>
      <label class="field">
        <span>Файл резервной копии (.json)</span>
        <input type="file" id="import-file" accept=".json,application/json" />
      </label>
    </section>

    <section class="card" aria-labelledby="h-demo">
      <h2 id="h-demo">Демо-режим</h2>
      <p>Тестовые данные за 30 дней — чтобы показать графики, гипотезы и самоэксперимент, например на защите проекта.
        Это выдуманные данные: каждая запись помечена как демо и удаляется одной кнопкой. Ваши собственные записи не затрагиваются:
        дни, за которые уже есть запись в дневнике, пропускаются.</p>
      ${demoPresent
        ? '<button type="button" class="btn" id="delete-demo-2">Удалить демо-данные</button>'
        : pilot?.enabled
          ? '<p class="notice">Во время пилотного исследования демо-данные добавлять нельзя.</p>'
          : '<button type="button" class="btn" id="load-demo">Заполнить тестовыми данными за 30 дней</button>'}
    </section>

    <section class="card" aria-labelledby="h-pilot">
      <h2 id="h-pilot">Пилотное исследование</h2>
      ${pilot?.enabled ? `
        <p>Режим пилота включён. Код участника: <strong class="code">${escapeHtml(pilot.code)}</strong>, начало ${formatDateTime(pilot.startedAt)}.</p>
        <div class="actions">
          <a class="btn" href="#/pilot">Открыть страницу пилота</a>
          <button type="button" class="btn btn-ghost" id="pilot-off">Выключить режим пилота</button>
        </div>` : `
        <p>Включайте, только если вы участвуете в пилотном исследовании. Вместо имени будет использоваться код участника,
          появятся анкеты «до» и «после» и выгрузка данных для исследователя.</p>
        ${demoPresent ? `
          <p class="notice">Сейчас в базе есть демо-данные. Пока они есть, режим пилота включить нельзя —
            чтобы они случайно не попали в исследование.</p>
          <button type="button" class="btn" id="delete-demo">Удалить демо-данные</button>` : `
          <form id="pilot-form" novalidate>
            <label class="field">
              <span>Код участника (если исследователь выдал код — введите его)</span>
              <input type="text" id="pilot-code" maxlength="12" autocomplete="off" value="${generateCode()}" />
            </label>
            <p class="hint">Только латинские буквы и цифры, без имени и фамилии.</p>
            <label class="field">
              <span>Через сколько дней анкета «после»</span>
              <input type="number" id="pilot-days" min="3" max="90" step="1" value="${PILOT_DEFAULT_AFTER_DAYS}" />
            </label>
            <div id="pilot-errors" role="alert"></div>
            <button type="submit" class="btn">Включить режим пилота</button>
          </form>`}`}
    </section>

    <section class="card card-danger" aria-labelledby="h-delete">
      <h2 id="h-delete">Удалить все данные</h2>
      <p>Будут удалены все записи, сеансы, гипотезы и настройки. Восстановить их можно только из резервной копии.</p>
      <button type="button" class="btn btn-danger" id="delete-all">Удалить все данные</button>
    </section>`;

  const status = root.querySelector('#status');
  const say = (text) => {
    showStatus(status, text);
  };
  // Ошибки — без галочки (галочка означает «получилось»).
  const sayError = (text) => {
    status.classList.remove('pop');
    status.textContent = text;
  };

  // Тема
  setupThemePicker(root, 'theme');

  // Смена котика — сохраняется сразу при выборе
  root.querySelector('#show-physio').addEventListener('change', async (e) => {
    await setSetting('showPhysio', e.target.checked);
    showStatus(document.getElementById('status'), e.target.checked ? 'Пульс и давление включены.' : 'Пульс и давление скрыты.');
  });

  root.querySelector('#cat-form').addEventListener('change', async (e) => {
    const cat = readCatPicker(e.currentTarget, 'cat');
    await setSetting('cat', cat);
    setMascotCat(cat);
    showStatus(document.getElementById('status'), `Теперь ваш котик — ${catName(cat)}.`);
  });

  // Устройство
  root.querySelector('#device-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const type = form.get('device');
    const typeLabel = DEVICE_TYPES.find((d) => d.value === type).label;
    const name = String(form.get('deviceName') || '').trim();
    await setSetting('primaryDevice', { type, name: name || typeLabel, userAgent: navigator.userAgent });
    await rerender();
    showStatus(document.getElementById('status'), 'Устройство сохранено.');
  });

  // Возраст
  root.querySelector('#age-toggle').addEventListener('click', async () => {
    await setSetting('age13plus', !s.age13plus);
    await rerender();
    showStatus(document.getElementById('status'), 'Ответ о возрасте изменён.');
  });

  // Экспорт JSON
  root.querySelector('#export-json').addEventListener('click', async () => {
    const data = await exportAllData();
    downloadFile(`laboratoriya-kopiya-${fileDate()}.json`, JSON.stringify(data, null, 2), 'application/json');
    await setSetting('lastBackupAt', new Date().toISOString());
    await setSetting('backupSnoozedUntil', null);
    await rerender();
    showStatus(document.getElementById('status'), 'Файл с копией данных скачан.');
  });

  // Экспорт CSV
  for (const btn of root.querySelectorAll('[data-csv]')) {
    btn.addEventListener('click', async () => {
      const csv = await exportStoreCsv(btn.dataset.csv);
      downloadFile(`laboratoriya-${btn.dataset.file}-${fileDate()}.csv`, csv, 'text/csv;charset=utf-8');
      say(`Таблица «${btn.textContent}» скачана.`);
    });
  }

  // Импорт
  root.querySelector('#import-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    let obj;
    try {
      obj = JSON.parse(await file.text());
    } catch {
      sayError('Не удалось прочитать файл: это не JSON.');
      e.target.value = '';
      return;
    }
    if (!confirm('Загрузить данные из файла? Все текущие данные будут заменены.')) {
      e.target.value = '';
      return;
    }
    const result = await importAllData(obj);
    if (result.ok) {
      say('Данные загружены.');
      await rerender();
      showStatus(document.getElementById('status'), 'Данные загружены из файла.');
    } else {
      sayError(result.error);
    }
    e.target.value = '';
  });

  // Пилот: включение, выключение, удаление демо-данных
  root.querySelector('#pilot-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = root.querySelector('#pilot-code').value.trim();
    const days = Number(root.querySelector('#pilot-days').value);
    const errors = [];
    if (!isValidCode(code)) errors.push('Код — от 2 до 12 латинских букв или цифр, без пробелов.');
    if (!Number.isInteger(days) || days < 3 || days > 90) errors.push('Число дней — от 3 до 90.');
    // Повторная проверка: демо-данные могли появиться в другой вкладке.
    if (hasDemoData(await getAllData())) errors.push('В базе есть демо-данные — сначала удалите их.');
    if (errors.length) {
      root.querySelector('#pilot-errors').innerHTML = `<ul class="error">${errors.map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul>`;
      return;
    }
    await setSetting('pilot', { enabled: true, code, afterDays: days, startedAt: new Date().toISOString() });
    location.hash = '#/pilot';
  });
  root.querySelector('#pilot-off')?.addEventListener('click', async () => {
    if (!confirm('Выключить режим пилота? Анкеты и данные сохранятся, но страница пилота скроется.')) return;
    await setSetting('pilot', { ...pilot, enabled: false });
    await rerender();
    showStatus(document.getElementById('status'), 'Режим пилота выключен.');
  });
  root.querySelector('#load-demo')?.addEventListener('click', async () => {
    const days = await loadDemoData();
    await rerender();
    showStatus(document.getElementById('status'), `Демо-данные добавлены (дней дневника: ${days}). Посмотрите «Карту состояния» и «Гипотезы».`);
  });
  root.querySelector('#delete-demo-2')?.addEventListener('click', async () => {
    if (!confirm('Удалить все демо-данные? Ваши собственные записи останутся.')) return;
    const n = await deleteDemoData();
    await rerender();
    showStatus(document.getElementById('status'), `Демо-данные удалены (записей: ${n}).`);
  });
  root.querySelector('#delete-demo')?.addEventListener('click', async () => {
    if (!confirm('Удалить все демо-данные? Ваши собственные записи останутся.')) return;
    const n = await deleteDemoData();
    await rerender();
    showStatus(document.getElementById('status'), `Демо-данные удалены (записей: ${n}).`);
  });

  // Удаление
  root.querySelector('#delete-all').addEventListener('click', async () => {
    if (!confirm('Удалить ВСЕ данные? Это нельзя отменить.')) return;
    if (!confirm('Точно удалить? Если резервной копии нет, данные пропадут навсегда.')) return;
    await clearEverything();
    setTheme('system');
    location.hash = '#/onboarding';
  });
}
