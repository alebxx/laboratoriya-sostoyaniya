// =====================================================================
// Страница «Тест внимания» (PVT-B).
// Экраны: инструкция → тест во весь экран → два вопроса → результат.
// Сам ход теста (тайминг) — в src/logic/pvtRunner.js.
// =====================================================================
import { getAll, put, putMany, getAllSettings } from '../db/repo.js';
import { PVT } from '../config.js';
import { createPvtRunner } from '../logic/pvtRunner.js';
import { summarizeSession } from '../logic/pvt.js';
import { median } from '../logic/stats.js';
import { dayKeyFor } from '../logic/dates.js';
import { makeId } from '../logic/id.js';
import { guessDeviceType } from '../logic/device.js';
import { exclusionReason, EXCLUSION_LABELS, isNextPractice, nextPracticeNumber } from '../logic/sessionFilter.js';
import { PVT_INSTRUCTION, PVT_PREPARATION } from '../data/pvtTexts.js';
import { DEVICE_TYPES } from './onboarding.js';
import { sliderHtml, setupSliders, readSlider } from '../ui/fields.js';
import { escapeHtml, formatDateTime } from '../ui/helpers.js';

const DEVICE_NAMES = { phone: 'телефон', tablet: 'планшет', computer: 'компьютер' };

export async function renderPvt(root) {
  await closeStaleSessions();
  const settings = await getAllSettings();
  const primary = settings.primaryDevice || { type: 'computer', name: 'Компьютер' };

  // Всё, что нужно остановить, если пользователь уйдёт со страницы во время теста.
  let activeTest = null;

  showIntro();

  // Функция «уборки»: роутер вызовет её при переходе на другую страницу.
  return () => {
    if (activeTest) activeTest.abort('left-page');
  };

  // ---------------------------------------------------------------
  // Экран 1. Инструкция и подготовка
  // ---------------------------------------------------------------
  async function showIntro() {
    const sessions = await getAll('pvtSessions');
    const practice = isNextPractice(sessions);
    const guess = guessDeviceType(navigator.userAgent, navigator.maxTouchPoints || 0);
    const usualTime = usualStartTime(sessions);

    root.innerHTML = `
      <h1>Тест внимания</h1>
      <p class="lead">Трёхминутный тест на время реакции (вариант PVT-B). Он измеряет, насколько быстро и стабильно вы реагируете на сигнал, — это показатель бдительности, а не стресса.</p>

      ${practice ? `
        <p class="notice">Это будет <strong>тренировочный сеанс ${nextPracticeNumber(sessions)} из ${PVT.practiceSessions}</strong>.
          Первые сеансы нужны, чтобы привыкнуть к тесту: результаты в начале обычно быстро улучшаются просто от практики.
          Поэтому тренировочные сеансы не входят в анализ.</p>` : ''}

      <section class="card" aria-labelledby="h-how">
        <h2 id="h-how">Как проходить</h2>
        <ul>${PVT_INSTRUCTION.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>
      </section>

      <section class="card" aria-labelledby="h-prep">
        <h2 id="h-prep">Перед началом</h2>
        <ul>${PVT_PREPARATION.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>
        ${usualTime ? `<p class="hint">Раньше вы обычно проходили тест около <strong>${usualTime}</strong>.</p>` : ''}
      </section>

      <form id="start-form" class="card" novalidate>
        <fieldset>
          <legend>На каком устройстве вы проходите тест сейчас?</legend>
          <div class="radio-row">
            ${DEVICE_TYPES.map((d) => `
              <label class="radio-card">
                <input type="radio" name="device" value="${d.value}" ${d.value === guess ? 'checked' : ''} />
                <span>${d.label}</span>
              </label>`).join('')}
          </div>
        </fieldset>
        <div id="device-warning" role="status"></div>
        <div class="actions">
          <button type="submit" class="btn btn-primary">Начать тест (${Math.round(PVT.durationSec / 60)} мин)</button>
        </div>
      </form>

      ${historyHtml(sessions, primary)}

      <p><a href="#/pvt-selfcheck">Для автора проекта: самопроверка теста</a></p>`;

    const form = root.querySelector('#start-form');
    const warning = root.querySelector('#device-warning');
    const updateWarning = () => {
      const type = form.querySelector('input[name="device"]:checked')?.value;
      warning.innerHTML =
        type && type !== primary.type
          ? `<p class="notice">Ваше основное устройство — <strong>${escapeHtml(primary.name)}</strong>.
             Время реакции на разных устройствах измеряется по-разному (у экранов и сенсоров свои задержки),
             поэтому сеанс с другого устройства по умолчанию <strong>не войдёт в анализ</strong>.
             Основное устройство можно поменять в разделе «Настройки и данные».</p>`
          : '';
    };
    form.addEventListener('change', updateWarning);
    updateWarning();

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const type = form.querySelector('input[name="device"]:checked')?.value || guess;
      // Полноэкранный режим браузер разрешает только сразу в ответ на нажатие,
      // поэтому просим его здесь, до любых других действий, и НЕ ждём ответа:
      // если браузер откажет (например, на iPhone), тест пройдёт в окне на всю страницу.
      try {
        const request = document.documentElement.requestFullscreen?.();
        if (request) request.catch(() => {});
      } catch {
        /* не страшно */
      }
      runTest(type, sessions);
    });
  }

  // ---------------------------------------------------------------
  // Экран 2. Сам тест (во весь экран)
  // ---------------------------------------------------------------
  async function runTest(deviceType, previousSessions) {
    const session = {
      id: makeId(),
      day: dayKeyFor(new Date()),
      startedAt: new Date().toISOString(),
      endedAt: null,
      // 'running' — пока идёт тест. Если страницу закроют, запись так и останется
      // «running», и при следующем открытии будет помечена как прерванная.
      status: 'running',
      device: { type: deviceType, isPrimary: deviceType === primary.type, userAgent: navigator.userAgent },
      config: { ...PVT },
      screen: { width: screen.width, height: screen.height, pixelRatio: window.devicePixelRatio },
    };
    await put('pvtSessions', session);

    // Окно теста — поверх всей страницы.
    const overlay = document.createElement('div');
    overlay.className = 'pvt-overlay';
    overlay.innerHTML = `
      <button type="button" class="btn btn-ghost pvt-abort" tabindex="-1">Прервать тест</button>
      <div class="pvt-frame" id="pvt-frame" aria-label="Поле теста: нажмите пробел или коснитесь, когда появятся цифры">
        <div class="pvt-display" id="pvt-display" aria-live="off"></div>
      </div>
      <p class="pvt-hint">Пробел, клик или касание — когда появятся цифры</p>`;
    document.body.appendChild(overlay);
    document.body.classList.add('pvt-running');
    if (document.activeElement) document.activeElement.blur();

    const frame = overlay.querySelector('#pvt-frame');
    const display = overlay.querySelector('#pvt-display');

    // Длительности кадров экрана — чтобы оценить частоту обновления (для самопроверки).
    const frameIntervals = [];
    let lastFrameTs = null;

    const runner = createPvtRunner({ onChange: draw });

    function draw(r) {
      if (r.phase === 'waiting') {
        display.textContent = '';
        display.className = 'pvt-display';
      } else if (r.phase === 'stimulus') {
        display.textContent = '0';
        display.className = 'pvt-display is-stimulus';
        lastFrameTs = null;
        requestAnimationFrame(tick);
      } else if (r.phase === 'feedback') {
        const f = r.lastFeedback;
        display.className = 'pvt-display is-feedback';
        if (f.kind === 'rt') display.textContent = `${Math.round(f.rt)} мс`;
        else if (f.kind === 'early') display.textContent = 'Рано!';
        else display.textContent = 'Нет ответа';
      } else if (r.phase === 'finished') {
        finish(true);
      } else if (r.phase === 'aborted') {
        finish(false);
      }
    }

    // Бегущий счётчик миллисекунд, пока виден сигнал.
    function tick(ts) {
      if (runner.phase !== 'stimulus') return;
      if (lastFrameTs !== null && frameIntervals.length < 2000) frameIntervals.push(ts - lastFrameTs);
      lastFrameTs = ts;
      display.textContent = String(Math.floor(performance.now() - runner.stimulusAt));
      requestAnimationFrame(tick);
    }

    // Момент нажатия: event.timeStamp — время самого события (по тем же часам,
    // что и performance.now()). Оно точнее, чем время, когда до него дошла очередь.
    function eventTime(e) {
      const nowTs = performance.now();
      const t = e.timeStamp;
      return t > 0 && nowTs - t >= 0 && nowTs - t < 1000 ? t : nowTs;
    }

    function onKeyDown(e) {
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault(); // чтобы страница не прокручивалась
        if (!e.repeat) runner.respond(eventTime(e), 'key');
      }
    }
    function onKeyUp(e) {
      if (e.code === 'Space' || e.key === ' ') e.preventDefault();
    }
    function onPointerDown(e) {
      e.preventDefault();
      runner.respond(eventTime(e), e.pointerType || 'mouse');
    }
    // Вкладку свернули или переключились на другое приложение — тест прерывается.
    function onVisibility() {
      if (document.visibilityState === 'hidden') runner.abort('hidden');
    }

    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    frame.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('visibilitychange', onVisibility);
    overlay.querySelector('.pvt-abort').addEventListener('click', () => runner.abort('user'));

    activeTest = runner;
    runner.start();

    async function finish(completed) {
      activeTest = null;
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      document.removeEventListener('visibilitychange', onVisibility);
      if (document.fullscreenElement) {
        // Выходим из полноэкранного режима, не дожидаясь ответа браузера.
        document.exitFullscreen().catch(() => {});
      }
      overlay.remove();
      document.body.classList.remove('pvt-running');

      const trials = runner.trials.map((t) => ({ ...t, id: makeId(), sessionId: session.id }));
      const metrics = summarizeSession(trials);
      Object.assign(session, metrics, {
        endedAt: new Date().toISOString(),
        status: completed ? 'completed' : 'aborted',
        abortReason: completed ? null : runner.abortReason,
        // Тренировочный — если до него было завершено меньше N сеансов.
        practice: completed ? isNextPractice(previousSessions) : false,
        frameMs: frameIntervals.length ? Math.round(median(frameIntervals) * 10) / 10 : null,
      });
      await put('pvtSessions', session);
      await putMany('pvtTrials', trials);

      // Если ушли со страницы — больше ничего не рисуем.
      if (runner.abortReason === 'left-page') return;
      if (completed) showQuestions(session);
      else showAborted(session);
    }
  }

  // ---------------------------------------------------------------
  // Экран 3. Два вопроса после теста
  // ---------------------------------------------------------------
  function showQuestions(session) {
    root.innerHTML = `
      <h1>Тест завершён</h1>
      <p class="lead">Ответьте на два коротких вопроса — это поможет понимать результаты.</p>
      <form id="q-form" class="card" novalidate>
        ${sliderHtml({ key: 'alertness', label: 'Насколько бодрым(ой) вы себя чувствуете?', min: 0, max: 100, minLabel: '0 — совсем не бодрым(ой)', maxLabel: '100 — очень бодрым(ой)' }, null)}
        ${sliderHtml({ key: 'effort', label: 'Насколько вы старались?', min: 0, max: 100, minLabel: '0 — совсем не старался(ась)', maxLabel: '100 — старался(ась) изо всех сил' }, null)}
        <fieldset>
          <legend>Были ли отвлечения во время теста?</legend>
          <div class="radio-row">
            <label class="radio-card"><input type="radio" name="distractions" value="yes" /><span>да</span></label>
            <label class="radio-card"><input type="radio" name="distractions" value="no" /><span>нет</span></label>
          </div>
        </fieldset>
        <div class="actions">
          <button type="submit" class="btn btn-primary">Сохранить и посмотреть результат</button>
          <button type="button" class="btn btn-ghost" id="skip">Пропустить</button>
        </div>
      </form>`;
    focusH1();
    setupSliders(root);

    root.querySelector('#q-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const d = e.target.querySelector('input[name="distractions"]:checked')?.value;
      session.alertness = readSlider(root, 'alertness');
      session.effort = readSlider(root, 'effort');
      session.distractions = d === 'yes' ? true : d === 'no' ? false : null;
      await put('pvtSessions', session);
      showResult(session);
    });
    root.querySelector('#skip').addEventListener('click', () => showResult(session));
  }

  // ---------------------------------------------------------------
  // Экран 4. Результат сеанса
  // ---------------------------------------------------------------
  function showResult(session) {
    const reason = exclusionReason(session, primary.type);
    root.innerHTML = `
      <h1>Результат сеанса</h1>
      ${reason === 'practice' ? `<p class="notice">Это тренировочный сеанс — он не входит в анализ и будет выделен на графиках.</p>` : ''}
      ${reason === 'otherDevice' ? `<p class="notice">Сеанс пройден не на основном устройстве — по умолчанию он не входит в анализ.</p>` : ''}
      <section class="card">
        <dl class="metrics">
          <div><dt>Медиана времени реакции</dt><dd>${fmt(session.medianRt, ' мс')}</dd>
            <p class="hint">Главный показатель: половина ваших реакций была быстрее, половина — медленнее.</p></div>
          <div><dt>Скорость реакции</dt><dd>${fmt(session.meanSpeed)}</dd>
            <p class="hint">Среднее значение 1/время реакции (в 1/с). Учитывает и медленные реакции.</p></div>
          <div><dt>Пропуски</dt><dd>${session.lapses}</dd>
            <p class="hint">Реакции не быстрее ${PVT.lapseMs} мс.</p></div>
          <div><dt>Фальстарты</dt><dd>${session.falseStarts}</dd>
            <p class="hint">Нажатия до сигнала или быстрее ${PVT.falseStartMs} мс.</p></div>
          <div><dt>Сигналов</dt><dd>${session.stimuli}</dd></div>
        </dl>
      </section>
      <p class="hint">Это не оценка и не сравнение с другими людьми. Сравнивайте только свои сеансы между собой:
        на время реакции влияют сон, время суток, усталость, устройство и многое другое.</p>
      <div class="actions">
        <a class="btn btn-primary" href="#/">На главную</a>
        <button type="button" class="btn" id="again">К тесту</button>
      </div>`;
    focusH1();
    root.querySelector('#again').addEventListener('click', showIntro);
  }

  // Тест прерван.
  function showAborted(session) {
    const why = {
      hidden: 'вкладка была свёрнута или вы переключились на другое приложение',
      user: 'вы нажали «Прервать тест»',
    }[session.abortReason] || 'тест был остановлен';
    root.innerHTML = `
      <h1>Тест прерван</h1>
      <p class="notice">Причина: ${why}. Незавершённый сеанс сохранён с пометкой «незавершённый» и <strong>не войдёт в анализ</strong>.</p>
      <div class="actions">
        <button type="button" class="btn btn-primary" id="again">Пройти заново</button>
        <a class="btn" href="#/">На главную</a>
      </div>`;
    focusH1();
    root.querySelector('#again').addEventListener('click', showIntro);
  }

  function focusH1() {
    const h1 = root.querySelector('h1');
    h1.setAttribute('tabindex', '-1');
    h1.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
}

