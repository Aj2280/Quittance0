import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Request, Response } from 'express';
import {
  resolveStellarNetwork,
  passphraseFor,
  defaultHorizonUrl,
  explorerSegmentFor,
  walletNetworkMatches,
  TESTNET_PASSPHRASE,
  PUBLIC_PASSPHRASE,
} from '../../shared/network';
import { STELLAR_NETWORK } from '../src/config/stellar';
import { buildHorizonTxUrl } from '../src/utils/explorer-tx-link';
import { buildQuittanceProof } from '../src/services/quittance-proof.service';
import { getQuittanceProof } from '../src/controllers/quittance-proof.controller';

const SERVER_SEGMENT = STELLAR_NETWORK === 'TESTNET' ? 'testnet' : 'public';
const TX_HASH = 'a'.repeat(64);
const SELLER = 'GB3Q3VRHH3OQDYITTLONDLEHWQGKB27T2BEDSFHIUMOERULVXPDXRKG4';

interface FakeResponse {
  statusCode: number;
  body: any;
}

function createRes(): FakeResponse & Response {
  const res: any = {
    statusCode: 200,
    body: undefined,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: any) {
      res.body = payload;
      return res;
    },
  };
  return res;
}

function createProofReq(invoice: any, query: any = {}): Request {
  return {
    params: { id: 'inv_1' },
    query,
    app: {
      get: (key: string) =>
        key === 'invoiceStorage'
          ? { getInvoiceById: async () => invoice }
          : undefined,
    },
  } as unknown as Request;
}

const PAID_INVOICE = {
  id: 'inv_1',
  status: 'PAID',
  sellerPublicKey: SELLER,
  payerPublicKey: null,
  amount: '12.5',
  assetCode: 'XLM',
  assetIssuer: null,
  memo: 'INV-ABCDEF-123456',
  paymentTxHash: TX_HASH,
  createdAt: '2026-01-01T00:00:00.000Z',
  expiresAt: '2026-01-08T00:00:00.000Z',
  paidAt: '2026-01-02T00:00:00.000Z',
};

describe('shared network resolver (issue #511)', () => {
  it('resolves TESTNET and PUBLIC in any casing', () => {
    assert.equal(resolveStellarNetwork('TESTNET'), 'TESTNET');
    assert.equal(resolveStellarNetwork('public'), 'PUBLIC');
    assert.equal(resolveStellarNetwork(' Public '), 'PUBLIC');
  });

  it('defaults to TESTNET when unset', () => {
    assert.equal(resolveStellarNetwork(undefined), 'TESTNET');
    assert.equal(resolveStellarNetwork(null), 'TESTNET');
  });

  it('fails closed on unrecognised values', () => {
    assert.throws(() => resolveStellarNetwork('mainnet'));
    assert.throws(() => resolveStellarNetwork('futurenet'));
    assert.throws(() => resolveStellarNetwork(''));
  });

  it('derives passphrase, horizon URL and explorer segment from one source', () => {
    assert.equal(passphraseFor('TESTNET'), TESTNET_PASSPHRASE);
    assert.equal(passphraseFor('PUBLIC'), PUBLIC_PASSPHRASE);
    assert.equal(defaultHorizonUrl('TESTNET'), 'https://horizon-testnet.stellar.org');
    assert.equal(defaultHorizonUrl('PUBLIC'), 'https://horizon.stellar.org');
    assert.equal(explorerSegmentFor('TESTNET'), 'testnet');
    assert.equal(explorerSegmentFor('PUBLIC'), 'public');
  });
});

describe('wallet network matching (issue #511)', () => {
  it('accepts the wallet when the reported passphrase matches exactly', () => {
    assert.equal(
      walletNetworkMatches('TESTNET', { network: 'TESTNET', networkPassphrase: TESTNET_PASSPHRASE }),
      true
    );
  });

  it('rejects a wallet whose passphrase belongs to the other network', () => {
    assert.equal(
      walletNetworkMatches('TESTNET', { network: 'TESTNET', networkPassphrase: PUBLIC_PASSPHRASE }),
      false
    );
  });

  it('rejects a self-named custom network whose passphrase does not match', () => {
    // The name claims TESTNET; the passphrase proves it is not.
    assert.equal(
      walletNetworkMatches('TESTNET', {
        network: 'TESTNET',
        networkPassphrase: 'Custom Standalone Network ; March 2026',
      }),
      false
    );
  });

  it('falls back to the name check only when no passphrase was reported', () => {
    assert.equal(walletNetworkMatches('TESTNET', { network: 'TESTNET' }), true);
    assert.equal(walletNetworkMatches('TESTNET', { network: 'PUBLIC' }), false);
  });
});

describe('explorer links follow the resolved network (issue #511)', () => {
  it('uses the server network when no segment is supplied', () => {
    assert.equal(
      buildHorizonTxUrl(TX_HASH),
      `https://stellar.expert/explorer/${SERVER_SEGMENT}/tx/${TX_HASH}`
    );
  });

  it('uses the server network when the segment is unrecognised', () => {
    assert.equal(
      buildHorizonTxUrl(TX_HASH, 'mainnet'),
      `https://stellar.expert/explorer/${SERVER_SEGMENT}/tx/${TX_HASH}`
    );
  });
});

describe('proof network pinning (issue #511)', () => {
  it('builds the proof on the server-resolved network without a hint', () => {
    const result = buildQuittanceProof(PAID_INVOICE);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.proof.network, SERVER_SEGMENT);
      assert.ok(result.proof.payment.explorerUrl?.includes(`/explorer/${SERVER_SEGMENT}/`));
    }
  });

  it('GET /quittance proof ignores a mismatched ?network and fails closed', async () => {
    const other = STELLAR_NETWORK === 'TESTNET' ? 'public' : 'testnet';
    const res = createRes();
    await getQuittanceProof(createProofReq(PAID_INVOICE, { network: other }), res);
    assert.equal(res.statusCode, 400);
  });

  it('GET /quittance proof accepts the matching network hint', async () => {
    const res = createRes();
    await getQuittanceProof(
      createProofReq(PAID_INVOICE, { network: SERVER_SEGMENT }),
      res
    );
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.network, SERVER_SEGMENT);
  });

  it('GET /quittance proof defaults to the server network without a hint', async () => {
    const res = createRes();
    await getQuittanceProof(createProofReq(PAID_INVOICE), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.network, SERVER_SEGMENT);
  });
});
