import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Queryable } from './invoice.service';

export interface PaymentMonitorCheckpoint {
  account: string;
  network: string;
  cursor: string;
  ledger?: number;
  updatedAt: Date;
}

export interface PaymentMonitorCheckpointStore {
  load(account: string, network: string): Promise<PaymentMonitorCheckpoint | null>;
  save(checkpoint: Omit<PaymentMonitorCheckpoint, 'updatedAt'>): Promise<void>;
}

export class PostgresPaymentMonitorCheckpointStore implements PaymentMonitorCheckpointStore {
  constructor(private readonly db: Queryable) {}

  async load(account: string, network: string): Promise<PaymentMonitorCheckpoint | null> {
    const result = await this.db.query(
      `SELECT account, network, cursor, ledger, updated_at
       FROM payment_monitor_checkpoints
       WHERE account = $1 AND network = $2`,
      [account, network]
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      account: row.account,
      network: row.network,
      cursor: row.cursor,
      ledger: row.ledger == null ? undefined : Number(row.ledger),
      updatedAt: new Date(row.updated_at),
    };
  }

  async save(checkpoint: Omit<PaymentMonitorCheckpoint, 'updatedAt'>): Promise<void> {
    await this.db.query(
      `INSERT INTO payment_monitor_checkpoints (account, network, cursor, ledger, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (account, network) DO UPDATE
       SET cursor = EXCLUDED.cursor, ledger = EXCLUDED.ledger, updated_at = NOW()`,
      [checkpoint.account, checkpoint.network, checkpoint.cursor, checkpoint.ledger ?? null]
    );
  }
}

type CheckpointFile = Record<string, {
  account: string;
  network: string;
  cursor: string;
  ledger?: number;
  updatedAt: string;
}>;

/**
 * Durable checkpoint option for the in-memory MVP. Invoice data still follows
 * the MVP's own persistence policy; this store only prevents Horizon gaps when
 * the monitor reconnects or the process restarts.
 */
export class FilePaymentMonitorCheckpointStore implements PaymentMonitorCheckpointStore {
  constructor(private readonly filePath: string) {}

  private key(account: string, network: string): string {
    return `${network}:${account}`;
  }

  private async read(): Promise<CheckpointFile> {
    try {
      return JSON.parse(await fs.readFile(this.filePath, 'utf8')) as CheckpointFile;
    } catch (error: any) {
      if (error?.code === 'ENOENT') return {};
      throw error;
    }
  }

  async load(account: string, network: string): Promise<PaymentMonitorCheckpoint | null> {
    const value = (await this.read())[this.key(account, network)];
    return value ? { ...value, updatedAt: new Date(value.updatedAt) } : null;
  }

  async save(checkpoint: Omit<PaymentMonitorCheckpoint, 'updatedAt'>): Promise<void> {
    const values = await this.read();
    values[this.key(checkpoint.account, checkpoint.network)] = {
      ...checkpoint,
      updatedAt: new Date().toISOString(),
    };
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
    await fs.writeFile(temporaryPath, `${JSON.stringify(values, null, 2)}\n`, 'utf8');
    await fs.rename(temporaryPath, this.filePath);
  }
}

