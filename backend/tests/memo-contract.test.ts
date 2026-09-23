import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  INVOICE_MEMO_PREFIX,
  MEMO_MAX_BYTES,
  MEMO_TAIL_ALPHABET,
  memoByteLength,
  hasInvoiceMemoPrefix,
  fitsStellarTextMemo,
  isValidMemo,
} from '../../shared/memo.ts';
import { generateInvoiceMemo } from '../src/utils/memo.ts';
import { formatQrPaymentPayload } from '../src/utils/qr-payment-payload.ts';
import { verifyHorizonPayment } from '../src/services/payment-verification.ts';
import type {
  ExpectedPayment,
  HorizonOperationLike,
  VerifyPaymentInput,
} from '../src/services/payment-verification.ts';
import { VALID_DESTINATION } from './fixtures/qr-payment-payload.fixture.ts';

const SELLER = 'GSELLERAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const PAYER = 'GPAYERAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const TX_HASH = 'a1b2c3d4'.repeat(8);

function expected(memo: string): ExpectedPayment {
  return { memo, amount: 100, destination: SELLER, assetCode: 'XLM' };
}

function paymentOp(): HorizonOperationLike {
  return {
    type: 'payment',
    from: PAYER,
    to: SELLER,
    amount: '100.0000000',
    asset_type: 'native',
  };
}

function inputWithTx(transaction: Record<string, unknown>, memo = 'INV-2K4H9'): VerifyPaymentInput {
  return {
    txHash: TX_HASH,
    expected: expected(memo),
    transaction,
    operations: [paymentOp()],
  };
}

describe('memo contract', () => {
  it('accepts the current INV-TIMESTAMP-RANDOM shape', () => {
    assert.equal(isValidMemo('INV-K8XYZ1-ABCDEFGH'), true);
    assert.equal(isValidMemo('INV-1-2'), true);
    // Missing the random-tail separator is not the contracted shape.
    assert.equal(isValidMemo('INV-2K4H9'), false);
  });

  it('rejects values without the invoice prefix', () => {
    assert.equal(isValidMemo('ORDER-1234'), false);
    assert.equal(isValidMemo('inv-2k4h9'), false);
    assert.equal(hasInvoiceMemoPrefix('ORDER-1234'), false);
  });

  it('counts UTF-8 bytes, not string length', () => {
    // 'é' is 1 code unit but 2 UTF-8 bytes.
    assert.equal(memoByteLength('é'), 2);
    assert.equal(memoByteLength('a'.repeat(28)), 28);
    assert.equal(memoByteLength('INV-' + 'é'.repeat(24)), 52);
  });

  it('enforces the 28-byte cap on byte length', () => {
    const atCap = 'INV-AA-' + 'A'.repeat(MEMO_MAX_BYTES - 7);
    assert.equal(atCap.length, 28);
    assert.equal(isValidMemo(atCap), true);
    assert.equal(isValidMemo(atCap + 'A'), false);
    // 27 chars but 28+ bytes because 'é' is 2 bytes — a JS .length check
    // would wrongly accept this.
    const sneaky = 'INV-' + 'é'.repeat(24);
    assert.equal(sneaky.length, 28);
    assert.equal(fitsStellarTextMemo(sneaky), false);
  });

  it('rejects characters outside the tail alphabet', () => {
    // '-' is the segment separator, so an invalid tail char is anything else
    // not in A-Z0-9 — including the underscore the old nanoid alphabet emitted.
    for (const bad of ['_', ' ', '.', '/', '!', 'a', 'é']) {
      assert.equal(isValidMemo(`INV-2K4H9${bad}`), false, `should reject ${bad}`);
      assert.equal(isValidMemo(`INV-2K4H${bad}9Z`), false, `should reject ${bad}`);
    }
  });

  it('rejects a tail containing an extra dash', () => {
    // Exactly one separator after the prefix is allowed; three segments is not.
    assert.equal(isValidMemo('INV-AB-CD-EF'), false);
    assert.equal(isValidMemo('INV-2K4H9-AB-CD'), false);
  });

  it('rejects non-string and empty input safely', () => {
    for (const bad of ['', null, undefined, 42, {}, []]) {
      assert.equal(isValidMemo(bad as never), false);
      assert.equal(hasInvoiceMemoPrefix(bad as never), false);
    }
  });

  it('tail alphabet contains no dashes or underscores', () => {
    assert.equal(MEMO_TAIL_ALPHABET.includes('-'), false);
    assert.equal(MEMO_TAIL_ALPHABET.includes('_'), false);
    assert.match(MEMO_TAIL_ALPHABET, /^[A-Z0-9]+$/);
  });
});

