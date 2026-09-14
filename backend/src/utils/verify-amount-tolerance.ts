import {
  STROOP_DECIMALS,
  compareAmounts,
  parseStroops,
  formatStroops,
  isUnderpaid,
  isOverpaid,
  describeAmountDelta,
} from './safe-amount-compare';

export {
  STROOP_DECIMALS,
  compareAmounts,
  parseStroops,
  formatStroops,
  isUnderpaid,
  isOverpaid,
  describeAmountDelta,
};

export interface AmountMatchInput {
  expected: string | number;
  actual: unknown;
  toleranceStroops?: number;
}

/**
 * Compares two Stellar amounts with an allowable delta, measured in stroops.
 * Uses integer string decimal parsing to prevent floating-point precision loss.
 *
 * @param expected - Amount the invoice demands.
 * @param actual - Amount observed on-chain from Horizon.
 * @param toleranceStroops - Width of the acceptance window, in stroops. Defaults to 0.
 * @returns True when both operands parse to valid amounts whose difference is within tolerance.
 */
export function amountsMatch(
  expected: string | number,
  actual: unknown,
  toleranceStroops: number = 0,
): boolean {
  return compareAmounts(expected, actual, toleranceStroops);
}

export default { amountsMatch, STROOP_DECIMALS };
