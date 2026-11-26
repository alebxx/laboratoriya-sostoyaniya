// =====================================================================
// Подсчёт опросника удобства SUS (стандартное правило из ТЗ проекта):
//   нечётные пункты (1, 3, 5, 7, 9): ответ минус 1;
//   чётные пункты (2, 4, 6, 8, 10): 5 минус ответ;
//   сумма × 2,5 = балл от 0 до 100.
// =====================================================================

export function validateSus(answers) {
  if (!Array.isArray(answers) || answers.length !== 10) return 'Нужно ответить на все 10 пунктов.';
  const missing = answers.map((a, i) => (Number.isInteger(a) && a >= 1 && a <= 5 ? null : i + 1)).filter(Boolean);
  if (missing.length) return `Ответьте, пожалуйста, на пункты: ${missing.join(', ')}.`;
  return null;
}

export function scoreSus(answers) {
  const error = validateSus(answers);
  if (error) throw new Error(error);
  const sum = answers.reduce((s, a, i) => s + ((i + 1) % 2 === 1 ? a - 1 : 5 - a), 0);
  return sum * 2.5;
}
