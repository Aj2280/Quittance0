import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import {
  FilePaymentMonitorCheckpointStore,
  PostgresPaymentMonitorCheckpointStore,
} from '../src/services/payment-monitor-checkpoint';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(directory =>
    rm(directory, { recursive: true, force: true })
  ));
});

describe('payment monitor checkpoint stores', () => {
  it('atomically persists a file cursor across store instances', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'quittance-monitor-'));
    temporaryDirectories.push(directory);
    const file = path.join(directory, 'cursor.json');
    const firstProcess = new FilePaymentMonitorCheckpointStore(file);
    await firstProcess.save({
      account: 'GSELLER',
      network: 'TESTNET',
      cursor: '101',
      ledger: 55,
    });

    const restartedProcess = new FilePaymentMonitorCheckpointStore(file);
    const checkpoint = await restartedProcess.load('GSELLER', 'TESTNET');
    assert.equal(checkpoint?.cursor, '101');
    assert.equal(checkpoint?.ledger, 55);
    const raw = await readFile(file, 'utf8');
    assert.doesNotThrow(() => JSON.parse(raw));
  });

  it('upserts and normalizes a Postgres checkpoint', async () => {
    const calls: Array<{ sql: string; params?: any[] }> = [];
    const database = {
      async query(sql: string, params?: any[]) {
        calls.push({ sql, params });
        if (sql.includes('SELECT account')) {
          return {
            rows: [{
              account: 'GSELLER',
              network: 'TESTNET',
              cursor: '202',
              ledger: '77',
              updated_at: '2026-09-13T00:00:00.000Z',
            }],
          };
        }
        return { rows: [], rowCount: 1 };
      },
    };
    const store = new PostgresPaymentMonitorCheckpointStore(database);

    await store.save({ account: 'GSELLER', network: 'TESTNET', cursor: '202', ledger: 77 });
    const checkpoint = await store.load('GSELLER', 'TESTNET');

    assert.match(calls[0].sql, /ON CONFLICT \(account, network\) DO UPDATE/);
    assert.deepEqual(calls[0].params, ['GSELLER', 'TESTNET', '202', 77]);
    assert.equal(checkpoint?.ledger, 77);
    assert.equal(checkpoint?.updatedAt.toISOString(), '2026-09-13T00:00:00.000Z');
  });
});
