'use strict';

const { AppError } = require('./errors');

const KZ_LETTERS = /[әғқңөұүһі]/i;
const KZ_WORDS =
  /\b(және|болады|қандай|неге|сұрақ|жауап|есеп|мәтін|дұрыс|қате|тапсырма|бөлшек|өсімдік)\b/i;

function detectLanguage(...samples) {
  const text = samples
    .map((s) => (typeof s === 'string' ? s : JSON.stringify(s || '')))
    .join(' ')
    .slice(0, 20_000);
  if (KZ_LETTERS.test(text)) return 'kz';
  if (KZ_WORDS.test(text)) return 'kz';
  return 'ru';
}

function normalizeLanguage(value, fallbackText) {
  const v = String(value || '').trim().toLowerCase();
  if (v === 'kz' || v === 'kk' || v.startsWith('kaz')) return 'kz';
  if (v === 'ru' || v.startsWith('rus')) return 'ru';
  return detectLanguage(fallbackText);
}

function asText(value, maxLength = 3000) {
  if (typeof value === 'number') value = String(value);
  if (typeof value !== 'string') return '';
  return value.replace(/\u0000/g, ' ').trim().slice(0, maxLength);
}

function cleanProse(value, maxLength) {
  return asText(value, maxLength)
    .replace(/\*\*/g, '')
    .replace(/__/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/`/g, '')
    .trim();
}

function toList(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function optionText(value) {
  if (typeof value === 'string') return asText(value, 500);
  if (typeof value === 'number') return String(value);
  if (value && typeof value === 'object') {
    return asText(value.text || value.value || value.option || value.label || value.answer, 500);
  }
  return '';
}

function letterToIndex(letter) {
  const normalized = String(letter || '').trim().toLowerCase();
  if (!/^[a-zа-я]$/.test(normalized)) return -1;
  const latin = 'abcdefghijklmnopqrstuvwxyz';
  const index = latin.indexOf(normalized);
  if (index >= 0) return index;
  // На случай кириллических А, В, С, Е в качестве обозначений вариантов.
  const cyrillicMap = { а: 0, б: 1, в: 2, г: 3, д: 4, е: 5 };
  return Object.prototype.hasOwnProperty.call(cyrillicMap, normalized)
    ? cyrillicMap[normalized]
    : -1;
}

function resolveCorrectIndex(q, options) {
  let index =
    q.correct_index ?? q.correctIndex ?? q.answer_index ?? q.answerIndex ?? q.correct_option;

  if (typeof index === 'string') {
    const trimmed = index.trim();
    if (/^\d+$/.test(trimmed)) index = Number(trimmed);
    else {
      const byLetter = letterToIndex(trimmed);
      if (byLetter >= 0 && byLetter < options.length) return byLetter;
      index = Number.NaN;
    }
  }

  if (Number.isInteger(index) && index >= 0 && index < options.length) {
    return index;
  }

  const answer = asText(
    q.correct_answer ?? q.correctAnswer ?? q.answer ?? q.correct,
    500
  );
  if (answer) {
    if (/^\d+$/.test(answer)) {
      const n = Number(answer);
      if (n >= 0 && n < options.length) return n;
    }
    const byLetter = letterToIndex(answer);
    if (byLetter >= 0 && byLetter < options.length) return byLetter;

    const needle = answer.toLowerCase();
    const exact = options.findIndex((opt) => opt.toLowerCase() === needle);
    if (exact >= 0) return exact;
    const contained = options.findIndex(
      (opt) => opt.toLowerCase().includes(needle) || needle.includes(opt.toLowerCase())
    );
    if (contained >= 0) return contained;
  }

  return -1;
}

function defaultTopic(language) {
  return language === 'kz' ? 'Жалпы' : 'Общее';
}

function defaultExplanation(language) {
  return language === 'kz'
    ? 'Бұл жауап тақырыптың негізгі ережесіне сүйенеді.'
    : 'Этот ответ опирается на основное правило темы.';
}

function defaultMistakeExplanation(language) {
  return language === 'kz'
    ? 'Қате жауап көбіне ережені толық қолданбаудан болады. Негізгі қадамдарды ретімен тексер.'
    : 'Ошибка чаще всего возникает из-за неполного применения правила. Проверь шаги решения по порядку.';
}

function normalizeQuiz(raw, { filename } = {}) {
  const source = Array.isArray(raw)
    ? { questions: raw }
    : raw && typeof raw === 'object'
      ? raw.quiz && Array.isArray(raw.quiz.questions)
        ? raw.quiz
        : raw.data && Array.isArray(raw.data.questions)
          ? raw.data
          : raw
      : {};

  const rawQuestions = Array.isArray(source.questions) ? source.questions : [];
  const language = normalizeLanguage(source.language, JSON.stringify(source).slice(0, 15_000));

  const questions = [];
  let nextId = 1;
  let skipped = 0;

  for (const q of rawQuestions.slice(0, 80)) {
    if (!q || typeof q !== 'object') {
      skipped += 1;
      continue;
    }

    const typeRaw = String(q.type || '').toLowerCase();
    const hasOptions = Array.isArray(q.options) || Array.isArray(q.choices) || Array.isArray(q.answers);
    const isOpen =
      /open|written|short|essay|text|ашық|разверн/.test(typeRaw) ||
      (!/multiple|choice|mcq|test|тест/.test(typeRaw) && !hasOptions);

    const question = asText(q.question ?? q.text ?? q.prompt, 3000);
    if (!question) {
      skipped += 1;
      continue;
    }

    const topic = asText(q.topic ?? q.theme ?? q.subject, 120) || defaultTopic(language);
    const explanation =
      asText(q.explanation ?? q.scientific_explanation ?? q.why, 2500) ||
      defaultExplanation(language);

    if (isOpen) {
      let criteria = toList(q.criteria ?? q.rubric ?? q.key_points ?? q.answer_criteria)
        .map((item) => optionText(item))
        .filter(Boolean)
        .slice(0, 5);

      if (criteria.length === 0) {
        criteria = [
          language === 'kz'
            ? 'Жауап сұрақтың мәнін дұрыс және толық ашады'
            : 'Ответ верно и полно раскрывает суть вопроса',
        ];
      }

      const sampleAnswer =
        asText(q.sample_answer ?? q.model_answer ?? q.reference_answer, 3000) || '';

      questions.push({
        id: nextId++,
        type: 'open_answer',
        topic,
        question,
        criteria,
        max_score: criteria.length,
        points: criteria.length,
        sample_answer: sampleAnswer,
        explanation,
      });
      continue;
    }

    const rawOptions = toList(q.options ?? q.choices ?? q.answers)
      .slice(0, 10)
      .map((opt, originalIndex) => ({ text: optionText(opt), originalIndex }))
      .filter((entry) => entry.text.length > 0);

    if (rawOptions.length < 2) {
      skipped += 1;
      continue;
    }

    const options = rawOptions.map((entry) => entry.text);
    const resolved = resolveCorrectIndex(q, options);

    if (resolved < 0 || resolved >= options.length) {
      skipped += 1;
      continue;
    }

    const mistake =
      asText(
        q.mistake_explanation ?? q.mistakeExplanation ?? q.common_mistake ?? q.wrong_explanation,
        2000
      ) || defaultMistakeExplanation(language);

    questions.push({
      id: nextId++,
      type: 'multiple_choice',
      topic,
      question,
      options,
      correct_index: resolved,
      explanation,
      mistake_explanation: mistake,
      points: 1,
    });
  }

  if (questions.length === 0) {
    throw new AppError(
      'NO_QUESTIONS',
      422,
      'No valid questions were found in the document',
      { skipped }
    );
  }

  const title =
    asText(source.title, 160) ||
    asText(String(filename || '').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '), 160) ||
    (language === 'kz' ? 'Интерактивті тест' : 'Интерактивный тест');

  const subject = asText(source.subject, 120);
  const grade = asText(source.grade, 60);

  return {
    language,
    title,
    subject,
    grade,
    questions,
    question_count: questions.length,
    total_points: questions.reduce((sum, q) => sum + q.points, 0),
    skipped_questions: skipped,
    demo: false,
    created_at: new Date().toISOString(),
  };
}

function normalizeMet(value) {
  if (value === true) return 'yes';
  if (value === false) return 'no';
  const v = String(value ?? '').toLowerCase();
  if (['yes', 'true', '1', 'full', 'met', 'correct', 'толық'].includes(v)) return 'yes';
  if (['partial', 'partly', '0.5', 'half', 'жартылай'].includes(v)) return 'partial';
  return 'no';
}

function normalizeGrade(raw, { maxScore, language }) {
  const max = Math.max(1, Math.min(5, Number(maxScore) || 1));
  let score = Number(raw?.score);
  if (!Number.isFinite(score)) score = 0;
  score = Math.round(Math.max(0, Math.min(max, score)) * 2) / 2;

  const percent = Math.round((score / max) * 100);
  const verdict = score >= max ? 'correct' : score > 0 ? 'partial' : 'incorrect';

  const fallbackFeedback =
    language === 'kz'
      ? score >= max
        ? 'Тамаша! Жауабың критерийлердің барлығын қамтыды.'
        : 'Жауабыңда дұрыс ой бар. Критерийлерге сүйеніп, оны толықтырып көр.'
      : score >= max
        ? 'Отлично! Твой ответ покрыл все критерии.'
        : 'В ответе есть верная мысль. Опираясь на критерии, дополни его.';

  const feedback = cleanProse(raw?.feedback ?? raw?.comment ?? raw?.explanation, 2000) || fallbackFeedback;

  const rawResults = toList(raw?.criteria_results ?? raw?.rubric_results ?? raw?.criteria);
  const criteriaResults = rawResults
    .slice(0, 6)
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return { criterion: asText(item, 300), met: 'no', comment: '' };
      }
      return {
        criterion: asText(item.criterion ?? item.text ?? item.name, 300),
        met: normalizeMet(item.met ?? item.status ?? item.result),
        comment: cleanProse(item.comment ?? item.feedback ?? item.explanation, 400),
      };
    })
    .filter((item) => item.criterion);

  return {
    score,
    max_score: max,
    percent,
    verdict,
    feedback,
    criteria_results: criteriaResults,
  };
}

function normalizeSummary(raw, language) {
  const fallbackMessage =
    language === 'kz'
      ? 'Сен бүгін маңызды жұмыс жасадың: тесті талдап, қателеріңмен жұмыс істедің. Әр қате — өсуге берілген мүмкіндік.'
      : 'Ты проделал важную работу: разобрал тест и поработал над ошибками. Каждая ошибка — это возможность вырасти.';
  const fallbackTip =
    language === 'kz'
      ? 'Қате жіберген тақырыптарды бір рет қайталап, ұқсас 2–3 тапсырма орындап көр.'
      : 'Повтори темы, где были ошибки, и реши по 2–3 похожих задания.';

  const message = cleanProse(raw?.message ?? raw?.text, 800) || fallbackMessage;
  const tip = cleanProse(raw?.tip ?? raw?.advice, 600) || fallbackTip;
  const emojiRaw = typeof raw?.emoji === 'string' ? raw.emoji.trim() : '';

  return {
    message,
    tip,
    emoji: emojiRaw ? emojiRaw.slice(0, 8) : '🌟',
  };
}

module.exports = {
  detectLanguage,
  normalizeQuiz,
  normalizeGrade,
  normalizeSummary,
};
