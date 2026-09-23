import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  STROOP_DECIMALS,
  STROOPS_PER_UNIT,
  parseStroops,
  formatStroops,
  compareAmounts,
  isUnderpaid,
  isOverpaid,
  describeAmountDelta,
  canonicalAmount,
} from '../src/utils/safe-amount-compare';

describe('safe-amount-compare — constants', () => {
  it('defines STROOP_DECIMALS as 7', () => {
    assert.equal(STROOP_DECIMALS, 7);
  });

  it('defines STROOPS_PER_UNIT as 10,000,000', () => {
    assert.equal(STROOPS_PER_UNIT, 10_000_000n);
  });
});

describe('safe-amount-compare — parseStroops', () => {
  it('parses integer strings into exact stroops', () => {
    assert.equal(parseStroops('1'), 10_000_000n);
    assert.equal(parseStroops('100'), 1_000_000_000n);
    assert.equal(parseStroops('0'), 0n);
  });

  it('parses decimal strings with varying precision', () => {
    assert.equal(parseStroops('0.1'), 1_000_000n);
    assert.equal(parseStroops('0.01'), 100_000n);
    assert.equal(parseStroops('0.0000001'), 1n);
    assert.equal(parseStroops('123.4567890'), 1_234_567_890n);
    assert.equal(parseStroops('20.0000000'), 200_000_000n);
  });

  it('rounds sub-stroop fractions half-up at the 8th decimal place', () => {
    assert.equal(parseStroops('1.00000004'), 10_000_000n);
    assert.equal(parseStroops('1.00000005'), 10_000_001n);
    assert.equal(parseStroops('0.00000009'), 1n);
    assert.equal(parseStroops('0.00000001'), 0n);
  });

  it('accepts positive numbers and bigints', () => {
    assert.equal(parseStroops(50), 500_000_000n);
    assert.equal(parseStroops(100n), 100n);
  });

  it('parses numbers that stringify in exponential notation', () => {
    // A one-stroop invoice arrives as the double 1e-7; the parser must expand
    // the exponent instead of rejecting it.
    assert.equal(parseStroops(0.0000001), 1n);
    assert.equal(parseStroops(1e-7), 1n);
    assert.equal(parseStroops(1.5e-7), 2n); // rounds half-up at the 8th digit
    assert.equal(parseStroops(1e21), 10_000_000_000_000_000_000_000_000_000n);
    assert.equal(parseStroops(2.5e-3), 25_000n);
  });

  it('returns null for negative, invalid, or malformed values', () => {
    assert.equal(parseStroops('-1'), null);
    assert.equal(parseStroops(-5), null);
    assert.equal(parseStroops(-10n), null);
    assert.equal(parseStroops(''), null);
    assert.equal(parseStroops('   '), null);
    assert.equal(parseStroops('abc'), null);
    assert.equal(parseStroops('1.2.3'), null);
    assert.equal(parseStroops(NaN), null);
    assert.equal(parseStroops(Infinity), null);
    assert.equal(parseStroops(null), null);
    assert.equal(parseStroops(undefined), null);
    assert.equal(parseStroops({}), null);
  });
});

describe('safe-amount-compare — formatStroops', () => {
  it('formats stroop counts into 7-decimal strings', () => {
    assert.equal(formatStroops(10_000_000n), '1.0000000');
    assert.equal(formatStroops(1n), '0.0000001');
    assert.equal(formatStroops(0n), '0.0000000');
    assert.equal(formatStroops(200_000_000n), '20.0000000');
  });

  it('formats negative stroop counts', () => {
    assert.equal(formatStroops(-10_000_000n), '-1.0000000');
    assert.equal(formatStroops(-500_000n), '-0.0500000');
  });
});

describe('safe-amount-compare — canonicalAmount', () => {
  it('normalizes mixed representations to the compared stroop string', () => {
    assert.equal(canonicalAmount(0.0000001), '0.0000001');
    assert.equal(canonicalAmount('0.0000001'), '0.0000001');
    assert.equal(canonicalAmount(10), '10.0000000');
    assert.equal(canonicalAmount('10.0000000'), '10.0000000');
    assert.equal(canonicalAmount('10'), '10.0000000');
    assert.equal(canonicalAmount('  0042.5000000  '), '42.5000000');
    assert.equal(canonicalAmount(1e-7), '0.0000001');
    assert.equal(canonicalAmount(0.1), '0.1000000');
  });

  it('returns null for unparseable amounts', () => {
    assert.equal(canonicalAmount('abc'), null);
    assert.equal(canonicalAmount(-1), null);
    assert.equal(canonicalAmount(undefined), null);
  });
});

describe('safe-amount-compare — compareAmounts', () => {
  it('performs exact comparisons at zero tolerance', () => {
    assert.equal(compareAmounts('100.0000000', '100.0000000', 0), true);
    assert.equal(compareAmounts('100.0000000', 100, 0), true);
    assert.equal(compareAmounts('100.0000000', '100.0000001', 0), false);
    assert.equal(compareAmounts('100.0000000', '99.9999999', 0), false);
  });

  it('respects non-zero stroop tolerance windows', () => {
    assert.equal(compareAmounts('100.0000000', '100.0000005', 5), true);
    assert.equal(compareAmounts('100.0000000', '99.9999995', 5), true);
    assert.equal(compareAmounts('100.0000000', '100.0000006', 5), false);
    assert.equal(compareAmounts('100.0000000', '99.9999994', 5), false);
  });

  it('rejects malformed inputs and invalid tolerances', () => {
    assert.equal(compareAmounts('100', 'invalid', 0), false);
    assert.equal(compareAmounts('invalid', '100', 0), false);
    assert.equal(compareAmounts('100', '100', -1), false);
    assert.equal(compareAmounts('100', '100', 1.5), false);
  });
});

describe('safe-amount-compare — diagnostics', () => {
  it('identifies underpaid payments correctly', () => {
    assert.equal(isUnderpaid('100.0000000', '99.9999999', 0), true);
    assert.equal(isUnderpaid('100.0000000', '100.0000000', 0), false);
    assert.equal(isUnderpaid('100.0000000', '100.0000001', 0), false);
  });

  it('identifies overpaid payments correctly', () => {
    assert.equal(isOverpaid('100.0000000', '100.0000001', 0), true);
    assert.equal(isOverpaid('100.0000000', '100.0000000', 0), false);
    assert.equal(isOverpaid('100.0000000', '99.9999999', 0), false);
  });

  it('returns comprehensive delta descriptions', () => {
    const exact = describeAmountDelta('50.0000000', '50.0000000');
    assert.equal(exact.status, 'exact');
    assert.equal(exact.diffStroops, 0n);
    assert.equal(exact.diffFormatted, '0.0000000');

    const under = describeAmountDelta('50.0000000', '48.0000000');
    assert.equal(under.status, 'underpaid');
    assert.equal(under.diffStroops, -20_000_000n);
    assert.equal(under.diffFormatted, '2.0000000');

    const over = describeAmountDelta('50.0000000', '51.5000000');
    assert.equal(over.status, 'overpaid');
    assert.equal(over.diffStroops, 15_000_000n);
    assert.equal(over.diffFormatted, '1.5000000');

    const invalid = describeAmountDelta('not-a-number', '50.0000000');
    assert.equal(invalid.status, 'invalid');
    assert.equal(invalid.expectedStroops, null);
  });
});