describe('generateInvoiceMemo', () => {
  it('always produces contract-valid memos within the byte cap', () => {
    for (let i = 0; i < 2000; i++) {
      const memo = generateInvoiceMemo();
      assert.equal(isValidMemo(memo), true, `invalid memo generated: ${memo}`);
      assert.equal(memoByteLength(memo), memo.length);
      assert.ok(memo.length <= MEMO_MAX_BYTES);
      assert.ok(memo.startsWith(INVOICE_MEMO_PREFIX));
    }
  });

  it('produces distinct memos on repeated calls', () => {
    const set = new Set(Array.from({ length: 100 }, () => generateInvoiceMemo()));
    assert.ok(set.size > 95, 'memos should not collide');
  });
});

describe('QR payload memo guard', () => {
  const base = { destination: VALID_DESTINATION, amount: '10' };

  it('emits memo unchanged when it fits the text cap', () => {
    const payload = formatQrPaymentPayload({ ...base, memo: 'INV-2K4H9' });
    assert.equal(payload.params.memo, 'INV-2K4H9');
    assert.equal(payload.params.memo_type, 'MEMO_TEXT');
    assert.ok(payload.uri.includes('memo=INV-2K4H9'));
  });

  it('omits memo fields for empty memo', () => {
    const payload = formatQrPaymentPayload({ ...base, memo: '' });
    assert.equal(payload.params.memo, undefined);
    assert.equal(payload.params.memo_type, undefined);
  });

  it('throws for memos over the 28-byte text cap', () => {
    const tooLong = 'X'.repeat(29);
    assert.throws(() => formatQrPaymentPayload({ ...base, memo: tooLong }), /28-byte/);
  });

  it('throws for multi-byte memos that exceed the cap in bytes', () => {
    const sneaky = 'é'.repeat(20); // 40 bytes, 20 chars
    assert.throws(() => formatQrPaymentPayload({ ...base, memo: sneaky }), /28-byte/);
  });
});

describe('verifyHorizonPayment memo types', () => {
  it('rejects hash memo without comparing text', () => {
    const result = verifyHorizonPayment(
      inputWithTx({ memo: 'INV-2K4H9', memo_type: 'hash' })
    );
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.code, 'MEMO_TYPE_MISMATCH');
  });

  it('rejects id memo', () => {
    const result = verifyHorizonPayment(
      inputWithTx({ memo: '12345', memo_type: 'id' })
    );
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.code, 'MEMO_TYPE_MISMATCH');
  });

  it('rejects return memo', () => {
    const result = verifyHorizonPayment(
      inputWithTx({ memo: 'a'.repeat(28), memo_type: 'return' })
    );
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.code, 'MEMO_TYPE_MISMATCH');
  });

  it('accepts a matching text memo', () => {
    const result = verifyHorizonPayment(
      inputWithTx({ memo: 'INV-2K4H9', memo_type: 'text' })
    );
    assert.equal(result.ok, true);
  });

  it('still flags wrong text memo as MEMO_MISMATCH, not type mismatch', () => {
    const result = verifyHorizonPayment(
      inputWithTx({ memo: 'DIFFERENT', memo_type: 'text' })
    );
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.code, 'MEMO_MISMATCH');
  });

  it('keeps none handling: absent memo stays a mismatch, not a type error', () => {
    const result = verifyHorizonPayment(
      inputWithTx({ memo: null, memo_type: 'none' })
    );
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.code, 'MEMO_MISMATCH');
  });

  it('normalizes Horizon-style MEMO_TEXT type values', () => {
    const result = verifyHorizonPayment(
      inputWithTx({ memo: 'INV-2K4H9', memo_type: 'MEMO_TEXT' })
    );
    assert.equal(result.ok, true);
  });
});
