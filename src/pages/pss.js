// =====================================================================
// Страница «PSS-10» (Шкала воспринимаемого стресса).
// Доступна с 13 лет, предлагается не чаще раза в 28 дней.
// Без порогов «норма / стресс»: показываются только баллы и изменение.
// =====================================================================
import { getAll, getSetting } from '../db/repo.js';
import { MIN_AGE, PSS } from '../config.js';
import { canTake, changeFromPrevious, scoreRanges } from '../logic/pss.js';
import { dayKeyFor } from '../logic/dates.js';
import { pssFormHtml, setupPssForm } from '../ui/pssForm.js';
import { formatDateTime } from '../ui/helpers.js';
import { icon } from '../ui/icons.js';

// Что именно измеряет шкала — TODO: вставить из источника [Cohen, Kamarck, Mermelstein, 1983;
// описание из выбранной русской версии]. Пока — нейтральное описание без научных утверждений.
const NOT_DIAGNOSIS = `PSS-10 — опросник из 10 вопросов о том, как вы воспринимали свою жизнь
за последний месяц. Это не диагноз и не медицинская оценка:
балл нельзя перевести в «есть стресс / нет стресса», и сайт не сравнивает его с нормами
или с результатами других людей. Имеет смысл только сравнение ваших собственных результатов во времени.`;

export async function renderPss(root) {
  const age13plus = await getSetting('age13plus', false);
  if (!age13plus) {
    root.innerHTML = `
      <h1>PSS-10</h1>
      <p class="notice">Опросник PSS-10 доступен пользователям ${MIN_AGE} лет и старше.
        Если вы ответили на вопрос о возрасте по ошибке, это можно изменить в разделе «Настройки и данные».</p>
      <p><a href="#/">На главную</a></p>`;
    return;
  }

  const results = (await getAll('pss')).sort((a, b) => a.completedAt.localeCompare(b.completedAt));
  const status = canTake(results, dayKeyFor());

  root.innerHTML = `
    <h1 class="card-title metric-pss" style="font-size:1.85rem"><span class="metric-badge">${icon('ClipboardCheck', 22)}</span>PSS-10: шкала воспринимаемого стресса</h1>
    <section class="card card-important"><p>${NOT_DIAGNOSIS}</p></section>
    <div id="pss-area"></div>
    ${historyHtml(results)}`;

  const area = root.querySelector('#pss-area');
  if (status.allowed) {
    area.innerHTML = `
      <p class="hint">Опросник предлагается не чаще раза в ${PSS.minDaysBetween} дней: вопросы относятся к последнему месяцу.</p>
      ${pssFormHtml()}`;
    setupPssForm(area, {
      context: 'regular',
      onSaved: (result) => showResult(root, [...results, result], result),
    });
  } else {
    area.innerHTML = `
      <p class="notice">Вы уже проходили опросник ${formatDateTime(results.filter((r) => !r.demo).at(-1).completedAt)}.
        Следующий раз — с ${status.nextDay.split('-').reverse().join('.')}: опросник предлагается не чаще раза в ${PSS.minDaysBetween} дней.</p>`;
  }
}

// Результат только что пройденного опросника.
function showResult(root, allResults, result) {
  const ranges = scoreRanges(result.scale);
  const change = changeFromPrevious(allResults, result);
  root.innerHTML = `
    <h1>Результат PSS-10</h1>
    <section class="card">
      <dl class="metrics">
        <div><dt>Общий балл</dt><dd>${result.total}</dd>
          <p class="hint">Возможный диапазон: от ${ranges.total.min} до ${ranges.total.max}.</p></div>
        <div><dt>Подшкала «беспомощность»</dt><dd>${result.helplessness}</dd>
          <p class="hint">Пункты 1, 2, 3, 6, 9, 10; диапазон ${ranges.helplessness.min}–${ranges.helplessness.max}.</p></div>
        <div><dt>Подшкала «самоэффективность»</dt><dd>${result.selfEfficacy}</dd>
          <p class="hint">Пункты 4, 5, 7, 8 (после переворота); диапазон ${ranges.selfEfficacy.min}–${ranges.selfEfficacy.max}.</p></div>
      </dl>
    </section>
    ${change ? `
      <section class="card">
        <h2>По сравнению с прошлым разом (${formatDateTime(change.previous.completedAt)})</h2>
        <ul>
          <li>Общий балл: ${changeText(change.total)}.</li>
          <li>Беспомощность: ${changeText(change.helplessness)}.</li>
          <li>Самоэффективность: ${changeText(change.selfEfficacy)}.</li>
        </ul>
        <p class="hint">Небольшие изменения могут быть случайными: ответы зависят от настроения в момент заполнения.</p>
      </section>` : '<p class="hint">Это ваш первый результат — сравнивать пока не с чем.</p>'}
    <p class="hint">${NOT_DIAGNOSIS}</p>
    <div class="actions"><a class="btn btn-primary" href="#/">На главную</a></div>`;
  const h1 = root.querySelector('h1');
  h1.setAttribute('tabindex', '-1');
  h1.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

// Изменение словами, без оценок «лучше/хуже».
function changeText(diff) {
  if (diff === 0) return 'без изменений';
  const n = Math.abs(diff);
  return `на ${n} ${plural(n)} ${diff > 0 ? 'больше' : 'меньше'}`;
}

function plural(n) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'балл';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'балла';
  return 'баллов';
}

function historyHtml(results) {
  if (results.length === 0) return '';
  return `
    <section aria-labelledby="h-pss-history">
      <h2 id="h-pss-history">Прошлые результаты</h2>
      <ul class="recent-list">
        ${[...results].reverse().map((r) => `
          <li><span>${formatDateTime(r.completedAt)}</span>
            <span>общий балл ${r.total} · беспомощность ${r.helplessness} · самоэффективность ${r.selfEfficacy}
              ${r.context && r.context !== 'regular' ? '<span class="tag">пилот</span>' : ''}${r.demo ? '<span class="tag">демо</span>' : ''}</span></li>`).join('')}
      </ul>
    </section>`;
}
