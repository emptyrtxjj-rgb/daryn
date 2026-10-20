'use strict';

require('dotenv').config();

const path = require('path');
const express = require('express');
const multer = require('multer');
const rateLimitModule = require('express-rate-limit');
const rateLimit = rateLimitModule.rateLimit || rateLimitModule.default || rateLimitModule;

const { AppError } = require('./src/errors');
const { extractText } = require('./src/extract');
const { generateQuiz, checkOpenAnswerAI, generateSummaryAI, MODEL } = require('./src/gemini');
const { normalizeQuiz, normalizeGrade, normalizeSummary } = require('./src/normalize');
const { getDemoQuiz } = require('./src/demo-data');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const MAX_FILE_MB = Number(process.env.MAX_FILE_MB) || 15;
const MAX_BYTES = MAX_FILE_MB * 1024 * 1024;
const INLINE_PDF_LIMIT = 10 * 1024 * 1024;
const MIN_TEXT_LENGTH = 40;

// Render terminates TLS and adds X-Forwarded-For one hop before Express.
// Auto-detect Render so express-rate-limit sees the real client IP without
// requiring a manual TRUST_PROXY=1 in the dashboard.
const behindProxy =
  process.env.TRUST_PROXY === '1' ||
  process.env.RENDER === 'true' ||
  Boolean(process.env.RENDER_EXTERNAL_HOSTNAME);

if (behindProxy) app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

app.use(express.json({ limit: '256kb' }));
app.use(
  express.static(path.join(__dirname, 'public'), {
    extensions: ['html'],
    maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0,
  })
);

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.AI_RATE_LIMIT) || 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res) =>
    res.status(429).json({
      error: 'APP_RATE_LIMIT',
      message: 'Too many AI requests from this IP. Please wait a few minutes.',
    }),
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1, fields: 5 },
  fileFilter(req, file, cb) {
    const ext = path.extname(String(file.originalname || '')).toLowerCase();
    if (!['.pdf', '.docx', '.txt'].includes(ext)) {
      return cb(
        new AppError('UNSUPPORTED_FILE', 415, 'Only PDF, DOCX and TXT files are supported')
      );
    }
    return cb(null, true);
  },
});
const uploadSingle = upload.single('file');

function safeFilename(name) {
  let result = String(name || 'test');
  // Busboy иногда отдаёт UTF-8 имя как latin1 — восстанавливаем кириллицу.
  if (/[ÃÂÐÑ]/.test(result)) {
    try {
      result = Buffer.from(result, 'latin1').toString('utf8');
    } catch (_) {
      /* оставляем как есть */
    }
  }
  result = path
    .basename(result)
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .trim()
    .slice(0, 140);
  return result || 'test';
}

function asText(value, max = 4000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function sendError(res, error, context) {
  if (error instanceof AppError) {
    if (error.status >= 500) {
      console.error(`[${context}] ${error.code}: ${error.message}`);
    }
    return res.status(error.status).json({
      error: error.code,
      message: error.message,
    });
  }

  console.error(`[${context}]`, error);
  return res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: 'Unexpected server error',
  });
}

function sendUploadError(res, error) {
  if (error instanceof AppError) return sendError(res, error, 'upload');
  if (error && error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: 'FILE_TOO_LARGE',
      message: `File is larger than ${MAX_FILE_MB} MB`,
    });
  }
  if (error && error.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      error: 'UNEXPECTED_FILE',
      message: 'Attach exactly one file in the "file" field',
    });
  }
  return sendError(res, error, 'upload');
}

/* ------------------------------------------------------------------ */
/* Health                                                              */
/* ------------------------------------------------------------------ */

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    gemini: Boolean(process.env.GEMINI_API_KEY),
    model: MODEL,
  });
});

/* ------------------------------------------------------------------ */
/* Demo quiz (работает без ключа Gemini)                               */
/* ------------------------------------------------------------------ */

app.get('/api/demo', (req, res) => {
  const lang = req.query.lang === 'kz' ? 'kz' : 'ru';
  res.json({ ok: true, quiz: getDemoQuiz(lang) });
});

/* ------------------------------------------------------------------ */
/* 1. Upload + parse + generate quiz                                   */
/* ------------------------------------------------------------------ */

