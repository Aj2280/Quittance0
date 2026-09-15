/**
 * The create form's side of the shared rule set (issue #436).
 *
 * The form used to check the amount and two emails itself, with its own
 * regexes and its own sentences, and let the API discover everything else. A
 * payload could therefore pass the form and come back as a 400 that named no
 * field. Both sides now ask shared/invoice-validation.ts, so the message under
 * an input is the same sentence the server would have answered with.
 *
 * This module is deliberately thin: it adapts the form's state to the shared
 * payload shape and reads field errors back off a failed request. It holds no
 * rules of its own.
 */

const {
  collectCreateInvoiceFieldErrors,
  firstCreateInvoiceMessage,
} = require('../../shared/invoice-validation.ts');

/**
 * The input each payload field belongs to, in the order a person fills them.
 * Fields the form constrains by construction (the asset select, the payment
 * window select, maxLength inputs) have no separate control to focus, so they
 * are reported in the summary instead.
 */
const FIELD_INPUT_IDS = Object.freeze({
  amount: 'invoice-amount',
  customerEmail: 'customer-email',
  sellerEmail: 'seller-email',
});

const FIELD_ORDER = Object.freeze([
  'amount',
  'customerEmail',
  'sellerEmail',
  'sellerPublicKey',
  'assetIssuer',
  'description',
  'customerName',
  'sellerName',
  'expiresInDays',
  'network',
  'form',
]);

/**
 * Run the create rules over what the form is about to send.
 *
 * @param {object} values Form state, already trimmed and parsed the way the
 *   request body is built. An amount the parser refused should be passed as
 *   the raw string so the rule set can tell "empty" from "not a number".
 * @returns {Record<string, string>} Field -> message; empty when acceptable.
 */
function formFieldErrors(values = {}) {
  return collectCreateInvoiceFieldErrors({
    sellerPublicKey: values.sellerPublicKey,
    amount: values.amount,
    assetCode: values.assetCode,
    assetIssuer: values.assetIssuer,
    description: values.description,
    customerName: values.customerName,
    customerEmail: values.customerEmail,
    sellerName: values.sellerName,
    sellerEmail: values.sellerEmail,
    expiresInDays: values.expiresInDays,
    network: values.network,
  });
}

/**
 * The field errors the API sent back, if it sent any.
 *
 * Anything that is not a string message is dropped rather than rendered, so a
 * malformed body cannot put "undefined" under an input.
 *
 * @param {unknown} error Thrown request error.
 * @returns {Record<string, string>}
 */
function fieldErrorsFromApiError(error) {
  const data =
    error && typeof error === 'object' && error.response && error.response.data
      ? error.response.data
      : {};
  const fieldErrors = data && typeof data === 'object' ? data.fieldErrors : null;

  if (!fieldErrors || typeof fieldErrors !== 'object' || Array.isArray(fieldErrors)) {
    return {};
  }

  const clean = {};
  for (const [field, message] of Object.entries(fieldErrors)) {
    if (typeof message === 'string' && message.trim() !== '') {
      clean[field] = message;
    }
  }

  return clean;
}

/** The one sentence to show when several fields are wrong. */
function fieldErrorSummary(fieldErrors) {
  if (!fieldErrors || typeof fieldErrors !== 'object') return null;
  return firstCreateInvoiceMessage(fieldErrors);
}

/**
 * The input to move focus to, so a keyboard user lands on the problem rather
 * than on the submit button that refused them.
 *
 * @param {Record<string, string>} fieldErrors
 * @returns {string|null} Element id, or null when nothing focusable is at fault.
 */
function firstInvalidFieldId(fieldErrors) {
  if (!fieldErrors || typeof fieldErrors !== 'object') return null;

  for (const field of FIELD_ORDER) {
    if (fieldErrors[field] && FIELD_INPUT_IDS[field]) {
      return FIELD_INPUT_IDS[field];
    }
  }

  return null;
}

module.exports = {
  FIELD_INPUT_IDS,
  FIELD_ORDER,
  fieldErrorSummary,
  fieldErrorsFromApiError,
  firstInvalidFieldId,
  formFieldErrors,
};
