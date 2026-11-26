// =====================================================================
// «Движок» теста PVT-B: ведёт тест от начала до конца.
//
// Ход теста:
//   ожидание (случайно 1–4 с) → сигнал (бегущий счётчик миллисекунд)
//   → нажатие → показ времени реакции (~1 с) → снова ожидание …
// Нажатие во время ожидания — фальстарт: показываем «Рано!» и ждём заново.
// Нет ответа слишком долго — пропуск, тест идёт дальше.
// Тест заканчивается, когда истекло время (по умолчанию 3 минуты):
// новый сигнал после окончания времени не показывается.
//
// Здесь нет ничего про внешний вид: движок только сообщает,
// в какой фазе тест (onChange), а страница рисует нужное.
// Часы и таймеры передаются параметрами — поэтому движок можно
// проверить тестами с «поддельным временем».
// =====================================================================
import { PVT } from '../config.js';
import { classifyTrial, randomIsi } from './pvt.js';

export function createPvtRunner({
  config = PVT,
  now = () => performance.now(), // точные часы браузера (миллисекунды с дробной частью)
  schedule = (fn, ms) => setTimeout(fn, ms),
  cancel = (id) => clearTimeout(id),
  nextFrame = (fn) => requestAnimationFrame(fn), // «перед следующей отрисовкой экрана»
  random = Math.random,
  onChange = () => {},
} = {}) {
  const runner = {
    phase: 'idle', // 'idle' | 'waiting' | 'stimulus' | 'feedback' | 'finished' | 'aborted'
    trials: [], // все попытки
    startTime: null,
    endTime: null,
    stimulusAt: null, // момент появления текущего сигнала
    lastFeedback: null, // что показать после нажатия: { kind: 'rt' | 'early' | 'timeout', rt }
    abortReason: null,
    start,
    respond,
    abort,
  };

  let timer = null;
  let currentIsi = null;
  let waitStartedAt = null;

  function setPhase(phase) {
    runner.phase = phase;
    onChange(runner);
  }

  function clearTimer() {
    if (timer !== null) cancel(timer);
    timer = null;
  }

  function start() {
    runner.startTime = now();
    runner.endTime = runner.startTime + config.durationSec * 1000;
    beginWait();
  }

  // Начать ожидание следующего сигнала.
  function beginWait() {
    const t = now();
    currentIsi = randomIsi(random, config);
    // Если сигнал пришёлся бы после окончания времени — тест закончен.
    if (t + currentIsi > runner.endTime) {
      finish();
      return;
    }
    waitStartedAt = t;
    setPhase('waiting');
    // Таймер срабатывает примерно в нужный момент, а сам сигнал
    // показываем в ближайший кадр отрисовки экрана (requestAnimationFrame).
    timer = schedule(() => nextFrame(showStimulus), currentIsi);
  }

  function showStimulus() {
    if (runner.phase !== 'waiting') return;
    // Сначала страница рисует сигнал (внутри onChange)…
    setPhase('stimulus');
    // …и сразу после этого запоминаем момент появления.
    runner.stimulusAt = now();
    timer = schedule(onTimeout, config.responseTimeoutMs);
  }

  // Нажатие (пробел, клик, касание).
  //   timestamp — момент нажатия по тем же часам (event.timeStamp);
  //   input — чем нажали: 'key', 'mouse', 'touch', 'pen'.
  function respond(timestamp = now(), input = 'key') {
    if (runner.phase === 'waiting') {
      // Нажал до сигнала — фальстарт.
      clearTimer();
      runner.trials.push({
        index: runner.trials.length + 1,
        isiMs: Math.round(currentIsi),
        stimulusAtMs: null,
        pressAtMs: round1(timestamp - runner.startTime),
        rt: null,
        early: true,
        timedOut: false,
        type: 'falseStart',
        input,
        waitedMs: round1(timestamp - waitStartedAt),
      });
      showFeedback({ kind: 'early' });
    } else if (runner.phase === 'stimulus') {
      clearTimer();
      let rt = timestamp - runner.stimulusAt;
      // Защита: если время события почему-то раньше сигнала, берём текущее.
      if (rt < 0) rt = now() - runner.stimulusAt;
      rt = round1(rt);
      const type = classifyTrial(rt, false, config);
      runner.trials.push({
        index: runner.trials.length + 1,
        isiMs: Math.round(currentIsi),
        stimulusAtMs: round1(runner.stimulusAt - runner.startTime),
        pressAtMs: round1(timestamp - runner.startTime),
        rt,
        early: false,
        timedOut: false,
        type,
        input,
      });
      showFeedback({ kind: 'rt', rt, type });
    }
    // В остальных фазах (показ результата, тест окончен) нажатия не учитываются.
  }

  // Нет ответа — засчитываем пропуск со временем, равным пределу ожидания.
  function onTimeout() {
    if (runner.phase !== 'stimulus') return;
    runner.trials.push({
      index: runner.trials.length + 1,
      isiMs: Math.round(currentIsi),
      stimulusAtMs: round1(runner.stimulusAt - runner.startTime),
      pressAtMs: null,
      rt: config.responseTimeoutMs,
      early: false,
      timedOut: true,
      type: 'lapse',
      input: null,
    });
    showFeedback({ kind: 'timeout' });
  }

  function showFeedback(info) {
    runner.lastFeedback = info;
    setPhase('feedback');
    timer = schedule(beginWait, config.feedbackMs);
  }

  function finish() {
    clearTimer();
    setPhase('finished');
  }

  // Прервать тест (вкладка свёрнута, ушли со страницы, нажали «Прервать»).
  function abort(reason) {
    if (runner.phase === 'finished' || runner.phase === 'aborted' || runner.phase === 'idle') return;
    clearTimer();
    runner.abortReason = reason;
    setPhase('aborted');
  }

  return runner;
}

// Округление до десятых миллисекунды (точнее браузер всё равно не измеряет).
function round1(x) {
  return Math.round(x * 10) / 10;
}
