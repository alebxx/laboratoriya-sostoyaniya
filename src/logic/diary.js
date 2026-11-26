// =====================================================================
// Дневник: из каких полей состоит запись, как её проверить
// и как превратить в строки таблицы CSV.
// Функции здесь не трогают базу и интерфейс — их проверяют тесты.
// =====================================================================

// Ползунки 0–10. Подписи краёв — нейтральные, без оценок.
export const SCALES = [
  { key: 'stress', label: 'Стресс сегодня', min: 0, max: 10, minLabel: '0 — совсем нет', maxLabel: '10 — очень сильный' },
  { key: 'fatigue', label: 'Усталость', min: 0, max: 10, minLabel: '0 — совсем нет', maxLabel: '10 — очень сильная' },
  { key: 'concentration', label: 'Как удавалось сосредоточиться', min: 0, max: 10, minLabel: '0 — совсем не удавалось', maxLabel: '10 — очень легко' },
];

// Настроение: 5 вариантов.
export const MOODS = [
  { value: 1, emoji: '😣', label: 'очень плохое' },
  { value: 2, emoji: '🙁', label: 'плохое' },
  { value: 3, emoji: '😐', label: 'среднее' },
  { value: 4, emoji: '🙂', label: 'хорошее' },
  { value: 5, emoji: '😄', label: 'очень хорошее' },
];

// Сон.
export const SLEEP_HOURS = { min: 0, max: 16, step: 0.5 };
export const SLEEP_QUALITY = {
  key: 'sleepQuality', label: 'Качество сна', min: 0, max: 10,
  minLabel: '0 — спал(а) очень плохо', maxLabel: '10 — очень хорошо',
};

// Возможные причины стресса (можно выбрать несколько).
export const CAUSES = ['учёба', 'работа', 'отношения', 'здоровье', 'недосып', 'другое'];

export const NOTE_MAX_LENGTH = 500;

// Все числовые поля записи — пригодится для графиков и гипотез.
export const NUMERIC_FIELDS = ['stress', 'fatigue', 'mood', 'sleepHours', 'sleepQuality', 'concentration'];

// Число в допустимых пределах или null («не отмечено»).
function numberOrNull(value, min, max) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

// Собрать запись дневника из ответов формы.
//   values — то, что ввёл пользователь;
//   previous — прежняя запись за этот день (если редактируем) или undefined;
//   factors — список своих факторов пользователя;
//   now — текущее время.
export function buildEntry(day, values, previous, factors = [], now = new Date()) {
  const entry = {
    day,
    createdAt: previous ? previous.createdAt : now.toISOString(),
    updatedAt: now.toISOString(),
    stress: numberOrNull(values.stress, 0, 10),
    fatigue: numberOrNull(values.fatigue, 0, 10),
    concentration: numberOrNull(values.concentration, 0, 10),
    mood: numberOrNull(values.mood, 1, 5),
    sleepHours: numberOrNull(values.sleepHours, SLEEP_HOURS.min, SLEEP_HOURS.max),
    sleepQuality: numberOrNull(values.sleepQuality, 0, 10),
    causes: (values.causes || []).filter((c) => CAUSES.includes(c)),
    causeOther: String(values.causeOther || '').trim().slice(0, 100),
    factors: {},
    note: String(values.note || '').trim().slice(0, NOTE_MAX_LENGTH),
  };
  // Свои факторы: «да/нет» → true/false, число → число. Не отмечено — не сохраняем.
  for (const f of factors) {
    const raw = values.factors ? values.factors[f.id] : undefined;
    if (f.type === 'bool') {
      if (raw === true || raw === 'yes') entry.factors[f.id] = true;
      else if (raw === false || raw === 'no') entry.factors[f.id] = false;
    } else if (raw !== undefined && raw !== null && raw !== '') {
      const n = Number(raw);
      if (Number.isFinite(n)) entry.factors[f.id] = n;
    }
  }
  if (previous && previous.demo) entry.demo = true;
  return entry;
}

// Есть ли в записи хоть что-то отмеченное (пустую запись не сохраняем).
export function isEntryEmpty(entry) {
  const hasNumber = NUMERIC_FIELDS.some((k) => entry[k] !== null && entry[k] !== undefined);
  return (
    !hasNumber &&
    entry.causes.length === 0 &&
    entry.causeOther === '' &&
    Object.keys(entry.factors).length === 0 &&
    entry.note === ''
  );
}

// ----- Свои факторы -----

// Проверить новый фактор. Возвращает текст ошибки или null.
export function validateFactor(name, type, existing) {
  const clean = String(name || '').trim();
  if (!clean) return 'Введите название фактора.';
  if (clean.length > 40) return 'Название слишком длинное (не больше 40 символов).';
  if (type !== 'bool' && type !== 'number') return 'Выберите тип: «да/нет» или число.';
  if (existing.some((f) => f.name.toLowerCase() === clean.toLowerCase())) {
    return 'Фактор с таким названием уже есть.';
  }
  return null;
}

// ----- Таблица CSV -----

// Записи дневника → строки для CSV с понятными столбцами:
// причины — через запятую, каждый свой фактор — отдельный столбец.
export function diaryRowsForCsv(entries, factors = []) {
  const sorted = [...entries].sort((a, b) => a.day.localeCompare(b.day));
  return sorted.map((e) => {
    const row = {
      day: e.day,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
      stress: e.stress,
      fatigue: e.fatigue,
      concentration: e.concentration,
      mood: e.mood,
      sleepHours: e.sleepHours,
      sleepQuality: e.sleepQuality,
      causes: (e.causes || []).join(', '),
      causeOther: e.causeOther,
    };
    for (const f of factors) {
      const v = e.factors ? e.factors[f.id] : undefined;
      row[`factor: ${f.name}`] = v === true ? 'да' : v === false ? 'нет' : v;
    }
    row.note = e.note;
    row.demo = e.demo ? 'да' : '';
    return row;
  });
}
