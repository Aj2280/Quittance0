/**
 * The invoice memo contract, shared by every surface that produces or checks
 * an invoice memo.
 *
 * Stellar text memos are capped at 28 bytes by the protocol. Before this
 * module, the cap lived nowhere: generation assumed the `INV-TIMESTAMP-RANDOM`
 * format would always fit, the QR/SEP-0007 encoder passed whatever it was
 * given, the Freighter builder relied on `Memo.text` to throw, and verify only
 * compared the memo string — never the memo type. A hash or id memo that
 * happened to carry matching bytes could reach the memo comparison at all,
 * and an over-length memo failed late with a wallet error rather than early
 * with a contract error.
 *
 * There is now one definition. `backend/src/utils/memo.ts` keeps generation
 * (it needs `nanoid`) and re-exports these predicates; the QR/SEP-0007
 * encoder, the Freighter builder and the verifier all import the same checks,
 * so the string the payer signs is exactly the string verify compares and the
 * 28-byte cap is enforced at build time, not at Horizon.
 */

/**
 * Case-sensitive prefix carried by every invoice memo. Re-exported for
 * backwards compatibility; `backend/src/utils/memo-prefix-check.ts` used to
 * own it.
 */
export const INVOICE_MEMO_PREFIX = 'INV-';

/** Maximum byte length of a Stellar text memo (protocol limit). */
export const MEMO_MAX_BYTES = 28;

/**
 * The alphabet the memo's random tail is drawn from. It deliberately excludes
 * `-` and `_`: the format is `INV-TIMESTAMP-RANDOM`, so a second dash or an
 * underscore breaks the shape every consumer assumes.
 */
export const MEMO_TAIL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/** Byte length of a memo string, as Stellar counts it (UTF-8). */
export function memoByteLength(memo: string): number {
  return new TextEncoder().encode(memo).length;
}

/** Whether a memo fits in a Stellar text memo. */
export function fitsStellarTextMemo(memo: string): boolean {
  return memoByteLength(memo) <= MEMO_MAX_BYTES;
}

/** Whether a value is a string that starts with the invoice memo prefix. */
export function hasInvoiceMemoPrefix(memo: unknown): boolean {
  return typeof memo === 'string' && memo.startsWith(INVOICE_MEMO_PREFIX);
}

/**
 * Whether a memo is a valid invoice memo: `INV-TIMESTAMP-RANDOM` shape,
 * tail-alphabet characters only, and short enough for a Stellar text memo.
 */
export function isValidMemo(memo: string): boolean {
  if (!hasInvoiceMemoPrefix(memo)) {
    return false;
  }
  if (!fitsStellarTextMemo(memo)) {
    return false;
  }
  return /^INV-[A-Z0-9]+-[A-Z0-9]+$/.test(memo);
}
