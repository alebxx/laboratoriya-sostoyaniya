// =====================================================================
// Простые SVG-схемы для раздела «Как это устроено».
// Это иллюстрации идей, а не данные: числа и линии условные.
// Цвета — из токенов темы, поэтому схемы работают в обеих темах.
// =====================================================================

const box = (x, y, w, h, title, sub, color) => `
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="var(--surface)" stroke="${color}" stroke-width="3"/>
  <text x="${x + w / 2}" y="${y + (sub ? h / 2 - 4 : h / 2 + 5)}" text-anchor="middle" font-size="15" font-weight="700" fill="var(--text)">${title}</text>
  ${sub ? `<text x="${x + w / 2}" y="${y + h / 2 + 16}" text-anchor="middle" font-size="12" fill="var(--text-muted)">${sub}</text>` : ''}`;

const arrow = (x1, y1, x2, y2, dashed = false) => `
  <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(--text-muted)" stroke-width="2.5" marker-end="url(#arr)" ${dashed ? 'stroke-dasharray="6 5"' : ''}/>`;

const defs = `<defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
  <path d="M0 0 L10 5 L0 10 z" fill="var(--text-muted)"/></marker></defs>`;

// Схема: сон → бодрость → время реакции; сбоку — что ещё влияет на результат теста.
export function sleepAttentionDiagram() {
  return `
  <figure class="diagram">
    <svg viewBox="0 0 640 250" role="img" aria-label="Схема: сон влияет на бодрость, бодрость — на время реакции в тесте; на результат теста влияют также время суток, старание и устройство">
      ${defs}
      ${box(20, 30, 170, 70, 'Сон', 'прошлой ночью', 'var(--m-sleep)')}
      ${box(235, 30, 170, 70, 'Бодрость', 'устойчивость внимания', 'var(--m-concentration)')}
      ${box(450, 30, 170, 70, 'Время реакции', 'в тесте', 'var(--m-test)')}
      ${arrow(190, 65, 233, 65)}
      ${arrow(405, 65, 448, 65)}
      ${box(300, 160, 100, 56, 'Время суток', '', 'var(--border-strong)')}
      ${box(410, 160, 100, 56, 'Старание', '', 'var(--border-strong)')}
      ${box(520, 160, 100, 56, 'Устройство', '', 'var(--border-strong)')}
      ${arrow(350, 160, 500, 102, true)}
      ${arrow(460, 160, 520, 102, true)}
      ${arrow(570, 160, 545, 102, true)}
    </svg>
    <figcaption>Схема-иллюстрация: тест измеряет бдительность, а не стресс. На время реакции влияют и другие вещи (пунктир). TODO: подтвердить схему источником из раздела.</figcaption>
  </figure>`;
}

// Схема «совпадение ≠ причина»: два похожих графика и общий третий фактор.
export function correlationDiagram() {
  const line = (pts, color, x0, y0) => `<polyline points="${pts.map(([x, y]) => `${x0 + x},${y0 + y}`).join(' ')}" fill="none" stroke="${color}" stroke-width="3" stroke-linejoin="round"/>`;
  const shape = [[0, 70], [30, 60], [60, 65], [90, 35], [120, 30], [150, 50], [180, 20], [210, 25]];
  const shape2 = shape.map(([x, y]) => [x, y + 6 - (x % 60 === 0 ? 8 : 0)]);
  const frame = (x, y, title, color, pts) => `
    <rect x="${x}" y="${y}" width="250" height="120" rx="14" fill="var(--surface)" stroke="var(--border)"/>
    <text x="${x + 14}" y="${y + 24}" font-size="14" font-weight="700" fill="var(--text)">${title}</text>
    ${line(pts, color, x + 20, y + 32)}`;
  return `
  <figure class="diagram">
    <svg viewBox="0 0 640 300" role="img" aria-label="Схема: два похожих графика — показатель A и показатель B — меняются вместе, потому что оба зависят от третьего фактора, а не друг от друга">
      ${defs}
      ${frame(20, 20, 'Показатель A', 'var(--m-fatigue)', shape)}
      ${frame(370, 20, 'Показатель B', 'var(--m-stress)', shape2)}
      <text x="320" y="88" text-anchor="middle" font-size="26" font-weight="800" fill="var(--text-muted)">≈</text>
      <line x1="285" y1="108" x2="355" y2="108" stroke="var(--text-muted)" stroke-width="2.5" stroke-dasharray="6 5"/>
      <text x="320" y="128" text-anchor="middle" font-size="12" fill="var(--text-muted)">не значит,</text>
      <text x="320" y="143" text-anchor="middle" font-size="12" fill="var(--text-muted)">что A → B</text>
      ${box(235, 205, 170, 66, 'Третий фактор', 'например, сложная неделя', 'var(--border-strong)')}
      ${arrow(280, 205, 160, 142)}
      ${arrow(360, 205, 480, 142)}
    </svg>
    <figcaption>Схема-иллюстрация: два показателя могут меняться одинаково, потому что оба зависят от чего-то третьего. Совпадение — не доказательство причины.</figcaption>
  </figure>`;
}

export const DIAGRAMS = {
  pvt: sleepAttentionDiagram,
  causality: correlationDiagram,
};
