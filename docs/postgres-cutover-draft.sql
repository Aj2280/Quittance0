-- REVIEW DRAFT ONLY. The executable schema is db/schema.sql.
-- IDs and memos are supplied by the snapshot importer and never regenerated.
CREATE TABLE invoices (
  id UUID PRIMARY KEY,
  seller_public_key VARCHAR(56) NOT NULL,
  seller_name VARCHAR(255),
  seller_email VARCHAR(255),
  amount NUMERIC(20, 7) NOT NULL CHECK (amount > 0),
  asset_code VARCHAR(12) NOT NULL DEFAULT 'XLM',
  asset_issuer VARCHAR(56),
  memo TEXT NOT NULL UNIQUE,
  description TEXT,
  customer_name VARCHAR(255),
  customer_email VARCHAR(255),
  status VARCHAR(20) NOT NULL
    CHECK (status IN ('PENDING', 'PAID', 'EXPIRED', 'CANCELLED')),
  payment_tx_hash VARCHAR(64),
  payer_public_key VARCHAR(56),
  payer_name VARCHAR(255),
  payer_email VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  metadata JSONB,
  CHECK (
    (status = 'PAID' AND payment_tx_hash IS NOT NULL AND paid_at IS NOT NULL)
    OR status <> 'PAID'
  )
);

CREATE UNIQUE INDEX invoices_payment_tx_hash_unique
  ON invoices(payment_tx_hash)
  WHERE payment_tx_hash IS NOT NULL;
CREATE INDEX invoices_seller_created_at
  ON invoices(seller_public_key, created_at DESC);
CREATE INDEX invoices_pending_expiry
  ON invoices(expires_at)
  WHERE status = 'PENDING';
