(function () {
  'use strict';

  const STORE_KEY = 'daryn.quiz';
  const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

  const $ = (id) => document.getElementById(id);

  const els = {};
  const state = {
    quiz: null,
    index: 0,
    records: [],
    answered: false,
    busy: false,
    resultsShown: false,
    summary: null,
    summaryLoading: false,
    summaryError: false,
  };

  class ApiError extends Error {
    constructor(payload) {
      super((payload && payload.message) || 'API error');
      this.code = (payload && payload.error) || 'UNKNOWN';
    }
  }

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function cacheElements() {
    Object.assign(els, {
      exitBtn: $('exit-btn'),
      progressLabel: $('progress-label'),
      scoreLabel: $('score-label'),
      progressBar: $('progress-bar'),
      progressFill: $('progress-fill'),

      missingView: $('missing-view'),
      quizView: $('quiz-view'),
      questionCard: $('question-card'),
      topicChip: $('topic-chip'),
      typeChip: $('type-chip'),
      demoBadge: $('demo-badge'),
      questionText: $('question-text'),

      mcOptions: $('mc-options'),
      openAnswer: $('open-answer'),
      answerInput: $('answer-input'),
      openError: $('open-error'),
      openErrorText: $('open-error-text'),
      checkBtn: $('check-btn'),
      checkBtnText: $('check-btn-text'),
      checkSpinner: $('check-spinner'),

      feedback: $('feedback'),
      feedbackScroll: document.querySelector('.feedback-scroll'),
      feedbackIcon: $('feedback-icon'),
      feedbackTitle: $('feedback-title'),
      feedbackScore: $('feedback-score'),
      feedbackBody: $('feedback-body'),
      nextBtn: $('next-btn'),
      nextText: $('next-text'),

      resultsView: $('results-view'),
      resultsTitle: $('results-title'),
      resultsSubtitle: $('results-subtitle'),
      ringValue: $('ring-value'),
      scoreBig: $('score-big'),
      scoreTotal: $('score-total'),
      scoreCaption: $('score-caption'),
      statAccuracy: $('stat-accuracy'),
      statCorrect: $('stat-correct'),
      statMistakes: $('stat-mistakes'),
      aiSummary: $('ai-summary'),
      resultsDemoNote: $('results-demo-note'),
      mistakesSection: $('mistakes-section'),
      mistakesList: $('mistakes-list'),
      retryBtn: $('retry-btn'),
      newBtn: $('new-btn'),
      confettiLayer: $('confetti-layer'),

      exitModal: $('exit-modal'),
      stayBtn: $('stay-btn'),
      leaveBtn: $('leave-btn'),
    });
  }

  /* ----------------------------- Helpers ----------------------------- */

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function readJson(response) {
    return response.json().catch(() => ({}));
  }

  function currentQuestion() {
    return state.quiz.questions[state.index];
  }

  function questionCount() {
    return state.quiz.questions.length;
  }

  function findRecord(questionId) {
    return state.records.find((record) => record.questionId === questionId);
  }

  function totalPoints() {
    return state.quiz.questions.reduce((sum, q) => {
      if (q.type === 'multiple_choice') return sum + 1;
      return sum + Math.max(1, Number(q.max_score) || (q.criteria ? q.criteria.length : 1));
    }, 0);
  }

  function earnedPoints() {
    return state.records.reduce((sum, record) => sum + (Number(record.awarded) || 0), 0);
  }

  function roundHalf(value) {
    return Math.round(value * 2) / 2;
  }

  function format(value) {
    return I18n.formatNumber(value);
  }

  function setProgress(percent) {
    const safe = Math.max(0, Math.min(100, percent));
    els.progressFill.style.width = `${safe}%`;
    els.progressBar.setAttribute('aria-valuenow', String(Math.round(safe)));
  }

  function updateScore() {
    els.scoreLabel.textContent = `${format(earnedPoints())} / ${format(totalPoints())}`;
  }

  function isLastQuestion() {
    return state.index >= questionCount() - 1;
  }

  function updateNextLabel() {
    els.nextText.textContent = isLastQuestion() ? I18n.t('quiz.finish') : I18n.t('feedback.continue');
  }

  function showInlineError(text) {
    els.openErrorText.textContent = text;
    els.openError.classList.remove('hidden');
  }

  function clearInlineError() {
    els.openError.classList.add('hidden');
    els.openErrorText.textContent = '';
  }

  function apiErrorMessage(error) {
    const map = {
      EMPTY_ANSWER: 'err.emptyAnswer',
      MISSING_API_KEY: 'err.noKey',
      APP_RATE_LIMIT: 'err.rate',
      AI_RATE_LIMIT: 'err.rate',
      AI_AUTH: 'err.auth',
      AI_TIMEOUT: 'err.timeout',
      AI_UNAVAILABLE: 'err.ai',
      AI_EMPTY_RESPONSE: 'err.ai',
      AI_BAD_JSON: 'err.parse',
      AI_BAD_REQUEST: 'err.parse',
    };
    if (error && map[error.code]) return I18n.t(map[error.code]);
    if (error && error.name === 'TypeError') return I18n.t('err.network');
    return I18n.t('err.answerError');
  }

  /* ----------------------------- Init ------------------------------- */

  function init() {
    cacheElements();

    let quiz;
    try {
      quiz = JSON.parse(sessionStorage.getItem(STORE_KEY) || 'null');
    } catch (_) {
      quiz = null;
    }

    if (!quiz || !Array.isArray(quiz.questions) || quiz.questions.length === 0) {
      showMissing();
      return;
    }

    quiz.language = quiz.language === 'kz' ? 'kz' : 'ru';
    quiz.demo = quiz.demo === true;
    quiz.questions = quiz.questions
      .filter((q) => q && typeof q.question === 'string' && q.question.trim())
      .map((q, index) => {
        const item = { ...q, id: q.id != null ? q.id : index + 1 };
        if (item.type === 'multiple_choice') {
          item.type = 'multiple_choice';
          item.options = Array.isArray(item.options) ? item.options.slice(0, 8) : [];
          item.correct_index = Number(item.correct_index);
          item.points = 1;
        } else {
          item.type = 'open_answer';
          item.criteria = Array.isArray(item.criteria)
            ? item.criteria.filter((c) => typeof c === 'string' && c.trim()).slice(0, 5)
            : [];
          item.max_score = Math.max(1, item.criteria.length || 1);
          item.points = item.max_score;
        }
        return item;
      })
      .filter((q) => {
        if (q.type === 'multiple_choice') {
          return (
            q.options.length >= 2 &&
            Number.isInteger(q.correct_index) &&
            q.correct_index >= 0 &&
            q.correct_index < q.options.length
          );
        }
        return q.criteria.length > 0;
      });

    if (quiz.questions.length === 0) {
      showMissing();
      return;
    }

    quiz.question_count = quiz.questions.length;
    state.quiz = quiz;

    bindEvents();
    renderQuestion();
  }

  function showMissing() {
    els.missingView.classList.remove('hidden');
    els.missingView.style.display = 'flex';
    els.quizView.classList.add('hidden');
    els.resultsView.classList.add('hidden');
    els.exitBtn.disabled = false;
  }

  /* --------------------------- Render quiz --------------------------- */

  function renderQuestion(options) {
    const opts = options || {};
    const q = currentQuestion();
    const record = findRecord(q.id);

    state.answered = Boolean(record);
    state.busy = false;

    closeFeedback();
    clearInlineError();
    els.demoBadge.classList.toggle('hidden', !state.quiz.demo);
    els.topicChip.textContent = q.topic || (state.quiz.language === 'kz' ? 'Жалпы' : 'Общее');
    els.typeChip.textContent =
      q.type === 'multiple_choice' ? I18n.t('quiz.typeMc') : I18n.t('quiz.typeOpen');
    els.questionText.textContent = q.question;
    els.progressLabel.textContent = I18n.t('quiz.progress', {
      n: state.index + 1,
      total: questionCount(),
    });

    const completed = state.index + (record ? 1 : 0);
    setProgress((completed / questionCount()) * 100);
    updateScore();
    updateNextLabel();

    els.questionCard.classList.remove('animate-fade-up');
    void els.questionCard.offsetWidth;
    els.questionCard.classList.add('animate-fade-up');

    if (q.type === 'multiple_choice') {
      renderOptions(q);
      if (record) paintMcAnswer(q, record);
    } else {
      renderOpenAnswer(q);
      if (record) restoreOpenAnswer(record);
    }

    if (record) {
      showFeedback(record, { instant: true });
    } else if (!opts.keepScroll) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function renderOptions(q) {
    els.mcOptions.innerHTML = '';
    els.mcOptions.classList.remove('hidden');
    els.openAnswer.classList.add('hidden');

    q.options.forEach((option, index) => {
      const button = el('button', 'option');
      button.type = 'button';
      button.dataset.index = String(index);
      button.appendChild(el('span', 'badge', LETTERS[index] || String(index + 1)));
      button.appendChild(el('span', 'option-text', option));
      button.addEventListener('click', () => selectOption(index));
      els.mcOptions.appendChild(button);
    });
  }

  function paintMcAnswer(q, record) {
    Array.from(els.mcOptions.children).forEach((button, index) => {
      button.disabled = true;
      const badge = button.querySelector('.badge');

      if (index === q.correct_index) {
        button.classList.add('correct');
        if (badge) badge.textContent = '✓';
      } else if (index === record.selectedIndex) {
        button.classList.add('wrong');
        if (badge) badge.textContent = '✕';
      } else {
        button.classList.add('muted');
      }
    });
  }

  function selectOption(index) {
    if (state.answered || state.busy) return;
    const q = currentQuestion();
    if (!q || q.type !== 'multiple_choice') return;
    if (index === q.correct_index && findRecord(q.id)) return;

    const correct = index === q.correct_index;
    const record = {
      questionId: q.id,
      type: 'multiple_choice',
      topic: q.topic || '',
      question: q.question,
      selectedIndex: index,
      awarded: correct ? 1 : 0,
      max: 1,
      correct,
    };

    state.records.push(record);
    state.answered = true;

    paintMcAnswer(q, record);
    setProgress(((state.index + 1) / questionCount()) * 100);
    updateScore();
    showFeedback(record);
  }

  function renderOpenAnswer(q) {
    els.mcOptions.innerHTML = '';
    els.mcOptions.classList.add('hidden');
    els.openAnswer.classList.remove('hidden');
    els.answerInput.value = '';
    els.answerInput.disabled = false;
    els.answerInput.classList.remove('hidden');
    els.checkBtn.classList.remove('hidden');
    els.checkBtn.disabled = false;
    els.checkBtnText.textContent = I18n.t('quiz.check');
    els.checkSpinner.classList.add('hidden');
  }

  function restoreOpenAnswer(record) {
    els.answerInput.value = record.answerText || '';
    els.answerInput.disabled = true;
    els.checkBtn.classList.add('hidden');
    els.checkBtn.disabled = false;
  }

  function setChecking(checking) {
    state.busy = checking;
    els.answerInput.disabled = checking;
    els.checkBtn.disabled = checking;
    els.checkBtnText.textContent = checking ? I18n.t('quiz.checking') : I18n.t('quiz.check');
    els.checkSpinner.classList.toggle('hidden', !checking);
    if (!checking) {
      els.checkSpinner.classList.add('spin');
    }
  }

  /* ------------------------- Open answer check ----------------------- */

  async function checkOpenAnswer() {
    if (state.answered || state.busy) return;
    const q = currentQuestion();
    const answer = els.answerInput.value.trim();

    clearInlineError();
    if (answer.length < 2) {
      showInlineError(I18n.t('quiz.emptyAnswer'));
      els.answerInput.focus();
      return;
    }

    setChecking(true);

    try {
      const grade = state.quiz.demo
        ? await demoGrade(q, answer)
        : await requestGrade(q, answer);

      const max = Math.max(1, Number(grade.max_score) || q.max_score || 1);
      const awarded = Math.max(0, Math.min(max, roundHalf(Number(grade.score) || 0)));

      const record = {
        questionId: q.id,
        type: 'open_answer',
        topic: q.topic || '',
        question: q.question,
        answerText: answer,
        awarded,
        max,
        correct: awarded >= max,
        grade: { ...grade, score: awarded, max_score: max },
      };

      state.records.push(record);
      state.answered = true;

      setChecking(false);
      els.answerInput.disabled = true;
      els.checkBtn.classList.add('hidden');

      setProgress(((state.index + 1) / questionCount()) * 100);
      updateScore();
      showFeedback(record);
    } catch (error) {
      setChecking(false);
      showInlineError(apiErrorMessage(error));
    }
  }

  async function requestGrade(q, answer) {
    const response = await fetch('/api/check-open-answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: q.question,
        criteria: q.criteria,
        max_score: q.max_score,
        sample_answer: q.sample_answer || '',
        answer,
        language: state.quiz.language,
      }),
    });

    const data = await readJson(response);
    if (!response.ok) throw new ApiError(data);
    if (!data.grade) throw new ApiError({ error: 'AI_BAD_JSON' });
    return data.grade;
  }

  /* -------------------------- Demo grading --------------------------- */

  const STOP_WORDS = new Set(
    (
      'что это как для при его она они было были есть или если так все ещё еще только очень ' +
      'может которые который через между после перед когда потому поэтому своими словами ' +
      'пример назови объясни почему какой какие твой ответ сен және бірақ үшін оның олар ' +
      'бұл осы сол бар жоқ деп деген болып болады керек қажет екі бірінші екінші өз сөзің'
    ).split(/\s+/)
  );

  function contentWords(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((word) => word.length >= 4 && !STOP_WORDS.has(word));
  }

  async function demoGrade(question, answer) {
    await delay(600);
    const answerWords = new Set(contentWords(answer));
    const criteria = question.criteria || [];

    const results = criteria.map((criterion) => {
      const words = Array.from(new Set(contentWords(criterion)));
      const hits = words.filter((word) => answerWords.has(word)).length;
      const ratio = words.length ? hits / words.length : 0;
      let met = 'no';
      if (answerWords.size >= 3 && ratio >= 0.4) met = 'yes';
      else if (answerWords.size >= 3 && ratio >= 0.18) met = 'partial';

      const comment =
        met === 'yes'
          ? I18n.t('demo.critYes')
          : met === 'partial'
            ? I18n.t('demo.critPartial')
            : I18n.t('demo.critNo');

      return { criterion, met, comment };
    });

    const max = Math.max(1, criteria.length);
    const score = Math.min(
      max,
      results.reduce((sum, item) => sum + (item.met === 'yes' ? 1 : item.met === 'partial' ? 0.5 : 0), 0)
    );

    let feedback;
    if (score >= max) {
      feedback = I18n.t('demo.fbFull');
    } else if (score > 0) {
      feedback = I18n.t('demo.fbPartial');
    } else {
      feedback = I18n.t('demo.fbZero');
    }

    return {
      score,
      max_score: max,
      percent: Math.round((score / max) * 100),
      verdict: score >= max ? 'correct' : score > 0 ? 'partial' : 'incorrect',
      feedback,
      criteria_results: results,
    };
  }

  /* --------------------------- Feedback UI --------------------------- */

  function addLabel(container, text) {
    container.appendChild(el('div', 'feedback-label', text));
  }

  function addText(container, text, className) {
    if (!text) return null;
    const node = el('p', className || 'feedback-text', text);
    node.style.whiteSpace = 'pre-line';
    container.appendChild(node);
    return node;
  }

  function addCriteria(container, record) {
    const q = currentQuestion();
    let results = record.grade && Array.isArray(record.grade.criteria_results)
      ? record.grade.criteria_results
      : [];

    if (results.length === 0 && Array.isArray(q.criteria) && q.criteria.length) {
      results = q.criteria.map((criterion) => ({ criterion, met: 'none', comment: '' }));
    }
    if (results.length === 0) return;

    addLabel(container, I18n.t('feedback.criteria'));
    const list = el('div', 'criteria-list');

    results.forEach((item) => {
      const met = item.met === 'yes' || item.met === 'partial' ? item.met : 'no';
      const row = el('div', `criterion ${met}`);
      const mark = el('span', 'mark', met === 'yes' ? '✓' : met === 'partial' ? '½' : '✕');
      const text = el('div', 'flex-1');
      text.appendChild(el('span', '', item.criterion || ''));
      if (item.comment) text.appendChild(el('span', 'comment', item.comment));
      row.appendChild(mark);
      row.appendChild(text);
      list.appendChild(row);
    });

    container.appendChild(list);
  }

  function showFeedback(record, options) {
    const opts = options || {};
    const q =
      state.quiz.questions.find((item) => item.id === record.questionId) ||
      currentQuestion();
    if (!q) return;
    const tone =
      record.type === 'multiple_choice'
        ? record.correct
          ? 'correct'
          : 'wrong'
        : record.awarded >= record.max
          ? 'correct'
          : record.awarded > 0
            ? 'partial'
            : 'wrong';

    els.feedback.classList.remove('correct', 'wrong', 'partial', 'is-open');
    els.feedback.classList.add(tone);
    els.feedback.setAttribute('aria-hidden', 'false');
    document.body.classList.add('has-sheet');

    els.feedbackIcon.textContent = tone === 'correct' ? '✓' : tone === 'partial' ? '½' : '✕';

    let title;
    if (record.type === 'multiple_choice') {
      title = record.correct
        ? I18n.t(`feedback.praise${((q.id - 1) % 4) + 1}`)
        : I18n.t('feedback.wrongTitle');
    } else if (tone === 'correct') {
      title = I18n.t('feedback.praise1');
    } else if (tone === 'partial') {
      title = I18n.t('feedback.partialTitle');
    } else {
      title = I18n.t('feedback.wrongTitle');
    }
    els.feedbackTitle.textContent = title;

    if (record.type === 'open_answer') {
      els.feedbackScore.textContent = `${format(record.awarded)} / ${format(record.max)}`;
      els.feedbackScore.classList.remove('hidden');
    } else {
      els.feedbackScore.classList.add('hidden');
      els.feedbackScore.textContent = '';
    }

    const body = els.feedbackBody;
    body.innerHTML = '';

    if (record.type === 'multiple_choice') {
      if (!record.correct) {
        const callout = el('div', 'answer-callout');
        callout.appendChild(el('span', 'feedback-label', I18n.t('feedback.correctAnswer')));
        callout.appendChild(el('strong', '', q.options[q.correct_index] || ''));
        body.appendChild(callout);

        addLabel(body, I18n.t('feedback.mistake'));
        addText(body, q.mistake_explanation);

        addLabel(body, I18n.t('feedback.explanation'));
        addText(body, q.explanation);
      } else {
        addLabel(body, I18n.t('feedback.explanation'));
        addText(body, q.explanation);
      }
    } else {
      const grade = record.grade || {};
      addLabel(body, I18n.t('feedback.aiFeedback'));
      addText(body, grade.feedback);
      addCriteria(body, record);

      addLabel(body, I18n.t('feedback.explanation'));
      addText(body, q.explanation);

      if (q.sample_answer) {
        addLabel(body, I18n.t('feedback.sample'));
        addText(body, q.sample_answer);
      }

      if (state.quiz.demo) {
        addText(body, I18n.t('feedback.demoNote'), 'text-[11px] font-bold text-amber-700 mt-3');
      }
    }

    updateNextLabel();
    els.feedbackScroll.scrollTop = 0;

    if (opts.instant) {
      els.feedback.style.transition = 'none';
      els.feedback.classList.add('is-open');
      void els.feedback.offsetHeight;
      els.feedback.style.transition = '';
    } else {
      // Фиксируем закрытое состояние перед открытием, чтобы transition сработал
      // даже в фоновой вкладке, где requestAnimationFrame может быть throttled.
      void els.feedback.offsetHeight;
      els.feedback.classList.add('is-open');
      window.setTimeout(() => {
        if (!els.nextBtn.disabled) els.nextBtn.focus({ preventScroll: true });
      }, 180);
    }
  }

  function closeFeedback() {
    els.feedback.classList.remove('is-open');
    els.feedback.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('has-sheet');
  }

  /* ---------------------------- Navigation --------------------------- */

  function advance() {
    if (!state.answered) return;
    closeFeedback();

    if (isLastQuestion()) {
      showResults();
      return;
    }

    state.index += 1;
    renderQuestion();
  }

  function metrics() {
    const total = totalPoints();
    const score = earnedPoints();
    const percent = total > 0 ? Math.round((score / total) * 100) : 0;
    const correct = state.records.filter((record) => record.awarded >= record.max).length;
    const mistakes = state.records.filter((record) => record.awarded < record.max);
    return { total, score, percent, correct, mistakes };
  }

  /* ----------------------------- Results ----------------------------- */

  function showResults() {
    state.resultsShown = true;
    closeFeedback();
    els.quizView.classList.add('hidden');
    els.resultsView.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'auto' });

    paintResults({ animate: true });
    launchConfetti();
    loadSummary();

    document.title = `${I18n.t('results.eyebrow')} — Дарын`;
    els.resultsTitle.setAttribute('tabindex', '-1');
    window.setTimeout(() => els.resultsTitle.focus({ preventScroll: true }), 60);
  }

  function paintResults(options) {
    const opts = options || {};
    const m = metrics();

    let titleKey = 'results.titleLow';
    let subtitleKey = 'results.subLow';
    if (m.percent >= 90) {
      titleKey = 'results.titleHigh';
      subtitleKey = 'results.subHigh';
    } else if (m.percent >= 70) {
      titleKey = 'results.titleGood';
      subtitleKey = 'results.subGood';
    } else if (m.percent >= 50) {
      titleKey = 'results.titleMid';
      subtitleKey = 'results.subMid';
    }

    els.resultsTitle.textContent = I18n.t(titleKey);
    els.resultsSubtitle.textContent = I18n.t(subtitleKey);
    els.scoreBig.textContent = format(m.score);
    els.scoreTotal.textContent = `/ ${format(m.total)}`;
    els.scoreCaption.textContent = I18n.pointsWord(m.total);
    els.statAccuracy.textContent = `${m.percent}%`;
    els.statCorrect.textContent = `${format(m.correct)} / ${format(questionCount())}`;
    els.statMistakes.textContent = format(m.mistakes.length);
    els.resultsDemoNote.classList.toggle('hidden', !state.quiz.demo);

    paintRing(m.percent, opts.animate !== false);
    renderMistakes(m.mistakes);
    paintSummary();
  }

  function paintRing(percent, animate) {
    const radius = 88;
    const circumference = 2 * Math.PI * radius;
    els.ringValue.style.strokeDasharray = String(circumference);
    els.ringValue.style.strokeDashoffset = String(circumference);

    if (!animate) {
      els.ringValue.style.strokeDashoffset = String(circumference * (1 - percent / 100));
      return;
    }

    void els.ringValue.getBoundingClientRect();
    window.requestAnimationFrame(() => {
      els.ringValue.style.strokeDashoffset = String(circumference * (1 - percent / 100));
    });
  }

  function renderMistakes(mistakes) {
    els.mistakesList.innerHTML = '';
    els.mistakesSection.classList.remove('hidden');

    if (mistakes.length === 0) {
      const success = el(
        'div',
        'answer-callout',
        I18n.t('results.noMistakes')
      );
      success.style.background = '#f4ffed';
      success.style.borderColor = '#c6efa5';
      els.mistakesList.appendChild(success);
      return;
    }

    mistakes.forEach((record) => {
      const question = state.quiz.questions.find((q) => q.id === record.questionId);
      if (!question) return;

      const questionIsMc =
        question.type === 'multiple_choice' && Array.isArray(question.options);
      if (record.type === 'multiple_choice' && !questionIsMc) return;
      if (record.type === 'open_answer' && questionIsMc) return;

      const details = el('details', 'mistake-item');
      const summary = el('summary', '');

      const mark = el(
        'span',
        'text-base font-black',
        record.awarded > 0 ? '½' : '✕'
      );
      mark.style.color = record.awarded > 0 ? '#b8860b' : '#d33131';

      const main = el('div', 'flex-1 min-w-0');
      if (record.topic) {
        main.appendChild(
          el(
            'span',
            'block text-[10px] font-black uppercase tracking-wider text-gray-400 mb-0.5',
            record.topic
          )
        );
      }
      main.appendChild(el('p', 'text-[13px] md:text-sm', record.question));

      const score = el(
        'span',
        'score-pill',
        `${format(record.awarded)} / ${format(record.max)}`
      );
      const chevron = el('span', 'chev', '▾');

      summary.appendChild(mark);
      summary.appendChild(main);
      summary.appendChild(score);
      summary.appendChild(chevron);

      const body = el('div', 'mistake-body');

      if (record.type === 'multiple_choice') {
        addLabel(body, I18n.t('feedback.correctAnswer'));
        const answer = el('p', 'text-sm font-extrabold text-[#356b00]', question.options[question.correct_index] || '');
        body.appendChild(answer);

        addLabel(body, I18n.t('feedback.mistake'));
        addText(body, question.mistake_explanation, 'text-sm');

        addLabel(body, I18n.t('feedback.explanation'));
        addText(body, question.explanation, 'text-sm');
      } else {
        addLabel(body, I18n.t('results.yourAnswer'));
        addText(body, record.answerText, 'text-sm');

        if (record.grade && record.grade.feedback) {
          addLabel(body, I18n.t('feedback.aiFeedback'));
          addText(body, record.grade.feedback, 'text-sm');
        }

        addLabel(body, I18n.t('feedback.explanation'));
        addText(body, question.explanation, 'text-sm');

        if (question.sample_answer) {
          addLabel(body, I18n.t('feedback.sample'));
          addText(body, question.sample_answer, 'text-sm');
        }
      }

      details.appendChild(summary);
      details.appendChild(body);
      els.mistakesList.appendChild(details);
    });
  }

  /* ----------------------------- Summary ----------------------------- */

  async function loadSummary() {
    if (state.quiz.demo) {
      state.summary = buildDemoSummary();
      state.summaryLoading = false;
      state.summaryError = false;
      paintSummary();
      return;
    }

    if (state.summaryLoading) return;

    const m = metrics();
    state.summaryLoading = true;
    state.summaryError = false;
    state.summary = null;
    paintSummary();

    try {
      const response = await fetch('/api/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          score: m.score,
          total: m.total,
          language: state.quiz.language,
          correct: m.correct,
          question_count: questionCount(),
          mistakes: m.mistakes.slice(0, 12).map((record) => ({
            topic: record.topic || '',
            question: record.question || '',
          })),
        }),
      });

      const data = await readJson(response);
      if (!response.ok) throw new ApiError(data);
      if (!data.summary) throw new ApiError({ error: 'AI_BAD_JSON' });

      state.summary = data.summary;
    } catch (error) {
      state.summaryError = true;
    } finally {
      state.summaryLoading = false;
      paintSummary();
    }
  }

  function paintSummary() {
    const container = els.aiSummary;
    container.innerHTML = '';

    if (state.summaryLoading) {
      container.appendChild(
        el('p', 'text-sm font-bold text-[#5f7250] mb-2', I18n.t('results.aiLoading'))
      );
      const line1 = el('div', 'skeleton w-11/12 mb-2');
      const line2 = el('div', 'skeleton w-3/4');
      container.appendChild(line1);
      container.appendChild(line2);
      return;
    }

    if (state.summaryError) {
      container.appendChild(
        el('p', 'text-sm font-semibold text-[#5f7250] leading-relaxed', I18n.t('results.aiError'))
      );
      const retry = el('button', 'btn btn-secondary btn-sm mt-3', I18n.t('results.aiRetry'));
      retry.type = 'button';
      retry.addEventListener('click', () => {
        state.summaryError = false;
        loadSummary();
      });
      container.appendChild(retry);
      return;
    }

    if (!state.summary) return;

    const message = el('p', 'text-sm font-semibold text-[#46523f] leading-relaxed');
    if (state.summary.emoji) {
      message.appendChild(el('span', 'mr-1', state.summary.emoji));
    }
    message.appendChild(document.createTextNode(state.summary.message));
    container.appendChild(message);

    if (state.summary.tip) {
      const tipBox = el(
        'div',
        'mt-3 rounded-xl bg-white/80 border border-[#d9f0c6] p-2.5'
      );
      tipBox.appendChild(
        el(
          'p',
          'text-[10px] font-black uppercase tracking-widest text-[#6d8a52] mb-0.5',
          I18n.t('results.tip')
        )
      );
      tipBox.appendChild(
        el('p', 'text-sm font-semibold text-[#46523f] leading-relaxed', state.summary.tip)
      );
      container.appendChild(tipBox);
    }
  }

  function buildDemoSummary() {
    const m = metrics();
    const lang = state.quiz.language;
    const topics = Array.from(
      new Set(m.mistakes.map((record) => record.topic).filter(Boolean))
    ).slice(0, 2);

    let message;
    let tip;
    let emoji;

    if (lang === 'kz') {
      if (m.percent >= 85) {
        message = 'Сен бұл квизді мықты орындадың! Тақырыпты түсінгенің көрінеді. Нәтижені бекіту үшін бір рет қайталап өт.';
        emoji = '🏆';
      } else if (m.percent >= 55) {
        message = 'Жақсы жұмыс! Негізгі ойды түсіндің, бірақ кейбір жерлерде нақтылық жетіспейді. Қателерді талдап, қайта көр.';
        emoji = '🌟';
      } else {
        message = 'Бүгінгі ең басты қадам — сен бастадың. Қателер тақырыпты тереңірек түсінуге көмектеседі, олардан қорықпа.';
        emoji = '🌱';
      }
      tip = topics.length
        ? `Мына тақырыптарды қайтала: ${topics.join(', ')}. Әр тақырыпқа 2–3 тапсырма орындап көр.`
        : 'Дәлдікті сақтау үшін квизді қайта өтіп, әр жауапты өз сөзіңмен түсіндіріп көр.';
    } else {
      if (m.percent >= 85) {
        message = 'Ты отлично справился с этим квизом! Видно, что тема понятна. Закрепи результат — пройди его ещё раз.';
        emoji = '🏆';
      } else if (m.percent >= 55) {
        message = 'Хорошая работа! Основную идею ты понял, но в некоторых местах не хватило точности. Разбери ошибки и попробуй снова.';
        emoji = '🌟';
      } else {
        message = 'Самый важный шаг сегодня — ты начал. Ошибки помогают понять тему глубже, не бойся их.';
        emoji = '🌱';
      }
      tip = topics.length
        ? `Повтори темы: ${topics.join(', ')}. Реши по 2–3 похожих задания на каждую.`
        : 'Чтобы закрепить точность, пройди квиз ещё раз и объясни каждый ответ своими словами.';
    }

    return { message, tip, emoji };
  }

  /* ---------------------------- Confetti ---------------------------- */

  function launchConfetti() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const layer = els.confettiLayer;
    layer.innerHTML = '';
    layer.classList.remove('hidden');

    const colors = ['#58cc02', '#1cb0f6', '#ffc800', '#ce82ff', '#ff4b4b'];
    for (let i = 0; i < 44; i += 1) {
      const piece = document.createElement('span');
      piece.className = 'confetti';
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.background = colors[i % colors.length];
      piece.style.setProperty('--dur', `${2.8 + Math.random() * 2.4}s`);
      piece.style.setProperty('--delay', `${Math.random() * 0.6}s`);
      if (i % 3 === 0) {
        piece.style.width = '8px';
        piece.style.height = '8px';
        piece.style.borderRadius = '999px';
      }
      layer.appendChild(piece);
    }

    window.setTimeout(() => {
      layer.classList.add('hidden');
      layer.innerHTML = '';
    }, 6000);
  }

  /* ----------------------------- Actions ----------------------------- */

  function resetQuiz() {
    state.index = 0;
    state.records = [];
    state.answered = false;
    state.busy = false;
    state.resultsShown = false;
    state.summary = null;
    state.summaryLoading = false;
    state.summaryError = false;

    closeFeedback();
    els.confettiLayer.classList.add('hidden');
    els.confettiLayer.innerHTML = '';
    els.resultsView.classList.add('hidden');
    els.quizView.classList.remove('hidden');
    els.aiSummary.innerHTML = '';
    document.title = 'Квиз — Дарын';
    renderQuestion();
  }

  function openExitModal() {
    if (state.resultsShown) {
      window.location.href = '/';
      return;
    }
    els.exitModal.classList.remove('hidden');
    els.exitModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    els.stayBtn.focus({ preventScroll: true });
  }

  function closeExitModal() {
    els.exitModal.classList.add('hidden');
    els.exitModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    els.exitBtn.focus({ preventScroll: true });
  }

  function leaveQuiz() {
    sessionStorage.removeItem(STORE_KEY);
    sessionStorage.removeItem('daryn.meta');
    window.location.href = '/';
  }

  /* ------------------------------ Events ----------------------------- */

  function bindEvents() {
    els.nextBtn.addEventListener('click', advance);
    els.checkBtn.addEventListener('click', checkOpenAnswer);

    els.answerInput.addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        checkOpenAnswer();
      }
    });

    els.retryBtn.addEventListener('click', resetQuiz);
    els.newBtn.addEventListener('click', () => {
      window.location.href = '/';
    });

    els.exitBtn.addEventListener('click', openExitModal);
    els.stayBtn.addEventListener('click', closeExitModal);
    els.leaveBtn.addEventListener('click', leaveQuiz);

    els.exitModal.addEventListener('click', (event) => {
      if (event.target === els.exitModal) closeExitModal();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !els.exitModal.classList.contains('hidden')) {
        closeExitModal();
      }
    });

    document.addEventListener('langchange', () => {
      if (!state.quiz) return;
      if (state.resultsShown) {
        paintResults({ animate: false });
        document.title = `${I18n.t('results.eyebrow')} — Дарын`;
      } else {
        renderQuestion({ keepScroll: true });
      }
    });
  }

  I18n.onReady(init);
})();
