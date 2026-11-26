// =====================================================================
// Режим пилотного исследования: код участника, сроки анкет,
// сводка и выгрузка данных для исследователя без личных данных.
// =====================================================================
import { APP_ID, SCHEMA_VERSION } from '../config.js';
import { addDays, dayKeyFor } from './dates.js';

export const PILOT_DEFAULT_AFTER_DAYS = 14;

// Код участника: «P» и три цифры (например, P042). Исследователь может
// выдать свой код — тогда его вводят вручную.
export function generateCode(random = Math.random) {
  return 'P' + String(Math.floor(random() * 1000)).padStart(3, '0');
}

// Код допустим: латинские буквы и цифры, 2–12 символов (без имён и пробелов).
export function isValidCode(code) {
  return /^[A-Za-z0-9-]{2,12}$/.test(String(code || ''));
}

// С какого дня доступна анкета «после».
export function afterAvailableFrom(pilot) {
  return addDays(dayKeyFor(new Date(pilot.startedAt)), pilot.afterDays);
}

export function isAfterDue(pilot, today) {
  return today >= afterAvailableFrom(pilot);
}

// Есть ли где-нибудь демо-данные (пилот нельзя включить, пока они есть).
export function hasDemoData(data) {
  return Object.values(data).some((rows) => Array.isArray(rows) && rows.some((r) => r.demo));
}

// Убрать демо-записи из всех таблиц.
export function withoutDemo(data) {
  const out = {};
  for (const [k, rows] of Object.entries(data)) out[k] = Array.isArray(rows) ? rows.filter((r) => !r.demo) : rows;
  return out;
}

// Сводка участия (без демо-данных).
export function pilotSummary(data) {
  const d = withoutDemo(data);
  return {
    diaryDays: new Set((d.diary || []).map((e) => e.day)).size,
    pvtSessions: (d.pvtSessions || []).filter((s) => s.status === 'completed').length,
    pvtSessionsAll: (d.pvtSessions || []).length,
    hypothesesCreated: (d.hypotheses || []).length,
    hypothesesCompleted: (d.hypotheses || []).filter((h) => h.result).length,
    experimentsCreated: (d.experiments || []).length,
    physioMeasurements: (d.physio || []).length,
  };
}

// Данные для исследователя БЕЗ личных данных:
//   — без демо-записей;
//   — без свободного текста, где могут быть личные подробности:
//     заметки дневника, «своя причина», вопрос и выводы по гипотезам;
//   — без user agent (по нему можно узнать устройство);
//   — названия своих факторов заменены на «фактор 1», «фактор 2»…
//     (в них тоже может оказаться личное, например имя).
// Ответы на анкеты пилота входят в выгрузку: ради них она и делается.
export function sanitizeForResearcher(data, factors = []) {
  const d = withoutDemo(data);
  const factorAlias = Object.fromEntries(factors.map((f, i) => [f.id, `фактор ${i + 1}`]));
  return {
    factors: factors.map((f, i) => ({ alias: `фактор ${i + 1}`, type: f.type, hidden: Boolean(f.hidden) })),
    diary: (d.diary || []).map((e) => {
      const { note, causeOther, factors: fs, ...rest } = e;
      const renamed = {};
      for (const [id, v] of Object.entries(fs || {})) renamed[factorAlias[id] || 'фактор (удалён)'] = v;
      return { ...rest, causeOtherFilled: Boolean(causeOther), noteFilled: Boolean(note), factors: renamed };
    }),
    pvtSessions: (d.pvtSessions || []).map((s) => {
      const { device, ...rest } = s;
      return { ...rest, device: device ? { type: device.type, isPrimary: device.isPrimary } : null };
    }),
    pvtTrials: d.pvtTrials || [],
    physio: d.physio || [],
    pss: d.pss || [],
    hypotheses: (d.hypotheses || []).map((h) => {
      const { question, reflection, result, ...rest } = h;
      const plan = { ...h.plan };
      if (plan.factorKey?.startsWith('factor:')) plan.factorKey = factorAlias[plan.factorKey.slice(7)] || 'фактор (удалён)';
      if (plan.outcomeKey?.startsWith('factor:')) plan.outcomeKey = factorAlias[plan.outcomeKey.slice(7)] || 'фактор (удалён)';
      const cleanResult = result ? (({ observations, ...r }) => r)(result) : null;
      return { ...rest, plan, result: cleanResult, questionFilled: Boolean(question), reflectionFilled: Boolean(reflection) };
    }),
    experiments: (d.experiments || []).map((e) => {
      // Условия A и B — свободный текст; оставляем, т.к. обычно это действие («перерыв 10 минут»).
      const { result, ...rest } = e;
      return { ...rest, result: result ? (({ observations, ...r }) => r)(result) : null };
    }),
  };
}

// Полная выгрузка для исследователя (JSON).
export function buildResearcherExport({ pilot, questionnaires, data, factors, now = new Date() }) {
  return {
    app: APP_ID,
    kind: 'pilot-export',
    schemaVersion: SCHEMA_VERSION,
    participant: pilot.code,
    exportedAt: now.toISOString(),
    pilot: { startedAt: pilot.startedAt, afterDays: pilot.afterDays },
    questionnaires,
    summary: pilotSummary(data),
    data: sanitizeForResearcher(data, factors),
  };
}

// Одна строка CSV на участника: сводка и ответы анкет.
// Исследователь объединяет строки всех участников в одну таблицу.
export function researcherCsvRow({ pilot, questionnaires, data }) {
  const s = pilotSummary(data);
  const b = questionnaires.before || {};
  const a = questionnaires.after || {};
  const pssById = Object.fromEntries((data.pss || []).map((p) => [p.id, p]));
  const pssB = pssById[b.pssId];
  const pssA = pssById[a.pssId];
  return {
    'Код участника': pilot.code,
    'Начало пилота': pilot.startedAt,
    'Анкета «до» заполнена': b.completedAt || '',
    'Анкета «после» заполнена': a.completedAt || '',
    'Дней с записями в дневнике': s.diaryDays,
    'Сеансов теста (завершённых)': s.pvtSessions,
    'Гипотез создано': s.hypothesesCreated,
    'Гипотез завершено': s.hypothesesCompleted,
    'Самоэкспериментов': s.experimentsCreated,
    'Измерений пульса/давления': s.physioMeasurements,
    'До: факторы концентрации': b.factorsAnswer ?? '',
    'До: PSS-10 общий балл': pssB?.total ?? '',
    'До: PSS-10 беспомощность': pssB?.helplessness ?? '',
    'До: PSS-10 самоэффективность': pssB?.selfEfficacy ?? '',
    'После: факторы концентрации': a.factorsAnswer ?? '',
    'После: PSS-10 общий балл': pssA?.total ?? '',
    'После: PSS-10 беспомощность': pssA?.helplessness ?? '',
    'После: PSS-10 самоэффективность': pssA?.selfEfficacy ?? '',
    'Шкала PSS-10': pssB?.scale || pssA?.scale || '',
    'SUS: балл (0–100)': a.sus?.score ?? '',
    ...Object.fromEntries((a.sus?.answers || []).map((v, i) => [`SUS: пункт ${i + 1}`, v])),
    ...Object.fromEntries(Object.entries(a.feedback || {}).map(([k, v]) => [`Отзыв: ${k}`, v])),
  };
}
