/**
 * Operational error with an HTTP status code. Thrown anywhere in the request
 * lifecycle and translated to a JSON response by the global error handler.
 * `isOperational = true` distinguishes expected errors (bad input, auth) from
 * programmer bugs, so we never leak stack traces for the former.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(statusCode: number, message: string, code = 'ERROR', details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace?.(this, this.constructor);
  }

  static badRequest(msg = 'Bad request', code = 'BAD_REQUEST', details?: unknown) {
    return new AppError(400, msg, code, details);
  }
  static unauthorized(msg = 'Unauthorized', code = 'UNAUTHORIZED') {
    return new AppError(401, msg, code);
  }
  static forbidden(msg = 'Forbidden', code = 'FORBIDDEN') {
    return new AppError(403, msg, code);
  }
  static notFound(msg = 'Resource not found', code = 'NOT_FOUND') {
    return new AppError(404, msg, code);
  }
  static conflict(msg = 'Conflict', code = 'CONFLICT') {
    return new AppError(409, msg, code);
  }
  static tooMany(msg = 'Too many requests', code = 'RATE_LIMITED') {
    return new AppError(429, msg, code);
  }
  static locked(msg = 'Account locked', code = 'ACCOUNT_LOCKED') {
    return new AppError(423, msg, code);
  }
  static internal(msg = 'Internal server error', code = 'INTERNAL') {
    return new AppError(500, msg, code);
  }
}
