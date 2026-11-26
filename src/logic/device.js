// =====================================================================
// Определение типа устройства (телефон / планшет / компьютер).
// Это только догадка по данным браузера: перед тестом пользователь
// видит её и может исправить.
// =====================================================================

// ua — строка user agent; touchPoints — navigator.maxTouchPoints.
export function guessDeviceType(ua = '', touchPoints = 0) {
  const s = ua.toLowerCase();
  if (s.includes('ipad')) return 'tablet';
  // Новые iPad притворяются компьютером Mac, но у них есть сенсорный экран.
  if (s.includes('macintosh') && touchPoints > 1) return 'tablet';
  if (s.includes('iphone') || s.includes('ipod')) return 'phone';
  if (s.includes('android')) return s.includes('mobile') ? 'phone' : 'tablet';
  if (s.includes('mobile')) return 'phone';
  if (s.includes('tablet')) return 'tablet';
  return 'computer';
}
