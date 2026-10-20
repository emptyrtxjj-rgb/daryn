'use strict';

const { GoogleGenAI } = require('@google/genai');
const { AppError } = require('./errors');
const {
  QUIZ_SYSTEM_PROMPT,
  OPEN_ANSWER_SYSTEM_PROMPT,
  SUMMARY_SYSTEM_PROMPT,
} = require('./prompts');

const PRIMARY_MODEL = (process.env.GEMINI_MODEL || 'gemini-3.7-flash').trim();
const FALLBACK_MODELS = String(
  process.env.GEMINI_FALLBACK_MODELS || 'gemini-3.1-flash-lite'
)
  .split(',')
  .map((model) => model.trim())
  .filter(Boolean);
const MODELS = [...new Set([PRIMARY_MODEL, ...FALLBACK_MODELS])];
const MODEL = PRIMARY_MODEL;
const GEMINI_TIMEOUT_MS = Math.max(
  30_000,
  Number(process.env.GEMINI_TIMEOUT_MS) || 110_000
);
const MAX_INPUT_CHARS = 120_000;

let client = null;

function getClient() {
  if (!process.env.GEMINI_API_KEY) {
    throw new AppError(
      'MISSING_API_KEY',
      503,
      'GEMINI_API_KEY is not configured on the server'
    );
  }
  if (!client) {
    client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return client;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function readResponseText(response) {
  if (!response) return '';
  if (typeof response.text === 'function') return response.text();
  return response.text || '';
}

function parseJson(text) {
  let cleaned = String(text || '').trim().replace(/^\uFEFF/, '');
  cleaned = cleaned
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  // На случай, если модель вернула просто массив вопросов.
  if (cleaned.startsWith('[')) {
    try {
      const arr = JSON.parse(cleaned);
      return { questions: Array.isArray(arr) ? arr : [] };
    } catch (_) {
      /* продолжаем ниже */
    }
  }

  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end <= start) {
    throw new AppError('AI_BAD_JSON', 502, 'Gemini did not return a JSON object');
  }

  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch (error) {
    throw new AppError('AI_BAD_JSON', 502, 'Gemini returned invalid JSON', {
      parseError: error.message,
    });
  }
}

function mapSdkError(error) {
  if (error instanceof AppError) return error;

  const status = error?.status || error?.code || error?.response?.status;
  const raw = String(error?.message || error || '');

  if (status === 429 || /quota|rate limit|resource exhausted|too many requests/i.test(raw)) {
    return new AppError(
      'AI_RATE_LIMIT',
      429,
      'Gemini free-tier limit reached. Try again in a minute.'
    );
  }
  if (
    status === 401 ||
    status === 403 ||
    /api[ -]?key|permission denied|unauthenticated|invalid key/i.test(raw)
  ) {
    return new AppError('AI_AUTH', 502, 'Gemini API key is invalid or lacks access');
  }
  if (/timeout|timed out|ETIMEDOUT|aborted|ECONNRESET/i.test(raw)) {
    return new AppError('AI_TIMEOUT', 504, 'Gemini request timed out');
  }
  if (status === 400) {
    return new AppError('AI_BAD_REQUEST', 502, 'Gemini rejected the request');
  }
  return new AppError('AI_UNAVAILABLE', 502, 'Gemini is temporarily unavailable');
}

function redactSecrets(value) {
  let text = String(value || '');
  const key = process.env.GEMINI_API_KEY;
  if (key) text = text.split(key).join('***');
  return text.replace(/([?&]key=)[^&\s]+/gi, '$1***').slice(0, 300);
}

async function generateJson({ systemInstruction, parts, temperature = 0.2, maxOutputTokens = 32768 }) {
  const ai = getClient();
  let lastError = null;

  for (const model of MODELS) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: [{ role: 'user', parts }],
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            temperature,
            maxOutputTokens,
            // Ограничиваем один HTTP-вызов, чтобы зависший запрос не держал
            // соединение дольше серверного таймаута. Повторы делает наш код.
            httpOptions: {
              timeout: GEMINI_TIMEOUT_MS,
              retryOptions: { attempts: 1 },
            },
          },
        });

        const text = readResponseText(response);
        if (!text || !String(text).trim()) {
          throw new AppError('AI_EMPTY_RESPONSE', 502, 'Gemini returned an empty response');
        }
        return parseJson(text);
      } catch (error) {
        lastError = mapSdkError(error);
        const status =
          error?.status || error?.code || error?.response?.status || 'no-status';
        console.warn(
          `[gemini] ${model} -> ${lastError.code} (${status}): ${redactSecrets(
            error?.message || error
          )}`
        );

        // Ошибки ключа и запроса не зависят от модели — повторов не будет.
        if (['AI_AUTH', 'AI_BAD_REQUEST'].includes(lastError.code)) {
          throw lastError;
        }

        // Битый/пустой JSON имеет смысл повторить на той же модели.
        const retrySameModel =
          ['AI_BAD_JSON', 'AI_EMPTY_RESPONSE'].includes(lastError.code) && attempt === 0;
        if (!retrySameModel) break;

        await sleep(1000);
      }
    }
  }

  throw lastError || new AppError('AI_UNAVAILABLE', 502, 'Gemini is temporarily unavailable');
}

async function generateQuiz({ text, file, filename }) {
  const parts = [
    {
      text:
        `School test file: "${filename || 'test'}".\n` +
        'Extract the questions and produce the quiz JSON exactly as instructed in the system prompt.\n' +
        'Remember: use the language of the document for all student-facing text.',
    },
  ];

  if (file && file.data && file.mimeType) {
    parts.push({ inlineData: { mimeType: file.mimeType, data: file.data } });
  }

  if (text && text.trim()) {
    parts.push({
      text: `--- BEGIN DOCUMENT TEXT ---\n${text.slice(0, MAX_INPUT_CHARS)}\n--- END DOCUMENT TEXT ---`,
    });
  }

  return generateJson({
    systemInstruction: QUIZ_SYSTEM_PROMPT,
    parts,
    temperature: 0.2,
    maxOutputTokens: 32768,
  });
}

async function checkOpenAnswerAI({ question, criteria, sampleAnswer, answer, language }) {
  const payload = {
    language: language === 'kz' ? 'kz (Kazakh)' : 'ru (Russian)',
    question,
    criteria,
    max_score: criteria.length,
    sample_answer: sampleAnswer || '',
    student_answer: answer,
  };

  const parts = [
    {
      text:
        'Grade the student answer against the rubric. Return only the JSON object.\n\n' +
        JSON.stringify(payload, null, 2),
    },
  ];

  const raw = await generateJson({
    systemInstruction: OPEN_ANSWER_SYSTEM_PROMPT,
    parts,
    temperature: 0.1,
    maxOutputTokens: 1600,
  });

  return raw;
}

async function generateSummaryAI({ score, total, language, mistakes, correct, questionCount }) {
  const payload = {
    language: language === 'kz' ? 'kz (Kazakh)' : 'ru (Russian)',
    score,
    total,
    correct_answers: correct,
    total_questions: questionCount,
    mistake_topics: mistakes,
  };

  const parts = [
    {
      text:
        'Write the closing message for this student. Return only the JSON object.\n\n' +
        JSON.stringify(payload, null, 2),
    },
  ];

  const raw = await generateJson({
    systemInstruction: SUMMARY_SYSTEM_PROMPT,
    parts,
    temperature: 0.8,
    maxOutputTokens: 900,
  });

  return raw;
}

module.exports = {
  MODEL,
  generateQuiz,
  checkOpenAnswerAI,
  generateSummaryAI,
};
