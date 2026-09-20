import { customAlphabet, nanoid } from 'nanoid';
import { hasInvoiceMemoPrefix } from './memo-prefix-check';

export { hasInvoiceMemoPrefix } from './memo-prefix-check';

/**
 * The random tail of an invoice memo is drawn from an alphabet that cannot
 * produce anything but `INV-TIMESTAMP-RANDOM`.
 *
 * nanoid's default alphabet includes `-` and `_`, and both of them break the
 * format the rest of the system assumes: `isValidMemo` rejects a memo with a
 * second dash or an underscore, and `hasInvoiceMemoPrefix` only anchors the
 * front of the string. With two bad characters in a 64-character alphabet,
 * roughly a fifth of generated memos failed the API's own validator -- which
 * is how the create-invoice regression test became flaky rather than wrong.
 */
const MEMO_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const memoRandom = customAlphabet(MEMO_ALPHABET, 8);

/**
 * Generate a unique memo for invoice
 * Format: INV-TIMESTAMP-RANDOM
 */
export const generateInvoiceMemo = (): string => {
  const timestamp = Date.now().toString(36).toUpperCase();
  return `INV-${timestamp}-${memoRandom()}`;
};

/**
 * Validate memo format
 */
export const isValidMemo = (memo: string): boolean => {
  if (!hasInvoiceMemoPrefix(memo)) {
    return false;
  }
  return /^INV-[A-Z0-9]+-[A-Z0-9]+$/.test(memo);
};

/**
 * Generate short payment reference
 */
export const generateShortReference = (): string => {
  return nanoid(10).toUpperCase();
};

export default {
  generateInvoiceMemo,
  isValidMemo,
  generateShortReference,
};

