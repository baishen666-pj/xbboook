import { Request, Response, NextFunction } from 'express';

const isDev = process.env.NODE_ENV === 'development';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  console.error('[Error]', err.stack || err.message);
  res.status(500).json({
    success: false,
    error: isDev ? err.message : 'Internal Server Error',
  });
}
