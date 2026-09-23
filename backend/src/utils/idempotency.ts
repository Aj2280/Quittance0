import { createHash } from 'crypto';
import type { CreateInvoiceInput } from './validation';

/**
 * Create-intent dedupe (issue #514). Two creates are "the same intent" when
 * the seller, normalized amount/asset pair, free-text fields and expiry all
 * match inside one short time bucket — exactly the double-click /
 * retry-after-timeout case where the first POST already succeeded but the
 * client never saw the response.
 *
 * Clients that send an explicit `Idempotency-Key` (or the `idempotencyKey`
 * body field) are deduped on that key instead: same key + same seller always
 * returns the original invoice, no window.
 */

/** Window in which an unsigned replay collapses onto the original row. */
export const IDEMPOTENT_CREATE_WINDOW_MS = 120_000;

const norm = (v: string | undefined) => (v ?? '').trim().toLowerCase();

/** Canonical signature of a create request, stable across JSON whitespace and casing. */
function createSignature(input: CreateInvoiceInput): string {
  return [
    input.sellerPublicKey,
    input.amount.toFixed(7),
    (input.assetCode || 'XLM').toUpperCase(),
    input.assetIssuer ?? '',
    norm(input.description),
    norm(input.customerName),
    norm(input.customerEmail),
    String(input.expiresInDays),
  ].join('|');
}

/**
 * The storage-level dedupe key: the caller's own key when present, otherwise
 * a hash of the signature plus the current time bucket. Hashing keeps raw
 * client text (customer email etc.) out of the index column.
 */
export function idempotencyKeyForCreate(
  input: CreateInvoiceInput,
  now: number = Date.now()
): string {
  if (input.idempotencyKey) return input.idempotencyKey;
  const bucket = Math.floor(now / IDEMPOTENT_CREATE_WINDOW_MS);
  const hash = createHash('sha256')
    .update(`${createSignature(input)}|${bucket}`)
    .digest('hex')
    .slice(0, 48);
  return `sig:${hash}`;
}
