// =====================================================================
// Талисман «Колбочка» — оригинальный персонаж сайта (простой SVG).
// Цвета берутся из токенов темы (--mascot-*), поэтому в тёмной теме
// контур сам становится светлым, а «ночные» детали (звёздочки, лампа)
// появляются только ночью (--night-only).
//
// Позы:
//   greet     — приветствие (первый вход, главная);
//   magnifier — с лупой («Исследую», «Как это устроено»);
//   notebook  — с пустым блокнотом (пустые экраны);
//   sprouts   — с ростками-графиками («данных пока мало»);
//   diploma   — в халате с дипломом (гипотеза завершена, конец пилота);
//   lock      — с замочком (фиксация гипотезы, приватность);
//   oops      — с перевёрнутой колбой (офлайн, ошибка).
//
// ВАЖНО: талисман не используется на экране теста PVT,
// на результатах и графиках и в сообщении мягкой заботы.
// =====================================================================

const LINE = 'var(--mascot-line)';

// Тело-колба, жидкость и лицо. mood: 'happy' | 'puzzled'.
function body(mood = 'happy') {
  const face = mood === 'puzzled'
    ? `<path d="M48 73 l7 2 M72 73 l-7 2" stroke="${LINE}" stroke-width="2.2" stroke-linecap="round"/>
       <circle cx="52" cy="80" r="3.2" fill="${LINE}"/><circle cx="68" cy="80" r="3.2" fill="${LINE}"/>
       <circle cx="60" cy="89" r="2.6" fill="none" stroke="${LINE}" stroke-width="2.2"/>`
    : `<circle cx="52" cy="80" r="3.4" fill="${LINE}"/><circle cx="68" cy="80" r="3.4" fill="${LINE}"/>
       <circle cx="53.1" cy="78.8" r="1.1" fill="#fff"/><circle cx="69.1" cy="78.8" r="1.1" fill="#fff"/>
       <path d="M55 87 Q60 92 65 87" fill="none" stroke="${LINE}" stroke-width="2.4" stroke-linecap="round"/>`;
  return `
    <defs><clipPath id="CLIP"><path d="M52 19 V46 L30 86 Q26 96 37 98 H83 Q94 96 90 86 L68 46 V19 Z"/></clipPath></defs>
    <path d="M52 19 V46 L30 86 Q26 96 37 98 H83 Q94 96 90 86 L68 46 V19 Z" fill="var(--mascot-glass)"/>
    <g clip-path="url(#CLIP)">
      <path d="M10 70 Q25 64 40 70 T70 70 T100 70 T130 70 V120 H10 Z" fill="var(--mascot-liquid)"/>
      <circle cx="44" cy="92" r="2.2" fill="#fff" opacity=".55"/>
      <circle cx="77" cy="74" r="1.6" fill="#fff" opacity=".55"/>
    </g>
    <path d="M52 19 V46 L30 86 Q26 96 37 98 H83 Q94 96 90 86 L68 46 V19 Z" fill="none" stroke="${LINE}" stroke-width="3" stroke-linejoin="round"/>
    <rect x="46" y="12" width="28" height="7" rx="3.5" fill="var(--mascot-glass)" stroke="${LINE}" stroke-width="3"/>
    <path d="M57 25 V41" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".75"/>
    <ellipse cx="45" cy="86" rx="4" ry="2.4" fill="var(--mascot-cheek)"/>
    <ellipse cx="75" cy="86" rx="4" ry="2.4" fill="var(--mascot-cheek)"/>
    ${face}`;
}

const arm = (d) => `<path d="${d}" fill="none" stroke="${LINE}" stroke-width="3" stroke-linecap="round"/>`;
const leftDown = arm('M36 76 Q28 82 26 91');
const star = (x, y, s = 1) =>
  `<path d="M${x} ${y - 4 * s} L${x + s} ${y - s} L${x + 4 * s} ${y} L${x + s} ${y + s} L${x} ${y + 4 * s} L${x - s} ${y + s} L${x - 4 * s} ${y} L${x - s} ${y - s} Z" fill="var(--m-fatigue)"/>`;

// «Ночные» детали: звёздочки (и лампа для некоторых поз).
function night(withLamp) {
  return `
    <g style="display: var(--night-only)">
      ${star(14, 22, 1.1)}${star(106, 16, 0.9)}${star(10, 58, 0.7)}
      ${withLamp ? `
        <circle cx="16" cy="94" r="11" fill="var(--m-fatigue)" opacity=".18"/>
        <path d="M12 92 a5 5 0 1 1 8 0 v4 h-8 z" fill="var(--m-fatigue)" stroke="${LINE}" stroke-width="1.6" stroke-linejoin="round"/>
        <path d="M13 99 h6" stroke="${LINE}" stroke-width="1.6" stroke-linecap="round"/>` : ''}
    </g>`;
}

