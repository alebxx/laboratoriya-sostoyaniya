// =====================================================================
// Демо-данные за 30 дней — чтобы показать графики и гипотезы на защите.
//
// ВАЖНО:
//   — это ВЫДУМАННЫЕ данные, они не описывают реального человека;
//   — у каждой записи есть пометка demo: true, их можно удалить одной кнопкой;
//   — дни, за которые уже есть настоящие записи дневника, пропускаются
//     (демо никогда не перезаписывает ваши данные);
//   — связи в данных заложены специально (например, меньше сна — медленнее реакция),
//     чтобы было что показать. Это пример, а не научный факт.
// =====================================================================
import { addDays } from './dates.js';
import { createRandom, shuffle } from './random.js';
import { generateSchedule } from './alternation.js';
import { PVT } from '../config.js';

export const DEMO_DAYS = 30;
export const DEMO_FACTOR = { id: 'demo-coffee', name: 'кофе (демо)', type: 'bool', hidden: false, demo: true };

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const round = (v, step = 1) => Math.round(v / step) * step;

// Момент времени в заданный день (местное время).
function at(day, hour, minute = 0) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, hour, minute).toISOString();
}

// today — сегодняшний день ('ГГГГ-ММ-ДД'); existingDiaryDays — дни с настоящими записями.
export function generateDemoData(today, { seed = 2026, existingDiaryDays = [], primaryType = 'computer' } = {}) {
  const random = createRandom(seed);
  const noise = (size) => (random() - 0.5) * 2 * size;
  const firstDay = addDays(today, -(DEMO_DAYS - 1));
  const skip = new Set(existingDiaryDays);
  const userAgent = 'демо-данные';

  const diary = [];
  const pvtSessions = [];
  const pvtTrials = [];
  const physio = [];

  // Самоэксперимент: дни −20…−7 (14 дней), условие A чуть ускоряет реакцию.
  const expStart = addDays(today, -20);
  const expSchedule = generateSchedule(expStart, 14, seed + 1);
  const expCondition = new Map(expSchedule.map((s) => [s.day, s.condition]));

  // Заранее решаем, какие дни будут с коротким сном: ровно половина, в случайном порядке.
  // Так в демо-гипотезе о сне обе группы набирают нужное число дней.
  const shortSleepDays = new Set(shuffle([...Array(DEMO_DAYS).keys()], random).slice(0, DEMO_DAYS / 2));

  let completedSessions = 0;
  for (let i = 0; i < DEMO_DAYS; i++) {
    const day = addDays(firstDay, i);
    if (skip.has(day)) continue;
    // Пропускаем примерно каждый седьмой день — как в жизни.
    if (i % 7 === 5) continue;

    const sleepHours = shortSleepDays.has(i)
      ? clamp(round(5.8 + noise(0.8), 0.5), 4.5, 6.5) // короткий сон
      : clamp(round(7.8 + noise(0.8), 0.5), 7, 9.5); // обычный сон
    const coffee = random() < 0.45;
    const lack = 8 - sleepHours; // «недосып» в часах
    const stress = clamp(round(4 + lack * 1.1 + noise(2)), 0, 10);
    const fatigue = clamp(round(3.5 + lack * 1.3 + noise(2)), 0, 10);
    const concentration = clamp(round(6.5 - lack * 1.0 - (coffee ? -0.5 : 0) + noise(2)), 0, 10);
    const sleepQuality = clamp(round(6 - lack * 0.8 + noise(2.5)), 0, 10);
    const mood = clamp(round(3.4 - lack * 0.4 + noise(1.2)), 1, 5);
    const causes = [];
    if (random() < 0.5) causes.push('учёба');
    if (lack > 1 && random() < 0.6) causes.push('недосып');

    diary.push({
      day,
      createdAt: at(day, 21, 10),
      updatedAt: at(day, 21, 10),
      stress, fatigue, concentration, mood, sleepHours, sleepQuality,
      causes,
      causeOther: '',
      factors: { [DEMO_FACTOR.id]: coffee },
      note: '',
      demo: true,
    });

    // Тест — в большинство дней, около 15:00.
    if (random() < 0.85) {
      const sessionId = `demo-s-${day}`;
      const cond = expCondition.get(day);
      const base = 255 + lack * 14 + (cond === 'A' ? -12 : 0) + noise(12);
      const trials = makeTrials(sessionId, base, random);
      const metrics = summarize(trials);
      const practice = completedSessions < PVT.practiceSessions;
      completedSessions++;
      pvtSessions.push({
        id: sessionId,
        day,
        startedAt: at(day, 15, 0),
        endedAt: at(day, 15, 3),
        status: 'completed',
        abortReason: null,
        practice,
        device: { type: primaryType, isPrimary: true, userAgent },
        config: { ...PVT },
        ...metrics,
        alertness: clamp(round(70 - lack * 10 + noise(10)), 0, 100),
        effort: clamp(round(75 + noise(15)), 0, 100),
        distractions: random() < 0.15,
        frameMs: 16.7,
        demo: true,
      });
      pvtTrials.push(...trials);
    }

    // Пульс и давление — примерно раз в три дня утром.
    if (i % 3 === 0) {
      physio.push({
        id: `demo-m-${day}`,
        day,
        measuredAt: at(day, 8, 30),
        createdAt: at(day, 8, 31),
        timeOfDay: 'утро',
        pulse: round(68 + noise(8)),
        systolic: round(114 + noise(8)),
        diastolic: round(74 + noise(6)),
        posture: 'sitting',
        rested5min: true,
        caffeine2h: false,
        exercise1h: false,
        demo: true,
      });
    }
  }

  // Один незавершённый сеанс — чтобы показать, как он выделяется.
  const abortedDay = addDays(today, -12);
  pvtSessions.push({
    id: 'demo-s-aborted',
    day: abortedDay,
    startedAt: at(abortedDay, 19, 0),
    endedAt: at(abortedDay, 19, 1),
    status: 'aborted',
    abortReason: 'hidden',
    practice: false,
    device: { type: primaryType, isPrimary: true, userAgent },
    medianRt: 330, meanSpeed: 3, lapses: 2, falseStarts: 0, stimuli: 12, responses: 12,
    demo: true,
  });

  // PSS-10 в начале и в конце периода (ответы выдуманы, шкала 0–4).
  const pss = [
    { id: 'demo-pss-1', day: firstDay, completedAt: at(firstDay, 20), context: 'regular', scale: '0-4', answers: [2, 2, 3, 1, 2, 3, 2, 1, 2, 2], total: 24, helplessness: 14, selfEfficacy: 10, demo: true },
    { id: 'demo-pss-2', day: addDays(today, -1), completedAt: at(addDays(today, -1), 20), context: 'regular', scale: '0-4', answers: [2, 1, 2, 2, 2, 2, 2, 2, 1, 2], total: 18, helplessness: 10, selfEfficacy: 8, demo: true },
  ];

  // Гипотезы: одна завершится сразу (зафиксирована до начала демо-периода),
  // вторая ещё собирает данные (зафиксирована 5 дней назад).
  const hypotheses = [
    {
      id: 'demo-h-sleep',
      question: 'Связана ли моя реакция в тесте с тем, сколько я сплю? (демо)',
      plan: { factorKey: 'sleepHours', factorKind: 'threshold', threshold: 7, side: 'below', outcomeKey: 'pvtMedian', direction: 'higher', lag: 0, minDays: 7 },
      lockedAt: at(addDays(firstDay, -1), 20),
      lockDay: addDays(firstDay, -1),
      parentId: null,
      result: null,
      reflection: '',
      demo: true,
    },
    {
      id: 'demo-h-coffee',
      question: 'Отличается ли концентрация в дни с кофе? (демо)',
      plan: { factorKey: `factor:${DEMO_FACTOR.id}`, factorKind: 'boolean', threshold: null, side: 'below', outcomeKey: 'concentration', direction: 'higher', lag: 0, minDays: 7 },
      lockedAt: at(addDays(today, -5), 20),
      lockDay: addDays(today, -5),
      parentId: null,
      result: null,
      reflection: '',
      demo: true,
    },
  ];

  const experiments = [{
    id: 'demo-exp-break',
    createdAt: at(addDays(expStart, -1), 20),
    conditionA: 'перерыв 10 минут перед тестом (демо)',
    conditionB: 'без перерыва (демо)',
    outcomeKey: 'pvtMedian',
    direction: 'lower',
    schedule: expSchedule,
    followed: Object.fromEntries(expSchedule.map((s, i) => [s.day, i !== 3])),
    result: null,
    demo: true,
  }];

  return { diary, pvtSessions, pvtTrials, physio, pss, hypotheses, experiments, factor: DEMO_FACTOR };
}

