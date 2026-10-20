'use strict';

class AppError extends Error {
  constructor(code, status = 400, message = code, details = null) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

module.exports = { AppError };
