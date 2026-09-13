import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatQrPaymentPayload } from '../src/utils/qr-payment-payload';
import { SEP7_RESEARCH_VECTORS } from './fixtures/sep-0007-wallet.fixture';

describe('SEP-0007 wallet research vectors', () => {
  for (const vector of SEP7_RESEARCH_VECTORS) {
    it(vector.name, () => {
      assert.ok(vector.walletNote.length > 10);
      if (vector.current === 'accept') {
        const { networkPassphrase: _network, ...currentInput } = vector.input;
        assert.equal(formatQrPaymentPayload(currentInput).uri, vector.expectedUri);
        return;
      }

      if (vector.current === 'reject') {
        const { networkPassphrase: _network, ...currentInput } = vector.input;
        assert.throws(() => formatQrPaymentPayload(currentInput), {
          message: vector.expectedError,
        });
        return;
      }

      const { networkPassphrase, ...currentInput } = vector.input;
      const current = formatQrPaymentPayload(currentInput);
      if (networkPassphrase) {
        assert.equal(current.params.network_passphrase, undefined);
      } else {
        assert.ok(Buffer.byteLength(current.params.memo || '', 'utf8') > 28);
      }
    });
  }

  it('keeps at least five accept/reject vectors and names every current gap', () => {
    assert.ok(SEP7_RESEARCH_VECTORS.length >= 5);
    assert.ok(SEP7_RESEARCH_VECTORS.some(vector => vector.recommendation === 'accept'));
    assert.ok(SEP7_RESEARCH_VECTORS.some(vector => vector.recommendation === 'reject'));
    for (const vector of SEP7_RESEARCH_VECTORS.filter(vector => vector.current === 'gap')) {
      assert.match(vector.walletNote, /current|formatter|explicit|validate/i);
    }
  });
});