app.post('/api/generate-quiz', aiLimiter, (req, res) => {
  uploadSingle(req, res, async (err) => {
    if (err) return sendUploadError(res, err);

    try {
      if (!req.file) {
        throw new AppError('NO_FILE', 400, 'Attach a PDF or DOCX file in the "file" field');
      }
      if (!process.env.GEMINI_API_KEY) {
        throw new AppError(
          'MISSING_API_KEY',
          503,
          'GEMINI_API_KEY is not configured on the server. Add it to .env and restart.'
        );
      }

      const filename = safeFilename(req.file.originalname);
      const extraction = await extractText(req.file);
      const hasText = Boolean(extraction.text && extraction.text.length >= MIN_TEXT_LENGTH);

      if (!hasText && !extraction.canInline) {
        throw new AppError(
          'EMPTY_DOCUMENT',
          422,
          'Could not extract text from this document. Try another file.'
        );
      }

      if (!hasText && extraction.canInline && req.file.size > INLINE_PDF_LIMIT) {
        throw new AppError(
          'PDF_SCAN_TOO_LARGE',
          422,
          'This looks like a scanned PDF. Files without a text layer must be under 10 MB.'
        );
      }

      if (extraction.warning) {
        console.warn('[extract]', extraction.warning);
      }

      const raw = await generateQuiz({
        text: hasText ? extraction.text : undefined,
        file:
          !hasText && extraction.canInline
            ? { data: req.file.buffer.toString('base64'), mimeType: 'application/pdf' }
            : undefined,
        filename,
      });

      const quiz = normalizeQuiz(raw, { filename });

      return res.json({
        ok: true,
        quiz,
        meta: {
          filename,
          method: hasText ? extraction.method : 'gemini-native-pdf',
          characters: extraction.text.length,
          pages: extraction.pages,
        },
      });
    } catch (error) {
      return sendError(res, error, 'generate-quiz');
    }
  });
});

/* ------------------------------------------------------------------ */
/* 2. Grade one open answer with Gemini                                */
/* ------------------------------------------------------------------ */

app.post('/api/check-open-answer', aiLimiter, async (req, res) => {
  try {
    const body = req.body || {};
    const question = asText(body.question, 2500);
    const answer = asText(body.answer, 4000);
    const sampleAnswer = asText(body.sample_answer, 3000);
    const language = body.language === 'kz' ? 'kz' : 'ru';

    if (!question) throw new AppError('BAD_REQUEST', 400, 'Question text is required');
    if (!answer) throw new AppError('EMPTY_ANSWER', 400, 'Answer is empty');
    if (!process.env.GEMINI_API_KEY) {
      throw new AppError(
        'MISSING_API_KEY',
        503,
        'GEMINI_API_KEY is not configured on the server'
      );
    }

    const criteria = (Array.isArray(body.criteria) ? body.criteria : [])
      .map((item) => asText(item, 400))
      .filter(Boolean)
      .slice(0, 5);

    if (criteria.length === 0) {
      throw new AppError('BAD_REQUEST', 400, 'Answer criteria are required');
    }

    const raw = await checkOpenAnswerAI({
      question,
      criteria,
      sampleAnswer,
      answer,
      language,
    });

    const grade = normalizeGrade(raw, {
      maxScore: criteria.length,
      language,
    });

    return res.json({ ok: true, grade });
  } catch (error) {
    return sendError(res, error, 'check-open-answer');
  }
});

/* ------------------------------------------------------------------ */
/* 3. Final AI encouragement                                           */
/* ------------------------------------------------------------------ */

app.post('/api/summary', aiLimiter, async (req, res) => {
  try {
    const body = req.body || {};
    const total = Math.max(1, Math.min(500, Number(body.total) || 1));
    const score = Math.max(0, Math.min(total, Number(body.score) || 0));
    const language = body.language === 'kz' ? 'kz' : 'ru';
    const correct = Math.max(0, Math.min(100, Number(body.correct) || 0));
    const questionCount = Math.max(0, Math.min(100, Number(body.question_count) || 0));

    if (!process.env.GEMINI_API_KEY) {
      throw new AppError(
        'MISSING_API_KEY',
        503,
        'GEMINI_API_KEY is not configured on the server'
      );
    }

    const mistakes = (Array.isArray(body.mistakes) ? body.mistakes : [])
      .slice(0, 12)
      .map((item) => ({
        topic: asText(item?.topic, 120),
        question: asText(item?.question, 500),
      }))
      .filter((item) => item.topic || item.question);

    const raw = await generateSummaryAI({
      score,
      total,
      language,
      mistakes,
      correct,
      questionCount,
    });

    return res.json({
      ok: true,
      summary: normalizeSummary(raw, language),
    });
  } catch (error) {
    return sendError(res, error, 'summary');
  }
});

/* ------------------------------------------------------------------ */
/* Errors                                                              */
/* ------------------------------------------------------------------ */

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', message: 'API endpoint not found' });
});

app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'BAD_JSON', message: 'Invalid JSON body' });
  }
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: 'FILE_TOO_LARGE',
      message: `File is larger than ${MAX_FILE_MB} MB`,
    });
  }
  return sendError(res, err, 'server');
});

const server = app.listen(PORT, () => {
  console.log('');
  console.log('  🦉  Daryn / Дарын');
  console.log(`  ➜  http://localhost:${PORT}`);
  console.log(`  ➜  model: ${MODEL}`);
  if (!process.env.GEMINI_API_KEY) {
    console.warn('  ⚠  GEMINI_API_KEY is not set — uploads are disabled, demo works.');
  }
  console.log('');
});

// Генерация квиза через Gemini может занимать больше минуты.
// Держим сокет и запрос открытыми до 5 минут, чтобы прокси/браузер
// не обрывали соединение раньше времени.
server.timeout = 300000;
server.requestTimeout = 300000;
server.keepAliveTimeout = 65000;