// Сеансы, которые остались «идущими» (страницу закрыли посреди теста),
// помечаем как прерванные.
async function closeStaleSessions() {
  const stale = (await getAll('pvtSessions')).filter((s) => s.status === 'running');
  for (const s of stale) {
    await put('pvtSessions', { ...s, status: 'aborted', abortReason: 'page-closed' });
  }
}

// Обычное время прохождения: медиана времени начала завершённых сеансов.
function usualStartTime(sessions) {
  const minutes = sessions
    .filter((s) => s.status === 'completed')
    .map((s) => {
      const d = new Date(s.startedAt);
      return d.getHours() * 60 + d.getMinutes();
    });
  if (minutes.length < 2) return null;
  const m = Math.round(median(minutes));
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

function fmt(value, unit = '') {
  if (value === null || value === undefined) return '—';
  return String(value).replace('.', ',') + unit;
}

// Список последних сеансов.
function historyHtml(sessions, primary) {
  const sorted = [...sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 15);
  if (sorted.length === 0) return '';
  return `
    <section aria-labelledby="h-history">
      <h2 id="h-history">Последние сеансы</h2>
      <ul class="recent-list">
        ${sorted.map((s) => {
          const reason = exclusionReason(s, primary.type);
          return `<li>
            <span>${formatDateTime(s.startedAt)} · ${DEVICE_NAMES[s.device?.type] || ''}</span>
            <span>${s.status === 'completed' ? `медиана ${fmt(s.medianRt, ' мс')}, пропусков ${s.lapses}` : ''}
              ${reason ? `<span class="tag">${EXCLUSION_LABELS[reason]}</span>` : ''}
              ${s.demo ? '<span class="tag">демо</span>' : ''}</span>
          </li>`;
        }).join('')}
      </ul>
    </section>`;
}
