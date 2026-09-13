// Global invoice ceiling for MVP in-memory mode. Once the ceiling is reached,
// new creates return 503 with Retry-After until older invoices expire or are
// paid. Postgres mode has no hard ceiling (the database is the limit), but
// this middleware can be wired there too if needed.
//
// The ceiling is checked before the handler runs, so no partial invoice is
// created when the limit is hit.
import { Request, Response, NextFunction } from 'express';
import type { InvoiceStorage } from '../storage/invoice-storage';

const DEFAULT_MVP_INVOICE_CEILING = 5000;
const CEILING_RETRY_AFTER_SECONDS = 300; // 5 minutes

export function invoiceCeilingMiddleware(storage: InvoiceStorage) {
  const ceiling = parseInt(process.env.INVOICE_CEILING || '', 10) || DEFAULT_MVP_INVOICE_CEILING;
  
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Only apply to invoice creation
      if (req.method !== 'POST' || !req.path.match(/^\/invoices\/?$/)) {
        return next();
      }

      // Check current count (this assumes storage exposes a count method or getInvoices)
      // For memory storage we can check the size directly
      const count = await getInvoiceCount(storage);
      
      if (count >= ceiling) {
        res.set('Retry-After', CEILING_RETRY_AFTER_SECONDS.toString());
        res.status(503).json({
          success: false,
          error: 'Invoice storage is at capacity',
          code: 'INVOICE_STORE_FULL',
          retryAfter: CEILING_RETRY_AFTER_SECONDS,
          currentCount: count,
          ceiling,
        });
        return;
      }

      next();
    } catch (error) {
      console.error('[InvoiceCeiling] Check failed:', error);
      // Fail open: don't block creates if the check breaks
      next();
    }
  };
}

async function getInvoiceCount(storage: InvoiceStorage): Promise<number> {
  try {
    if (typeof storage.getInvoiceCount === 'function') {
      return await storage.getInvoiceCount();
    }
    
    // Fallback: storage doesn't implement the method
    console.warn('[InvoiceCeiling] Storage backend does not implement getInvoiceCount');
    return 0;
  } catch (error) {
    console.error('[InvoiceCeiling] Count failed:', error);
    return 0;
  }
}

export default invoiceCeilingMiddleware;
