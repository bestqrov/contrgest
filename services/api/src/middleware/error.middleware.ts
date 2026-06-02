import { Request, Response, NextFunction } from 'express';
import { createLogger } from '@field-ops/shared';
import { ERROR_CODES } from '@field-ops/shared';
import { ZodError } from 'zod';

const logger = createLogger('api:error');

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function notFound(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: ERROR_CODES.NOT_FOUND,
    message: `Route ${req.method} ${req.path} not found`,
  });
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.code,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: ERROR_CODES.VALIDATION_ERROR,
      message: 'Validation failed',
      details: err.flatten().fieldErrors,
    });
    return;
  }

  logger.error('Unhandled error', {
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
    path: req.path,
    method: req.method,
  });

  res.status(500).json({
    success: false,
    error: ERROR_CODES.INTERNAL_ERROR,
    message: 'Internal server error',
  });
}
