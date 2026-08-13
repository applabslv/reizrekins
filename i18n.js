'use strict';

/* ============================================================
   Lokalizācija — lv / en / ru
   ============================================================ */

const LANGS = [
  { code: 'lv', label: '🇱🇻', name: 'Latviski' },
  { code: 'en', label: '🇬🇧', name: 'English' },
  { code: 'ru', label: '🇷🇺', name: 'Русский' },
];

const STRINGS = {
  lv: {
    'doc.title': 'Reizrēķins debesīs — lidmašīnu spēle',
    'doc.desc': 'Reizināšanas tabulas spēle bērniem — lido ar lidmašīnu un trāpi pareizajā atbildē!',
    'menu.h1': '✈️ Reizrēķins debesīs',
    'menu.subtitle': 'Lido ar bultiņām ↑ ↓ vai velc ar pirkstu.<br>Uzlido mākonim ar pareizo atbildi, no pārējiem izvairies!<br>Pēc 15 sekundēm mākoņi aizšķērsos visas debesis.',
    'label.table': 'Reizināšanas tabula',
    'label.answers': 'Atbildes',
    'label.speed': 'Ātrums',
    'label.language': 'Valoda',
    'btn.start': '▶ Sākt spēli',
    'btn.scores': '🏆 Labākie rezultāti',
    'pause.title': 'Pauze',
    'btn.resume': '▶ Turpināt',
    'btn.restart': '↻ Sākt no jauna',
    'btn.home': '⌂ Uz sākumu',
    'go.over': '🏁 SPĒLE GALĀ',
    'go.win': '🏁 MALACIS!',
    'go.points': 'Punkti',
    'go.time': 'Laiks',
    'go.best': '⭐ Jauns rekords! ⭐',
    'btn.results': '🏆 Rezultāti',
    'btn.showAnswers': '📋 Rādīt atbildes',
    'btn.again': '↻ Sākt vēlreiz',
    'answers.title': 'Atbildes',
    'legend.got': 'pareizi',
    'legend.missed': 'nepareizi',
    'legend.skipped': 'nepaspēja',
    'btn.back': '← Atpakaļ',
    'lb.title': '🏆 Labākie rezultāti',
    'lb.table': 'Tabula',
    'lb.speed': 'Ātrums',
    'lb.points': 'Punkti',
    'lb.time': 'Laiks',
    'lb.choices': 'Atbilžu skaits',
    'lb.empty': 'Vēl nav rezultātu — nospēlē pirmo spēli!',
    'fb.correct': 'Pareizi!',
    'fb.wrong': 'Nepareizi!',
    'aria.pause': 'Pauze',
    'aria.sound': 'Skaņa',
    'aria.choices': '{n} atbildes',
  },
  en: {
    'doc.title': 'Times Tables in the Sky — plane game',
    'doc.desc': 'A times tables game for kids — fly your plane into the right answer!',
    'menu.h1': '✈️ Times Tables in the Sky',
    'menu.subtitle': 'Fly with the arrows ↑ ↓ or drag your finger.<br>Fly into the cloud with the right answer, dodge the rest!<br>After 15 seconds the clouds block the whole sky.',
    'label.table': 'Times table',
    'label.answers': 'Answers',
    'label.speed': 'Speed',
    'label.language': 'Language',
    'btn.start': '▶ Start game',
    'btn.scores': '🏆 High scores',
    'pause.title': 'Paused',
    'btn.resume': '▶ Resume',
    'btn.restart': '↻ Start over',
    'btn.home': '⌂ Main menu',
    'go.over': '🏁 GAME OVER',
    'go.win': '🏁 WELL DONE!',
    'go.points': 'Score',
    'go.time': 'Time',
    'go.best': '⭐ New record! ⭐',
    'btn.results': '🏆 Scores',
    'btn.showAnswers': '📋 Show answers',
    'btn.again': '↻ Play again',
    'answers.title': 'Answers',
    'legend.got': 'correct',
    'legend.missed': 'wrong',
    'legend.skipped': 'not reached',
    'btn.back': '← Back',
    'lb.title': '🏆 High scores',
    'lb.table': 'Table',
    'lb.speed': 'Speed',
    'lb.points': 'Score',
    'lb.time': 'Time',
    'lb.choices': 'Number of answers',
    'lb.empty': 'No scores yet — play your first game!',
    'fb.correct': 'Correct!',
    'fb.wrong': 'Wrong!',
    'aria.pause': 'Pause',
    'aria.sound': 'Sound',
    'aria.choices': '{n} answers',
  },
  ru: {
    'doc.title': 'Таблица умножения в небе — игра с самолётом',
    'doc.desc': 'Игра на таблицу умножения для детей — лети на самолёте к правильному ответу!',
    'menu.h1': '✈️ Умножение в небе',
    'menu.subtitle': 'Лети стрелками ↑ ↓ или веди пальцем.<br>Влетай в облако с правильным ответом, остальные облетай!<br>Через 15 секунд облака перекроют всё небо.',
    'label.table': 'Таблица умножения',
    'label.answers': 'Ответы',
    'label.speed': 'Скорость',
    'label.language': 'Язык',
    'btn.start': '▶ Начать игру',
    'btn.scores': '🏆 Лучшие результаты',
    'pause.title': 'Пауза',
    'btn.resume': '▶ Продолжить',
    'btn.restart': '↻ Начать заново',
    'btn.home': '⌂ В меню',
    'go.over': '🏁 ИГРА ОКОНЧЕНА',
    'go.win': '🏁 МОЛОДЕЦ!',
    'go.points': 'Очки',
    'go.time': 'Время',
    'go.best': '⭐ Новый рекорд! ⭐',
    'btn.results': '🏆 Результаты',
    'btn.showAnswers': '📋 Показать ответы',
    'btn.again': '↻ Играть снова',
    'answers.title': 'Ответы',
    'legend.got': 'верно',
    'legend.missed': 'неверно',
    'legend.skipped': 'не успел',
    'btn.back': '← Назад',
    'lb.title': '🏆 Лучшие результаты',
    'lb.table': 'Таблица',
    'lb.speed': 'Скорость',
    'lb.points': 'Очки',
    'lb.time': 'Время',
    'lb.choices': 'Количество ответов',
    'lb.empty': 'Результатов пока нет — сыграй первую игру!',
    'fb.correct': 'Верно!',
    'fb.wrong': 'Неверно!',
    'aria.pause': 'Пауза',
    'aria.sound': 'Звук',
    'aria.choices': '{n} ответа',
  },
};

