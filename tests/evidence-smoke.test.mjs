import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import {
  evidenceConfig,
  publicArtifact,
  updateEvidenceMarkdown,
} from '../backend/scripts/evidence-lib.mjs';

const baseEnv = {
  EVIDENCE_API_URL: 'https://api.example/api/',
  EVIDENCE_FRONTEND_URL: 'https://app.example/',
  EVIDENCE_SELLER_PUBLIC_KEY: 'GSELLER',
  EVIDENCE_PAYER_SECRET: 'SPAYER',
  EVIDENCE_NETWORK: 'TESTNET',
  EVIDENCE_AMOUNT: '0.1000000',
  EVIDENCE_SOURCE_REVISION: 'abc123',
};

function artifact() {
  const config = evidenceConfig(baseEnv, ['--write-evidence']);
  return publicArtifact(config, {
    capturedAt: '2026-09-13T12:00:00.000Z',
    invoiceId: 'invoice-id',
    memo: 'Q-EVIDENCE',
    payerPublicKey: 'GPAYER',
    txHash: 'a'.repeat(64),
    finalStatus: 'PAID',
    payUrl: 'https://app.example/pay/invoice-id',
    checks: {
      health: true,
      createdPending: true,
      payLinkReturned: true,
      verifiedPaid: true,
      rereadPaid: true,
      negativeVerifyRejected: true,
    },
  });
}

describe('evidence smoke configuration', () => {
  it('normalizes URLs and is Testnet-only', () => {
    const config = evidenceConfig(baseEnv, ['--write-evidence']);
    assert.equal(config.apiUrl, 'https://api.example/api');
    assert.equal(config.frontendUrl, 'https://app.example');
    assert.equal(config.writeEvidence, true);
    assert.throws(
      () => evidenceConfig({ ...baseEnv, EVIDENCE_NETWORK: 'PUBLIC' }),
      /restricted to Stellar TESTNET/
    );
    assert.throws(
      () => evidenceConfig({ ...baseEnv, EVIDENCE_API_URL: 'http://api.example/api' }),
      /HTTPS URL ending in \/api/
    );
    assert.throws(
      () => evidenceConfig({ ...baseEnv, EVIDENCE_SOURCE_REVISION: '' }, ['--write-evidence']),
      /required with --write-evidence/
    );
  });

  it('validates the exact XLM amount format', () => {
    assert.throws(
      () => evidenceConfig({ ...baseEnv, EVIDENCE_AMOUNT: '1.00000001' }),
      /at most 7 decimals/
    );
    assert.throws(
      () => evidenceConfig({ ...baseEnv, EVIDENCE_AMOUNT: '0' }),
      /positive XLM/
    );
  });
});

describe('evidence artifacts', () => {
  it('contains reviewer fields without the payer secret', () => {
    const output = artifact();
    const serialized = JSON.stringify(output);
    assert.equal(output.finalStatus, 'PAID');
    assert.equal(output.explorerUrl, 'https://stellar.expert/explorer/testnet/tx/' + 'a'.repeat(64));
    assert.equal(serialized.includes(baseEnv.EVIDENCE_PAYER_SECRET), false);
  });

  it('records the pay link the buyer receives', () => {
    // The loop is create -> pay link -> verify -> PAID, so an artifact without
    // the link does not evidence the middle step (issue #429).
    const output = artifact();
    assert.equal(output.payUrl, 'https://app.example/pay/invoice-id');
  });

  it('records that a second invoice was refused the first invoice transaction', () => {
    // Without this check a passing run would also pass if verify ignored the
    // memo entirely, because the happy path never asks verify to say no.
    const output = artifact();
    assert.equal(output.checks.negativeVerifyRejected, true);
  });

  it('updates the existing EVIDENCE.md tables without creating another guide', async () => {
    const template = await readFile(new URL('../EVIDENCE.md', import.meta.url), 'utf8');
    const updated = updateEvidenceMarkdown(template, artifact());
    assert.match(updated, /\| Frontend \| `https:\/\/app\.example` \|/);
    assert.match(updated, /\| API liveness \| `https:\/\/api\.example\/api\/health` \|/);
    assert.match(updated, /\| Source revision \| `abc123` \|/);
    assert.match(updated, /\| 1 \(required\) \| `0\.1000000` \| XLM \| `Q-EVIDENCE`/);
    assert.match(updated, new RegExp('stellar\\.expert/explorer/testnet/tx/' + 'a'.repeat(64)));
  });
});
