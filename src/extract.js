'use strict';

const path = require('path');
const mammoth = require('mammoth');
const { AppError } = require('./errors');

// В pdf-parse 1.1.1 импорт корневого модуля запускает debug-блок,
// поэтому подключаем реализацию напрямую.
let pdfParse;
try {
  pdfParse = require('pdf-parse/lib/pdf-parse');
} catch (_) {
  pdfParse = require('pdf-parse');
}

const MAX_TEXT_CHARS = 300_000;

function cleanText(raw) {
  return String(raw || '')
    .replace(/\u0000/g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_TEXT_CHARS);
}

function extensionOf(filename) {
  return path.extname(String(filename || '')).toLowerCase();
}

async function extractText(file) {
  if (!file || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
    throw new AppError('NO_FILE', 400, 'File is missing or empty');
  }

  const ext = extensionOf(file.originalname);
  const buffer = file.buffer;

  if (ext === '.pdf') {
    const header = buffer.subarray(0, 5).toString('latin1');
    if (header !== '%PDF-') {
      throw new AppError('INVALID_FILE', 400, 'The file is not a valid PDF');
    }

    try {
      const data = await pdfParse(buffer);
      const text = cleanText(data.text);
      return {
        text,
        method: 'pdf-parse',
        canInline: true,
        pages: data.numpages || null,
      };
    } catch (error) {
      // Скан без текстового слоя / сложный PDF: отправим сам PDF в Gemini.
      return {
        text: '',
        method: 'none',
        canInline: true,
        pages: null,
        warning: `pdf_parse_failed: ${error.message}`,
      };
    }
  }

  if (ext === '.docx') {
    const isZip = buffer[0] === 0x50 && buffer[1] === 0x4b;
    if (!isZip) {
      throw new AppError('INVALID_FILE', 400, 'The file is not a valid DOCX');
    }

    try {
      const result = await mammoth.extractRawText({ buffer });
      return {
        text: cleanText(result.value),
        method: 'mammoth',
        canInline: false,
        pages: null,
      };
    } catch (error) {
      throw new AppError('DOCX_EXTRACT_FAILED', 422, 'Could not read the DOCX file', {
        reason: error.message,
      });
    }
  }

  if (ext === '.txt') {
    return {
      text: cleanText(buffer.toString('utf8')),
      method: 'plain-text',
      canInline: false,
      pages: null,
    };
  }

  throw new AppError('UNSUPPORTED_FILE', 415, 'Only PDF, DOCX and TXT files are supported');
}

module.exports = { extractText, cleanText };
