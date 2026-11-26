// Тесты движка PVT на «поддельном времени»: можно точно управлять часами
// и за доли секунды прогнать весь тест.
import { describe, it, expect } from 'vitest';
import { createPvtRunner } from '../src/logic/pvtRunner.js';

// Поддельные часы и таймеры.
function fakeTime() {
  let t = 0;
  let tasks = [];
  let lastId = 0;
  const env = {
    now: () => t,
    schedule(fn, ms) {
      tasks.push({ id: ++lastId, at: t + ms, fn });
      return lastId;
    },
    cancel(id) {
      tasks = tasks.filter((x) => x.id !== id);
    },
    // Кадр отрисовки — через 16 мс (как у экрана 60 Гц).
    nextFrame(fn) {
      return env.schedule(fn, 16);
    },
    // Перемотать время вперёд, выполняя таймеры по порядку.
    advance(ms) {
      const end = t + ms;
      for (;;) {
        tasks.sort((a, b) => a.at - b.at);
        const next = tasks[0];
        if (!next || next.at > end) break;
        tasks.shift();
        t = next.at;
        next.fn();
      }
      t = end;
    },
  };
  return env;
}

const config = {
  durationSec: 10,
  isiMinMs: 1000,
  isiMaxMs: 1000, // для теста интервал всегда ровно 1 с
  lapseMs: 355,
  falseStartMs: 100,
  feedbackMs: 1000,
  responseTimeoutMs: 2000,
};

function setup() {
  const env = fakeTime();
  const runner = createPvtRunner({ config, ...env, random: () => 0 });
  return { env, runner };
}

describe('движок PVT', () => {
  it('сигнал появляется в кадре после интервала, время реакции считается от сигнала', () => {
    const { env, runner } = setup();
    runner.start();
    expect(runner.phase).toBe('waiting');
    env.advance(1000);
    expect(runner.phase).toBe('waiting'); // таймер сработал, ждём кадр
    env.advance(16);
    expect(runner.phase).toBe('stimulus');
    expect(runner.stimulusAt).toBe(1016);
    env.advance(250);
    runner.respond(env.now(), 'key');
    expect(runner.trials[0]).toMatchObject({ rt: 250, type: 'valid', early: false, input: 'key', isiMs: 1000 });
    expect(runner.phase).toBe('feedback');
    expect(runner.lastFeedback).toMatchObject({ kind: 'rt', rt: 250 });
  });

  it('используется время события нажатия, а не время обработки', () => {
    const { env, runner } = setup();
    runner.start();
    env.advance(1016 + 300);
    // Событие произошло на 1016 + 240, а обработали его позже.
    runner.respond(1016 + 240, 'touch');
    expect(runner.trials[0].rt).toBe(240);
  });

  it('нажатие до сигнала — фальстарт, затем новое ожидание', () => {
    const { env, runner } = setup();
    runner.start();
    env.advance(500);
    runner.respond(env.now(), 'key');
    expect(runner.trials[0]).toMatchObject({ type: 'falseStart', early: true, rt: null });
    expect(runner.lastFeedback.kind).toBe('early');
    env.advance(1000); // показ «Рано!»
    expect(runner.phase).toBe('waiting');
  });

  it('реакция быстрее 100 мс — фальстарт (но сигнал был)', () => {
    const { env, runner } = setup();
    runner.start();
    env.advance(1016 + 50);
    runner.respond(env.now());
    expect(runner.trials[0]).toMatchObject({ type: 'falseStart', early: false, rt: 50 });
  });

  it('нет ответа — пропуск со временем, равным пределу ожидания', () => {
    const { env, runner } = setup();
    runner.start();
    env.advance(1016 + 2000);
    expect(runner.trials[0]).toMatchObject({ type: 'lapse', timedOut: true, rt: 2000 });
    expect(runner.lastFeedback.kind).toBe('timeout');
  });

  it('нажатия во время показа результата не учитываются', () => {
    const { env, runner } = setup();
    runner.start();
    env.advance(1016 + 250);
    runner.respond(env.now());
    runner.respond(env.now() + 10);
    expect(runner.trials).toHaveLength(1);
  });

  it('тест заканчивается по времени, сигнал после конца не показывается', () => {
    const { env, runner } = setup();
    runner.start();
    // Каждый цикл: 1000 ожидание + 16 кадр + 300 реакция + 1000 показ = 2316 мс.
    for (let i = 0; i < 10 && runner.phase !== 'finished'; i++) {
      env.advance(1016 + 300);
      if (runner.phase === 'stimulus') runner.respond(env.now());
      env.advance(1000);
    }
    expect(runner.phase).toBe('finished');
    // Ожидания начинались в 0, 2316, 4632, 6948; на 9264 + 1000 > 10000 — конец.
    expect(runner.trials).toHaveLength(4);
    expect(runner.trials.every((t) => t.stimulusAtMs + 0 < 10000)).toBe(true);
  });

  it('прерывание останавливает тест, дальше ничего не происходит', () => {
    const { env, runner } = setup();
    runner.start();
    env.advance(500);
    runner.abort('hidden');
    expect(runner.phase).toBe('aborted');
    expect(runner.abortReason).toBe('hidden');
    env.advance(5000);
    expect(runner.phase).toBe('aborted');
    expect(runner.trials).toHaveLength(0);
  });

  it('после окончания прерывание ничего не меняет', () => {
    const { env, runner } = setup();
    runner.start();
    env.advance(60000);
    runner.abort('hidden');
    expect(runner.phase).toBe('finished');
  });
});
