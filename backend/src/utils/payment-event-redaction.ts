/**
 * payment_events payloads are written for internal attribution and carry
 * whatever context the writer had — including raw memos or contact fields if
 * a writer ever adds them. The seller feed (issue #515) strips identity-shaped
 * keys before rows leave the server so the audit read can never become a PII
 * side channel. Public keys, tx hashes, codes and amounts are kept — they are
 * on-chain data the seller can already see.
 */

const REDACTED_KEY = /memo|email|customername|payername|sellername|description/i;

export function redactPaymentEventData(
  data: Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (REDACTED_KEY.test(key)) continue;
    clean[key] =
      value && typeof value === 'object' && !Array.isArray(value)
        ? redactPaymentEventData(value as Record<string, unknown>)
        : value;
  }
  return clean;
}
