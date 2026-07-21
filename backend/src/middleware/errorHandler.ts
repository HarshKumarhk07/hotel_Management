import type { NextFunction, Request, Response } from 'express';
import { Error as MongooseError } from 'mongoose';
import { ZodError } from 'zod';
import { isProd } from '@/config/env';
import { logger } from '@/config/logger';
import { captureException } from '@/config/sentry';
import { AppError } from '@/utils/AppError';

interface ErrorBody {
  success: false;
  message: string;
  errors?: Record<string, string>;
  error: { code: string; message: string; details?: unknown; requestId?: string };
}

/** 404 handler for unmatched routes. */
export function notFound(req: Request, _res: Response, next: NextFunction): void {
  next(AppError.notFound(`Route ${req.method} ${req.originalUrl} not found`, 'ROUTE_NOT_FOUND'));
}

/**
 * Centralised error handler. Normalises known error shapes (AppError, Zod,
 * Mongoose validation/cast, duplicate key) into the standard error envelope and
 * hides internals for unexpected (non-operational) errors in production.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  let statusCode = 500;
  let code = 'INTERNAL';
  let message = err instanceof Error ? err.message : 'Something went wrong';
  let details: unknown = !isProd && err instanceof Error ? { stack: err.stack } : undefined;
  let errorsMap: Record<string, string> | undefined = undefined;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;
    if (err.details && typeof err.details === 'object') {
      errorsMap = err.details as Record<string, string>;
    }
  } else if (err instanceof ZodError) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Validation failed';
    const flattened = err.flatten().fieldErrors;
    errorsMap = Object.fromEntries(
      Object.entries(flattened).map(([k, v]) => [k, v?.[0] ?? 'Invalid value'])
    );
    details = flattened;
  } else if (err instanceof MongooseError.ValidationError) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Validation failed';
    errorsMap = Object.fromEntries(
      Object.entries(err.errors).map(([k, v]) => [k, v.message])
    );
    details = errorsMap;
  } else if (err instanceof MongooseError.CastError) {
    statusCode = 400;
    code = 'INVALID_ID';
    message = `Invalid value for "${err.path}"`;
  } else if (typeof err === 'object' && err && (err as { code?: number }).code === 11000) {
    statusCode = 409;
    code = 'DUPLICATE_KEY';
    const key = Object.keys((err as { keyValue?: object }).keyValue ?? {})[0];
    message = key ? `A record with that ${key} already exists` : 'Duplicate value';
  }

  // Handle overlap database error from mongoose pre-save hook
  if (err instanceof Error && err.message.includes('already booked or reserved')) {
    statusCode = 409;
    code = 'CONFLICT';
    message = err.message;
    errorsMap = { startTime: err.message, endTime: err.message };
  }

  const isUnexpected = statusCode >= 500;
  if (isUnexpected) {
    logger.error({ err, requestId: req.context?.requestId }, 'Unhandled error');
    captureException(err, { requestId: req.context?.requestId, path: req.originalUrl, method: req.method });
  } else {
    logger.warn({ code, message, errors: errorsMap, requestId: req.context?.requestId }, 'Request error');
  }

  // Build root-level clean message/errors object, and keep legacy error envelope
  const body: ErrorBody = {
    success: false,
    message: isUnexpected && isProd ? 'Internal server error' : message,
    ...(errorsMap ? { errors: errorsMap } : {}),
    error: {
      code,
      message: isUnexpected && isProd ? 'Internal server error' : message,
      ...(details ? { details } : {}),
      requestId: req.context?.requestId,
    },
  };

  res.status(statusCode).json(body);
}
