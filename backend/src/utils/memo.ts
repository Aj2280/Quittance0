import { customAlphabet, nanoid } from 'nanoid';
import {
  fitsStellarTextMemo,
  hasInvoiceMemoPrefix,
  INVOICE_MEMO_PREFIX,
  isValidMemo,
  MEMO_MAX_BYTES,
  MEMO_TAIL_ALPHABET,
  memoByteLength,
} from '../../../shared/memo';

export {
  fitsStellarTextMemo,
  hasInvoiceMemoPrefix,
  INVOICE_MEMO_PREFIX,
  isValidMemo,
  MEMO_MAX_BYTES,
  MEMO_TAIL_ALPHABET,
  memoByteLength,
};

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
const memoRandom = customAlphabet(MEMO_TAIL_ALPHABET, 8);

/**
 * Generate a unique memo for invoice
 * Format: INV-TIMESTAMP-RANDOM
 *
 * The shape guarantees the result always fits a Stellar text memo: the
 * longest possible timestamp encoding keeps the total under
 * `MEMO_MAX_BYTES`, and the generator refuses to return anything that does
 * not satisfy `isValidMemo` so create can never persist a memo the chain
 * cannot carry.
 */
export const generateInvoiceMemo = (): string => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const memo = `INV-${timestamp}-${memoRandom()}`;
  if (!isValidMemo(memo)) {
    throw new Error('Generated invoice memo violates the memo contract');
  }
  return memo;
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
