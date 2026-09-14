import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  verifyHorizonPayment,
  checkPaymentAmount,
  isPaymentUnderpaid,
  isPaymentOverpaid,
} from '../src/services/payment-verification';
import {
  AMOUNT_MATCHING_FIXTURES,
  CIRCLE_USDC_TESTNET_ISSUER,
} from './fixtures/amount-matching.fixture';

const SELLER_PUBLIC_KEY = 'GSELLERAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const PAYER_PUBLIC_KEY = 'GPAYERAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const TX_HASH = '1234567890abcdef'.repeat(4);

describe('Amount Matching & Underpayment Rejection Fixtures (#438)', () => {
  for (const fixture of AMOUNT_MATCHING_FIXTURES) {
    it(`[${fixture.scenario.toUpperCase()}] ${fixture.name}`, () => {
      const result = verifyHorizonPayment({
        txHash: TX_HASH,
        expected: {
          memo: 'INV-438-TEST',
          amount: fixture.expectedAmount,
          destination: SELLER_PUBLIC_KEY,
          assetCode: fixture.assetCode,
          assetIssuer: fixture.assetIssuer,
          network: 'TESTNET',
        },
        transaction: {
          memo: 'INV-438-TEST',
          memo_type: 'text',
          created_at: new Date().toISOString(),
        },
        operations: [
          {
            type: 'payment',
            from: PAYER_PUBLIC_KEY,
            to: SELLER_PUBLIC_KEY,
            amount: fixture.actualAmount,
            asset_type: fixture.assetType,
            asset_code: fixture.assetCode === 'XLM' ? undefined : fixture.assetCode,
            asset_issuer: fixture.assetIssuer,
          },
        ],
        network: 'TESTNET',
      });

      assert.equal(
        result.ok,
        fixture.expectedOk,
        `Expected ok=${fixture.expectedOk} for scenario ${fixture.id}: ${fixture.description}`
      );

      if (!fixture.expectedOk) {
        assert.equal(result.ok, false);
        if (!result.ok) {
          assert.equal(
            result.code,
            fixture.expectedCode,
            `Expected rejection code ${fixture.expectedCode} for scenario ${fixture.id}`
          );
        }
      }
    });
  }
});

describe('Helper unit checks: checkPaymentAmount, isPaymentUnderpaid, isPaymentOverpaid', () => {
  it('identifies underpayments correctly across fractional and integer bounds', () => {
    assert.equal(isPaymentUnderpaid('99.9999999', 100), true);
    assert.equal(isPaymentUnderpaid('0.0000001', 100), true);
    assert.equal(isPaymentUnderpaid('50.0000000', 100), true);
    assert.equal(isPaymentUnderpaid('100.0000000', 100), false);
    assert.equal(isPaymentUnderpaid('100.0000001', 100), false);
  });

  it('identifies overpayments correctly', () => {
    assert.equal(isPaymentOverpaid('100.0000001', 100), true);
    assert.equal(isPaymentOverpaid('150.0000000', 100), true);
    assert.equal(isPaymentOverpaid('100.0000000', 100), false);
    assert.equal(isPaymentOverpaid('99.9999999', 100), false);
  });

  it('enforces that underpay never marks invoice as PAID or returns ok: true', () => {
    const underpayCheck = checkPaymentAmount('99.9999999', '100.0000000');
    assert.equal(underpayCheck.ok, false);
    if (!underpayCheck.ok) {
      assert.equal(underpayCheck.code, 'AMOUNT_MISMATCH');
    }

    const dustCheck = checkPaymentAmount('0.0000001', '100.0000000');
    assert.equal(dustCheck.ok, false);
    if (!dustCheck.ok) {
      assert.equal(dustCheck.code, 'AMOUNT_MISMATCH');
    }

    const exactCheck = checkPaymentAmount('100.0000000', '100.0000000');
    assert.equal(exactCheck.ok, true);
  });
});