// Попытки одного сеанса: ~45 реакций около base мс, иногда пропуск или фальстарт.
function makeTrials(sessionId, base, random) {
  const trials = [];
  let t = 0;
  for (let i = 1; i <= 45; i++) {
    const isi = 1000 + random() * 3000;
    t += isi;
    const r = random();
    let rt;
    let type;
    let early = false;
    if (r < 0.02) {
      rt = null;
      type = 'falseStart';
      early = true;
    } else {
      rt = Math.round((base + (random() - 0.3) * 60 + (r > 0.95 ? 150 : 0)) * 10) / 10;
      type = rt >= PVT.lapseMs ? 'lapse' : 'valid';
    }
    trials.push({
      id: `${sessionId}-${i}`,
      sessionId,
      index: i,
      isiMs: Math.round(isi),
      stimulusAtMs: early ? null : Math.round(t),
      pressAtMs: early ? Math.round(t - isi / 2) : Math.round(t + rt),
      rt,
      early,
      timedOut: false,
      type,
      input: 'key',
      demo: true,
    });
    t += (rt || 0) + 1000;
  }
  return trials;
}

// Те же показатели, что у настоящего сеанса.
function summarize(trials) {
  const rts = trials.filter((x) => x.type !== 'falseStart').map((x) => x.rt).sort((a, b) => a - b);
  const mid = rts.length / 2;
  const median = rts.length % 2 ? rts[Math.floor(mid)] : (rts[mid - 1] + rts[mid]) / 2;
  const speed = rts.reduce((s, rt) => s + 1000 / rt, 0) / rts.length;
  return {
    medianRt: Math.round(median),
    meanSpeed: Math.round(speed * 1000) / 1000,
    lapses: trials.filter((x) => x.type === 'lapse').length,
    falseStarts: trials.filter((x) => x.type === 'falseStart').length,
    stimuli: trials.filter((x) => !x.early).length,
    responses: rts.length,
  };
}
