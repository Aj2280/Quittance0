import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import * as StellarSdk from '@stellar/stellar-sdk';
import {
  evidenceConfig,
  publicArtifact,
  resolveFromScript,
  updateEvidenceMarkdown,
} from './evidence-lib.mjs';

const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log(`Usage: npm run evidence:smoke -- [--write-evidence]

Required: EVIDENCE_API_URL, EVIDENCE_SELLER_PUBLIC_KEY, EVIDENCE_PAYER_SECRET
For --write-evidence: EVIDENCE_FRONTEND_URL, EVIDENCE_SOURCE_REVISION
Optional: EVIDENCE_AMOUNT, EVIDENCE_HORIZON_URL, EVIDENCE_OUTPUT`);
  process.exit(0);
}

async function main() {
  const config = evidenceConfig(process.env, args);
  const payer = StellarSdk.Keypair.fromSecret(config.payerSecret);
  StellarSdk.Keypair.fromPublicKey(config.sellerPublicKey);
  if (payer.publicKey() === config.sellerPublicKey) {
    throw new Error('Seller and payer must be different Testnet accounts');
  }

  const horizon = new StellarSdk.Horizon.Server(config.horizonUrl);
  const request = async (route, options = {}) => {
    const response = await fetch(config.apiUrl + route, {
      signal: AbortSignal.timeout(20_000),
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      ...options,
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error((options.method || 'GET') + ' ' + route + ' -> ' +
        response.status + ': ' + JSON.stringify(body));
    }
    return body;
  };

  const health = await request('/health');
  if (health.status !== 'ok' || health.network !== 'TESTNET' || health.simulationEnabled) {
    throw new Error('API health must be ok on TESTNET with simulation disabled');
  }
  const readiness = await request('/ready');
  if (readiness.status !== 'ready' || readiness.ready !== true) {
    throw new Error('API readiness did not confirm ready=true');
  }

  await horizon.loadAccount(config.sellerPublicKey);
  const payerAccount = await horizon.loadAccount(payer.publicKey());
  const created = await request('/invoices', {
    method: 'POST',
    body: JSON.stringify({
      amount: Number(config.amount),
      assetCode: 'XLM',
      description: 'SCF evidence ' + new Date().toISOString(),
      sellerPublicKey: config.sellerPublicKey,
      network: 'TESTNET',
    }),
  });
  const invoice = created?.data?.invoice;
  if (!invoice?.id || !invoice?.memo || invoice.status !== 'PENDING') {
    throw new Error('Create invoice did not return a PENDING invoice with id and memo');
  }

  const transaction = new StellarSdk.TransactionBuilder(payerAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET,
  })
    .addOperation(StellarSdk.Operation.payment({
      destination: config.sellerPublicKey,
      asset: StellarSdk.Asset.native(),
      amount: config.amount,
    }))
    .addMemo(StellarSdk.Memo.text(invoice.memo))
    .setTimeout(120)
    .build();
  transaction.sign(payer);
  const submitted = await horizon.submitTransaction(transaction);

  const verified = await request('/invoices/' + invoice.id + '/verify', {
    method: 'POST',
    body: JSON.stringify({ txHash: submitted.hash, network: 'TESTNET' }),
  });
  const finalInvoice = verified?.data;
  if (finalInvoice?.status !== 'PAID' || finalInvoice.paymentTxHash !== submitted.hash) {
    throw new Error('Verify did not return PAID with the submitted transaction hash');
  }

  const reread = await request('/invoices/' + invoice.id);
  if (reread?.data?.status !== 'PAID' || reread.data.paymentTxHash !== submitted.hash) {
    throw new Error('Paid state did not survive a fresh API read');
  }

  const artifact = publicArtifact(config, {
    capturedAt: new Date().toISOString(),
    invoiceId: invoice.id,
    memo: invoice.memo,
    payerPublicKey: payer.publicKey(),
    txHash: submitted.hash,
    finalStatus: reread.data.status,
    checks: {
      health: true,
      readiness: true,
      createdPending: true,
      paymentSubmitted: true,
      verifiedPaid: true,
      rereadPaid: true,
      simulationDisabled: true,
    },
  });

  const outputPath = path.resolve(process.cwd(), config.outputPath);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(artifact, null, 2) + '\n', {
    encoding: 'utf8',
    mode: 0o600,
  });

  if (config.writeEvidence) {
    const evidencePath = resolveFromScript(import.meta.url, '../../EVIDENCE.md');
    const markdown = await readFile(evidencePath, 'utf8');
    await writeFile(evidencePath, updateEvidenceMarkdown(markdown, artifact), 'utf8');
  }

  console.log('Evidence smoke passed: ' + artifact.explorerUrl);
  console.log('Artifact: ' + outputPath);
  if (config.writeEvidence) console.log('Updated EVIDENCE.md');
}

main().catch(error => {
  console.error('Evidence smoke failed: ' + (error?.message || error));
  process.exit(1);
});
