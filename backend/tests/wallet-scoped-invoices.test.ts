import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MemoryInvoiceStorage } from '../src/storage/memory-invoice-storage';
import { InvoiceMemoryService } from '../src/services/invoice-memory.service';
import { MemoryStorage } from '../src/storage/memory-storage';

const ALICE = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';
const BOB = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H';
const CAROL = 'GCAROL000000000000000000000000000000000000000000000';

function input(sellerPublicKey: string, overrides: Record<string, unknown> = {}) {
  return {
    sellerPublicKey,
    amount: 25,
    assetCode: 'XLM',
    memo: 'QTN-SCOPE',
    description: 'wallet scoping',
    ...overrides,
  } as any;
}

async function seed() {
  // A fresh MemoryStorage per case: the default one is a module singleton
  // shared by every test in the process, so counts would leak between them.
  const storage = new MemoryInvoiceStorage(new InvoiceMemoryService(new MemoryStorage()));
  const alice = [
    await storage.createInvoice(input(ALICE)),
    await storage.createInvoice(input(ALICE, { amount: 40 })),
  ];
  const bob = [await storage.createInvoice(input(BOB, { amount: 10 }))];
  return { storage, alice, bob };
}

describe('wallet-scoped invoice reads', () => {
  it('returns only the requesting seller rows', async () => {
    const { storage, alice } = await seed();

    const rows = await storage.getInvoicesBySeller(ALICE);

    assert.equal(rows.length, 2);
    assert.deepEqual(
      rows.map((row) => row.id).sort(),
      alice.map((row) => row.id).sort()
    );
    assert.ok(rows.every((row) => row.sellerPublicKey === ALICE));
  });

  it('shows a switched wallet none of the previous wallet rows', async () => {
    const { storage, alice, bob } = await seed();

    const firstWallet = await storage.getInvoicesBySeller(ALICE);
    const secondWallet = await storage.getInvoicesBySeller(BOB);

    assert.equal(firstWallet.length, 2);
    assert.equal(secondWallet.length, 1);
    assert.equal(secondWallet[0].id, bob[0].id);
    for (const row of alice) {
      assert.ok(!secondWallet.some((other) => other.id === row.id));
    }
  });

  it('counts stats per wallet instead of across wallets', async () => {
    const { storage } = await seed();

    const [aliceStats] = await storage.getInvoiceStats(ALICE);
    const [bobStats] = await storage.getInvoiceStats(BOB);

    assert.equal(aliceStats.total_invoices, 2);
    assert.equal(aliceStats.pending_invoices, 2);
    assert.equal(bobStats.total_invoices, 1);
    assert.equal(bobStats.pending_invoices, 1);
    assert.deepEqual(aliceStats.revenue_by_asset, {});
  });

  it('returns nothing at all for a wallet that has no invoices', async () => {
    const { storage } = await seed();

    assert.deepEqual(await storage.getInvoicesBySeller(CAROL), []);
    const [carolStats] = await storage.getInvoiceStats(CAROL);
    assert.equal(carolStats.total_invoices, 0);
    assert.equal(carolStats.pending_invoices, 0);
  });
});
