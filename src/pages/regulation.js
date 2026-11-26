// =====================================================================
// Страница «Саморегуляция»: дыхательное упражнение и советы.
// Без обещаний: сайт не утверждает, что упражнение или совет «снижает стресс».
// Вместо этого — предложение проверить на себе (самоэксперимент).
// =====================================================================
import { BREATHING } from '../config.js';
import { phaseAt, totalMs, plannedCycles, clampSettings } from '../logic/breathing.js';
import { TIPS } from '../data/tips.js';
import { escapeHtml } from '../ui/helpers.js';

const PHASE_NAMES = { inhale: 'Вдох', exhale: 'Выдох' };

export function renderRegulation(root) {
  let timer = null; // идущее упражнение
  const settings = { inhaleSec: BREATHING.inhaleSec, exhaleSec: BREATHING.exhaleSec, durationMin: BREATHING.durationMin };

  root.innerHTML = `
    <h1>Саморегуляция</h1>
    <p class="notice">То, что помогает одним, может не помогать другим. Проверьте на себе:
      для этого есть самоэксперимент с чередованием дней.</p>

    <section class="card" aria-labelledby="h-breath">
      <h2 id="h-breath">Дыхательное упражнение</h2>
      <!-- TODO: сверить с источником [предостережение «если неприятно или кружится голова — остановитесь» добавлено разработчиком] -->
      <p>Медленное дыхание в заданном темпе: следите за кругом — он растёт на вдохе и уменьшается на выдохе.
        Дышите спокойно, без усилия. Если неприятно или кружится голова — остановитесь.</p>

      <form id="breath-settings" class="number-row" novalidate>
        <label class="field">
          <span>Вдох, секунд</span>
          <input type="number" id="inhale" min="${BREATHING.minPhaseSec}" max="${BREATHING.maxPhaseSec}" step="1" value="${settings.inhaleSec}" />
        </label>
        <label class="field">
          <span>Выдох, секунд</span>
          <input type="number" id="exhale" min="${BREATHING.minPhaseSec}" max="${BREATHING.maxPhaseSec}" step="1" value="${settings.exhaleSec}" />
        </label>
        <label class="field">
          <span>Длительность, минут</span>
          <input type="number" id="duration" min="${BREATHING.minDurationMin}" max="${BREATHING.maxDurationMin}" step="1" value="${settings.durationMin}" />
        </label>
      </form>

      <div class="breath-stage">
        <div class="breath-circle" id="circle" aria-hidden="true"></div>
        <p class="breath-phase" id="phase" aria-live="polite">Готово к началу</p>
        <p class="breath-seconds" id="seconds" aria-hidden="true"></p>
        <progress id="phase-progress" max="1" value="0" aria-hidden="true"></progress>
        <p class="hint" id="remaining"></p>
      </div>

      <div class="actions">
        <button type="button" class="btn btn-primary" id="start">Начать</button>
        <button type="button" class="btn" id="stop" disabled>Остановить</button>
      </div>

      <div class="card card-important">
        <p>Хотите узнать, есть ли разница именно для вас? Проверьте это в самоэксперименте:
          сайт случайно распределит дни «с упражнением» и «без», а потом сравнит их.</p>
        <a class="btn" id="check-breathing" href="#">Проверить, помогает ли это мне</a>
      </div>
    </section>

    <section aria-labelledby="h-tips">
      <h2 id="h-tips">Советы</h2>
      <p class="hint">Советы взяты из опубликованных рекомендаций — источник указан под каждым.</p>
      ${TIPS.map((group) => `
        <section class="card" aria-labelledby="tips-${group.id}">
          <h3 id="tips-${group.id}">${escapeHtml(group.title)}</h3>
          <ul class="tips-list">
            ${group.items.map((t) => `
              <li>
                <p>${escapeHtml(t.text)}</p>
                <p class="hint">Источник: ${t.url
                  ? `<a href="${escapeHtml(t.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t.source)}</a>`
                  : escapeHtml(t.source)}</p>
              </li>`).join('')}
          </ul>
        </section>`).join('')}
      <div class="actions">
        <a class="btn" href="#/experiments/new">Выбрать совет и проверить его на себе</a>
      </div>
    </section>`;

  const circle = root.querySelector('#circle');
  const phaseEl = root.querySelector('#phase');
  const secondsEl = root.querySelector('#seconds');
  const progressEl = root.querySelector('#phase-progress');
  const remainingEl = root.querySelector('#remaining');
  const startBtn = root.querySelector('#start');
  const stopBtn = root.querySelector('#stop');
  const form = root.querySelector('#breath-settings');

  const readSettings = () =>
    Object.assign(settings, clampSettings({
      inhaleSec: Number(form.querySelector('#inhale').value),
      exhaleSec: Number(form.querySelector('#exhale').value),
      durationMin: Number(form.querySelector('#duration').value),
    }));

  // Ссылка «Проверить, помогает ли это мне» — с подставленными условиями.
  const updateCheckLink = () => {
    readSettings();
    const a = `дыхательное упражнение ${settings.durationMin} мин (вдох ${settings.inhaleSec} с, выдох ${settings.exhaleSec} с)`;
    const b = 'без дыхательного упражнения';
    root.querySelector('#check-breathing').href = `#/experiments/new?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`;
  };
  updateCheckLink();
  form.addEventListener('input', updateCheckLink);

  const updateRemaining = (ms) => {
    const s = Math.max(0, Math.ceil(ms / 1000));
    remainingEl.textContent = `Осталось ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };
  updateRemaining(totalMs(settings.durationMin, settings.inhaleSec, settings.exhaleSec));

  function start() {
    readSettings();
    // Поля приводим к допустимым значениям, чтобы человек видел реальный темп.
    form.querySelector('#inhale').value = settings.inhaleSec;
    form.querySelector('#exhale').value = settings.exhaleSec;
    form.querySelector('#duration').value = settings.durationMin;
    for (const input of form.querySelectorAll('input')) input.disabled = true;
    startBtn.disabled = true;
    stopBtn.disabled = false;
    stopBtn.focus();

    const total = totalMs(settings.durationMin, settings.inhaleSec, settings.exhaleSec);
    const startedAt = performance.now();
    let lastPhase = null;

    const tick = () => {
      const elapsed = performance.now() - startedAt;
      if (elapsed >= total) {
        finish(true);
        return;
      }
      const p = phaseAt(elapsed, settings.inhaleSec, settings.exhaleSec);
      if (p.phase !== lastPhase) {
        lastPhase = p.phase;
        // Смена фазы: круг плавно растёт или уменьшается за всю длину фазы.
        const sec = p.phase === 'inhale' ? settings.inhaleSec : settings.exhaleSec;
        circle.style.transitionDuration = `${sec}s`;
        circle.classList.toggle('is-inhale', p.phase === 'inhale');
        phaseEl.textContent = PHASE_NAMES[p.phase];
      }
      secondsEl.textContent = p.secondsLeftInPhase;
      progressEl.value = p.progressInPhase;
      updateRemaining(total - elapsed);
      timer = requestAnimationFrame(tick);
    };
    timer = requestAnimationFrame(tick);
  }

  function finish(completed) {
    if (timer) cancelAnimationFrame(timer);
    timer = null;
    circle.style.transitionDuration = '1s';
    circle.classList.remove('is-inhale');
    phaseEl.textContent = completed
      ? `Упражнение завершено (${plannedCycles(settings.durationMin, settings.inhaleSec, settings.exhaleSec)} циклов).`
      : 'Остановлено';
    secondsEl.textContent = '';
    progressEl.value = 0;
    updateRemaining(totalMs(settings.durationMin, settings.inhaleSec, settings.exhaleSec));
    for (const input of form.querySelectorAll('input')) input.disabled = false;
    startBtn.disabled = false;
    stopBtn.disabled = true;
    startBtn.focus();
  }

  startBtn.addEventListener('click', start);
  stopBtn.addEventListener('click', () => finish(false));

  // При уходе со страницы упражнение останавливается.
  return () => {
    if (timer) cancelAnimationFrame(timer);
  };
}
