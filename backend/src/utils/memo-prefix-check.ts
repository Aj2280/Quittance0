// Invoice memo prefix checker.
//
// The predicate and the constant now live in shared/memo.ts, the single
// memo contract consumed by create, the QR/SEP-0007 encoder, the Freighter
// builder and the verifier. This file re-exports them so existing imports
// keep working without a second definition to keep equal by hand.

import { hasInvoiceMemoPrefix, INVOICE_MEMO_PREFIX } from '../../../shared/memo';

export { hasInvoiceMemoPrefix, INVOICE_MEMO_PREFIX };

export default {
  hasInvoiceMemoPrefix,
  INVOICE_MEMO_PREFIX,
};
