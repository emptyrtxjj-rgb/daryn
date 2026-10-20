(function () {
  'use strict';

  const MAX_MB = 15;
  const ALLOWED = ['pdf', 'docx', 'txt'];
  const STORE_KEY = 'daryn.quiz';
  const META_KEY = 'daryn.meta';
  const REQUEST_TIMEOUT_MS = 300000;

  const $ = (id) => document.getElementById(id);

  const els = {
    form: $('upload-form'),
    input: $('file-input'),
    dropzone: $('dropzone'),
    empty: $('dropzone-empty'),
    preview: $('file-preview'),
    fileName: $('file-name'),
    fileSize: $('file-size'),
    remove: $('remove-file'),
    generate: $('generate-btn'),
    demo: $('demo-btn'),
    error: $('error-banner'),
    errorText: $('error-text'),
    keyWarning: $('key-warning'),
    overlay: $('loading-overlay'),
    loadingMessage: $('loading-message'),
    loadingBar: $('loading-bar'),
  };

  let selectedFile = null;
  let busy = false;
  let loadingTimer = null;
  let progressTimer = null;
  let messageIndex = 0;

  const LOADING_KEYS = ['loading.m0', 'loading.m1', 'loading.m2', 'loading.m3'];

  class ApiError extends Error {
    constructor(payload) {
      super((payload && payload.message) || 'API error');
      this.code = (payload && payload.error) || 'UNKNOWN';
    }
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
  }

  function showError(message) {
    els.errorText.textContent = message;
    els.error.classList.remove('hidden');
  }

  function clearError() {
    els.error.classList.add('hidden');
    els.errorText.textContent = '';
  }

  function setBusy(next) {
    busy = next;
    els.form.setAttribute('aria-busy', next ? 'true' : 'false');
    els.input.disabled = next;
    els.demo.disabled = next;
    els.remove.disabled = next;
    els.generate.disabled = next || !selectedFile;
    if (next) els.generate.classList.add('opacity-90');
    else els.generate.classList.remove('opacity-90');
  }

  function validate(file) {
    const ext = String(file.name || '').split('.').pop().toLowerCase();
    if (!ALLOWED.includes(ext)) return I18n.t('err.fileType');
    if (file.size > MAX_MB * 1024 * 1024) return I18n.t('err.fileSize');
    if (file.size === 0) return I18n.t('err.upload');
    return null;
  }

  function setFile(file) {
    clearError();
    const problem = validate(file);
    if (problem) {
      showError(problem);
      return;
    }

    selectedFile = file;
    els.fileName.textContent = file.name;
    els.fileSize.textContent = `${formatBytes(file.size)} · ${String(file.name).split('.').pop().toUpperCase()}`;
    els.dropzone.classList.add('has-file');
    els.empty.classList.add('hidden');
    els.preview.classList.remove('hidden');
    els.preview.classList.add('flex');
    els.generate.disabled = false;
  }

  function clearFile() {
    selectedFile = null;
    els.input.value = '';
    els.fileName.textContent = '';
    els.fileSize.textContent = '';
    els.dropzone.classList.remove('has-file');
    els.empty.classList.remove('hidden');
    els.preview.classList.add('hidden');
    els.preview.classList.remove('flex');
    els.generate.disabled = true;
    clearError();
  }

  function startLoading() {
    messageIndex = 0;
    els.loadingMessage.textContent = I18n.t(LOADING_KEYS[0]);
    els.loadingBar.style.width = '7%';
    els.overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    clearInterval(loadingTimer);
    clearInterval(progressTimer);

    loadingTimer = setInterval(() => {
      messageIndex = (messageIndex + 1) % LOADING_KEYS.length;
      els.loadingMessage.textContent = I18n.t(LOADING_KEYS[messageIndex]);
    }, 2800);

    progressTimer = setInterval(() => {
      const current = parseFloat(els.loadingBar.style.width) || 7;
      if (current < 92) {
        const step = 2 + Math.random() * 7;
        els.loadingBar.style.width = `${Math.min(92, current + step)}%`;
      }
    }, 900);
  }

  function finishLoading() {
    clearInterval(loadingTimer);
    clearInterval(progressTimer);
    els.loadingBar.style.width = '100%';
  }

  function stopLoading() {
    clearInterval(loadingTimer);
    clearInterval(progressTimer);
    els.overlay.classList.add('hidden');
    document.body.style.overflow = '';
  }

  async function readJson(response) {
    try {
      return await response.json();
    } catch (_) {
      return {};
    }
  }

  function friendlyError(error) {
    if (!error) return I18n.t('err.generic');
    if (error.name === 'TypeError') return I18n.t('err.network');
    const map = {
      NO_FILE: 'err.noFile',
      UNSUPPORTED_FILE: 'err.fileType',
      INVALID_FILE: 'err.fileType',
      FILE_TOO_LARGE: 'err.fileSize',
      LIMIT_FILE_SIZE: 'err.fileSize',
      MISSING_API_KEY: 'err.noKey',
      APP_RATE_LIMIT: 'err.rate',
      AI_RATE_LIMIT: 'err.rate',
      AI_AUTH: 'err.auth',
      AI_TIMEOUT: 'err.timeout',
      AI_UNAVAILABLE: 'err.ai',
      AI_EMPTY_RESPONSE: 'err.ai',
      AI_BAD_JSON: 'err.parse',
      AI_BAD_REQUEST: 'err.parse',
      NO_QUESTIONS: 'err.noQuestions',
      EMPTY_DOCUMENT: 'err.emptyDoc',
      DOCX_EXTRACT_FAILED: 'err.emptyDoc',
      PDF_SCAN_TOO_LARGE: 'err.pdfLarge',
      UPLOAD_FAILED: 'err.upload',
      UNEXPECTED_FILE: 'err.upload',
    };
    if (error.code && map[error.code]) return I18n.t(map[error.code]);
    return I18n.t('err.generic');
  }

  async function fetchWithTimeout(url, options, timeoutMs = REQUEST_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...(options || {}), signal: controller.signal });
    } catch (error) {
      if (error && error.name === 'AbortError') {
        throw new ApiError({ error: 'AI_TIMEOUT' });
      }
      throw error;
    } finally {
      window.clearTimeout(timer);
    }
  }

  function goToQuiz(quiz, meta) {
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify(quiz));
      sessionStorage.setItem(META_KEY, JSON.stringify(meta || {}));
    } catch (_) {
      showError(I18n.t('err.generic'));
      return false;
    }
    window.location.href = '/quiz.html';
    return true;
  }

  async function generate(event) {
    if (event) event.preventDefault();
    if (busy) return;

    if (!selectedFile) {
      showError(I18n.t('err.noFile'));
      return;
    }

    clearError();
    setBusy(true);
    startLoading();

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetchWithTimeout('/api/generate-quiz', {
        method: 'POST',
        body: formData,
      });
      const data = await readJson(response);

      if (!response.ok) throw new ApiError(data);
      if (!data.quiz) throw new ApiError({ error: 'AI_BAD_JSON' });

      finishLoading();
      window.setTimeout(() => goToQuiz(data.quiz, data.meta), 300);
    } catch (error) {
      stopLoading();
      setBusy(false);
      showError(friendlyError(error));
    }
  }

  async function openDemo() {
    if (busy) return;
    clearError();
    els.demo.disabled = true;

    try {
      const response = await fetch(`/api/demo?lang=${encodeURIComponent(I18n.getLang())}`);
      const data = await readJson(response);
      if (!response.ok || !data.quiz) throw new ApiError(data || {});
      goToQuiz(data.quiz, { filename: 'demo', method: 'demo' });
    } catch (error) {
      els.demo.disabled = false;
      showError(friendlyError(error));
    }
  }

  /* ----------------------------- Events ----------------------------- */

  els.input.addEventListener('change', () => {
    const file = els.input.files && els.input.files[0];
    if (file) setFile(file);
  });

  els.remove.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    clearFile();
    els.input.focus({ preventScroll: true });
  });

  els.form.addEventListener('submit', generate);
  els.demo.addEventListener('click', openDemo);

  ['dragenter', 'dragover'].forEach((name) => {
    els.dropzone.addEventListener(name, (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!busy) els.dropzone.classList.add('is-dragover');
    });
  });

  ['dragleave', 'dragend'].forEach((name) => {
    els.dropzone.addEventListener(name, (event) => {
      event.preventDefault();
      els.dropzone.classList.remove('is-dragover');
    });
  });

  els.dropzone.addEventListener('drop', (event) => {
    event.preventDefault();
    event.stopPropagation();
    els.dropzone.classList.remove('is-dragover');
    if (busy) return;
    const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
    if (file) setFile(file);
  });

  // Не даём браузеру открыть файл, если его уронили мимо зоны.
  window.addEventListener('dragover', (event) => event.preventDefault());
  window.addEventListener('drop', (event) => event.preventDefault());

  document.addEventListener('langchange', () => {
    clearError();
    if (busy) els.loadingMessage.textContent = I18n.t(LOADING_KEYS[messageIndex]);
  });

  /* ----------------------------- Health ----------------------------- */

  fetch('/api/health')
    .then((response) => response.json())
    .then((data) => {
      if (!data.gemini) els.keyWarning.classList.remove('hidden');
    })
    .catch(() => {
      /* сервер может быть недоступен — ошибка проявится при загрузке */
    });
})();
