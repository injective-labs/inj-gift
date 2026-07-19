import { Pool } from "pg";

const globalForGiftDb = globalThis as typeof globalThis & {
  giftDbPool?: Pool;
};

export function getGiftPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  return (globalForGiftDb.giftDbPool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
  }));
}
