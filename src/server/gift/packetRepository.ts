export type GiftPacketRecord = {
  packetId: string;
  creatorAddress: string;
  chainId: number;
  contractAddress: string;
  createTxHash: string;
  createdBlockNumber: string;
  createdBlockTimestamp: string;
};

type QueryResult = { rows: unknown[] };

export type GiftQueryable = {
  query: (sql: string, values?: unknown[]) => Promise<QueryResult>;
};

type GiftPacketRow = {
  packet_id: string;
  creator_address: string;
  chain_id: number;
  contract_address: string;
  create_tx_hash: string;
  created_block_number: string | number | bigint;
  created_block_timestamp: string | Date;
};

const normalizeAddress = (address: string) => address.toLowerCase();

const toRecord = (row: GiftPacketRow): GiftPacketRecord => ({
  packetId: row.packet_id,
  creatorAddress: row.creator_address,
  chainId: row.chain_id,
  contractAddress: row.contract_address,
  createTxHash: row.create_tx_hash,
  createdBlockNumber: String(row.created_block_number),
  createdBlockTimestamp:
    row.created_block_timestamp instanceof Date
      ? row.created_block_timestamp.toISOString()
      : row.created_block_timestamp,
});

const columns = `
  packet_id,
  creator_address,
  chain_id,
  contract_address,
  create_tx_hash,
  created_block_number,
  created_block_timestamp
`;

export async function upsertGiftPacket(
  db: GiftQueryable,
  record: GiftPacketRecord,
): Promise<GiftPacketRecord> {
  const normalized = {
    ...record,
    creatorAddress: normalizeAddress(record.creatorAddress),
    contractAddress: normalizeAddress(record.contractAddress),
  };
  const result = await db.query(
    `INSERT INTO "gift-packets" (${columns})
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (chain_id, contract_address, packet_id) DO UPDATE SET
       creator_address = EXCLUDED.creator_address,
       create_tx_hash = EXCLUDED.create_tx_hash,
       created_block_number = EXCLUDED.created_block_number,
       created_block_timestamp = EXCLUDED.created_block_timestamp,
       updated_at = NOW()
     RETURNING ${columns}`,
    [
      normalized.packetId,
      normalized.creatorAddress,
      normalized.chainId,
      normalized.contractAddress,
      normalized.createTxHash,
      normalized.createdBlockNumber,
      normalized.createdBlockTimestamp,
    ],
  );
  return toRecord(result.rows[0] as GiftPacketRow);
}

export async function listGiftPackets(
  db: GiftQueryable,
  creatorAddress: string,
): Promise<GiftPacketRecord[]> {
  const result = await db.query(
    `SELECT ${columns}
     FROM "gift-packets"
     WHERE creator_address = $1
     ORDER BY created_block_timestamp DESC`,
    [normalizeAddress(creatorAddress)],
  );
  return result.rows.map((row) => toRecord(row as GiftPacketRow));
}
