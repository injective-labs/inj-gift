ALTER TABLE "gift-packets"
  ADD COLUMN IF NOT EXISTS share_code TEXT;

DO $$
DECLARE
  packet_row RECORD;
  candidate TEXT;
  alphabet CONSTANT TEXT := '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  index_value INTEGER;
BEGIN
  FOR packet_row IN
    SELECT chain_id, contract_address, packet_id
    FROM "gift-packets"
    WHERE share_code IS NULL
  LOOP
    LOOP
      candidate := '';
      FOR index_value IN 1..8 LOOP
        candidate := candidate || substr(
          alphabet,
          1 + floor(random() * length(alphabet))::INTEGER,
          1
        );
      END LOOP;
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM "gift-packets" WHERE share_code = candidate
      );
    END LOOP;

    UPDATE "gift-packets"
    SET share_code = candidate
    WHERE chain_id = packet_row.chain_id
      AND contract_address = packet_row.contract_address
      AND packet_id = packet_row.packet_id;
  END LOOP;
END $$;

ALTER TABLE "gift-packets"
  ALTER COLUMN share_code SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'gift-packets-share-code-key'
  ) THEN
    ALTER TABLE "gift-packets"
      ADD CONSTRAINT "gift-packets-share-code-key" UNIQUE (share_code);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'gift-packets-share-code-format'
  ) THEN
    ALTER TABLE "gift-packets"
      ADD CONSTRAINT "gift-packets-share-code-format"
      CHECK (share_code ~ '^[1-9A-HJ-NP-Za-km-z]{8}$');
  END IF;
END $$;