let lang = 'lv';

// Valsts pēc pārlūka laika joslas — bez tīkla pieprasījuma un bez IP izsekošanas.
const TZ_LANG = {
  'Europe/Riga': 'lv',
  'Europe/Moscow': 'ru', 'Europe/Kaliningrad': 'ru', 'Europe/Samara': 'ru',
  'Europe/Volgograd': 'ru', 'Europe/Saratov': 'ru', 'Europe/Astrakhan': 'ru',
  'Europe/Ulyanovsk': 'ru', 'Europe/Kirov': 'ru', 'Europe/Minsk': 'ru',
  'Asia/Yekaterinburg': 'ru', 'Asia/Omsk': 'ru', 'Asia/Novosibirsk': 'ru',
  'Asia/Krasnoyarsk': 'ru', 'Asia/Irkutsk': 'ru', 'Asia/Yakutsk': 'ru',
  'Asia/Vladivostok': 'ru', 'Asia/Magadan': 'ru', 'Asia/Kamchatka': 'ru',
};

// Pirmajā reizē: 1) pārlūka valoda, 2) valsts pēc laika joslas, 3) angļu.
function detectLang() {
  for (const l of navigator.languages || [navigator.language || '']) {
    const code = String(l).slice(0, 2).toLowerCase();
    if (STRINGS[code]) return code;
  }
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (TZ_LANG[tz]) return TZ_LANG[tz];
  } catch {}
  return 'en';
}

function t(key, vars) {
  let s = (STRINGS[lang] && STRINGS[lang][key]) || STRINGS.lv[key] || key;
  if (vars) for (const k in vars) s = s.replaceAll('{' + k + '}', vars[k]);
  return s;
}

// Pārtulko visu, kas atzīmēts ar data-i18n / data-i18n-aria / data-i18n-title.
function applyI18n() {
  document.documentElement.lang = lang;
  document.title = t('doc.title');
  const desc = document.querySelector('meta[name="description"]');
  if (desc) desc.setAttribute('content', t('doc.desc'));

  for (const el of document.querySelectorAll('[data-i18n]')) {
    el.innerHTML = t(el.dataset.i18n);
  }
  for (const el of document.querySelectorAll('[data-i18n-aria]')) {
    el.setAttribute('aria-label', t(el.dataset.i18nAria));
  }
  for (const el of document.querySelectorAll('[data-i18n-title]')) {
    el.setAttribute('title', t(el.dataset.i18nTitle));
  }
}
