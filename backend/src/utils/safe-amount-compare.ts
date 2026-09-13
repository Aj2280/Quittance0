/**
 * Safe amount comparison for Stellar payments without floating-point errors.
 *
 * Stellar amounts are decimals with up to 7 fractional digits (stroops).
 * Comparing floats directly leads to rounding errors; this helper converts to
 * stroops (integers), compares there, and documents the tolerance.
 *
 * Issue #378: Hardened for USDC payment edge cases with path payments and
 * amount precision verification.
 */

/**
 * Stroop precision: 1 XLM = 10,000,000 stroops
 * All amounts in Stellar are represented with 7 decimal places max.
 */
export const STROOP_DECIMALS = 7;
export const STROOP_SCALE = Math.pow(10, STROOP_DECIMALS); // 10000000

/**
 * Largest safe amount in stroops before overflow into JavaScript's unsafe integer range.
 * Stellar's total supply is ~5B XLM, well below this limit.
 */
export const MAX_SAFE_STROOP = Number.MAX_SAFE_INTEGER;

/**
 * Convert Stellar amount (string or number) to stroops (safe integer).
 *
 * @param amount Amount as string (e.g., "100.5") or number
 * @returns Stroops as integer, or null if conversion fails
 */
export function toStroops(amount: unknown): number | null {
  if (typeof amount !== 'string' && typeof amount !== 'number') {
    return null;
  }

  const str = String(amount).trim();
  if (str === '') return null;

  const num = Number(str);
  if (!Number.isFinite(num) || num < 0) return null;

  const stroops = Math.round(num * STROOP_SCALE);
  if (!Number.isSafeInteger(stroops) || stroops > MAX_SAFE_STROOP) {
    return null;
  }

  return stroops;
}

/**
 * Amount comparison with configurable tolerance in stroops.
 *
 * This is the core comparison for payment verification. Default tolerance is
 * 0 (exact match). For path payments or on-chain settlement variations, you
 * can increase tolerance to N stroops.
 *
 * Why stroops?
 * - Avoids float rounding errors that can cause false rejections
 * - Stellar amounts are always fixed at 7 decimal places
 * - Safe integer range covers all realistic payment amounts
 *
 * @param expected    Amount expected on invoice (XLM, USDC, etc.)
 * @param actual      Amount from Horizon payment operation
 * @param tolerance   Stroop tolerance (default: 0 for exact match)
 * @returns true if amounts match within tolerance, false otherwise
 *
 * @example
 * // Exact match
 * compareAmounts('100.5', '100.5000000') === true
 *
 * // Float rounding absorbed (< 0.5 stroop)
 * compareAmounts('100.1', '100.1000001') === true
 *
 * // Underpayment rejected
 * compareAmounts('100', '99.9999999') === false
 *
 * // Overpayment rejected (default)
 * compareAmounts('100', '100.0000001') === false
 *
 * // Overpayment accepted with tolerance
 * compareAmounts('100', '100.0000001', 1) === true
 */
export function compareAmounts(
  expected: unknown,
  actual: unknown,
  tolerance: number = 0
): boolean {
  // Validate tolerance
  if (!Number.isInteger(tolerance) || tolerance < 0) {
    return false;
  }

  const expectedStroops = toStroops(expected);
  const actualStroops = toStroops(actual);

  if (expectedStroops === null || actualStroops === null) {
    return false;
  }

  const delta = Math.abs(expectedStroops - actualStroops);
  return delta <= tolerance;
}

/**
 * Check if payment is underpaid (strictly less than expected).
 *
 * Useful for diagnostics: distinguishing underpayment from overpayment
 * in error messages.
 *
 * @returns true if actual < expected
 */
export function isUnderpaid(expected: unknown, actual: unknown): boolean {
  const expectedStroops = toStroops(expected);
  const actualStroops = toStroops(actual);

  if (expectedStroops === null || actualStroops === null) {
    return false;
  }

  return actualStroops < expectedStroops;
}

/**
 * Check if payment is overpaid (strictly greater than expected).
 *
 * @returns true if actual > expected
 */
export function isOverpaid(expected: unknown, actual: unknown): boolean {
  const expectedStroops = toStroops(expected);
  const actualStroops = toStroops(actual);

  if (expectedStroops === null || actualStroops === null) {
    return false;
  }

  return actualStroops > expectedStroops;
}

/**
 * Describe the relationship between expected and actual amounts.
 *
 * Useful for log messages and diagnostics. Returns one of:
 * 'exact', 'under', 'over', 'invalid'
 */
export function describeAmountDelta(
  expected: unknown,
  actual: unknown,
  tolerance: number = 0
): 'exact' | 'under' | 'over' | 'invalid' {
  const expectedStroops = toStroops(expected);
  const actualStroops = toStroops(actual);

  if (expectedStroops === null || actualStroops === null) {
    return 'invalid';
  }

  const delta = actualStroops - expectedStroops;

  if (Math.abs(delta) <= tolerance) return 'exact';
  if (delta < 0) return 'under';
  return 'over';
}

export default {
  compareAmounts,
  isUnderpaid,
  isOverpaid,
  describeAmountDelta,
  toStroops,
  STROOP_DECIMALS,
  STROOP_SCALE,
};