const POSES = {
  greet: () => `
    ${night(true)}
    ${body()}
    ${leftDown}
    ${arm('M84 76 Q96 66 98 53')}
    <circle cx="98" cy="50" r="3.6" fill="var(--mascot-glass)" stroke="${LINE}" stroke-width="2.5"/>
    <path d="M105 42 q4 4 0 9 M110 39 q6 7 0 14" fill="none" stroke="${LINE}" stroke-width="2" stroke-linecap="round" opacity=".45"/>`,

  magnifier: () => `
    ${night(false)}
    ${body()}
    ${leftDown}
    ${arm('M84 76 Q93 70 96 62')}
    <circle cx="101" cy="52" r="9" fill="var(--mascot-glass)" fill-opacity=".5" stroke="${LINE}" stroke-width="3"/>
    <path d="M97 49 a5 5 0 0 1 5 -3" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".8"/>
    <path d="M95 59 L90 65" stroke="${LINE}" stroke-width="4" stroke-linecap="round"/>`,

  notebook: () => `
    ${night(true)}
    ${body()}
    <rect x="38" y="93" width="44" height="22" rx="3" fill="var(--surface)" stroke="${LINE}" stroke-width="2.5"/>
    <path d="M60 93 V115" stroke="${LINE}" stroke-width="2"/>
    ${arm('M36 76 Q30 90 42 99')}
    ${arm('M84 76 Q90 90 78 99')}`,

  sprouts: () => `
    ${night(false)}
    ${body()}
    ${leftDown}
    ${arm('M84 78 Q90 82 92 88')}
    <rect x="94" y="88" width="6" height="10" rx="3" fill="var(--m-sleep)"/>
    <rect x="102" y="82" width="6" height="16" rx="3" fill="var(--m-test)"/>
    <rect x="110" y="74" width="6" height="24" rx="3" fill="var(--m-stress)"/>
    <path d="M113 74 q-1 -6 -6 -7 q1 6 6 7 z M113 74 q1 -6 6 -7 q-1 6 -6 7 z" fill="var(--m-concentration)"/>
    <path d="M90 98 H118" stroke="${LINE}" stroke-width="2" stroke-linecap="round"/>`,

  diploma: () => `
    ${night(false)}
    ${body()}
    <path d="M52 46 L35 77 L46 74 L55 57 Z M68 46 L85 77 L74 74 L65 57 Z" fill="var(--surface)" stroke="${LINE}" stroke-width="2.2" stroke-linejoin="round"/>
    <rect x="73" y="88" width="11" height="7" rx="1.5" fill="var(--surface)" stroke="${LINE}" stroke-width="1.8"/>
    <path d="M76 88 V83" stroke="var(--m-sleep)" stroke-width="2.2" stroke-linecap="round"/>
    ${leftDown}
    ${arm('M84 76 Q94 70 95 64')}
    <rect x="86" y="56" width="26" height="8" rx="4" fill="var(--surface)" stroke="${LINE}" stroke-width="2.2"/>
    <circle cx="99" cy="60" r="3" fill="var(--m-stress)"/>
    <path d="M97 62 l-2 6 M101 62 l2 6" stroke="var(--m-stress)" stroke-width="2" stroke-linecap="round"/>`,

  lock: () => `
    ${night(false)}
    ${body()}
    ${leftDown}
    ${arm('M84 78 Q88 80 88 84')}
    <path d="M89 76 V70 a6 6 0 0 1 12 0 V76" fill="none" stroke="${LINE}" stroke-width="3"/>
    <rect x="86" y="76" width="18" height="15" rx="3.5" fill="var(--m-fatigue)" stroke="${LINE}" stroke-width="2.5"/>
    <circle cx="95" cy="82.5" r="2" fill="${LINE}"/><path d="M95 84 V87" stroke="${LINE}" stroke-width="2" stroke-linecap="round"/>`,

  oops: () => `
    ${night(false)}
    ${body('puzzled')}
    ${leftDown}
    ${arm('M84 76 Q92 68 93 62')}
    <path d="M89 48 H105 L100 58 V64 H94 V58 Z" fill="var(--mascot-glass)" stroke="${LINE}" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M97 70 q-3 4 0 6 q3 -2 0 -6 z" fill="var(--mascot-liquid)" stroke="${LINE}" stroke-width="1.4"/>`,
};

export const MASCOT_POSES = Object.keys(POSES);

let counter = 0;

// SVG-строка талисмана. label — подпись для программ чтения с экрана
// (пустая строка — картинка декоративная и скрыта от них).
export function mascot(pose = 'greet', { size = 120, label = '' } = {}) {
  const draw = POSES[pose] || POSES.greet;
  const id = `mascot-clip-${++counter}`; // у каждой картинки своя маска
  const a11y = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true" focusable="false"';
  return `<svg class="mascot mascot-${pose}" viewBox="0 0 120 120" width="${size}" height="${size}" ${a11y}
    style="filter: drop-shadow(0 0 6px var(--mascot-glow))">${draw().replaceAll('CLIP', id)}</svg>`;
}
