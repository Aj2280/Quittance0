/**
 * Stroop-accurate amount helpers — the frontend mirror of
 * backend/src/utils/safe-amount-compare.ts.
 *
 * Horizon amounts are strings and Stellar precision is fixed at 7 decimals, so
 * every amount the UI accepts, compares, prints, or embeds (QR / SEP-0007 URI /
 * payment op / proof) goes through BigInt stroops here. `parseFloat` and
 * `toFixed` are IEEE-754 paths: `1e-7` stringifies as an exponent and a
 * formatted float can drift one stroop off the chain value.
 */

export const STROOP_DECIMALS = 7;
export const STROOPS_PER_UNIT = 10_000_000n;

/**
 * Expands JavaScript's exponential `toString()` output (`1e-7`, `1.5e+21`)
 * into plain decimal so the digits-only parser below can consume it.
 */
function expandExponential(str) {
  if (!/[eE]/.test(str)) {
    return str;
  }
  const parts = str.split(/[eE]/);
  if (parts.length !== 2) {
    return str;
  }
  const [mantissa, exponentRaw] = parts;
  const exponent = Number.parseInt(exponentRaw, 10);
  if (
    !Number.isFinite(exponent) ||
    !/^[+-]?\d+$/.test(exponentRaw) ||
    !/^-?\d+(\.\d+)?$/.test(mantissa)
  ) {
    return str;
  }
  const negative = mantissa.startsWith('-');
  const unsigned = negative ? mantissa.slice(1) : mantissa;
  const dotIndex = unsigned.indexOf('.');
  const digits = unsigned.replace('.', '');
  const dotPosition = dotIndex === -1 ? digits.length : dotIndex;
  const newDot = dotPosition + exponent;
  let expanded;
  if (newDot <= 0) {
    expanded = '0.' + '0'.repeat(-newDot) + digits;
  } else if (newDot >= digits.length) {
    expanded = digits + '0'.repeat(newDot - digits.length);
  } else {
    expanded = digits.slice(0, newDot) + '.' + digits.slice(newDot);
  }
  return (negative ? '-' : '') + expanded;
}

/**
 * Parse a string/number/bigint amount into integer stroops.
 * Returns null for invalid input.
 */
export function parseStroops(value) {
  if (value === null || value === undefined || typeof value === 'object') {
    return null;
  }

  let str;
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
    return value < 0n ? null : value;
  } else {
    return null;
  }

  // Strings can carry exponent notation too — a DECIMAL column read through a
  // lossy driver, or JSON round-tripped through String(1e-7).
  str = expandExponential(str);

  if (!/^\d+(\.\d+)?$/.test(str)) {
    return null;
  }

  const [intPart, fracPart = ''] = str.split('.');
  if (fracPart.length > STROOP_DECIMALS) {
    const frac7 = fracPart.slice(0, STROOP_DECIMALS);
    const eighthDigit = parseInt(fracPart[STROOP_DECIMALS], 10);
    let stroops = BigInt(intPart) * STROOPS_PER_UNIT + BigInt(frac7);
    if (eighthDigit >= 5) {
      stroops += 1n;
    }
    return stroops;
  }

  return BigInt(intPart) * STROOPS_PER_UNIT + BigInt(fracPart.padEnd(STROOP_DECIMALS, '0'));
}

/**
 * Format integer stroops back into a 7-decimal string without float arithmetic.
 */
export function formatStroops(stroops) {
  const isNegative = stroops < 0n;
  const absStroops = isNegative ? -stroops : stroops;
  const intPart = absStroops / STROOPS_PER_UNIT;
  const fracPart = (absStroops % STROOPS_PER_UNIT).toString().padStart(STROOP_DECIMALS, '0');
  return `${isNegative ? '-' : ''}${intPart.toString()}.${fracPart}`;
}

/**
 * Parse then format: the canonical 7-decimal amount string, or null when the
 * input is not a valid amount.
 */
export function canonicalAmount(value) {
  const stroops = parseStroops(value);
  return stroops === null ? null : formatStroops(stroops);
}

/**
 * Stroop-exact equality between an expected invoice amount and an observed one.
 */
export function amountsEqual(expected, actual) {
  const expectedStroops = parseStroops(expected);
  const actualStroops = parseStroops(actual);
  return expectedStroops !== null && actualStroops !== null && expectedStroops === actualStroops;
}
