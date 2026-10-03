import { Request, Response, NextFunction, RequestHandler } from 'express';
import { AuthRequest } from './auth';

/**
 * Wrap an async route handler so rejections reach the global error middleware.
 * Also usable for sync handlers — any thrown error is forwarded.
 *
 * Usage:
 *   router.get('/x', asyncHandler(async (req, res) => {
 *     const rows = query('SELECT ...');
 *     res.json({ success: true, data: rows });
 *   }));
 */
export function asyncHandler<
  Req extends Request = Request,
  Res extends Response = Response
>(fn: (req: Req, res: Res, next: NextFunction) => unknown | Promise<unknown>): RequestHandler {
  return (req, res, next) => {
    try {
      const result = fn(req as unknown as Req, res as unknown as Res, next);
      if (result instanceof Promise) {
        result.catch(next);
      }
    } catch (err) {
      next(err);
    }
  };
}

/** Authenticated variant that types req as AuthRequest. */
export function asyncAuthHandler(
  fn: (req: AuthRequest, res: Response, next: NextFunction) => unknown | Promise<unknown>
): RequestHandler {
  return asyncHandler<AuthRequest>(fn);
}

/** HTTP error with status code — thrown from handlers, rendered by global middleware. */
export class HttpError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
    this.name = 'HttpError';
  }
}

export const badRequest = (msg = 'Некорректный запрос', details?: unknown) => new HttpError(400, msg, details);
export const unauthorized = (msg = 'Требуется авторизация') => new HttpError(401, msg);
export const forbidden = (msg = 'Недостаточно прав') => new HttpError(403, msg);
export const notFound = (msg = 'Не найдено') => new HttpError(404, msg);
export const conflict = (msg = 'Конфликт данных') => new HttpError(409, msg);

/**
 * Global Express error middleware. Register LAST:
 *   app.use(errorHandler);
 *
 * Converts HttpError to its status, everything else to 500.
 * Never leaks stack traces to clients.
 */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof HttpError) {
    if (err.status >= 500) {
      console.error(`[${req.method} ${req.path}]`, err.message, err.details ?? '');
    }
    res.status(err.status).json({
      success: false,
      error: err.message,
      ...(err.details !== undefined ? { details: err.details } : {}),
    });
    return;
  }

  // Multer / body-parser errors have status + message
  const anyErr = err as { status?: number; statusCode?: number; message?: string; type?: string };
  const status = anyErr.status || anyErr.statusCode;

  if (status && status >= 400 && status < 500) {
    res.status(status).json({ success: false, error: anyErr.message || 'Некорректный запрос' });
    return;
  }

  console.error(`[${req.method} ${req.path}] Unhandled error:`, err);
  res.status(500).json({ success: false, error: 'Ошибка сервера' });
}
