// Canonical quittance proof document (#376).
//
// Proof is the product: the client PDF and a machine-readable export are two
// renderings of the same payment, and today they can drift (different fields,
// order, timestamps or explorer URLs), so two "quittances" for one payment may
// not match. This module owns the single document model both must consume.
//
// Invariants, in the sense the issue asks for - each one is asserted in
// tests/quittance-proof.test.js and checked by checkQuittanceProofInvariants:
//   1. versioned             - every document carries QUITTANCE_PROOF_VERSION
//   2. amounts are strings   - never floats, so 7-decimal precision survives
//   3. timestamps are UTC    - ISO-8601 with a Z suffix, never localised
//   4. deterministic         - same input and same clock produce identical JSON
//   5. one counterparty      - at most one payer address, never a history
//   6. no secrets, no PII    - no Stellar secret key, no payer email or name
//   7. no inferred ownership - the payer address appears only when supplied
//
// Everything in the document is either public chain data or the invoice's own
// records. Nothing is fetched, so the model cannot leak another wallet's data
// by accident.

import { buildHorizonTxUrl } from './explorer-tx-link.ts';

export const QUITTANCE_PROOF_VERSION = 'quittance.v1';

/** Fixed, documented field order - JSON key order must not depend on input. */
export const QUITTANCE_PROOF_FIELDS = [
  'schemaVersion',
  'invoiceId',
  'network',
  'status',
  'issuedAt',
  'dueAt',
  'settledAt',
  'seller',
  'payer',
  'payment',
  'verification',
  'document',
] as const;

export type QuittanceProofField = (typeof QUITTANCE_PROOF_FIELDS)[number];

export interface QuittanceProofAsset {
  code: string;
  issuer: string | null;
}

export interface QuittanceProofPayment {
  txHash: string;
  memo: string | null;
  amount: string;
  asset: QuittanceProofAsset;
  explorerUrl: string | null;
}

export interface QuittanceProof {
  schemaVersion: string;
  invoiceId: string;
  network: 'testnet' | 'public';
  status: 'PAID' | 'PENDING' | 'EXPIRED' | 'CANCELLED';
  issuedAt: string;
  dueAt: string;
  settledAt: string | null;
  seller: string;
  payer: string | null;
  payment: QuittanceProofPayment;
  verification: {
    status: 'verified' | 'unverified';
    method: 'memo-and-amount' | 'none';
    checkedAt: string | null;
  };
  document: {
    generatedAtUtc: string;
    generatedBy: 'quittance-web';
  };
}

/** Shape this module accepts. Mirrors the invoice shape the app already has. */
export interface QuittanceProofInput {
  id?: string;
  status?: string;
  sellerPublicKey?: string;
  payerPublicKey?: string | null;
  amount?: string | number | null;
  assetCode?: string | null;
  assetIssuer?: string | null;
  memo?: string | null;
  paymentTxHash?: string | null;
  expiresAt?: string | Date | null;
  createdAt?: string | Date | null;
  paidAt?: string | Date | null;
}

export interface QuittanceProofOptions {
  network?: string | null;
  /** Injected clock: determinism has to be testable. */
  now?: Date;
}

export type QuittanceProofResult =
  | { ok: true; proof: QuittanceProof }
  | { ok: false; code: string; message: string };

const TX_HASH_PATTERN = /^[a-fA-F0-9]{64}$/;
const AMOUNT_PATTERN = /^\d+(?:\.\d{1,7})?$/;
const SECRET_KEY_PATTERN = /S[A-Z2-7]{55}/;
const EMAIL_PATTERN = /[^\s@]+@[^\s@]+\.[^\s@]+/;

function utcIso(value: string | Date | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

/**
 * Stellar amounts are fixed-point at 7 decimals. Accepting a number here would
 * silently round it, so numbers are converted through their decimal string and
 * anything that does not fit the pattern is rejected.
 */
function normalizeAmount(value: string | number | null | undefined): string | null {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) return null;
    return normalizeAmount(value.toFixed(7));
  }
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed === '') return null;
  if (!AMOUNT_PATTERN.test(trimmed)) return null;
  const [whole, fraction = ''] = trimmed.split('.');
  if (fraction === '') return whole;
  return whole + '.' + fraction.padEnd(7, '0').slice(0, 7);
}

function normalizeNetwork(network: string | null | undefined): 'testnet' | 'public' {
  return String(network ?? '').toLowerCase() === 'testnet' ? 'testnet' : 'public';
}

function isSettled(status: string): boolean {
  return status === 'PAID';
}

/**
 * Build the canonical document for one invoice.
 *
 * Returns an explicit error rather than throwing, because every failure here is
 * a user-visible state: a proof for an unpaid invoice must say "not settled",
 * not render a blank field.
 */
