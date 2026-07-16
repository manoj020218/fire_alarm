/**
 * Zod schema validation middleware for Express.
 * Usage: router.post('/path', validate({ body: MySchema }), handler)
 */
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodSchema, ZodError } from 'zod';

interface Schemas {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

export function validate(schemas: Schemas): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (schemas.body !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        req.body = schemas.body.parse(req.body);
      }
      if (schemas.query !== undefined) {
        // ParsedQs is compatible with Zod parse output here
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        req.query = schemas.query.parse(req.query);
      }
      if (schemas.params !== undefined) {
        req.params = schemas.params.parse(req.params) as Record<string, string>;
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({
          ok: false as const,
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          errors: err.issues,
        });
        return;
      }
      next(err);
    }
  };
}
