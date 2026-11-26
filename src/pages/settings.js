// =====================================================================
// Настройки и данные: тема, устройство, возраст, экспорт, импорт, удаление.
// =====================================================================
import { getAllSettings, setSetting, clearEverything, getAllData, deleteDemoData } from '../db/repo.js';
import { generateCode, isValidCode, hasDemoData, PILOT_DEFAULT_AFTER_DAYS } from '../logic/pilot.js';
import { exportAllData, exportStoreCsv, importAllData, CSV_TABLES } from '../db/exportImport.js';
import { getTheme, setTheme } from '../ui/layout.js';
import { downloadFile, formatDateTime, fileDate, escapeHtml } from '../ui/helpers.js';
import { DEVICE_TYPES } from './onboarding.js';
import { MIN_AGE } from '../config.js';
import { rerender } from '../router.js';

export async function renderSettings(root) {
  const s = await getAllSettings();
  const device = s.primaryDevice || {};
  const theme = getTheme();
  const pilot = s.pilot || null;
  const demoPresent = hasDemoData(await getAllData());

  root.innerHTML = `
    <h1>Настройки и данные</h1>
    <p role="status" id="status" class="status"></p>

    <section class="card" aria-labelledby="h-theme">
      <h2 id="h-theme">Оформление</h2>
      <fieldset>
        <legend>Тема</legend>
        <div class="radio-row">
          ${[
            ['system', 'Как в системе'],
            ['light', 'Светлая'],
            ['dark', 'Тёмная'],
          ]
            .map(
              ([v, l]) => `<label class="radio-card">
                <input type="radio" name="theme" value="${v}" ${theme === v ? 'checked' : ''} /><span>${l}</span>
              </label>`
            )
            .join('')}
        </div>
      </fieldset>
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
      <button type="button" class="btn btn-primary" id="export-json">Скачать резервную копию (JSON)</button>

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

    <section class="card" aria-labelledby="h-pilot">
      <h2 id="h-pilot">Пилотное исследование</h2>
      ${pilot?.enabled ? `
        <p>Режим пилота включён. Код участника: <strong class="code">${escapeHtml(pilot.code)}</strong>, начало ${formatDateTime(pilot.startedAt)}.</p>
        <div class="actions">
          <a class="btn btn-primary" href="#/pilot">Открыть страницу пилота</a>
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
            <button type="submit" class="btn btn-primary">Включить режим пилота</button>
          </form>`}`}
    </section>

    <section class="card card-danger" aria-labelledby="h-delete">
      <h2 id="h-delete">Удалить все данные</h2>
      <p>Будут удалены все записи, сеансы, гипотезы и настройки. Восстановить их можно только из резервной копии.</p>
      <button type="button" class="btn btn-danger" id="delete-all">Удалить все данные</button>
    </section>`;

  const status = root.querySelector('#status');
  const say = (text) => {
    status.textContent = text;
  };

  // Тема
  for (const input of root.querySelectorAll('input[name="theme"]')) {
    input.addEventListener('change', () => setTheme(input.value));
  }

  // Устройство
  root.querySelector('#device-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const type = form.get('device');
    const typeLabel = DEVICE_TYPES.find((d) => d.value === type).label;
    const name = String(form.get('deviceName') || '').trim();
    await setSetting('primaryDevice', { type, name: name || typeLabel, userAgent: navigator.userAgent });
    await rerender();
    document.getElementById('status').textContent = 'Устройство сохранено.';
  });

  // Возраст
  root.querySelector('#age-toggle').addEventListener('click', async () => {
    await setSetting('age13plus', !s.age13plus);
    await rerender();
    document.getElementById('status').textContent = 'Ответ о возрасте изменён.';
  });

  // Экспорт JSON
  root.querySelector('#export-json').addEventListener('click', async () => {
    const data = await exportAllData();
    downloadFile(`laboratoriya-kopiya-${fileDate()}.json`, JSON.stringify(data, null, 2), 'application/json');
    await setSetting('lastBackupAt', new Date().toISOString());
    await setSetting('backupSnoozedUntil', null);
    await rerender();
    document.getElementById('status').textContent = 'Файл с копией данных скачан.';
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
      say('Не удалось прочитать файл: это не JSON.');
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
      document.getElementById('status').textContent = 'Данные загружены из файла.';
    } else {
      say(result.error);
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
    document.getElementById('status').textContent = 'Режим пилота выключен.';
  });
  root.querySelector('#delete-demo')?.addEventListener('click', async () => {
    if (!confirm('Удалить все демо-данные? Ваши собственные записи останутся.')) return;
    const n = await deleteDemoData();
    await rerender();
    document.getElementById('status').textContent = `Демо-данные удалены (записей: ${n}).`;
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
