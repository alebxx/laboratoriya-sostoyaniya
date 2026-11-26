// =====================================================================
// Какие сеансы теста попадают в анализ.
// Не попадают:
//   - незавершённые (тест прерван: вкладка свёрнута, выход со страницы);
//   - тренировочные (первые N завершённых сеансов — эффект практики);
//   - сеансы с другого устройства (если не включено «учитывать все устройства»).
// =====================================================================
import { PVT } from '../config.js';

// Причина исключения сеанса или null, если сеанс учитывается.
//   primaryType — тип основного устройства ('phone' | 'tablet' | 'computer');
//   includeOtherDevices — учитывать ли сеансы с других устройств.
export function exclusionReason(session, primaryType, includeOtherDevices = false) {
  if (session.status !== 'completed') return 'incomplete';
  if (session.practice) return 'practice';
  if (!includeOtherDevices && session.device && session.device.type !== primaryType) return 'otherDevice';
  return null;
}

export const EXCLUSION_LABELS = {
  incomplete: 'незавершённый',
  practice: 'тренировочный',
  otherDevice: 'другое устройство',
};

// Сеансы, которые учитываются в анализе.
export function sessionsForAnalysis(sessions, primaryType, includeOtherDevices = false) {
  return sessions.filter((s) => exclusionReason(s, primaryType, includeOtherDevices) === null);
}

// Будет ли следующий завершённый сеанс тренировочным.
// Считаем уже завершённые сеансы (с любого устройства).
export function isNextPractice(sessions, practiceCount = PVT.practiceSessions) {
  const completed = sessions.filter((s) => s.status === 'completed').length;
  return completed < practiceCount;
}

// Номер тренировочного сеанса (1, 2, 3…) для подписи «тренировочный 2 из 3».
export function nextPracticeNumber(sessions) {
  return sessions.filter((s) => s.status === 'completed').length + 1;
}
