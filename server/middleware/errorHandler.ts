import { Request, Response, NextFunction } from 'express';
import { AppError } from './errors.js';
import { logger } from './logger.js';

const isDev = process.env.NODE_ENV === 'development';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const statusCode = err instanceof AppError ? err.statusCode : 500;

  if (statusCode >= 500) {
    logger.error({ err, statusCode }, 'unhandled error');
  } else {
    logger.warn({ err: err.message, statusCode }, 'client error');
  }

  res.status(statusCode).json({
    success: false,
    error: isDev ? err.message : (statusCode < 500 ? err.message : 'Internal Server Error'),
  });
}