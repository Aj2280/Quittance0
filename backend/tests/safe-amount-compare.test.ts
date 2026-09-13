import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  compareAmounts,
  isUnderpaid,
  isOverpaid,
  describeAmountDelta,
  toStroops,
  STROOP_DECIMALS,
  STROOP_SCALE,
} from '../src/utils/safe-amount-compare';

describe('safe-amount-compare: USDC verification edge cases', () => {
  describe('STROOP_DECIMALS and STROOP_SCALE', () => {
    it('defines correct precision for Stellar', () => {
      assert.equal(STROOP_DECIMALS, 7);
      assert.equal(STROOP_SCALE, 10000000);
    });
  });

  describe('toStroops - conversion safety', () => {
    it('converts exact amounts to stroops', () => {
      assert.equal(toStroops('1'), 10000000);
      assert.equal(toStroops('1.0'), 10000000);
      assert.equal(toStroops(1), 10000000);
      assert.equal(toStroops('0.1'), 1000000);
      assert.equal(toStroops('0.0000001'), 1);
    });

    it('rejects invalid input', () => {
      assert.equal(toStroops(null), null);
      assert.equal(toStroops(undefined), null);
      assert.equal(toStroops(''), null);
      assert.equal(toStroops('  '), null);
      assert.equal(toStroops('invalid'), null);
      assert.equal(toStroops(NaN), null);
      assert.equal(toStroops(Infinity), null);
      assert.equal(toStroops(-100), null); // Negative amounts invalid
    });

    it('handles floating point edge cases', () => {
      // These should not cause precision errors
      assert.equal(toStroops('0.1'), 1000000);
      assert.equal(toStroops('0.01'), 100000);
      assert.equal(toStroops('0.001'), 10000);
      assert.equal(toStroops('0.0001'), 1000);
      assert.equal(toStroops('0.00001'), 100);
      assert.equal(toStroops('0.000001'), 10);
      assert.equal(toStroops('0.0000001'), 1);
      assert.equal(toStroops('0.00000001'), 0); // Rounds down to 0
    });
  });

  describe('compareAmounts - exact matching (XLM happy path)', () => {
    it('accepts exact matches across formats', () => {
      assert.equal(compareAmounts('100', 100), true);
      assert.equal(compareAmounts(100, '100'), true);
      assert.equal(compareAmounts('100.0', '100.0000000'), true);
      assert.equal(compareAmounts(100.5, '100.5000000'), true);
    });

    it('accepts amounts at stroop precision', () => {
      // Difference < 0.5 stroops collapses
      assert.equal(compareAmounts('1.00000004', 1), true);
      assert.equal(compareAmounts('1.00000001', 1), true);
    });

    it('rejects stroop precision mismatches', () => {
      // Difference >= 0.5 stroops
      assert.equal(compareAmounts('1.00000005', 1), false);
      assert.equal(compareAmounts('1.0000001', 1), false);
    });

    it('rejects overpayment (default zero tolerance)', () => {
      assert.equal(compareAmounts('100', '100.0000001'), false);
      assert.equal(compareAmounts(100, 100.1), false);
      assert.equal(compareAmounts('50', '50.1'), false);
    });

    it('rejects underpayment', () => {
      assert.equal(compareAmounts('100', '99.9999999'), false);
      assert.equal(compareAmounts(100, 99.9), false);
      assert.equal(compareAmounts('50', '49.9'), false);
    });
  });

  describe('compareAmounts - USDC edge cases', () => {
    it('handles USDC with precise decimals', () => {
      // USDC path payment might result in slight precision diff
      assert.equal(compareAmounts('25.123', '25.1230000'), true);
      assert.equal(compareAmounts('100.5', '100.5000000'), true);
    });

    it('rejects USDC underpayment (1 stroop under)', () => {
      assert.equal(compareAmounts('100', '99.9999999'), false);
      assert.equal(compareAmounts('50.5', '50.4999999'), false);
    });

    it('rejects USDC overpayment by default', () => {
      assert.equal(compareAmounts('100', '100.0000001'), false);
      assert.equal(compareAmounts('50.5', '50.5000001'), false);
    });

    it('accepts USDC overpayment with tolerance', () => {
      // For path payments that might overfund slightly
      assert.equal(compareAmounts('100', '100.0000001', 1), true);
      assert.equal(compareAmounts('100', '100.0000010', 10), true);
      assert.equal(compareAmounts('50.5', '50.5000001', 1), true);
    });
  });

  describe('compareAmounts - invalid tolerance', () => {
    it('rejects negative tolerance', () => {
      assert.equal(compareAmounts('100', '100', -1), false);
    });

    it('rejects non-integer tolerance', () => {
      assert.equal(compareAmounts('100', '100', 1.5), false);
      assert.equal(compareAmounts('100', '100', 0.1), false);
    });

    it('rejects invalid operands with any tolerance', () => {
      assert.equal(compareAmounts('invalid', '100', 0), false);
      assert.equal(compareAmounts('100', 'invalid', 0), false);
      assert.equal(compareAmounts('100', null, 0), false);
    });
  });

  describe('isUnderpaid - underpayment detection', () => {
    it('detects underpayment', () => {
      assert.equal(isUnderpaid('100', '99.9'), true);
      assert.equal(isUnderpaid('50.5', '50'), true);
      assert.equal(isUnderpaid('100', '99.9999999'), true);
    });

    it('rejects exact match as underpaid', () => {
      assert.equal(isUnderpaid('100', '100'), false);
      assert.equal(isUnderpaid('100', '100.0000000'), false);
    });

    it('rejects overpayment as underpaid', () => {
      assert.equal(isUnderpaid('100', '100.1'), false);
      assert.equal(isUnderpaid('100', '100.0000001'), false);
    });
  });

  describe('isOverpaid - overpayment detection', () => {
    it('detects overpayment', () => {
      assert.equal(isOverpaid('100', '100.1'), true);
      assert.equal(isOverpaid('50', '50.5'), true);
      assert.equal(isOverpaid('100', '100.0000001'), true);
    });

    it('rejects exact match as overpaid', () => {
      assert.equal(isOverpaid('100', '100'), false);
      assert.equal(isOverpaid('100', '100.0000000'), false);
    });

    it('rejects underpayment as overpaid', () => {
      assert.equal(isOverpaid('100', '99.9'), false);
      assert.equal(isOverpaid('100', '99.9999999'), false);
    });
  });

  describe('describeAmountDelta - diagnostic descriptions', () => {
    it('identifies exact matches', () => {
      assert.equal(describeAmountDelta('100', '100'), 'exact');
      assert.equal(describeAmountDelta('100.1', '100.1000000'), 'exact');
      assert.equal(describeAmountDelta('50.5', '50.5'), 'exact');
    });

    it('identifies exact matches within tolerance', () => {
      assert.equal(describeAmountDelta('100', '100.0000001', 1), 'exact');
      assert.equal(describeAmountDelta('100', '99.9999999', 1), 'exact');
    });

    it('identifies underpayment', () => {
      assert.equal(describeAmountDelta('100', '99.9'), 'under');
      assert.equal(describeAmountDelta('100', '50'), 'under');
      assert.equal(describeAmountDelta('100', '99.9999999'), 'under');
    });

    it('identifies overpayment', () => {
      assert.equal(describeAmountDelta('100', '100.1'), 'over');
      assert.equal(describeAmountDelta('100', '150'), 'over');
      assert.equal(describeAmountDelta('100', '100.0000001'), 'over');
    });

    it('identifies invalid input', () => {
      assert.equal(describeAmountDelta('invalid', '100'), 'invalid');
      assert.equal(describeAmountDelta('100', 'invalid'), 'invalid');
      assert.equal(describeAmountDelta(null, '100'), 'invalid');
    });
  });

  describe('integration: USDC use cases', () => {
    it('USDC exact match from Circle issuer', () => {
      // Invoice requests 100 USDC
      // Horizon payment shows 100.0000000 USDC from Circle
      assert.equal(compareAmounts('100', '100.0000000'), true);
    });

    it('USDC path payment with correct destination amount', () => {
      // Path payment might accumulate rounding
      // But final destination should be exact
      assert.equal(compareAmounts('100', '100.0000000'), true);
    });

    it('USDC from wrong issuer detected separately (by asset code check)', () => {
      // This test focuses on amount; asset matching is separate
      // Here we verify amount would match even if issuer was wrong
      // (that wrong issuer would be caught by asset matching)
      assert.equal(compareAmounts('100', '100.0000000'), true);
    });

    it('USDC underpayment clearly rejected', () => {
      // Invoice requests 100 USDC
      // Payer only sends 99.99 USDC
      assert.equal(compareAmounts('100', '99.99'), false);
      assert.equal(isUnderpaid('100', '99.99'), true);
      assert.equal(describeAmountDelta('100', '99.99'), 'under');
    });

    it('USDC overpayment rejected by default', () => {
      // Invoice requests 100 USDC
      // Payer sends 100.01 USDC (mistake or attack)
      assert.equal(compareAmounts('100', '100.01'), false);
      assert.equal(isOverpaid('100', '100.01'), true);
      assert.equal(describeAmountDelta('100', '100.01'), 'over');
    });

    it('USDC with many decimal places', () => {
      // Real-world example: 1000.123456789 should round to stroops
      assert.equal(compareAmounts('1000.123456789', '1000.1234567'), true); // Rounds same
      assert.equal(compareAmounts('1000.123456789', '1000.1234568'), false); // Rounds different
    });
  });
});
