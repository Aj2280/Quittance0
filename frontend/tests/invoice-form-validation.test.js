/**
 * Issue #436 - the form asks the same rule set the API does.
 *
 * These cases are the ones a person actually hits: an empty amount box, text
 * in the amount box, a client email with no domain. The point of the shared
 * module is that each of them produces the same sentence on the client as the
 * server would have answered with, so the tests assert the sentence and not
 * just "an error".
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  fieldErrorSummary,
  fieldErrorsFromApiError,
  firstInvalidFieldId,
  formFieldErrors,
} = require('../lib/invoice-form-validation');
const { CREATE_INVOICE_MESSAGES } = require('../../shared/invoice-validation.ts');

const SELLER = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';
const ISSUER = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H';

const formValues = (overrides = {}) => ({
  sellerPublicKey: SELLER,
  amount: 25,
  assetCode: 'XLM',
  expiresInDays: 7,
  network: 'TESTNET',
  ...overrides,
});

test('an amount the parser refused is reported the way the API would', () => {
  assert.deepEqual(formFieldErrors(formValues({ amount: undefined })), {
    amount: CREATE_INVOICE_MESSAGES.amountRequired,
  });
  assert.deepEqual(formFieldErrors(formValues({ amount: 'twenty-five' })), {
    amount: CREATE_INVOICE_MESSAGES.amountNotNumber,
  });
  assert.deepEqual(formFieldErrors(formValues({ amount: 0 })), {
    amount: CREATE_INVOICE_MESSAGES.amountPositive,
  });
});

test('emails are checked with the shared pattern, not a local copy', () => {
  assert.deepEqual(formFieldErrors(formValues({ customerEmail: 'client@' })), {
    customerEmail: CREATE_INVOICE_MESSAGES.customerEmail,
  });
  assert.deepEqual(formFieldErrors(formValues({ sellerEmail: 'me @example.com' })), {
    sellerEmail: CREATE_INVOICE_MESSAGES.sellerEmail,
  });
  assert.deepEqual(
    formFieldErrors(formValues({ customerEmail: '', sellerEmail: undefined })),
    {},
    'an untouched optional email is not an error'
  );
});

test('an issued asset still needs its issuer and XLM still refuses one', () => {
  assert.deepEqual(formFieldErrors(formValues({ assetCode: 'USDC' })), {
    assetIssuer: CREATE_INVOICE_MESSAGES.assetIssuerRequired,
  });
  assert.deepEqual(
    formFieldErrors(formValues({ assetCode: 'XLM', assetIssuer: ISSUER })),
    { assetIssuer: CREATE_INVOICE_MESSAGES.assetIssuerNotAllowed }
  );
});

test('a complete form passes with no field errors at all', () => {
  assert.deepEqual(
    formFieldErrors(
      formValues({
        assetCode: 'USDC',
        assetIssuer: ISSUER,
        customerEmail: 'client@example.com',
        sellerEmail: 'me@example.com',
        description: 'Design work, March',
        expiresInDays: 14,
      })
    ),
    {}
  );
});

test('server field errors are read back off a failed request', () => {
  const error = {
    response: {
      data: {
        success: false,
        code: 'VALIDATION_ERROR',
        error: 'Amount must be greater than zero',
        fieldErrors: {
          amount: 'Amount must be greater than zero',
          customerEmail: 'Client email is invalid',
          ignored: '',
          notAString: 42,
        },
      },
    },
  };

  assert.deepEqual(fieldErrorsFromApiError(error), {
    amount: 'Amount must be greater than zero',
    customerEmail: 'Client email is invalid',
  });
  assert.equal(fieldErrorSummary(fieldErrorsFromApiError(error)), 'Amount must be greater than zero');
});

test('an error without field errors leaves the form untouched', () => {
  assert.deepEqual(fieldErrorsFromApiError({ message: 'Network Error' }), {});
  assert.deepEqual(fieldErrorsFromApiError(undefined), {});
  assert.deepEqual(
    fieldErrorsFromApiError({ response: { data: { error: 'boom', fieldErrors: 'nope' } } }),
    {}
  );
  assert.equal(fieldErrorSummary({}), null);
});

test('focus lands on the first field a person can fix', () => {
  assert.equal(firstInvalidFieldId({ amount: 'x', customerEmail: 'y' }), 'invoice-amount');
  assert.equal(firstInvalidFieldId({ customerEmail: 'y', amount: undefined }), 'customer-email');
  assert.equal(firstInvalidFieldId({ description: 'too long' }), null);
  assert.equal(firstInvalidFieldId({}), null);
});
