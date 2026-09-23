import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const TESTNET_NETWORK = 'TESTNET';
export const DEFAULT_HORIZON_URL = 'https://horizon-testnet.stellar.org';

export function normalizeApiUrl(value) {
  const url = new URL(String(value || '').trim());
  const pathname = url.pathname.replace(/\/+$/, '');
  if (url.protocol !== 'https:' || !pathname.endsWith('/api')) {
    throw new Error('EVIDENCE_API_URL must be an HTTPS URL ending in /api');
  }
  url.pathname = pathname;
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

export function evidenceConfig(env, args = []) {
  if (!env.EVIDENCE_API_URL) throw new Error('EVIDENCE_API_URL is required');
  if (!env.EVIDENCE_SELLER_PUBLIC_KEY) {
    throw new Error('EVIDENCE_SELLER_PUBLIC_KEY is required');
  }
  if (!env.EVIDENCE_PAYER_SECRET) throw new Error('EVIDENCE_PAYER_SECRET is required');

  const network = (env.EVIDENCE_NETWORK || TESTNET_NETWORK).toUpperCase();
  if (network !== TESTNET_NETWORK) {
    throw new Error('Evidence automation is restricted to Stellar TESTNET');
  }

  const amount = env.EVIDENCE_AMOUNT || '0.1000000';
  if (!/^\d+(\.\d{1,7})?$/.test(amount) || Number(amount) <= 0) {
    throw new Error('EVIDENCE_AMOUNT must be a positive XLM amount with at most 7 decimals');
  }

  const writeEvidence = args.includes('--write-evidence');
  if (writeEvidence && (!env.EVIDENCE_FRONTEND_URL || !env.EVIDENCE_SOURCE_REVISION)) {
    throw new Error('EVIDENCE_FRONTEND_URL and EVIDENCE_SOURCE_REVISION are required with --write-evidence');
  }

  return {
    apiUrl: normalizeApiUrl(env.EVIDENCE_API_URL),
    frontendUrl: env.EVIDENCE_FRONTEND_URL?.replace(/\/+$/, ''),
    sellerPublicKey: env.EVIDENCE_SELLER_PUBLIC_KEY,
    payerSecret: env.EVIDENCE_PAYER_SECRET,
    network,
    horizonUrl: env.EVIDENCE_HORIZON_URL || DEFAULT_HORIZON_URL,
    amount,
    sourceRevision: env.EVIDENCE_SOURCE_REVISION,
    outputPath: env.EVIDENCE_OUTPUT || '../artifacts/evidence-smoke.json',
    writeEvidence,
  };
}

function replaceRow(markdown, label, value) {
  const lines = markdown.split('\n');
  const prefix = '| ' + label + ' |';
  const index = lines.findIndex(line => line.startsWith(prefix));
  if (index < 0) throw new Error('EVIDENCE.md row not found: ' + label);
  lines[index] = '| ' + label + ' | ' + value + ' |';
  return lines.join('\n');
}

export function updateEvidenceMarkdown(markdown, artifact) {
  let updated = markdown;
  if (artifact.frontendUrl) {
    updated = replaceRow(updated, 'Frontend', String.fromCharCode(96) + artifact.frontendUrl + String.fromCharCode(96));
  }
  updated = replaceRow(updated, 'API liveness', String.fromCharCode(96) + artifact.apiUrl + '/health' + String.fromCharCode(96));
  updated = replaceRow(updated, 'API readiness', String.fromCharCode(96) + artifact.apiUrl + '/ready' + String.fromCharCode(96));
  if (artifact.sourceRevision) {
    updated = replaceRow(updated, 'Source revision', String.fromCharCode(96) + artifact.sourceRevision + String.fromCharCode(96));
  }
  updated = replaceRow(updated, 'Captured at (UTC)', String.fromCharCode(96) + artifact.capturedAt + String.fromCharCode(96));

  const lines = updated.split('\n');
  const index = lines.findIndex(line => line.startsWith('| 1 (required) |'));
  if (index < 0) throw new Error('EVIDENCE.md required transaction row not found');
  const tick = String.fromCharCode(96);
  lines[index] = '| 1 (required) | ' + tick + artifact.amount + tick +
    ' | XLM | ' + tick + artifact.memo + tick + ' | ' + tick + artifact.txHash +
    tick + ' | [Stellar Expert](' + artifact.explorerUrl + ') |';
  return lines.join('\n');
}

export function resolveFromScript(scriptUrl, relativePath) {
  return path.resolve(path.dirname(fileURLToPath(scriptUrl)), relativePath);
}

export function publicArtifact(config, values) {
  return {
    schemaVersion: 1,
    capturedAt: values.capturedAt,
    sourceRevision: config.sourceRevision || null,
    frontendUrl: config.frontendUrl || null,
    apiUrl: config.apiUrl,
    healthUrl: config.apiUrl + '/health',
    readinessUrl: config.apiUrl + '/ready',
    network: TESTNET_NETWORK,
    horizonUrl: config.horizonUrl,
    invoiceId: values.invoiceId,
    // The link the buyer receives; part of the loop the smoke proves.
    payUrl: values.payUrl || null,
    amount: config.amount,
    asset: 'XLM',
    memo: values.memo,
    sellerPublicKey: config.sellerPublicKey,
    payerPublicKey: values.payerPublicKey,
    txHash: values.txHash,
    explorerUrl: 'https://stellar.expert/explorer/testnet/tx/' + values.txHash,
    finalStatus: values.finalStatus,
    checks: values.checks,
  };
}
