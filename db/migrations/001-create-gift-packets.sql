CREATE TABLE IF NOT EXISTS "gift-packets" (
  packet_id TEXT NOT NULL,
  creator_address TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  contract_address TEXT NOT NULL,
  create_tx_hash TEXT NOT NULL,
  created_block_number BIGINT NOT NULL,
  created_block_timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (chain_id, contract_address, packet_id),
  UNIQUE (chain_id, create_tx_hash),
  CHECK (creator_address = LOWER(creator_address)),
  CHECK (contract_address = LOWER(contract_address))
);

CREATE INDEX IF NOT EXISTS "gift-packets-creator-created-idx"
  ON "gift-packets" (creator_address, created_block_timestamp DESC);