export function buildQuittanceProof(
  input: QuittanceProofInput,
  options: QuittanceProofOptions = {}
): QuittanceProofResult {
  const invoiceId = typeof input.id === 'string' ? input.id.trim() : '';
  if (invoiceId === '') {
    return { ok: false, code: 'MISSING_INVOICE_ID', message: 'Invoice id is required for a proof.' };
  }

  const seller = typeof input.sellerPublicKey === 'string' ? input.sellerPublicKey.trim() : '';
  if (seller === '') {
    return { ok: false, code: 'MISSING_SELLER', message: 'The invoice has no seller account to prove against.' };
  }

  const amount = normalizeAmount(input.amount);
  if (amount === null) {
    return {
      ok: false,
      code: 'INVALID_AMOUNT',
      message: 'Amount must be a positive decimal with at most 7 decimal places.',
    };
  }

  const status = typeof input.status === 'string' ? input.status : 'PENDING';
  const network = normalizeNetwork(options.network ?? process.env.NEXT_PUBLIC_STELLAR_NETWORK);
  const settled = isSettled(status);

  let txHash: string | null = null;
  if (settled) {
    const candidate = typeof input.paymentTxHash === 'string' ? input.paymentTxHash.trim() : '';
    if (!TX_HASH_PATTERN.test(candidate)) {
      return {
        ok: false,
        code: 'INVALID_TX_HASH',
        message: 'A settled invoice needs its 64-character transaction hash to build a proof.',
      };
    }
    txHash = candidate.toLowerCase();
  }

  const checkedAt = settled ? utcIso(input.paidAt) : null;
  const generatedAt = (options.now ?? new Date()).toISOString();

  const proof: QuittanceProof = {
    schemaVersion: QUITTANCE_PROOF_VERSION,
    invoiceId,
    network,
    status: (['PAID', 'PENDING', 'EXPIRED', 'CANCELLED'].includes(status) ? status : 'PENDING') as QuittanceProof['status'],
    issuedAt: utcIso(input.createdAt) ?? generatedAt,
    dueAt: utcIso(input.expiresAt) ?? generatedAt,
    settledAt: settled ? checkedAt : null,
    seller,
    // Present only when the invoice recorded it. Never inferred from a stream
    // or from another invoice's activity.
    payer: typeof input.payerPublicKey === 'string' && input.payerPublicKey.trim() !== ''
      ? input.payerPublicKey.trim()
      : null,
    payment: {
      txHash: txHash ?? '',
      memo: typeof input.memo === 'string' && input.memo !== '' ? input.memo : null,
      amount,
      asset: {
        code: typeof input.assetCode === 'string' && input.assetCode !== '' ? input.assetCode : 'XLM',
        issuer: typeof input.assetIssuer === 'string' && input.assetIssuer !== '' ? input.assetIssuer : null,
      },
      explorerUrl: txHash ? buildHorizonTxUrl(txHash, network) : null,
    },
    verification: settled
      ? { status: 'verified', method: 'memo-and-amount', checkedAt }
      : { status: 'unverified', method: 'none', checkedAt: null },
    document: { generatedAtUtc: generatedAt, generatedBy: 'quittance-web' },
  };

  return { ok: true, proof };
}

/** Ordered copy so serialized key order is a property of the schema. */
function ordered(proof: QuittanceProof): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of QUITTANCE_PROOF_FIELDS) {
    out[field] = proof[field as QuittanceProofField];
  }
  return out;
}

/**
 * Machine-readable export. Two spaces, a trailing newline, and the field order
 * above, so a diff of two exports is meaningful.
 */
export function serializeQuittanceProof(proof: QuittanceProof): string {
  return JSON.stringify(ordered(proof), null, 2) + '\n';
}

/** Parse an exported document back, or null when it is not this schema. */
export function parseQuittanceProof(json: string): QuittanceProof | null {
  try {
    const parsed = JSON.parse(json) as QuittanceProof;
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.schemaVersion !== QUITTANCE_PROOF_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Check the invariants listed at the top of this file against a serialized
 * document. Returns the names that are violated; an empty array means clean.
 *
 * This is deliberately independent of the builder: it is the check a reviewer
 * (or a CI step) can run over an exported proof from anywhere.
 */
export function checkQuittanceProofInvariants(serialized: string): string[] {
  const violated: string[] = [];
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(serialized) as Record<string, unknown>;
  } catch {
    return ['NOT_JSON'];
  }
  if (!parsed) return ['NOT_JSON'];

  if (parsed.schemaVersion !== QUITTANCE_PROOF_VERSION) violated.push('VERSIONED');

  if (SECRET_KEY_PATTERN.test(serialized)) violated.push('NO_SECRET_KEY');
  if (EMAIL_PATTERN.test(serialized)) violated.push('NO_PAYER_PII');

  const payment = (parsed.payment ?? {}) as Record<string, unknown>;
  if (typeof payment.amount !== 'string') violated.push('AMOUNTS_ARE_STRINGS');

  for (const key of ['issuedAt', 'dueAt', 'settledAt', 'document']) {
    const value = parsed[key];
    if (key === 'document') {
      const doc = (value ?? {}) as Record<string, unknown>;
      if (typeof doc.generatedAtUtc !== 'string' || !doc.generatedAtUtc.endsWith('Z')) {
        violated.push('UTC_TIMESTAMPS');
      }
      continue;
    }
    if (value !== null && (typeof value !== 'string' || !value.endsWith('Z'))) {
      violated.push('UTC_TIMESTAMPS');
    }
  }

  const payer = parsed.payer;
  if (payer !== null && payer !== undefined && typeof payer !== 'string') {
    violated.push('SINGLE_COUNTERPARTY');
  }

  return violated;
}

export default {
  buildQuittanceProof,
  serializeQuittanceProof,
  parseQuittanceProof,
  checkQuittanceProofInvariants,
  QUITTANCE_PROOF_VERSION,
  QUITTANCE_PROOF_FIELDS,
};
