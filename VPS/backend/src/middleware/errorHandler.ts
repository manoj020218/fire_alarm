/**
 * Central Express error handler — must be registered LAST in app.ts.
 * Converts AppError and Mongoose/Zod errors to structured JSON responses.
 */
import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import mongoose from 'mongoose';
import { AppError } from '../utils/AppError';
import logger from '../config/logger';
import { env } from '../config/env';

interface ErrorResponse {
  ok: false;
  code: string;
  message: string;
  errors?: unknown;
  stack?: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler: ErrorRequestHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Operational app errors
  if (err instanceof AppError) {
    const body: ErrorResponse = {
      ok: false,
      code: err.code ?? 'ERROR',
      message: err.message,
    };
    if (env.NODE_ENV !== 'production') {
      body.stack = err.stack;
    }
    res.status(err.statusCode).json(body);
    return;
  }

  // Zod validation errors (shouldn't normally reach here — validate middleware catches them)
  if (err instanceof ZodError) {
    res.status(400).json({
      ok: false,
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      errors: err.issues,
    } satisfies ErrorResponse);
    return;
  }

  // Mongoose duplicate key
  if (
    err instanceof mongoose.mongo.MongoServerError &&
    (err as mongoose.mongo.MongoServerError).code === 11000
  ) {
    const mongoErr = err as mongoose.mongo.MongoServerError & { keyValue?: Record<string, unknown> };
    const field = mongoErr.keyValue ? Object.keys(mongoErr.keyValue).join(', ') : 'field';
    res.status(409).json({
      ok: false,
      code: 'DUPLICATE_KEY',
      message: `${field} already exists`,
    } satisfies ErrorResponse);
    return;
  }

  // Mongoose validation error
  if (err instanceof mongoose.Error.ValidationError) {
    const messages = Object.values(err.errors).map((e) => e.message);
    res.status(400).json({
      ok: false,
      code: 'VALIDATION_ERROR',
      message: messages.join('; '),
    } satisfies ErrorResponse);
    return;
  }

  // Unknown errors — log and return 500
  logger.error({ err }, 'Unhandled error');
  const body500: ErrorResponse = {
    ok: false,
    code: 'INTERNAL_ERROR',
    message: env.NODE_ENV === 'production' ? 'Internal server error' : String(err),
  };
  if (env.NODE_ENV !== 'production' && err instanceof Error) {
    body500.stack = err.stack;
  }
  res.status(500).json(body500);
};
