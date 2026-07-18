import type { Response } from 'express';

interface Meta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  [key: string]: unknown;
}

/** Uniform success envelope so every endpoint returns the same shape. */
export function ok<T>(res: Response, data: T, statusCode = 200, meta?: Meta): Response {
  return res.status(statusCode).json({
    success: true,
    data,
    ...(meta ? { meta } : {}),
  });
}

export function created<T>(res: Response, data: T, meta?: Meta): Response {
  return ok(res, data, 201, meta);
}

export function noContent(res: Response): Response {
  return res.status(204).send();
}
