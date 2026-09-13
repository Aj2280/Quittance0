export const STROOP_DECIMALS = 7;
export const STROOPS_PER_UNIT = 10_000_000n;

export type AmountDeltaStatus = 'exact' | 'underpaid' | 'overpaid' | 'invalid';

export interface AmountDelta {
  status: AmountDeltaStatus;
  expectedStroops: bigint | null;
  actualStroops: bigint | null;
  diffStroops: bigint | null;
  diffFormatted: string | null;
}

/**
 * Converts a string decimal or number representation into an integer stroop count.
 *
 * @param value - String decimal, number, or bigint to convert.
 * @returns BigInt representation in stroops (10^-7 units), or null if the input is invalid.
 */
export function parseStroops(value: unknown): bigint | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'object') {
    return null;
  }

  let str = '';
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) {
      return null;
    }
    str = value.toString();
  } else if (typeof value === 'string') {
    str = value.trim();
    if (!str) {
      return null;
    }
  } else if (typeof value === 'bigint') {
    if (value < 0n) {
      return null;
    }
    return value;
  } else {
    return null;
  }

  if (!/^\d+(\.\d+)?$/.test(str)) {
    return null;
  }

  const parts = str.split('.');
  const intPart = parts[0];
  const fracPart = parts[1] || '';

  if (fracPart.length > STROOP_DECIMALS) {
    const frac7 = fracPart.slice(0, STROOP_DECIMALS);
    const eighthDigit = parseInt(fracPart[STROOP_DECIMALS], 10);
    let stroops = BigInt(intPart) * STROOPS_PER_UNIT + BigInt(frac7);
    if (eighthDigit >= 5) {
      stroops += 1n;
    }
    return stroops;
  }

  const paddedFrac = fracPart.padEnd(STROOP_DECIMALS, '0');
  return BigInt(intPart) * STROOPS_PER_UNIT + BigInt(paddedFrac);
}

/**
 * Formats a BigInt stroop count back into a 7-decimal string without float arithmetic.
 *
 * @param stroops - Integer count of stroops to format.
 * @returns Formatted decimal string with 7 fractional digits.
 */
export function formatStroops(stroops: bigint): string {
  const isNegative = stroops < 0n;
  const absStroops = isNegative ? -stroops : stroops;
  const intPart = absStroops / STROOPS_PER_UNIT;
  const fracPart = (absStroops % STROOPS_PER_UNIT).toString().padStart(STROOP_DECIMALS, '0');
  const formatted = `${intPart.toString()}.${fracPart}`;
  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Compares an expected invoice amount against an observed payment amount within a stroop tolerance.
 *
 * @param expected - Expected invoice amount.
 * @param actual - Observed payment amount from Horizon.
 * @param toleranceStroops - Permitted tolerance in stroops (defaults to 0 for exact match).
 * @returns True if both amounts are valid and within tolerance, false otherwise.
 */
export function compareAmounts(
  expected: unknown,
  actual: unknown,
  toleranceStroops: number | bigint = 0,
): boolean {
  if (typeof toleranceStroops === 'number') {
    if (!Number.isInteger(toleranceStroops) || toleranceStroops < 0) {
      return false;
    }
  } else if (typeof toleranceStroops === 'bigint') {
    if (toleranceStroops < 0n) {
      return false;
    }
  } else {
    return false;
  }

  const expectedStroops = parseStroops(expected);
  const actualStroops = parseStroops(actual);

  if (expectedStroops === null || actualStroops === null) {
    return false;
  }

  const tol = BigInt(toleranceStroops);
  const diff = expectedStroops > actualStroops ? expectedStroops - actualStroops : actualStroops - expectedStroops;
  return diff <= tol;
}

/**
 * Determines whether the observed payment amount is less than expected beyond the specified tolerance.
 *
 * @param expected - Expected invoice amount.
 * @param actual - Observed payment amount.
 * @param toleranceStroops - Permitted tolerance in stroops.
 * @returns True if the payment is underpaid beyond tolerance.
 */
export function isUnderpaid(
  expected: unknown,
  actual: unknown,
  toleranceStroops: number | bigint = 0,
): boolean {
  const expectedStroops = parseStroops(expected);
  const actualStroops = parseStroops(actual);

  if (expectedStroops === null || actualStroops === null) {
    return false;
  }

  const tol = BigInt(toleranceStroops);
  return actualStroops < expectedStroops - tol;
}

/**
 * Determines whether the observed payment amount exceeds expected beyond the specified tolerance.
 *
 * @param expected - Expected invoice amount.
 * @param actual - Observed payment amount.
 * @param toleranceStroops - Permitted tolerance in stroops.
 * @returns True if the payment is overpaid beyond tolerance.
 */
export function isOverpaid(
  expected: unknown,
  actual: unknown,
  toleranceStroops: number | bigint = 0,
): boolean {
  const expectedStroops = parseStroops(expected);
  const actualStroops = parseStroops(actual);

  if (expectedStroops === null || actualStroops === null) {
    return false;
  }

  const tol = BigInt(toleranceStroops);
  return actualStroops > expectedStroops + tol;
}

/**
 * Produces a diagnostic summary describing the difference between expected and actual amounts.
 *
 * @param expected - Expected invoice amount.
 * @param actual - Observed payment amount.
 * @returns Structured diagnostic delta.
 */
export function describeAmountDelta(expected: unknown, actual: unknown): AmountDelta {
  const expectedStroops = parseStroops(expected);
  const actualStroops = parseStroops(actual);

  if (expectedStroops === null || actualStroops === null) {
    return {
      status: 'invalid',
      expectedStroops,
      actualStroops,
      diffStroops: null,
      diffFormatted: null,
    };
  }

  const diff = actualStroops - expectedStroops;
  const absDiff = diff < 0n ? -diff : diff;

  let status: AmountDeltaStatus = 'exact';
  if (diff < 0n) {
    status = 'underpaid';
  } else if (diff > 0n) {
    status = 'overpaid';
  }

  return {
    status,
    expectedStroops,
    actualStroops,
    diffStroops: diff,
    diffFormatted: formatStroops(absDiff),
  };
}
