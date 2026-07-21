import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodTypeAny } from 'zod';
import { AppError } from '@/utils/AppError';
import { logger } from '@/config/logger';

interface Schemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

/**
 * Validate (and coerce) request parts against Zod schemas. On success the parsed
 * values replace the originals so handlers get fully-typed, sanitised input.
 * On failure a 400 with a flattened, field-level error map is returned.
 */
export function validate(schemas: Schemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
        logger.info({
          requestId: req.context?.requestId,
          path: req.originalUrl,
          validatedBody: req.body,
        }, 'Validated request body');
      }
      if (schemas.params) {
        req.params = schemas.params.parse(req.params);
        logger.info({
          requestId: req.context?.requestId,
          path: req.originalUrl,
          validatedParams: req.params,
        }, 'Validated request parameters');
      }
      if (schemas.query) {
        // req.query may be a getter; assign parsed values onto it field by field.
        const parsed = schemas.query.parse(req.query) as Record<string, unknown>;
        Object.assign(req.query, parsed);
        logger.info({
          requestId: req.context?.requestId,
          path: req.originalUrl,
          validatedQuery: req.query,
        }, 'Validated request query');
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        logger.warn({
          requestId: req.context?.requestId,
          path: req.originalUrl,
          errors: err.flatten().fieldErrors,
        }, 'Zod validation failed');
        next(
          AppError.badRequest('Validation failed', 'VALIDATION_ERROR', err.flatten().fieldErrors),
        );
        return;
      }
      next(err);
    }
  };
}
