import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  SEP7_QR_MAX_VERSION,
  fitsSep7QrBudget,
  qrVersionFor,
} from '../src/utils/qr-budget';
import { generateStellarPaymentQR } from '../src/utils/qrcode';
import { formatQrPaymentPayload } from '../src/utils/qr-payment-payload';
import {
  VALID_DESTINATION,
  VALID_ASSET_ISSUER,
} from './fixtures/qr-payment-payload.fixture';

const FALLBACK_LINK = 'https://quittance.test/pay/inv_123';
const MEMO = 'QTN-20260922-AB3F9K2X';

describe('QR payload budget (issue #510)', () => {
  it('an XLM invoice URI fits the budget', () => {
    const { uri } = formatQrPaymentPayload({
      destination: VALID_DESTINATION,
      amount: '42.5',
      memo: MEMO,
    });
    assert.equal(fitsSep7QrBudget(uri), true);
    assert.ok(
      qrVersionFor(uri) <= SEP7_QR_MAX_VERSION,
      `XLM URI encoded at QR version ${qrVersionFor(uri)}`
    );
  });

  it('a USDC URI with code + issuer + memo exceeds the budget', () => {
    const { uri } = formatQrPaymentPayload({
      destination: VALID_DESTINATION,
      amount: '42.5',
      memo: MEMO,
      asset: { code: 'USDC', issuer: VALID_ASSET_ISSUER },
    });
    assert.equal(
      fitsSep7QrBudget(uri),
      false,
      `USDC URI (${uri.length} bytes) should exceed version ${SEP7_QR_MAX_VERSION}`
    );
  });

  it('the generated QR still encodes the SEP-0007 URI when it fits', async () => {
    const qr = await generateStellarPaymentQR(
      VALID_DESTINATION,
      '42.5',
      'XLM',
      MEMO,
      undefined,
      FALLBACK_LINK
    );
    assert.equal(qr.encodesSep7Uri, true);
    assert.match(qr.qrDataUrl, /^data:image\/png;base64,/);
    assert.ok(qr.uri.startsWith('web+stellar:pay?'));
  });

  it('an over-budget URI encodes the HTTPS pay link instead', async () => {
    const qr = await generateStellarPaymentQR(
      VALID_DESTINATION,
      '42.5',
      'USDC',
      MEMO,
      VALID_ASSET_ISSUER,
      FALLBACK_LINK
    );
    assert.equal(qr.encodesSep7Uri, false);
    assert.match(qr.qrDataUrl, /^data:image\/png;base64,/);
  });

  it('the full URI survives the fallback — memo and issuer are never truncated', async () => {
    const qr = await generateStellarPaymentQR(
      VALID_DESTINATION,
      '42.5',
      'USDC',
      MEMO,
      VALID_ASSET_ISSUER,
      FALLBACK_LINK
    );
    assert.equal(qr.encodesSep7Uri, false);
    assert.match(qr.uri, /asset_code=USDC/);
    assert.match(qr.uri, new RegExp(`asset_issuer=${VALID_ASSET_ISSUER}`));
    assert.match(qr.uri, new RegExp(`memo=${MEMO}`));
    assert.match(qr.uri, /memo_type=MEMO_TEXT/);
  });

  it('an over-budget URI without a fallback link fails closed', async () => {
    await assert.rejects(
      generateStellarPaymentQR(VALID_DESTINATION, '42.5', 'USDC', MEMO, VALID_ASSET_ISSUER),
      /exceeds the QR payload budget/
    );
  });

  it('the version budget itself is pinned', () => {
    // The byte threshold is version-dependent, not a raw string length — this
    // documents the measured boundary in this build of `qrcode`.
    assert.equal(qrVersionFor('x'.repeat(155)) <= SEP7_QR_MAX_VERSION, true);
    assert.equal(qrVersionFor('x'.repeat(229)) <= SEP7_QR_MAX_VERSION, false);
  });
});
