/**
 * Issue #520 guard: amount values on the payment path must be parsed and
 * compared as integer stroops through safe-amount-compare. This suite reads the
 * audited sources and fails if float formatting, float parsing, or direct
 * equality on a `.amount` member creeps back in.
 *
 * Deliberately not scanned: safe-amount-compare.ts itself (the helper), stats
 * counters (Number(row.total_invoices) counts rows, not money), and type or
 * positivity guards such as `typeof inv.amount !== 'number'`.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const AUDITED_FILES = [
  'src/routes/invoice.handlers.ts',
  'src/services/cutover.service.ts',
  'src/services/invoice.service.ts',
  'src/services/payment-monitor.service.ts',
  'src/services/payment-verification.ts',
  'src/services/quittance-proof.service.ts',
  'src/utils/qr-payment-payload.ts',
  // frontend payment path: display, monitor notification, proof, and the
  // amount string handed to the Stellar SDK
  '../frontend/app/pay/[id]/page.tsx',
  '../frontend/app/invoice/[id]/page.tsx',
  '../frontend/app/page.tsx',
  '../frontend/components/PaymentReceipt.tsx',
  '../frontend/lib/payment-monitor.ts',
  '../frontend/lib/quittance-proof.ts',
  '../frontend/lib/stellar.ts',
];

const FORBIDDEN: Array<{ pattern: RegExp; why: string }> = [
  {
    pattern: /\.toFixed\s*\(/,
    why: 'toFixed formats through a float; use canonicalAmount/formatStroops',
  },
  {
    pattern: /\bparseFloat\s*\(/,
    why: 'parseFloat re-introduces IEEE-754 drift; use parseStroops',
  },
  {
    // Number(amount), Number(invoice.amount), Number(row.amount) — but
    // Number(canonicalAmount(...)) stays legal: the helper call breaks the
    // token chain right after the opening paren.
    pattern: /Number\s*\(\s*[\w.]*\bamount\b/,
    why: 'Number() coerces an amount to a float; use parseStroops/canonicalAmount',
  },
  {
    // invoice.amount === expected, op.amount == x — equality on amounts must
    // go through compareAmounts so '10' and '10.0000000' stay equal.
    pattern: /\.amount\s*[!=]==/,
    why: 'direct equality on .amount misses stroop equivalence; use compareAmounts',
  },
];

describe('stroop-amount paths — no float reintroduction', () => {
  for (const file of AUDITED_FILES) {
    const source = readFileSync(join(ROOT, file), 'utf8');

    for (const { pattern, why } of FORBIDDEN) {
      it(`${file} — ${pattern.source}`, () => {
        const hit = source.split('\n').findIndex((line) => {
          const code = line.replace(/\/\/.*$/, ''); // comments may name the banned call
          if (/\btypeof\b/.test(code) && /[!=]==\s*'(?:string|number|bigint|boolean|object|undefined)'/.test(code)) {
            return false; // typeof x.amount !== 'number' is a shape guard, not a value compare
          }
          return pattern.test(code);
        });
        assert.equal(hit, -1, `${file}:${hit + 1} — ${why}`);
      });
    }
  }
});
