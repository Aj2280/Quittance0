import { Router } from 'express';
import { createInvoiceHandlers, InvoiceHandlerOptions } from './invoice.handlers';
import rateLimitMiddleware from '../middleware/rate-limit';
import verifyCacheMiddleware from '../middleware/verify-cache';
import invoiceCeilingMiddleware from '../middleware/invoice-ceiling';

/**
 * Invoice routes shared by both servers. Mount under `/api`.
 *
 * Route list is kept identical between server.ts (Postgres) and
 * server-mvp.ts (in-memory):
 *   POST   /invoices
 *   GET    /invoices/stats
 *   GET    /invoices
 *   GET    /invoices/:id
 *   GET    /invoices/:id/payment-info
 *   POST   /invoices/:id/cancel (seller authorized)
 *   POST   /invoices/:id/verify
 *   POST   /invoices/:id/simulate-payment
 * If a route is added here, wire it into the same shared handlers so parity
 * tests in invoice-handlers.test.ts cover both storage backends.
 */
export function createInvoiceRouter(options: InvoiceHandlerOptions): Router {
  const handlers = createInvoiceHandlers(options);
  const router = Router();

  // POST /invoices - Create new invoice (rate limited + ceiling enforced)
  router.post(
    '/invoices',
    rateLimitMiddleware('create_invoice'),
    invoiceCeilingMiddleware(options.storage),
    handlers.createInvoice
  );

  // GET /invoices/stats - Stats (rate limited, seller-scoped)
  // Must stay before the dynamic /invoices/:id route to avoid shadowing.
  router.get('/invoices/stats', rateLimitMiddleware('get_stats'), handlers.getStats);

  // GET /invoices - List invoices (rate limited, seller-scoped)
  router.get('/invoices', rateLimitMiddleware('list_invoices'), handlers.getInvoices);

  // GET /invoices/:id - Get single invoice (no rate limit, read-only)
  router.get('/invoices/:id', handlers.getInvoice);

  // GET /invoices/:id/payment-info - Payment info (no rate limit, needed for checkout)
  router.get('/invoices/:id/payment-info', handlers.getPaymentInfo);

  // POST /invoices/:id/cancel - Cancel invoice (rate limited, requires signature)
  router.post('/invoices/:id/cancel', rateLimitMiddleware('cancel_invoice'), handlers.cancelInvoice);

  // POST /invoices/:id/verify - Verify payment (rate limited, cached)
  router.post(
    '/invoices/:id/verify',
    rateLimitMiddleware('verify_payment'),
    verifyCacheMiddleware,
    handlers.verifyPayment
  );

  // POST /invoices/:id/simulate-payment - Dev-only simulation (no limits, gated by env)
  router.post('/invoices/:id/simulate-payment', handlers.simulatePayment);

  return router;
}

export default createInvoiceRouter;
