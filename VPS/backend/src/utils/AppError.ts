/**
 * Typed application error class.
 * Controllers throw this; the central errorHandler formats the response.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code?: string;

  constructor(
    message: string,
    statusCode: number,
    options?: { isOperational?: boolean; code?: string }
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.isOperational = options?.isOperational ?? true;
    // exactOptionalPropertyTypes: only assign when actually provided
    if (options?.code !== undefined) this.code = options.code;

    // Preserve prototype chain (needed when targeting older JS)
    Object.setPrototypeOf(this, new.target.prototype);
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  static badRequest(message: string, code?: string): AppError {
    return new AppError(message, 400, code !== undefined ? { code } : {});
  }

  static unauthorized(message = 'Unauthorized'): AppError {
    return new AppError(message, 401, { code: 'UNAUTHORIZED' });
  }

  static forbidden(message = 'Forbidden'): AppError {
    return new AppError(message, 403, { code: 'FORBIDDEN' });
  }

  static notFound(resource: string): AppError {
    return new AppError(`${resource} not found`, 404, { code: 'NOT_FOUND' });
  }

  static conflict(message: string): AppError {
    return new AppError(message, 409, { code: 'CONFLICT' });
  }

  static internal(message = 'Internal server error'): AppError {
    return new AppError(message, 500, { isOperational: false });
  }
}
