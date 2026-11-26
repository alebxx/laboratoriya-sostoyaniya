// =====================================================================
// Тест на внимание PVT-B: классификация попыток и показатели сеанса.
// Методика и обоснование — docs/methodology.md, раздел «Тест PVT-B».
// =====================================================================
import { PVT } from '../config.js';
import { median, mean } from './stats.js';
import { localDateTime } from './diary.js';

// Типы попыток:
//   'valid'      — обычная реакция (от falseStartMs до lapseMs);
//   'lapse'      — пропуск: реакция не быстрее lapseMs (или нет ответа);
//   'falseStart' — фальстарт: нажатие до сигнала или быстрее falseStartMs.
export function classifyTrial(rt, early, config = PVT) {
  if (early) return 'falseStart';
  if (rt < config.falseStartMs) return 'falseStart';
  if (rt >= config.lapseMs) return 'lapse';
  return 'valid';
}

// Случайный интервал ожидания: равномерно от isiMinMs до isiMaxMs.
export function randomIsi(random = Math.random, config = PVT) {
  return config.isiMinMs + random() * (config.isiMaxMs - config.isiMinMs);
}

// Показатели сеанса по списку попыток.
// Попытка: { rt (мс или null), type, early (нажал до сигнала), timedOut }.
export function summarizeSession(trials) {
  // «Ответы» — все реакции на сигнал, кроме фальстартов (включая пропуски).
  const responses = trials.filter((t) => t.type !== 'falseStart' && typeof t.rt === 'number');
  const rts = responses.map((t) => t.rt);
  return {
    // Главный показатель — медиана времени реакции, мс.
    medianRt: rts.length ? Math.round(median(rts)) : null,
    // Скорость реакции: среднее значение 1/RT, в «реакциях в секунду» (1000 / мс).
    meanSpeed: rts.length ? round(mean(rts.map((rt) => 1000 / rt)), 3) : null,
    lapses: trials.filter((t) => t.type === 'lapse').length,
    falseStarts: trials.filter((t) => t.type === 'falseStart').length,
    // Стимулов — сколько раз появлялся сигнал (нажатия до сигнала не считаются).
    stimuli: trials.filter((t) => !t.early).length,
    responses: responses.length,
  };
}

function round(x, digits) {
  const k = 10 ** digits;
  return Math.round(x * k) / k;
}

// ----- Таблицы CSV (русские заголовки) -----

const STATUS_LABELS = { completed: 'завершён', aborted: 'прерван', running: 'прерван (страница закрыта)' };
const DEVICE_LABELS = { phone: 'телефон', tablet: 'планшет', computer: 'компьютер' };
const TYPE_LABELS = { valid: 'реакция', lapse: 'пропуск', falseStart: 'фальстарт' };

// Сеансы теста → строки CSV.
//   excludedReason(session) — функция, которая говорит, почему сеанс не входит в анализ.
export function sessionRowsForCsv(sessions, excludedReason = () => null) {
  return [...sessions]
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    .map((s) => ({
      'ID сеанса': s.id,
      'День': s.day,
      'Начало': localDateTime(s.startedAt),
      'Конец': localDateTime(s.endedAt),
      'Статус': STATUS_LABELS[s.status] || s.status,
      'Причина прерывания': s.abortReason || '',
      'Тренировочный': s.practice ? 'да' : 'нет',
      'Устройство': DEVICE_LABELS[s.device?.type] || '',
      'Основное устройство': s.device?.isPrimary ? 'да' : 'нет',
      'В анализе': excludedReason(s) ? 'нет' : 'да',
      'Медиана RT, мс': s.medianRt,
      'Скорость (среднее 1/RT, 1/с)': s.meanSpeed,
      'Пропуски': s.lapses,
      'Фальстарты': s.falseStarts,
      'Стимулы': s.stimuli,
      'Бодрость (0–100)': s.alertness,
      'Старание (0–100)': s.effort,
      'Были отвлечения': s.distractions === true ? 'да' : s.distractions === false ? 'нет' : '',
      'Длительность, с': s.config?.durationSec,
      'Интервал, мс': s.config ? `${s.config.isiMinMs}–${s.config.isiMaxMs}` : '',
      'Порог пропуска, мс': s.config?.lapseMs,
      'Кадр экрана, мс': s.frameMs,
      'Тема сайта': s.theme ? `${s.theme.shown === 'dark' ? 'ночная' : 'дневная'}${s.theme.setting === 'system' ? ' (как в системе)' : ''}` : '',
      'User agent': s.device?.userAgent,
      'Демо-данные': s.demo ? 'да' : '',
    }));
}

// Отдельные попытки → строки CSV.
export function trialRowsForCsv(trials) {
  return [...trials]
    .sort((a, b) => a.sessionId.localeCompare(b.sessionId) || a.index - b.index)
    .map((t) => ({
      'ID сеанса': t.sessionId,
      'Номер попытки': t.index,
      'Тип': TYPE_LABELS[t.type] || t.type,
      'Время реакции, мс': t.rt,
      'Нет ответа': t.timedOut ? 'да' : '',
      'Нажатие до сигнала': t.early ? 'да' : '',
      'Интервал ожидания, мс': t.isiMs,
      'Сигнал от начала теста, мс': t.stimulusAtMs,
      'Нажатие от начала теста, мс': t.pressAtMs,
      'Чем нажато': t.input,
      'Демо-данные': t.demo ? 'да' : '',
    }));
}
