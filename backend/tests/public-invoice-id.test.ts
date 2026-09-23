import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  InvoiceIdCollisionError,
  MemoCollisionError,
} from '../src/domain/payment-attribution';
import { MemoryStorage } from '../src/storage/memory-storage';
import { InvoiceMemoryService } from '../src/services/invoice-memory.service';
import { InvoiceService } from '../src/services/invoice.service';
import { UUID_V4_REGEX } from '../src/utils/memory-public-id';

const SELLER = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';
const ID_A = '11111111-2222-4333-8444-555555555555';
const ID_B = '66666666-7777-4888-8999-000000000000';

const input = () => ({
  sellerPublicKey: SELLER,
  amount: 25,
  assetCode: 'XLM',
});

/** A fake `Queryable` whose INSERT raises the given pg error once. */
function failingInsertDb(failures: { code: string; constraint?: string }[]) {
  const rows: Record<string, any>[] = [];
  const calls: any[][] = [];
  return {
    rows,
    calls,
    async query(_text: string, params: any[] = []) {
      calls.push(params);
      const failure = failures.shift();
      if (failure) {
        const err: any = new Error('duplicate key value violates unique constraint');
        err.code = failure.code;
        if (failure.constraint) err.constraint = failure.constraint;
        throw err;
      }
      const row = {
        id: params[0],
        seller_public_key: params[1],
        amount: params[4],
        asset_code: params[5],
        memo: params[7],
        status: params[11],
        created_at: new Date(),
        expires_at: params[12],
      };
      rows.push(row);
      return { rows: [row], rowCount: 1 };
    },
  };
}

describe('public invoice ids (issue #512)', () => {
  it('created ids are unguessable UUIDv4, not sequential', async () => {
    const service = new InvoiceMemoryService(new MemoryStorage());
    const first = await service.createInvoice(input());
    const second = await service.createInvoice(input());

    assert.match(first.id, UUID_V4_REGEX);
    assert.match(second.id, UUID_V4_REGEX);
    assert.notEqual(first.id, second.id);
  });

  it('a drawn id that already exists is redrawn instead of overwriting', async () => {
    const storage = new MemoryStorage();
    const draws = [ID_A, ID_B, ID_A];
    const service = new InvoiceMemoryService(storage, undefined, () => draws.shift() as string);

    await service.createInvoice(input());
    const second = await service.createInvoice(input());

    assert.equal(second.id, ID_B, 'the colliding draw must be skipped');
    assert.equal(storage.getInvoiceById(ID_A)?.id, ID_A, 'the first invoice survives');
  });

  it('refuses creation when every drawn id collides', async () => {
    const storage = new MemoryStorage();
    const service = new InvoiceMemoryService(storage, undefined, () => ID_A);

    await service.createInvoice(input());
    await assert.rejects(() => service.createInvoice(input()), InvoiceIdCollisionError);
  });

  it('the storage layer refuses an id overwrite directly', () => {
    const storage = new MemoryStorage();
    storage.createInvoice({ id: ID_A, sellerPublicKey: SELLER, amount: 1, memo: 'INV-ONE' });

    assert.throws(
      () => storage.createInvoice({ id: ID_A, sellerPublicKey: SELLER, amount: 2, memo: 'INV-TWO' }),
      InvoiceIdCollisionError
    );
    assert.equal(storage.getInvoiceById(ID_A)?.amount, 1, 'the original invoice is untouched');
  });

  it('a restarted service over the same storage keeps the same id', async () => {
    const storage = new MemoryStorage();
    const first = await new InvoiceMemoryService(storage).createInvoice(input());

    const restarted = new InvoiceMemoryService(storage);
    const read = await restarted.getInvoiceById(first.id);

    assert.equal(read?.id, first.id);
    assert.equal(read?.sellerPublicKey, SELLER);
  });

  it('postgres path retries once on a primary-key 23505 then succeeds', async () => {
    const db = failingInsertDb([{ code: '23505', constraint: 'invoices_pkey' }]);
    const service = new InvoiceService(db as any);

    const invoice = await service.createInvoice(input() as any);
    assert.match(invoice.id, UUID_V4_REGEX);
    assert.equal(db.calls.length, 2, 'one redraw after the colliding insert');
  });

  it('postgres path refuses when every insert collides on the id', async () => {
    const db = failingInsertDb([
      { code: '23505', constraint: 'invoices_pkey' },
      { code: '23505', constraint: 'invoices_pkey' },
    ]);
    const service = new InvoiceService(db as any);

    await assert.rejects(() => service.createInvoice(input() as any), InvoiceIdCollisionError);
    assert.equal(db.calls.length, 2);
  });

  it('a memo unique-violation is not misreported as an id collision', async () => {
    const db = failingInsertDb([{ code: '23505', constraint: 'invoices_memo_key' }]);
    const service = new InvoiceService(db as any);

    await assert.rejects(() => service.createInvoice(input() as any), MemoCollisionError);
    assert.equal(db.calls.length, 1, 'memo collisions do not redraw the id');
  });
});
