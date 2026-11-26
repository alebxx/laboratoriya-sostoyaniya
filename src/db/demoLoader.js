// =====================================================================
// Загрузка демо-данных в базу (кнопка «Заполнить тестовыми данными»).
// =====================================================================
import { getAll, putMany, getSetting, setSetting } from './repo.js';
import { generateDemoData } from '../logic/demo.js';
import { dayKeyFor } from '../logic/dates.js';

export async function loadDemoData() {
  const existingDiaryDays = (await getAll('diary')).map((e) => e.day);
  const primary = await getSetting('primaryDevice', null);
  const demo = generateDemoData(dayKeyFor(), { existingDiaryDays, primaryType: primary?.type || 'computer' });
  await putMany('diary', demo.diary);
  await putMany('pvtSessions', demo.pvtSessions);
  await putMany('pvtTrials', demo.pvtTrials);
  await putMany('physio', demo.physio);
  await putMany('pss', demo.pss);
  await putMany('hypotheses', demo.hypotheses);
  await putMany('experiments', demo.experiments);
  const factors = await getSetting('customFactors', []);
  if (!factors.some((f) => f.id === demo.factor.id)) {
    await setSetting('customFactors', [...factors, demo.factor]);
  }
  await setSetting('demoLoaded', true);
  return demo.diary.length;
}
