// =====================================================================
// Пульс и давление: проверка правдоподобия и запись измерения.
// ВАЖНО: здесь нет никакой медицинской оценки. Границы — только
// защита от опечаток (например, 7 вместо 70), а не нормы.
// =====================================================================
import { PHYSIO_INPUT_LIMITS } from '../config.js';
import { dayKeyFor } from './dates.js';
import { localDateTime } from './diary.js';

export const POSTURES = [
  { value: 'sitting', label: 'сидя' },
  { value: 'standing', label: 'стоя' },
  { value: 'lying', label: 'лёжа' },
];

// Время суток по часу измерения (граница ночи совпадает с границей суток 4:00).
export function timeOfDay(date) {
  const h = date.getHours();
  if (h >= 4 && h < 12) return 'утро';
  if (h >= 12 && h < 18) return 'день';
  if (h >= 18) return 'вечер';
  return 'ночь';
}

// Пустое поле → null, иначе число (или NaN, если введено не число).
function parse(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  return Number(String(value).replace(',', '.'));
}

const NAMES = { pulse: 'Пульс', systolic: 'Верхнее (систолическое) давление', diastolic: 'Нижнее (диастолическое) давление' };

// Проверить введённые значения.
// Возвращает { errors: [...], values: { pulse, systolic, diastolic } }.
export function checkValues(raw, limits = PHYSIO_INPUT_LIMITS) {
  const errors = [];
  const values = {};
  for (const key of ['pulse', 'systolic', 'diastolic']) {
    const v = parse(raw[key]);
    values[key] = v;
    if (v === null) continue;
    if (!Number.isFinite(v) || !Number.isInteger(v)) {
      errors.push(`${NAMES[key]}: введите целое число.`);
    } else if (v < limits[key].min || v > limits[key].max) {
      errors.push(`${NAMES[key]}: ${v} — похоже на опечатку. Можно ввести число от ${limits[key].min} до ${limits[key].max}.`);
    }
  }
  if (values.pulse === null && values.systolic === null && values.diastolic === null) {
    errors.push('Введите хотя бы одно значение.');
  }
  // Давление записывается парой: верхнее и нижнее вместе.
  if ((values.systolic === null) !== (values.diastolic === null)) {
    errors.push('Давление записывается двумя числами: введите и верхнее, и нижнее.');
  } else if (Number.isFinite(values.systolic) && Number.isFinite(values.diastolic) && values.systolic <= values.diastolic) {
    errors.push('Верхнее давление должно быть больше нижнего — проверьте, не перепутаны ли числа.');
  }
  return { errors, values };
}

// Собрать запись измерения.
//   context — { posture, rested, caffeine, exercise } (да/нет хранится как true/false/null)
export function buildRecord(id, values, context, measuredAt, now = new Date()) {
  return {
    id,
    day: dayKeyFor(measuredAt),
    measuredAt: measuredAt.toISOString(),
    createdAt: now.toISOString(),
    timeOfDay: timeOfDay(measuredAt),
    pulse: values.pulse,
    systolic: values.systolic,
    diastolic: values.diastolic,
    posture: context.posture || null,
    rested5min: context.rested ?? null,
    caffeine2h: context.caffeine ?? null,
    exercise1h: context.exercise ?? null,
  };
}

// CSV с русскими заголовками.
const POSTURE_LABELS = Object.fromEntries(POSTURES.map((p) => [p.value, p.label]));
const yesNo = (v) => (v === true ? 'да' : v === false ? 'нет' : '');

export function physioRowsForCsv(records) {
  return [...records]
    .sort((a, b) => a.measuredAt.localeCompare(b.measuredAt))
    .map((r) => ({
      'День': r.day,
      'Время измерения': localDateTime(r.measuredAt),
      'Время суток': r.timeOfDay,
      'Пульс, уд/мин': r.pulse,
      'Давление верхнее': r.systolic,
      'Давление нижнее': r.diastolic,
      'Поза': POSTURE_LABELS[r.posture] || '',
      'Отдых 5 минут': yesNo(r.rested5min),
      'Кофеин за 2 часа': yesNo(r.caffeine2h),
      'Нагрузка за час': yesNo(r.exercise1h),
      'Демо-данные': r.demo ? 'да' : '',
    }));
}
