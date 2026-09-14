import { Request, Response, NextFunction, RequestHandler } from 'express';

export const DEFAULT_INVOICE_CEILING = 5000;

export interface InvoiceCeilingOptions {
  ceiling?: number;
  retryAfterSeconds?: number;
}

/**
 * Express middleware that enforces a global invoice storage ceiling.
 * Rejects creation requests with 503 INVOICE_STORE_FULL when the ceiling is reached.
 *
 * @param getCount Function returning the current count of invoices in storage
 * @param options Optional ceiling threshold and Retry-After delay
 */
export function createInvoiceCeilingMiddleware(
  getCount: () => Promise<number> | number,
  options?: InvoiceCeilingOptions
): RequestHandler {
  const ceiling =
    options?.ceiling ??
    (process.env.INVOICE_CEILING ? parseInt(process.env.INVOICE_CEILING, 10) : DEFAULT_INVOICE_CEILING);
  const retryAfterSeconds = options?.retryAfterSeconds ?? 300;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const currentCount = await getCount();
      if (currentCount >= ceiling) {
        res.setHeader('Retry-After', retryAfterSeconds);
        return res.status(503).json({
          success: false,
          code: 'INVOICE_STORE_FULL',
          error: `Invoice store full: maximum invoice capacity of ${ceiling} reached`,
          retryAfter: retryAfterSeconds,
        });
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
