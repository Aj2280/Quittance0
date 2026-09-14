import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  verifyHorizonPayment,
  checkInvoiceIsPayable,
  failure,
} from '../src/services/payment-verification';
import {
  USDC_VERIFY_CASES,
  CIRCLE_USDC_TESTNET_ISSUER,
  REAL_TESTNET_TX_USDC_20,
} from './fixtures/usdc-verify-edge-cases.fixture';

describe('USDC and path payment verification edge cases — fixture suite', () => {
  for (const testCase of USDC_VERIFY_CASES) {
    it(testCase.name, () => {
      const result = verifyHorizonPayment(testCase.input);
      assert.equal(result.ok, testCase.expectedResult, testCase.description);

      if (!testCase.expectedResult && testCase.expectedCode) {
        assert.equal(result.ok, false);
        if (!result.ok) {
          assert.equal(result.code, testCase.expectedCode);
        }
      }

      if (testCase.expectedResult) {
        assert.equal(result.ok, true);
        if (result.ok) {
          assert.equal(result.value.txHash, testCase.input.txHash);
          assert.equal(result.value.assetCode, testCase.input.expected.assetCode);
        }
      }
    });
  }
});

describe('USDC trustline and missing operation edge cases', () => {
  it('returns NO_PAYMENT_OPERATION when transaction only contains a change_trust operation', () => {
    const result = verifyHorizonPayment({
      txHash: REAL_TESTNET_TX_USDC_20,
      network: 'TESTNET',
      expected: {
        memo: 'INV-TRUST-01',
        amount: '10.0000000',
        destination: 'GAYF33NNNMI2Z6VNRFXQ64D4E4SF77PM46NW3ZUZEEU5X7FCHAZCMHKU',
        assetCode: 'USDC',
        assetIssuer: CIRCLE_USDC_TESTNET_ISSUER,
        network: 'TESTNET',
      },
      transaction: {
        memo: 'INV-TRUST-01',
        memo_type: 'text',
      },
      operations: [
        {
          type: 'change_trust',
          from: 'GAYF33NNNMI2Z6VNRFXQ64D4E4SF77PM46NW3ZUZEEU5X7FCHAZCMHKU',
          asset_type: 'credit_alphanum4',
          asset_code: 'USDC',
          asset_issuer: CIRCLE_USDC_TESTNET_ISSUER,
        },
      ],
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'NO_PAYMENT_OPERATION');
    }
  });

  it('rejects an invoice if invoice status is not PENDING', () => {
    assert.deepEqual(checkInvoiceIsPayable('PAID'), failure('INVOICE_ALREADY_PAID'));
    assert.deepEqual(checkInvoiceIsPayable('EXPIRED'), failure('INVOICE_EXPIRED'));
    assert.deepEqual(checkInvoiceIsPayable('CANCELLED'), failure('INVOICE_NOT_PENDING'));
  });
});

describe('USDC verification check ordering', () => {
  it('prioritizes memo mismatch before destination, amount, and asset mismatch', () => {
    const result = verifyHorizonPayment({
      txHash: REAL_TESTNET_TX_USDC_20,
      network: 'TESTNET',
      expected: {
        memo: 'EXPECTED-MEMO',
        amount: '100.0000000',
        destination: 'G_EXPECTED_DESTINATION',
        assetCode: 'USDC',
        assetIssuer: CIRCLE_USDC_TESTNET_ISSUER,
        network: 'TESTNET',
      },
      transaction: {
        memo: 'WRONG-MEMO',
        memo_type: 'text',
      },
      operations: [
        {
          type: 'payment',
          from: 'G_SOURCE',
          to: 'G_WRONG_DESTINATION',
          amount: '1.0000000',
          asset_type: 'native',
        },
      ],
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'MEMO_MISMATCH');
    }
  });

  it('prioritizes destination mismatch before amount and asset mismatch', () => {
    const result = verifyHorizonPayment({
      txHash: REAL_TESTNET_TX_USDC_20,
      network: 'TESTNET',
      expected: {
        memo: 'MATCHING-MEMO',
        amount: '100.0000000',
        destination: 'G_EXPECTED_DESTINATION',
        assetCode: 'USDC',
        assetIssuer: CIRCLE_USDC_TESTNET_ISSUER,
        network: 'TESTNET',
      },
      transaction: {
        memo: 'MATCHING-MEMO',
        memo_type: 'text',
      },
      operations: [
        {
          type: 'payment',
          from: 'G_SOURCE',
          to: 'G_WRONG_DESTINATION',
          amount: '1.0000000',
          asset_type: 'native',
        },
      ],
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'DESTINATION_MISMATCH');
    }
  });

  it('reports the shortfall when the amount is wrong and the asset differs too', () => {
    const result = verifyHorizonPayment({
      txHash: REAL_TESTNET_TX_USDC_20,
      network: 'TESTNET',
      expected: {
        memo: 'MATCHING-MEMO',
        amount: '100.0000000',
        destination: 'G_DEST',
        assetCode: 'USDC',
        assetIssuer: CIRCLE_USDC_TESTNET_ISSUER,
        network: 'TESTNET',
      },
      transaction: {
        memo: 'MATCHING-MEMO',
        memo_type: 'text',
      },
      operations: [
        {
          type: 'payment',
          from: 'G_SOURCE',
          to: 'G_DEST',
          amount: '50.0000000',
          asset_type: 'native',
        },
      ],
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'AMOUNT_TOO_LOW');
    }
  });
});
