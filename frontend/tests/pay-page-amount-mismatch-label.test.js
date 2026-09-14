const test = require('node:test');
const assert = require('node:assert/strict');
const {
  PAY_STATES,
  initialPaymentState,
  paymentReducer,
  describePaymentState,
} = require('../lib/payment-page-state');
const { rejectionLabel } = require('../lib/verify-rejection-label.ts');

test('rejectionLabel correctly maps AMOUNT_MISMATCH to short label', () => {
  const label = rejectionLabel('AMOUNT_MISMATCH');
  assert.equal(label, 'Amount mismatch');
});

test('paymentReducer captures rejection code and error on VERIFY_FAILED', () => {
  const state = initialPaymentState({ status: 'PENDING' });
  const next = paymentReducer(state, {
    type: 'VERIFY_FAILED',
    error: 'Amount mismatch',
    code: 'AMOUNT_MISMATCH',
  });

  assert.equal(next.status, PAY_STATES.ERROR);
  assert.equal(next.error, 'Amount mismatch');
  assert.equal(next.code, 'AMOUNT_MISMATCH');

  const label = rejectionLabel(next.code);
  assert.equal(label, 'Amount mismatch');

  const sentence = describePaymentState(next);
  assert.equal(sentence, 'Payment could not be completed. Amount mismatch.');
});

test('paymentReducer VERIFY_FAILED defaults code to null if not provided', () => {
  const state = initialPaymentState({ status: 'PENDING' });
  const next = paymentReducer(state, {
    type: 'VERIFY_FAILED',
    error: 'Amount mismatch',
  });

  assert.equal(next.status, PAY_STATES.ERROR);
  assert.equal(next.code, null);
});
