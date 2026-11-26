// =====================================================================
// Страница «Пульс и давление»: ручной ввод своих измерений.
// Никакой медицинской оценки: значения только записываются.
// =====================================================================
import { getAll, put, remove } from '../db/repo.js';
import { makeId } from '../logic/id.js';
import { checkValues, buildRecord, POSTURES } from '../logic/physio.js';
import { PHYSIO_INPUT_LIMITS as L } from '../config.js';
import { PROTOCOL_SHORT, PROTOCOL_DETAILED } from '../data/physio.js';
import { escapeHtml, formatDateTime } from '../ui/helpers.js';
import { rerender } from '../router.js';

let flash = '';

// Текущее время для поля «дата и время» (формат ГГГГ-ММ-ДДTЧЧ:ММ, местное время).
function nowForInput() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

const POSTURE_LABELS = Object.fromEntries(POSTURES.map((p) => [p.value, p.label]));

export async function renderPhysio(root) {
  const records = (await getAll('physio')).sort((a, b) => b.measuredAt.localeCompare(a.measuredAt)).slice(0, 20);

  root.innerHTML = `
    <h1>Пульс и давление</h1>
    <p role="status" id="status" class="status">${escapeHtml(flash)}</p>
    <p class="notice">Здесь можно записывать собственные измерения — это необязательно.
      Сайт <strong>не оценивает</strong> значения, не сравнивает их с нормами и не делает выводов о здоровье или стрессе.</p>

    <section class="card card-important" aria-labelledby="h-protocol">
      <h2 id="h-protocol">Перед измерением</h2>
      <ul>${PROTOCOL_SHORT.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>
      <details class="table-details">
        <summary>Подробная инструкция</summary>
        <ul>${PROTOCOL_DETAILED.items.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>
        <p class="hint">Источник: ${escapeHtml(PROTOCOL_DETAILED.source)}</p>
      </details>
    </section>

    <form id="physio-form" class="card" novalidate>
      <h2>Новое измерение</h2>
      <div class="number-row">
        <label class="field">
          <span>Пульс, уд/мин</span>
          <input type="number" id="pulse" inputmode="numeric" min="${L.pulse.min}" max="${L.pulse.max}" step="1" />
        </label>
        <label class="field">
          <span>Давление верхнее</span>
          <input type="number" id="systolic" inputmode="numeric" min="${L.systolic.min}" max="${L.systolic.max}" step="1" />
        </label>
        <label class="field">
          <span>Давление нижнее</span>
          <input type="number" id="diastolic" inputmode="numeric" min="${L.diastolic.min}" max="${L.diastolic.max}" step="1" />
        </label>
      </div>
      <p class="hint">Все поля необязательны: можно записать только пульс. Давление — двумя числами вместе.</p>

      <fieldset>
        <legend>Поза</legend>
        <div class="radio-row">
          ${POSTURES.map((p) => `<label class="radio-card"><input type="radio" name="posture" value="${p.value}" ${p.value === 'sitting' ? 'checked' : ''} /><span>${p.label}</span></label>`).join('')}
        </div>
      </fieldset>
      ${yesNoHtml('rested', 'Перед измерением был отдых 5 минут?')}
      ${yesNoHtml('caffeine', 'Кофеин (кофе, крепкий чай, энергетик) за последние 2 часа?')}
      ${yesNoHtml('exercise', 'Физическая нагрузка за последний час?')}

      <label class="field">
        <span>Когда измерено</span>
        <input type="datetime-local" id="measuredAt" value="${nowForInput()}" max="${nowForInput()}" />
      </label>
      <p class="hint">Время суток определится автоматически. Если записываете измерение позже, поменяйте время.</p>

      <div id="errors" role="alert"></div>
      <div class="actions">
        <button type="submit" class="btn btn-primary">Сохранить измерение</button>
      </div>
    </form>

    <section aria-labelledby="h-recent">
      <h2 id="h-recent">Последние измерения</h2>
      ${records.length === 0 ? '<p class="hint">Измерений пока нет.</p>' : `
        <ul class="recent-list">
          ${records.map((r) => `
            <li>
              <span>${formatDateTime(r.measuredAt)} (${r.timeOfDay}) ·
                ${r.pulse !== null ? `пульс ${r.pulse}` : ''}${r.pulse !== null && r.systolic !== null ? ' · ' : ''}${r.systolic !== null ? `давление ${r.systolic}/${r.diastolic}` : ''}
                <span class="hint">${[POSTURE_LABELS[r.posture], r.rested5min === false ? 'без отдыха' : '', r.caffeine2h ? 'кофеин' : '', r.exercise1h ? 'нагрузка' : ''].filter(Boolean).join(', ')}</span>
                ${r.demo ? '<span class="tag">демо</span>' : ''}</span>
              <button type="button" class="btn btn-ghost btn-small" data-delete="${r.id}" aria-label="Удалить измерение ${formatDateTime(r.measuredAt)}">Удалить</button>
            </li>`).join('')}
        </ul>`}
    </section>`;
  flash = '';

  root.querySelector('#physio-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const { errors, values } = checkValues({
      pulse: f.querySelector('#pulse').value,
      systolic: f.querySelector('#systolic').value,
      diastolic: f.querySelector('#diastolic').value,
    });
    const measuredRaw = f.querySelector('#measuredAt').value;
    const measuredAt = measuredRaw ? new Date(measuredRaw) : new Date();
    if (Number.isNaN(measuredAt.getTime())) errors.push('Проверьте дату и время измерения.');
    else if (measuredAt.getTime() > Date.now() + 60000) errors.push('Время измерения не может быть в будущем.');
    if (errors.length) {
      root.querySelector('#errors').innerHTML = `<ul class="error">${errors.map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul>`;
      return;
    }
    const yn = (name) => {
      const v = f.querySelector(`input[name="${name}"]:checked`)?.value;
      return v === 'yes' ? true : v === 'no' ? false : null;
    };
    const record = buildRecord(makeId(), values, {
      posture: f.querySelector('input[name="posture"]:checked')?.value,
      rested: yn('rested'),
      caffeine: yn('caffeine'),
      exercise: yn('exercise'),
    }, measuredAt);
    await put('physio', record);
    flash = 'Измерение сохранено.';
    await rerender();
  });

  for (const btn of root.querySelectorAll('[data-delete]')) {
    btn.addEventListener('click', async () => {
      if (!confirm('Удалить это измерение?')) return;
      await remove('physio', btn.dataset.delete);
      flash = 'Измерение удалено.';
      await rerender();
    });
  }
}

function yesNoHtml(name, legend) {
  return `
    <fieldset>
      <legend>${legend}</legend>
      <div class="radio-row">
        <label class="radio-card"><input type="radio" name="${name}" value="yes" /><span>да</span></label>
        <label class="radio-card"><input type="radio" name="${name}" value="no" /><span>нет</span></label>
      </div>
    </fieldset>`;
}
