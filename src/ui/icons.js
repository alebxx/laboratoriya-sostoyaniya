// =====================================================================
// Иконки Lucide (лежат в проекте, пакет lucide, лицензия ISC).
// icon('Moon') → строка SVG. Все используемые иконки перечислены здесь,
// чтобы в сборку попали только они.
// =====================================================================
import {
  createElement,
  House, NotebookPen, Timer, HeartPulse, ChartLine, FlaskConical, ClipboardCheck, Wind, BookOpen, Settings, Users,
  GraduationCap, Briefcase, Heart, Moon, Ellipsis, MessageCircleQuestion, ClipboardList, Lock, Search, Lightbulb,
  Gauge, BatteryLow, Brain, Smile, Check, Sprout, Sun, SunMoon, Download, Upload, Trash2, Info, ArrowLeft, Shuffle,
  Coffee, WifiOff, Sparkles, Plus, Activity, Shield, Eye, Backpack, Library, ArrowRight, Repeat, Telescope,
} from 'lucide';

const ICONS = {
  House, NotebookPen, Timer, HeartPulse, ChartLine, FlaskConical, ClipboardCheck, Wind, BookOpen, Settings, Users,
  GraduationCap, Briefcase, Heart, Moon, Ellipsis, MessageCircleQuestion, ClipboardList, Lock, Search, Lightbulb,
  Gauge, BatteryLow, Brain, Smile, Check, Sprout, Sun, SunMoon, Download, Upload, Trash2, Info, ArrowLeft, Shuffle,
  Coffee, WifiOff, Sparkles, Plus, Activity, Shield, Eye, Backpack, Library, ArrowRight, Repeat, Telescope,
};

// Иконка — декоративная (скрыта от программ чтения с экрана: рядом всегда есть текст).
export function icon(name, size = 20, extraClass = '') {
  const I = ICONS[name];
  if (!I) return '';
  const el = createElement(I);
  el.setAttribute('width', size);
  el.setAttribute('height', size);
  el.setAttribute('aria-hidden', 'true');
  el.setAttribute('focusable', 'false');
  el.setAttribute('class', `icon ${extraClass}`.trim());
  return el.outerHTML;
}

// Иконки причин стресса.
export const CAUSE_ICONS = {
  'учёба': 'GraduationCap',
  'работа': 'Briefcase',
  'отношения': 'Users',
  'здоровье': 'Heart',
  'недосып': 'Moon',
  'другое': 'Ellipsis',
};

// Иконки шагов мастера гипотез.
export const STEP_ICONS = ['MessageCircleQuestion', 'ClipboardList', 'Lock', 'Search', 'Lightbulb'];

// Иконки пунктов меню (по адресу страницы). У шагов цикла вместо значка — номер шага.
export const NAV_ICONS = {
  '#/': 'House',
  '#/diary': 'NotebookPen',
  '#/pvt': 'Timer',
  '#/physio': 'HeartPulse',
  '#/hypotheses': 'Lightbulb',
  '#/pss': 'ClipboardCheck',
  '#/regulation': 'Wind',

  '#/learn': 'BookOpen',
  '#/pilot': 'Users',
  '#/settings': 'Settings',
};
