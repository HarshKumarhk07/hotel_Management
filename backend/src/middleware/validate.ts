import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodTypeAny } from 'zod';
import { AppError } from '@/utils/AppError';

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
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.params) req.params = schemas.params.parse(req.params);
      if (schemas.query) {
        // req.query may be a getter; assign parsed values onto it field by field.
        const parsed = schemas.query.parse(req.query) as Record<string, unknown>;
        Object.assign(req.query, parsed);
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next(
          AppError.badRequest('Validation failed', 'VALIDATION_ERROR', err.flatten().fieldErrors),
        );
        return;
      }
      next(err);
    }
  };
}
